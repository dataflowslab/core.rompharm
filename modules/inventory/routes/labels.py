"""
Labels Generator Routes
"""
from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.responses import StreamingResponse
from typing import List, Optional
from pydantic import BaseModel
import io
import base64
import qrcode
from datetime import datetime
import time
from bson import ObjectId

from src.backend.utils.db import get_db
from src.backend.routes.auth import verify_token
from src.backend.utils.dataflows_docu import DataFlowsDocuClient
from .utils import serialize_doc

router = APIRouter()

class LabelItem(BaseModel):
    id: str  # id of the item (part_id, stock_id, location_id)
    quantity: int = 1

class GenerateLabelsDocuRequest(BaseModel):
    table: str          # 'depo_parts' | 'depo_stocks' | 'depo_locations'
    items: List[LabelItem]


# DataFlows Docu template codes per table
DOCU_TEMPLATE_CODES = {
    'depo_stocks': 'Z4ZW2CN0A0VY',
    'depo_parts': 'VZ128YDOUWXZ',
    'depo_locations': 'WOPS3UAKOVWH',
}


def _generate_qr_base64(content: str) -> str:
    """Generate QR code as base64-encoded PNG data URI"""
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=1
    )
    qr.add_data(content)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    b64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
    return f"data:image/png;base64,{b64}"


def _format_expiry(expiry) -> str:
    """Format expiry_date from either datetime or ISO string to yyyy-mm-dd"""
    if not expiry:
        return ''
    if isinstance(expiry, datetime):
        return expiry.strftime('%Y-%m-%d')
    if isinstance(expiry, str):
        try:
            return datetime.fromisoformat(expiry.replace('Z', '+00:00')).strftime('%Y-%m-%d')
        except (ValueError, AttributeError):
            return expiry
    return str(expiry)


def _render_label_pdf(
    client: DataFlowsDocuClient,
    template_code: str,
    label_data: dict,
    filename: str,
    max_wait_seconds: int = 60,
    poll_interval_seconds: int = 2
) -> Optional[bytes]:
    """Render a single label PDF via DataFlows Docu using /jobs + polling."""
    docu_payload = {
        'data': label_data
    }

    job_response = client.create_job(
        template_code=template_code,
        data=docu_payload,
        format='pdf',
        filename=filename,
        options={}
    )
    if not job_response or 'id' not in job_response:
        return None

    job_id = job_response['id']
    max_attempts = max(1, int(max_wait_seconds / poll_interval_seconds))
    for _ in range(max_attempts):
        status = client.get_job_status(job_id)
        if status:
            job_status = status.get('status')
            if job_status in ['done', 'completed']:
                return client.download_document(job_id)
            if job_status == 'failed':
                return None
        time.sleep(poll_interval_seconds)

    return None


@router.post("/generate-labels-docu")
async def generate_labels_docu(
    request: Request,
    body: GenerateLabelsDocuRequest,
    current_user: dict = Depends(verify_token),
    db = Depends(get_db)
):
    """
    Generate labels via DataFlows Docu template engine.
    
    Builds data payload with barcode (text) and barcode_str (base64 PNG QR),
    then sends to DataFlows Docu for PDF rendering using the specified template.
    
    QR code formats:
        - depo_stocks:  P{IPN}L{BATCH_CODE}     (e.g. P300135603LSDSA)
        - depo_parts:   P{IPN}                   (e.g. P300135603)
        - depo_locations: LOC{CODE}              (e.g. LOCCASATE)
    """
    table_name = body.table
    template_code = DOCU_TEMPLATE_CODES.get(table_name)
    if not template_code:
        raise HTTPException(status_code=400, detail=f"Unsupported table: {table_name}")
    
    label_items = []
    
    for item in body.items:
        try:
            item_oid = ObjectId(item.id)
        except Exception:
            print(f"[LABELS] Invalid ObjectId: {item.id}")
            continue
        
        label_data = None
        
        if table_name == 'depo_parts':
            data = db.depo_parts.find_one({'_id': item_oid})
            if not data:
                continue
            
            ipn = data.get('ipn', '')
            barcode = f"P{ipn}"
            
            label_data = {
                'barcode': barcode,
                'barcode_str': _generate_qr_base64(barcode),
                'part_name': data.get('name', ''),
                'part_ipn': ipn,
                'part_description': data.get('description', ''),
                'um': data.get('um', ''),
                'is_salable': data.get('is_salable', False),
                'storage_conditions': data.get('storage_conditions', ''),
                'user_name': current_user.get('username', 'system'),
            }
        
        elif table_name == 'depo_stocks':
            data = db.depo_stocks.find_one({'_id': item_oid})
            if not data:
                continue
            
            # Get part info
            part = db.depo_parts.find_one({'_id': data.get('part_id')})
            part_ipn = part.get('ipn', '') if part else ''
            part_name = part.get('name', '') if part else ''
            batch_code = data.get('batch_code', '')
            
            barcode = f"P{part_ipn}L{batch_code}"
            
            # Get location info
            location_name = ''
            if data.get('location_id'):
                location = db.depo_locations.find_one({'_id': data['location_id']})
                if location:
                    location_name = location.get('name', '')
            
            # Get state info
            state_name = ''
            if data.get('state_id'):
                state = db.depo_stocks_states.find_one({'_id': data['state_id']})
                if state:
                    state_name = state.get('label', state.get('name', ''))
            
            label_data = {
                'barcode': barcode,
                'barcode_str': _generate_qr_base64(barcode),
                'part_name': part_name,
                'part_ipn': part_ipn,
                'batch_code': batch_code,
                'expiry_date': _format_expiry(data.get('expiry_date')),
                'quantity': data.get('initial_quantity', data.get('quantity', 0)),
                'location_name': location_name,
                'state_name': state_name,
                'is_salable': part.get('is_salable', False) if part else False,
                'um': part.get('um', '') if part else '',
                'storage_conditions': part.get('storage_conditions', '') if part else '',
                'purchase_price': data.get('purchase_price', ''),
                'user_name': current_user.get('username', 'system'),
            }
        
        elif table_name == 'depo_locations':
            data = db.depo_locations.find_one({'_id': item_oid})
            if not data:
                continue
            
            loc_code = data.get('code', '')
            barcode = f"LOC{loc_code}"
            
            label_data = {
                'barcode': barcode,
                'barcode_str': _generate_qr_base64(barcode),
                'location_name': data.get('name', ''),
                'location_code': loc_code,
                'location_description': data.get('description', ''),
                'user_name': current_user.get('username', 'system'),
            }
        
        if label_data:
            # Repeat for quantity, add quant (total per item) and crt_no (1..quant)
            total = item.quantity
            for i in range(total):
                label_items.append({
                    **label_data,
                    'quant': total,
                    'crt_no': i + 1
                })
    
    if not label_items:
        raise HTTPException(status_code=400, detail="No valid items found to generate labels")
    
    now = datetime.utcnow()
    filename_base = f"labels-{table_name}-{len(label_items)}pcs-{now.strftime('%Y%m%d-%H%M%S')}"
    
    # Send to DataFlows Docu for rendering
    try:
        client = DataFlowsDocuClient()
        pdf_blobs = []
        for index, label_data in enumerate(label_items, start=1):
            label_filename = f"{filename_base}-{index}"
            pdf_bytes = _render_label_pdf(
                client=client,
                template_code=template_code,
                label_data=label_data,
                filename=label_filename
            )
            if not pdf_bytes:
                raise HTTPException(
                    status_code=502,
                    detail="DataFlows Docu failed to generate the label PDF"
                )
            pdf_blobs.append(pdf_bytes)

        if len(pdf_blobs) == 1:
            return StreamingResponse(
                io.BytesIO(pdf_blobs[0]),
                media_type="application/pdf",
                headers={"Content-Disposition": "inline; filename=labels.pdf"}
            )

        try:
            from pypdf import PdfReader, PdfWriter
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail="PDF merge requires pypdf to be installed"
            ) from e
        writer = PdfWriter()
        for pdf_blob in pdf_blobs:
            reader = PdfReader(io.BytesIO(pdf_blob))
            for page in reader.pages:
                writer.add_page(page)

        merged = io.BytesIO()
        writer.write(merged)
        merged.seek(0)

        return StreamingResponse(
            merged,
            media_type="application/pdf",
            headers={"Content-Disposition": "inline; filename=labels.pdf"}
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"[LABELS] DataFlows Docu error: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate labels via DataFlows Docu: {str(e)}"
        )

@router.get("/read-label")
async def read_label(
    request: Request,
    code: str,
    current_user: dict = Depends(verify_token),
    db = Depends(get_db)
):
    """
    Parse a label QR code and fetch detailed information.
    Supported formats:
      - table:id---other:info...
      - P{IPN}L{BATCH_CODE}  (stock)
      - P{IPN}              (part)
      - LOC{CODE}           (location)
    """
    if not code:
        raise HTTPException(status_code=400, detail="Code is required")

    table_name = None
    item = None
    item_id = None

    # 1) Try native "table:id" format
    if ":" in code:
        segments = code.split("---")
        primary_segment = segments[0]
        if ":" in primary_segment:
            table_name, item_id = primary_segment.split(":", 1)

    # 2) Try barcode formats (P{IPN}L{BATCH}, P{IPN}, LOC{CODE})
    if not table_name:
        normalized = code.strip()
        if normalized.upper().startswith("LOC"):
            loc_code = normalized[3:]
            if loc_code:
                table_name = "depo_locations"
                item = db.depo_locations.find_one({'code': loc_code})
        elif normalized.upper().startswith("P"):
            payload = normalized[1:]
            payload_upper = payload.upper()
            if "L" in payload_upper:
                split_index = payload_upper.find("L")
                ipn = payload[:split_index]
                batch_code = payload[split_index + 1:]
                if ipn and batch_code:
                    part = db.depo_parts.find_one({'ipn': ipn})
                    if part:
                        table_name = "depo_stocks"
                        item = db.depo_stocks.find_one(
                            {'part_id': part['_id'], 'batch_code': batch_code},
                            sort=[('created_at', -1)]
                        )
            else:
                if payload:
                    table_name = "depo_parts"
                    item = db.depo_parts.find_one({'ipn': payload})

    # Validate allowed tables
    allowed_tables = ['depo_parts', 'depo_stocks', 'depo_locations']
    if table_name and table_name not in allowed_tables:
        raise HTTPException(status_code=400, detail=f"Table {table_name} not supported for reading")

    # Fetch by ObjectId if we have table:id and not yet fetched
    if table_name and not item:
        if not item_id or not ObjectId.is_valid(item_id):
            raise HTTPException(status_code=400, detail="Invalid ID format")
        item = db[table_name].find_one({'_id': ObjectId(item_id)})

    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    item_id = str(item.get('_id'))

    # Normalize location_id if stock uses initial_location_id
    if table_name == 'depo_stocks' and not item.get('location_id') and item.get('initial_location_id'):
        item['location_id'] = item.get('initial_location_id')

    serialized_item = serialize_doc(item)
    
    # Expand associative fields
    # We look for fields ending in '_id' and try to find their related documents
    # Convention: 
    # part_id -> depo_parts
    # location_id -> depo_locations
    # state_id -> [table]_states mapping or try both
    # supplier_id -> depo_companies (or suppliers)
    
    expanded_data = {}
    
    for key, value in item.items():
        if key.endswith('_id') and isinstance(value, ObjectId):
            related_doc = None
            field_name = key.replace('_id', '_detail')
            
            # Smart guessing of collection based on field name
            if key == 'part_id':
                related_doc = db.depo_parts.find_one({'_id': value})
            elif key == 'location_id':
                related_doc = db.depo_locations.find_one({'_id': value})
            elif key == 'supplier_id':
                # Try companies
                related_doc = db.depo_suppliers.find_one({'_id': value}) # or companies? assuming depo_suppliers for now or check config
                if not related_doc:
                     related_doc = db.companies.find_one({'_id': value})
            elif key == 'state_id':
                # Determine state collection based on main table
                if table_name == 'depo_stocks':
                    related_doc = db.depo_stocks_states.find_one({'_id': value})
                elif table_name == 'depo_purchase_orders':
                    related_doc = db.depo_purchase_orders_states.find_one({'_id': value})
            elif key == 'system_um_id' or key == 'manufacturer_um_id':
                related_doc = db.depo_ums.find_one({'_id': value})
                
            if related_doc:
                serialized_item[field_name] = serialize_doc(related_doc)

    # Add current quantity for stock from ledger balances if available
    if table_name == 'depo_stocks':
        try:
            from modules.inventory.stock_movements import get_stock_balance
            balance_info = get_stock_balance(db, ObjectId(item_id))
            if isinstance(balance_info, dict):
                if 'total_quantity' in balance_info:
                    serialized_item['quantity'] = balance_info.get('total_quantity', 0)
                elif 'quantity' in balance_info:
                    serialized_item['quantity'] = balance_info.get('quantity', 0)
        except Exception:
            pass

    return {
        "table": table_name,
        "id": item_id,
        "data": serialized_item
    }
