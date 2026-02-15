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
    collections = ['depo_procurement_documents', 'depo_stock_request_documents']
    
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
        
        if doc.get('status') not in ['done', 'completed']:
            print(f"[DOCUMENT] ERROR: Document not ready, status={doc.get('status')}")
            raise HTTPException(status_code=400, detail=f"Document not ready. Status: {doc.get('status')}")
        
        client = DataFlowsDocuClient()
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
    
    collections = ['depo_procurement_documents', 'depo_stock_request_documents']
    
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
    
    collections = ['depo_procurement_documents', 'depo_stock_request_documents']
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
    import qrcode
    import qrcode.image.svg
    import json
    
    purchase_order = db['depo_purchase_orders'].find_one({'_id': order_obj_id})
    if not purchase_order:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    
    # Get supplier
    supplier_detail = None
    if purchase_order.get('supplier_id'):
        supplier_detail = db['depo_companies'].find_one({'_id': ObjectId(purchase_order['supplier_id'])})
    
    # Get company info
    config_collection = db['config']
    org_config = config_collection.find_one({'slug': 'organizatie'})
    
    company_info = {}
    if org_config:
        content = org_config.get('content', {})
        if isinstance(content, str):
            try:
                company_info = json.loads(content)
            except:
                company_info = {}
        elif isinstance(content, dict):
            company_info = content
    
    # Get line items with part details
    line_items = purchase_order.get('items', [])
    for item in line_items:
        if item.get('part_id'):
            part = db['depo_parts'].find_one({'_id': ObjectId(item['part_id'])})
            if part:
                item['part_detail'] = {
                    'name': part.get('name'),
                    'ipn': part.get('ipn'),
                    'um': part.get('um'),
                    'description': part.get('description', '')
                }
    
    # Generate QR code
    qr_string = f"{request.object_id}#{purchase_order.get('supplier_id', '')}#{purchase_order.get('issue_date', '')}"
    qr = qrcode.QRCode(version=1, error_correction=qrcode.constants.ERROR_CORRECT_L, box_size=10, border=1)
    qr.add_data(qr_string)
    qr.make(fit=True)
    factory = qrcode.image.svg.SvgPathImage
    img = qr.make_image(fill_color="black", back_color="white", image_factory=factory)
    svg_io = io.BytesIO()
    img.save(svg_io)
    qr_svg = svg_io.getvalue().decode('utf-8')
    
    # Serialize
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
    
    # Map company fields
    company_mapped = {
        'name': company_info.get('name', company_info.get('nume', '')),
        'tax_id': company_info.get('tax_id', company_info.get('cif', '')),
        'address': company_info.get('address', company_info.get('adresa', '')),
        'phone': company_info.get('phone', company_info.get('telefon', '')),
        'fax': company_info.get('fax', ''),
        'email': company_info.get('email', '')
    }
    
    document_data = {
        'company': company_mapped,
        'purchase_order': serialize(purchase_order),
        'supplier': serialize(supplier_detail) if supplier_detail else None,
        'line_items': serialize(line_items),
        'delivery_address': purchase_order.get('delivery_address', ''),
        'user': {'name': user.get('username', 'System')},
        'qr_code_svg': qr_svg,
        'qr_code_data': qr_string,
        'generated_at': datetime.utcnow().isoformat(),
        'generated_by': user.get('username')
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
        'data': {
            'order': {
                'reference': req.get('reference'),
                'source': req.get('source'),
                'destination': req.get('destination'),
                'status': req.get('status'),
                'notes': req.get('notes', ''),
                'batch_codes': req.get('batch_codes', []),
                'issue_date': req.get('issue_date').isoformat() if isinstance(req.get('issue_date'), datetime) else str(req.get('issue_date', '')),
                'created_by': req.get('created_by'),
                'created_at': req.get('created_at').isoformat() if isinstance(req.get('created_at'), datetime) else str(req.get('created_at', '')),
                'total_price': round(total_price, 2),
                'order_currency': 'RON'
            },
            'source_location': source_detail,
            'destination_location': destination_detail,
            'line_items': items_with_details,
            'qr_code_svg': qr_svg,
            'qr_code_data': qr_string,
            'generated_at': datetime.utcnow().isoformat(),
            'generated_by': user.get('username')
        }
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
