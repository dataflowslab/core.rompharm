"""
Global document generation routes - Simple and clean
Uses only job_id for everything
"""
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional
from bson import ObjectId
from datetime import datetime
import io
import base64

from src.backend.utils.db import get_db
from src.backend.utils.dataflows_docu import DataFlowsDocuClient
from src.backend.routes.auth import verify_token


router = APIRouter(prefix="/api/documents", tags=["documents"])


class GenerateDocumentRequest(BaseModel):
    object_id: str
    template_code: str
    template_name: str


@router.get("/templates")
def get_templates(user = Depends(verify_token)):
    """Get all available templates"""
    try:
        db = get_db()
        client = DataFlowsDocuClient()
        
        if not client.health_check():
            raise HTTPException(status_code=503, detail="Document service unavailable")
        
        config_collection = db['config']
        
        # Get all template codes
        all_template_codes = []
        
        procurement_config = config_collection.find_one({'slug': 'procurement_order'})
        if procurement_config:
            all_template_codes.extend(procurement_config.get('items', []))
        
        stock_request_config = config_collection.find_one({'slug': 'stock_request'})
        if stock_request_config:
            all_template_codes.extend(stock_request_config.get('items', []))
        
        general_config = config_collection.find_one({'slug': 'docu_templates'})
        if general_config:
            all_template_codes.extend(general_config.get('templates', []))
        
        all_template_codes = list(set(all_template_codes))
        
        if not all_template_codes:
            return []
        
        templates = []
        for code in all_template_codes:
            template = client.get_template(code)
            if template:
                name = code
                if template.get('parts') and len(template['parts']) > 0:
                    name = template['parts'][0].get('name', code)
                templates.append({'code': code, 'name': name, 'parts': template.get('parts', [])})
            else:
                templates.append({'code': code, 'name': code, 'parts': []})
        
        return templates
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get templates: {str(e)}")


@router.post("/generate")
def generate_document(
    request: GenerateDocumentRequest,
    user = Depends(verify_token)
):
    """Generate document - returns only job_id"""
    print(f"[DOCUMENT] Generate: object_id={request.object_id}, template={request.template_code}")
    
    db = get_db()
    
    try:
        object_obj_id = ObjectId(request.object_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid object ID")
    
    # Determine type by checking collections
    if db['depo_purchase_orders'].find_one({'_id': object_obj_id}):
        return _generate_procurement_order_document(db, object_obj_id, request, user)
    
    if db['depo_requests'].find_one({'_id': object_obj_id}):
        return _generate_stock_request_document(db, object_obj_id, request, user)

    if db['depo_sales_ordes'].find_one({'_id': object_obj_id}) or db['depo_sales_orders'].find_one({'_id': object_obj_id}):
        return _generate_sales_order_document(db, object_obj_id, request, user)

    raise HTTPException(status_code=404, detail="Object not found")


@router.get("/{doc_id}/download")
def download_document(
    doc_id: str,
    user = Depends(verify_token)
):
    """Download document by document _id or job_id"""
    from src.backend.utils.config import load_config
    
    config = load_config()
    debug_mode = config.get('app', {}).get('debug', False)
    
    print(f"[DOCUMENT] Download request for doc_id: {doc_id}")
    db = get_db()
    
    # Search in all document collections by _id first, then by job_id
    collections = ['depo_procurement_documents', 'depo_stock_request_documents', 'depo_sales_documents']
    
    doc = None
    coll = None
    
    # First try to find by _id (MongoDB ObjectId)
    try:
        obj_id = ObjectId(doc_id)
        for coll_name in collections:
            doc = db[coll_name].find_one({'_id': obj_id})
            if doc:
                coll = db[coll_name]
                print(f"[DOCUMENT] Found by _id in collection: {coll_name}")
                break
    except:
        pass
    
    # If not found by _id, try by job_id
    if not doc:
        for coll_name in collections:
            doc = db[coll_name].find_one({'job_id': doc_id})
            if doc:
                coll = db[coll_name]
                print(f"[DOCUMENT] Found by job_id in collection: {coll_name}")
                break
    
    if not doc:
        print(f"[DOCUMENT] ERROR: Document not found for doc_id: {doc_id}")
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Get the actual job_id from the document
    job_id = doc.get('job_id')
    if not job_id:
        print(f"[DOCUMENT] ERROR: Document has no job_id")
        raise HTTPException(status_code=400, detail="Document has no job_id")
    
    print(f"[DOCUMENT] Document status: {doc.get('status')}, has_cache: {doc.get('document_data') is not None}")
    
    # Check if cached
    if doc.get('document_data'):
        print(f"[DOCUMENT] Serving cached document ({len(doc['document_data'])} chars)")
        try:
            document_bytes = base64.b64decode(doc['document_data'])
            print(f"[DOCUMENT] Decoded to {len(document_bytes)} bytes")
        except Exception as e:
            print(f"[DOCUMENT] ERROR decoding: {e}")
            raise HTTPException(status_code=500, detail="Failed to decode document")
    else:
        print(f"[DOCUMENT] No cache, downloading from service...")

        client = DataFlowsDocuClient()
        if doc.get('status') not in ['done', 'completed']:
            job_status = client.get_job_status(job_id)
            if not job_status:
                print(f"[DOCUMENT] ERROR: Job status not found for job_id={job_id}")
                raise HTTPException(status_code=404, detail="Job not found")

            current_status = job_status.get('status')
            if current_status in ['done', 'completed']:
                coll.update_one(
                    {'job_id': job_id},
                    {'$set': {
                        'status': current_status,
                        'updated_at': datetime.utcnow(),
                        'error': job_status.get('error')
                    }}
                )
            else:
                print(f"[DOCUMENT] ERROR: Document not ready, status={current_status}")
                raise HTTPException(status_code=400, detail=f"Document not ready. Status: {current_status}")

        document_bytes = client.download_document(job_id, debug=debug_mode)
        
        if not document_bytes:
            print(f"[DOCUMENT] ERROR: Failed to download from service")
            if debug_mode:
                print(f"[DOCUMENT DEBUG] job_id: {job_id}")
                print(f"[DOCUMENT DEBUG] doc status in DB: {doc.get('status')}")
                print(f"[DOCUMENT DEBUG] artifact_path: {doc.get('artifact_path')}")
            raise HTTPException(status_code=500, detail="Failed to download document from service")
        
        print(f"[DOCUMENT] Downloaded {len(document_bytes)} bytes, caching...")
        
        coll.update_one(
            {'job_id': job_id},
            {'$set': {
                'document_data': base64.b64encode(document_bytes).decode('utf-8'),
                'updated_at': datetime.utcnow()
            }}
        )
    
    print(f"[DOCUMENT] Returning {len(document_bytes)} bytes as PDF")
    return StreamingResponse(
        io.BytesIO(document_bytes),
        media_type='application/pdf',
        headers={'Content-Disposition': f'attachment; filename="{doc.get("filename", "document.pdf")}"'}
    )


@router.delete("/{job_id}")
def delete_document(
    job_id: str,
    user = Depends(verify_token)
):
    """Delete document by job_id"""
    db = get_db()
    
    collections = ['depo_procurement_documents', 'depo_stock_request_documents', 'depo_sales_documents']
    
    for coll_name in collections:
        result = db[coll_name].delete_one({'job_id': job_id})
        if result.deleted_count > 0:
            return {'message': 'Document deleted', 'job_id': job_id}
    
    raise HTTPException(status_code=404, detail="Document not found")


@router.get("/job/{job_id}/status")
def get_job_status(
    job_id: str,
    user = Depends(verify_token)
):
    """Check job status"""
    client = DataFlowsDocuClient()
    job_status = client.get_job_status(job_id)
    
    if not job_status:
        raise HTTPException(status_code=404, detail="Job not found")
    
    return {
        'job_id': job_id,
        'status': job_status.get('status'),
        'error': job_status.get('error'),
        'created_at': job_status.get('created_at'),
        'updated_at': job_status.get('updated_at')
    }


@router.get("/for/{object_id}")
def get_documents_for_object(
    object_id: str,
    user = Depends(verify_token)
):
    """Get all documents for an object"""
    db = get_db()
    
    try:
        obj_id = ObjectId(object_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid object ID")
    
    collections = ['depo_procurement_documents', 'depo_stock_request_documents', 'depo_sales_documents']
    all_docs = []
    
    for coll_name in collections:
        docs = list(db[coll_name].find({'object_id': obj_id}))
        all_docs.extend(docs)
    
    # Auto-check status and download completed documents
    client = DataFlowsDocuClient()
    for doc in all_docs:
        if doc.get('document_data') or doc.get('status') == 'failed':
            continue
        
        if doc.get('status') not in ['done', 'completed', 'failed']:
            job_id = doc.get('job_id')
            if job_id:
                job_status = client.get_job_status(job_id)
                if job_status:
                    current_status = job_status.get('status')
                    
                    if current_status != doc.get('status'):
                        update_data = {
                            'status': current_status,
                            'updated_at': datetime.utcnow(),
                            'error': job_status.get('error')
                        }
                        
                        if current_status in ['done', 'completed']:
                            document_bytes = client.download_document(job_id)
                            if document_bytes:
                                update_data['document_data'] = base64.b64encode(document_bytes).decode('utf-8')
                        
                        for coll_name in collections:
                            if db[coll_name].find_one({'_id': doc['_id']}):
                                db[coll_name].update_one({'_id': doc['_id']}, {'$set': update_data})
                                break
                        
                        doc['status'] = current_status
                        doc['error'] = update_data.get('error')
    
    # Format response
    for doc in all_docs:
        doc['_id'] = str(doc['_id'])
        if 'object_id' in doc:
            doc['object_id'] = str(doc['object_id'])
        if 'created_at' in doc and isinstance(doc['created_at'], datetime):
            doc['created_at'] = doc['created_at'].isoformat()
        if 'updated_at' in doc and isinstance(doc['updated_at'], datetime):
            doc['updated_at'] = doc['updated_at'].isoformat()
        doc['has_document'] = doc.get('document_data') is not None
        if 'document_data' in doc:
            del doc['document_data']
    
    return all_docs


# ==================== INTERNAL HANDLERS ====================

def _generate_procurement_order_document(db, order_obj_id, request, user):
    """Generate procurement order document"""
    
    purchase_order = db['depo_purchase_orders'].find_one({'_id': order_obj_id})
    if not purchase_order:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    
    # Get supplier
    supplier_detail = None
    if purchase_order.get('supplier_id'):
        supplier_detail = db['depo_companies'].find_one({'_id': ObjectId(purchase_order['supplier_id'])})
    
    def format_date(value):
        if isinstance(value, datetime):
            return value.strftime('%Y-%m-%d')
        if value is None:
            return ''
        return str(value)

    def resolve_supplier_contact(supplier_doc):
        if not supplier_doc:
            return ''
        contact = supplier_doc.get('contact') or supplier_doc.get('contact_person')
        if contact:
            return contact
        contacts = supplier_doc.get('contacts') or []
        if contacts and isinstance(contacts, list):
            first = contacts[0]
            if isinstance(first, dict):
                return first.get('name') or first.get('full_name') or first.get('email') or ''
        return ''

    def resolve_manufacturer_name(part_doc):
        if not part_doc:
            return ''
        manufacturer_name = part_doc.get('manufacturer_name')
        if manufacturer_name:
            return manufacturer_name
        manufacturer_id = part_doc.get('manufacturer_id')
        if manufacturer_id:
            try:
                manufacturer_doc = db['depo_companies'].find_one({'_id': ObjectId(manufacturer_id)})
                if manufacturer_doc:
                    return manufacturer_doc.get('name', '')
            except Exception:
                pass
        return ''

    def resolve_user_name(user_doc):
        if not user_doc:
            return 'System'
        candidates = []
        name = user_doc.get('name')
        if isinstance(name, str):
            candidates.append(name)
        first = user_doc.get('firstname')
        last = user_doc.get('lastname')
        full = ' '.join([p for p in [first, last] if isinstance(p, str) and p.strip()])
        if full:
            candidates.append(full)
        username = user_doc.get('username')
        if isinstance(username, str):
            candidates.append(username)
        for candidate in candidates:
            cleaned = candidate.strip()
            if not cleaned:
                continue
            parts = [p.strip().lower() for p in cleaned.split() if p.strip()]
            if parts and all(p == 'none' for p in parts):
                continue
            return cleaned
        return 'System'

    def resolve_config_string(config_doc):
        if not config_doc:
            return ''
        for key in ('value', 'address', 'delivery_address', 'text', 'name', 'description'):
            value = config_doc.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
        items = config_doc.get('items')
        if isinstance(items, list) and items:
            first = items[0]
            if isinstance(first, str):
                return first.strip()
            if isinstance(first, dict):
                for key in ('value', 'name', 'label', 'text'):
                    value = first.get(key)
                    if isinstance(value, str) and value.strip():
                        return value.strip()
        return ''

    # Build line items for template
    raw_items = purchase_order.get('items', [])
    line_items = []
    for item in raw_items:
        part_doc = None
        part_id = item.get('part_id')
        if part_id:
            try:
                part_doc = db['depo_parts'].find_one({'_id': ObjectId(part_id)})
            except Exception:
                part_doc = None

        part_name = (
            item.get('part_name')
            or (item.get('part_detail') or {}).get('name')
            or (part_doc.get('name') if part_doc else '')
        )
        part_ipn = (
            item.get('part_IPN')
            or item.get('part_ipn')
            or (item.get('part_detail') or {}).get('ipn')
            or (part_doc.get('ipn') if part_doc else '')
        )
        unit = (
            item.get('unit')
            or item.get('um')
            or (item.get('part_detail') or {}).get('um')
            or (part_doc.get('um') if part_doc else '')
        )
        manufacturer = (
            item.get('manufacturer')
            or resolve_manufacturer_name(part_doc)
        )

        line_items.append({
            'name': part_name,
            'ipn': part_ipn,
            'manufacturer': manufacturer,
            'quantity': item.get('quantity', ''),
            'um': unit
        })

    supplier_address = supplier_detail.get('address', '') if supplier_detail else ''
    supplier_email = supplier_detail.get('email', '') if supplier_detail else ''
    supplier_phone = supplier_detail.get('phone', supplier_detail.get('telefon', '')) if supplier_detail else ''
    supplier_vatno = ''
    if supplier_detail:
        supplier_vatno = supplier_detail.get('tax_id') or supplier_detail.get('cif', '') or ''

    delivery_address_config = db['config'].find_one({'slug': 'delivery_address'})
    delivery_address = resolve_config_string(delivery_address_config)

    document_data = {
        'supplier_address': supplier_address,
        'supplier_contact_name': resolve_supplier_contact(supplier_detail),
        'supplier_email': supplier_email,
        'supplier_name': supplier_detail.get('name', '') if supplier_detail else '',
        'supplier_phone': supplier_phone,
        'supplier_vatno': supplier_vatno,
        'line_items': line_items,
        'currency': purchase_order.get('currency', ''),
        'delivery_terms': purchase_order.get('delivery_terms', purchase_order.get('delivery_term', '')),
        'delivery_address': delivery_address,
        'supplier_reference': purchase_order.get('supplier_reference', ''),
        'issue_date': format_date(purchase_order.get('issue_date')),
        'payment_terms': purchase_order.get('payment_terms', purchase_order.get('payment_conditions', '')),
        'reference': purchase_order.get('reference', ''),
        'target_date': format_date(purchase_order.get('target_date', purchase_order.get('delivery_date'))),
        'user_name': resolve_user_name(user)
    }
    
    # Create job
    client = DataFlowsDocuClient()
    filename = f"PO-{request.object_id[:8]}-{request.template_code[:6]}"
    job_response = client.create_job(
        template_code=request.template_code,
        data=document_data,
        format='pdf',
        filename=filename
    )
    
    if not job_response or 'id' not in job_response:
        raise HTTPException(status_code=500, detail="Failed to create job")
    
    job_id = job_response['id']
    
    # Save to MongoDB
    docs_collection = db['depo_procurement_documents']
    doc_entry = {
        'object_id': order_obj_id,
        'object_type': 'procurement_order',
        'job_id': job_id,
        'template_code': request.template_code,
        'template_name': request.template_name,
        'status': job_response.get('status', 'queued'),
        'filename': f"{filename}.pdf",
        'created_at': datetime.utcnow(),
        'updated_at': datetime.utcnow(),
        'created_by': user.get('username'),
        'document_data': None,
        'error': None
    }
    
    docs_collection.insert_one(doc_entry)
    
    return {
        'job_id': job_id,
        'status': job_response.get('status'),
        'message': 'Document generation started',
        'filename': f"{filename}.pdf"
    }


def _generate_stock_request_document(db, request_obj_id, request, user):
    """Generate stock request document"""
    import qrcode
    import qrcode.image.svg
    
    req = db['depo_requests'].find_one({'_id': request_obj_id})
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    
    def serialize(obj):
        if isinstance(obj, ObjectId):
            return str(obj)
        elif isinstance(obj, datetime):
            return obj.isoformat()
        elif isinstance(obj, dict):
            return {k: serialize(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [serialize(item) for item in obj]
        return obj

    def format_date(value):
        if isinstance(value, datetime):
            return value.strftime('%Y-%m-%d')
        if value is None:
            return ''
        return str(value)

    # Get location details from local database
    source_detail = None
    destination_detail = None
    
    if req.get('source'):
        try:
            source_detail = db['depo_locations'].find_one({'_id': ObjectId(req['source'])})
        except:
            pass
    
    if req.get('destination'):
        try:
            destination_detail = db['depo_locations'].find_one({'_id': ObjectId(req['destination'])})
        except:
            pass
    
    items_with_details = []
    depo_parts_collection = db['depo_parts']
    
    for item in req.get('items', []):
        item_data = item.copy()
        part_id = item.get('part')
        
        if part_id:
            # Get part details from local database
            try:
                depo_part = depo_parts_collection.find_one({'_id': ObjectId(part_id)})
            except Exception:
                depo_part = depo_parts_collection.find_one({'id': part_id})

            if depo_part:
                item_data['part_detail'] = {
                    'name': depo_part.get('name'),
                    'IPN': depo_part.get('ipn'),
                    'description': depo_part.get('description', '')
                }
                item_data['purchase_price'] = depo_part.get('purchase_price')
                item_data['purchase_price_currency'] = depo_part.get('purchase_price_currency', 'RON')
        
        items_with_details.append(item_data)
    
    qr_string = f"{req['reference']}#{req.get('source')}#{req.get('destination')}"
    qr = qrcode.QRCode(version=1, error_correction=qrcode.constants.ERROR_CORRECT_L, box_size=10, border=1)
    qr.add_data(qr_string)
    qr.make(fit=True)
    factory = qrcode.image.svg.SvgPathImage
    img = qr.make_image(fill_color="black", back_color="white", image_factory=factory)
    svg_io = io.BytesIO()
    img.save(svg_io)
    qr_svg = svg_io.getvalue().decode('utf-8')
    
    total_price = sum(float(item.get('purchase_price', 0)) * float(item.get('quantity', 0)) for item in items_with_details if item.get('purchase_price'))
    
    document_data = {
        'order': {
            'reference': req.get('reference', ''),
            'issue_date': format_date(req.get('issue_date')),
        },
        'source_location': serialize(source_detail) if source_detail else None,
        'destination_location': serialize(destination_detail) if destination_detail else None,
        'line_items': serialize(items_with_details),
        'qr_code_svg': qr_svg,
        'qr_code_data': qr_string,
        'generated_at': datetime.utcnow().isoformat(),
        'generated_by': user.get('username')
    }
    
    client = DataFlowsDocuClient()
    filename = f"REQ-{req['reference']}-{request.template_code[:6]}"
    job_response = client.create_job(
        template_code=request.template_code,
        data=document_data,
        format='pdf',
        filename=filename
    )
    
    if not job_response or 'id' not in job_response:
        raise HTTPException(status_code=500, detail="Failed to create job")
    
    job_id = job_response['id']
    
    docs_collection = db['depo_stock_request_documents']
    doc_entry = {
        'object_id': request_obj_id,
        'object_type': 'stock_request',
        'job_id': job_id,
        'template_code': request.template_code,
        'template_name': request.template_name,
        'status': job_response.get('status', 'queued'),
        'filename': f"{filename}.pdf",
        'created_at': datetime.utcnow(),
        'updated_at': datetime.utcnow(),
        'created_by': user.get('username'),
        'document_data': None,
        'error': None
    }
    
    docs_collection.insert_one(doc_entry)
    
    return {
        'job_id': job_id,
        'status': job_response.get('status'),
        'message': 'Document generation started',
        'filename': f"{filename}.pdf"
    }


def _generate_sales_order_document(db, order_obj_id, request, user):
    """Generate sales order document"""

    order = db['depo_sales_ordes'].find_one({'_id': order_obj_id})
    if not order:
        order = db['depo_sales_orders'].find_one({'_id': order_obj_id})
    if not order:
        raise HTTPException(status_code=404, detail="Sales order not found")

    # Get customer
    customer_detail = None
    if order.get('customer_id'):
        try:
            customer_id = order['customer_id']
            customer_oid = ObjectId(customer_id) if isinstance(customer_id, str) else customer_id
            customer_detail = db['depo_companies'].find_one({'_id': customer_oid})
        except Exception:
            customer_detail = None

    def format_date(value):
        if isinstance(value, datetime):
            return value.strftime('%Y-%m-%d')
        if value is None:
            return ''
        return str(value)

    def resolve_customer_contact(customer_doc):
        if not customer_doc:
            return ''
        contact = customer_doc.get('contact') or customer_doc.get('contact_person')
        if contact:
            return contact
        contacts = customer_doc.get('contacts') or []
        if contacts and isinstance(contacts, list):
            first = contacts[0]
            if isinstance(first, dict):
                return first.get('name') or first.get('full_name') or first.get('email') or ''
        return ''

    def resolve_manufacturer_name(part_doc):
        if not part_doc:
            return ''
        manufacturer_name = part_doc.get('manufacturer_name')
        if manufacturer_name:
            return manufacturer_name
        manufacturer_id = part_doc.get('manufacturer_id')
        if manufacturer_id:
            try:
                manufacturer_doc = db['depo_companies'].find_one({'_id': ObjectId(manufacturer_id)})
                if manufacturer_doc:
                    return manufacturer_doc.get('name', '')
            except Exception:
                pass
        return ''

    def resolve_user_name(user_doc):
        if not user_doc:
            return 'System'
        candidates = []
        name = user_doc.get('name')
        if isinstance(name, str):
            candidates.append(name)
        first = user_doc.get('firstname')
        last = user_doc.get('lastname')
        full = ' '.join([p for p in [first, last] if isinstance(p, str) and p.strip()])
        if full:
            candidates.append(full)
        username = user_doc.get('username')
        if isinstance(username, str):
            candidates.append(username)
        for candidate in candidates:
            cleaned = candidate.strip()
            if not cleaned:
                continue
            parts = [p.strip().lower() for p in cleaned.split() if p.strip()]
            if parts and all(p == 'none' for p in parts):
                continue
            return cleaned
        return 'System'

    raw_items = order.get('items', [])
    if not raw_items:
        raw_items = list(db['depo_sales_order_lines'].find({
            'order_id': {'$in': [str(order_obj_id), order_obj_id]}
        }))
    line_items = []
    for item in raw_items:
        part_doc = None
        part_id = item.get('part_id') or item.get('part')
        if part_id:
            try:
                part_doc = db['depo_parts'].find_one({'_id': ObjectId(part_id)})
            except Exception:
                part_doc = None

        part_name = (
            item.get('part_name')
            or (item.get('part_detail') or {}).get('name')
            or (part_doc.get('name') if part_doc else '')
        )
        part_ipn = (
            item.get('part_IPN')
            or item.get('part_ipn')
            or (item.get('part_detail') or {}).get('ipn')
            or (part_doc.get('ipn') if part_doc else '')
        )
        unit = (
            item.get('unit')
            or item.get('um')
            or (item.get('part_detail') or {}).get('um')
            or (part_doc.get('um') if part_doc else '')
        )
        price = item.get('sale_price')
        if price is None:
            price = item.get('price')
        manufacturer = (
            item.get('manufacturer')
            or resolve_manufacturer_name(part_doc)
        )

        line_items.append({
            'name': part_name,
            'ipn': part_ipn,
            'manufacturer': manufacturer,
            'quantity': item.get('quantity', ''),
            'um': unit,
            'price': price if price is not None else ''
        })

    # Destination detail
    destination_detail = None
    if order.get('destination_id'):
        try:
            destination_id = order['destination_id']
            destination_oid = ObjectId(destination_id) if isinstance(destination_id, str) else destination_id
            destination_detail = db['depo_locations'].find_one({'_id': destination_oid})
        except Exception:
            destination_detail = None

    client_address = customer_detail.get('address', '') if customer_detail else ''
    client_email = customer_detail.get('email', '') if customer_detail else ''
    client_phone = customer_detail.get('phone', customer_detail.get('telefon', '')) if customer_detail else ''
    client_vatno = ''
    if customer_detail:
        client_vatno = customer_detail.get('tax_id') or customer_detail.get('cif', '') or ''

    delivery_address = order.get('delivery_address')
    if not delivery_address and destination_detail:
        delivery_address = destination_detail.get('name') or destination_detail.get('description', '')

    price_total = 0.0
    for line in line_items:
        try:
            qty = float(line.get('quantity') or 0)
            price = float(line.get('price') or 0)
        except Exception:
            qty = 0.0
            price = 0.0
        price_total += qty * price

    document_data = {
        'client_address': client_address,
        'client_contact_name': resolve_customer_contact(customer_detail),
        'client_email': client_email,
        'client_name': customer_detail.get('name', '') if customer_detail else '',
        'client_phone': client_phone,
        'client_vatno': client_vatno,
        'line_items': line_items,
        'currency': order.get('currency', ''),
        'price_total': price_total,
        'delivery_address': delivery_address or '',
        'delivery_terms': order.get('delivery_terms', order.get('delivery_term', '')),
        'issue_date': format_date(order.get('issue_date')),
        'payment_terms': order.get('payment_terms', ''),
        'reference': order.get('reference', ''),
        'target_date': format_date(order.get('target_date')),
        'user_name': resolve_user_name(user)
    }

    # Create job
    client = DataFlowsDocuClient()
    filename = f"SO-{order.get('reference', request.object_id[:8])}-{request.template_code[:6]}"
    job_response = client.create_job(
        template_code=request.template_code,
        data=document_data,
        format='pdf',
        filename=filename
    )

    if not job_response or 'id' not in job_response:
        raise HTTPException(status_code=500, detail="Failed to create job")

    job_id = job_response['id']

    docs_collection = db['depo_sales_documents']
    doc_entry = {
        'object_id': order_obj_id,
        'object_type': 'sales_order',
        'job_id': job_id,
        'template_code': request.template_code,
        'template_name': request.template_name,
        'status': job_response.get('status', 'queued'),
        'filename': f"{filename}.pdf",
        'created_at': datetime.utcnow(),
        'updated_at': datetime.utcnow(),
        'created_by': user.get('username'),
        'document_data': None,
        'error': None
    }

    docs_collection.insert_one(doc_entry)

    return {
        'job_id': job_id,
        'status': job_response.get('status'),
        'message': 'Document generation started',
        'filename': f"{filename}.pdf"
    }
