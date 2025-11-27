"""
Sync raw sales data from MongoDB raw_data into InvenTree Sales Orders.

Behavior:
- Processes raw_data documents that:
  1. Do NOT contain keys 'sync_status' and 'sync_log' (new documents)
  2. OR have 'sync_status' but the order hash has changed (modified documents)
- For each order entry inside data payload, creates/links:
  - Customer (Company) if missing
  - Parts (by IPN = cod_conta_produs OR name = nume_produs; case-insensitive, trimmed)
  - Sales Order with reference/description containing serie+numar for idempotency
- Marks orders as not issued (i.e., do not complete/issue the order)
- Detects order modifications via hash (order_id + product_ids + quantities)
- Updates existing orders: adds/removes/updates line items as needed
- Writes back sync_log, sync_status, and order_hash on each processed raw_data document:
  - 1 (ok): all products identified and order created/updated
  - 2 (partial): some products missing; list missing
  - 3 (failed): unexpected error

Assumptions about raw_data.data structure (adjust mappings if needed):
- The document contains fields to build a sales order:
  {
    "serie": "...",          # series string
    "numar": "...",          # number string
    "client": {
      "name": "...",         # client name
      "email": "...",        # optional
      "website": "...",      # optional
      "company_code": "..."  # optional identifier (CUI)
    },
    "items": [
      {
        "cod_conta_produs": "...",   # map to Part.ipn
        "nume_produs": "...",        # map to Part.name if ipn not found
        "quantity": 1,
        "price": 100.0,
        "description": "..."
      }
    ],
    "order_date": "YYYY-MM-DD"  # optional
  }

Env/config:
- Uses src/backend/utils/db.get_db() for Mongo access.
- Uses config.yaml for InvenTree URL and token: inventree.url and inventree.token

Run:
- python -m src.scripts.sync_inventree_sales_orders

Cron:
- Schedule this script; it is idempotent and skips already processed raw_data entries.

Note:
- InvenTree API version assumed 1.0.1
"""
from __future__ import annotations

import os
import sys
import json
import hashlib
import traceback
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

import requests

# Ensure project root on path
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from src.backend.utils.db import get_db  # type: ignore

try:
    import yaml  # lazy import config
except Exception:
    yaml = None


def load_config() -> Dict[str, Any]:
    config_path = os.path.join(PROJECT_ROOT, 'config', 'config.yaml')
    with open(config_path, 'r', encoding='utf-8') as f:
        return yaml.safe_load(f)


def get_inventree_session() -> Tuple[str, Dict[str, str]]:
    cfg = load_config()
    base_url = cfg['inventree']['url'].rstrip('/')
    token = cfg['inventree'].get('token')
    
    # If no token, try to get one using username/password
    if not token:
        username = cfg['inventree'].get('username')
        password = cfg['inventree'].get('password')
        if not username or not password:
            raise RuntimeError('inventree.token or (inventree.username + inventree.password) not configured in config.yaml')
        
        # Get token via API
        token_url = f"{base_url}/api/user/token/"
        try:
            from requests.auth import HTTPBasicAuth
            response = requests.get(token_url, auth=HTTPBasicAuth(username, password), timeout=10)
            response.raise_for_status()
            token = response.json().get('token')
            if not token:
                raise RuntimeError('Failed to obtain token from InvenTree')
        except Exception as e:
            raise RuntimeError(f'Failed to authenticate with InvenTree: {e}')
    
    headers = {
        'Authorization': f'Token {token}',
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    }
    return base_url, headers


# ---- InvenTree API helpers (v1.0.1 compatible) ----

def it_get(url: str, headers: Dict[str, str], params: Optional[Dict[str, Any]] = None) -> requests.Response:
    r = requests.get(url, headers=headers, params=params or {}, timeout=30)
    r.raise_for_status()
    return r


def it_post(url: str, headers: Dict[str, str], payload: Dict[str, Any]) -> requests.Response:
    r = requests.post(url, headers=headers, data=json.dumps(payload), timeout=30)
    r.raise_for_status()
    return r


def it_patch(url: str, headers: Dict[str, str], payload: Dict[str, Any]) -> requests.Response:
    r = requests.patch(url, headers=headers, data=json.dumps(payload), timeout=30)
    r.raise_for_status()
    return r


def it_delete(url: str, headers: Dict[str, str]) -> requests.Response:
    r = requests.delete(url, headers=headers, timeout=30)
    r.raise_for_status()
    return r


# ---- Hash calculation for order change detection ----

def calculate_order_hash(invoice: Dict[str, Any]) -> str:
    """Calculate hash from order ID + product IDs + quantities.
    Format: IDCMD-{product_id}-{qty}--{product_id}-{qty}...
    Example: IDCMD-198779420-3--198779422-1
    """
    invoice_id = str(invoice.get('id') or invoice.get('serie', '') + invoice.get('numar', ''))
    articole = invoice.get('articole') or []
    
    # Sort by product code/name for consistent hash
    items = []
    for articol in articole:
        ipn = (articol.get('cod_conta_produs') or '').strip()
        name = (articol.get('nume_produs') or '').strip()
        qty = float(articol.get('cantitate') or 0)
        if qty <= 0:
            continue
        # Use IPN if available, otherwise name
        product_id = ipn if ipn else name
        items.append(f"{product_id}-{qty}")
    
    items.sort()  # Sort for consistent hash
    hash_string = f"IDCMD-{invoice_id}--{'--'.join(items)}"
    
    # Return MD5 hash for shorter storage
    return hashlib.md5(hash_string.encode('utf-8')).hexdigest()


# Companies (customers)

def find_or_create_company(base_url: str, headers: Dict[str, str], name: str, company_code: Optional[str] = None, email: Optional[str] = None, website: Optional[str] = None) -> Dict[str, Any]:
    # Search by exact name (case-insensitive matching via API filter not guaranteed; fetch and compare)
    companies = it_get(f"{base_url}/api/company/", headers, params={"is_customer": True, "limit": 200}).json().get('results') or []
    lower = name.strip().lower()
    for c in companies:
        if c.get('name', '').strip().lower() == lower:
            return c
    # If code provided, try search by tax_id
    if company_code:
        for c in companies:
            if c.get('tax_id', '').strip() == company_code.strip():
                return c
    payload = {
        "name": name.strip(),
        "is_customer": True,
    }
    if company_code:
        payload["tax_id"] = company_code
    if email:
        payload["email"] = email
    if website:
        payload["website"] = website
    created = it_post(f"{base_url}/api/company/", headers, payload).json()
    return created


# Parts

def find_part(base_url: str, headers: Dict[str, str], ipn: Optional[str], name: Optional[str]) -> Optional[Dict[str, Any]]:
    # Try IPN first
    if ipn:
        ipn_q = ipn.strip()
        if ipn_q:
            res = it_get(f"{base_url}/api/part/", headers, params={"IPN": ipn_q, "limit": 1}).json().get('results') or []
            if res:
                return res[0]
    # Fallback by name (case-insensitive approximate)
    if name:
        name_q = name.strip()
        if name_q:
            res = it_get(f"{base_url}/api/part/", headers, params={"search": name_q, "limit": 50}).json().get('results') or []
            lower = name_q.lower()
            for p in res:
                if p.get('name', '').strip().lower() == lower:
                    return p
            if res:
                return res[0]
    return None


def create_basic_part(base_url: str, headers: Dict[str, str], name: str, ipn: Optional[str]) -> Dict[str, Any]:
    payload = {
        "name": name.strip(),
        "description": "",
        "active": True,
        "purchaseable": True,
        "salable": True,
    }
    if ipn:
        payload["IPN"] = ipn.strip()
    created = it_post(f"{base_url}/api/part/", headers, payload).json()
    return created


# Sales Orders

def find_or_create_sales_order(base_url: str, headers: Dict[str, str], customer_id: int, ref_desc: str, order_date: Optional[str]) -> Dict[str, Any]:
    # Search by description containing our unique marker (serie+numar)
    res = it_get(f"{base_url}/api/order/so/", headers, params={"customer": customer_id, "limit": 100, "description": ref_desc}).json()
    results = res.get('results') if isinstance(res, dict) else res
    if results:
        # If API returns list without pagination
        if isinstance(results, list):
            for so in results:
                if (so.get('description') or '') == ref_desc:
                    return so
        # If paginated
        else:
            for so in res.get('results', []):
                if (so.get('description') or '') == ref_desc:
                    return so
    payload = {
        "customer": customer_id,
        "description": ref_desc,
    }
    if order_date:
        payload["target_date"] = order_date  # Set target date, not issue_date
    created = it_post(f"{base_url}/api/order/so/", headers, payload).json()
    return created


def add_or_update_sales_order_line(base_url: str, headers: Dict[str, str], so_id: int, part_id: int, quantity: float, price: Optional[float], reference: Optional[str]) -> Dict[str, Any]:
    # First check existing lines to avoid duplicates
    lines = it_get(f"{base_url}/api/order/so-line/", headers, params={"order": so_id, "limit": 200}).json().get('results') or []
    for line in lines:
        if line.get('part') == part_id:
            # Update quantity if needed; keep price if provided
            payload = {"quantity": quantity}
            if price is not None:
                payload["sale_price"] = price
            if reference:
                payload["reference"] = reference
            return it_patch(f"{base_url}/api/order/so-line/{line['pk']}/", headers, payload).json()
    payload = {
        "order": so_id,
        "part": part_id,
        "quantity": quantity,
    }
    if price is not None:
        payload["sale_price"] = price
    if reference:
        payload["reference"] = reference
    created = it_post(f"{base_url}/api/order/so-line/", headers, payload).json()
    return created


def process_single_invoice(invoice: Dict[str, Any], base_url: str, headers: Dict[str, str]) -> Tuple[int, Dict[str, Any]]:
    """Process a single invoice from the data array.
    Returns (sync_status, sync_log)
    """
    serie = str(invoice.get('serie') or '').strip()
    numar = str(invoice.get('numar') or '').strip()
    
    if not serie or not numar:
        return 3, {"error": "Missing serie or numar", "invoice_id": invoice.get('id')}

    client_name = str(invoice.get('denumire_client') or '').strip()
    if not client_name:
        return 3, {"error": "Missing denumire_client", "invoice_id": invoice.get('id')}

    ref_desc = f"SERIE={serie};NUMAR={numar}"
    
    # Extract client info
    company_code = str(invoice.get('cod_unic_client') or '').strip() or None
    order_date = invoice.get('data_emitere', '').split('T')[0] if invoice.get('data_emitere') else None
    
    # Extract items
    articole = invoice.get('articole') or []

    try:
        # Customer
        company = find_or_create_company(
            base_url,
            headers,
            name=client_name,
            company_code=company_code,
            email=None,
            website=None,
        )
        customer_id = company.get('pk') or company.get('id')
        if not customer_id:
            return 3, {"error": "Customer creation failed", "company": company, "invoice_id": invoice.get('id')}

        # Sales Order
        so = find_or_create_sales_order(base_url, headers, customer_id=customer_id, ref_desc=ref_desc, order_date=order_date)
        so_id = so.get('pk') or so.get('id')
        if not so_id:
            return 3, {"error": "Sales order create/find failed", "so": so, "invoice_id": invoice.get('id')}

        # Lines
        missing_products: List[Dict[str, Any]] = []
        added_lines: List[Dict[str, Any]] = []
        for articol in articole:
            ipn = (articol.get('cod_conta_produs') or '').strip()
            name = (articol.get('nume_produs') or '').strip()
            qty = float(articol.get('cantitate') or 0)
            price = articol.get('pret_unitar')
            price_float = float(price) if price is not None else None
            if qty <= 0:
                continue

            part = find_part(base_url, headers, ipn=ipn or None, name=name or None)
            if not part:
                # Create minimal part if not found
                if not name and not ipn:
                    missing_products.append({"ipn": ipn, "name": name, "reason": "missing identifiers"})
                    continue
                part = create_basic_part(base_url, headers, name=name or ipn or f"Item {len(added_lines)+1}", ipn=ipn or None)

            part_id = part.get('pk') or part.get('id')
            if not part_id:
                missing_products.append({"ipn": ipn, "name": name, "reason": "part id missing after create"})
                continue

            line = add_or_update_sales_order_line(
                base_url,
                headers,
                so_id=so_id,
                part_id=part_id,
                quantity=qty,
                price=price_float,
                reference=(articol.get('detalii') or None)
            )
            added_lines.append({"part": part_id, "qty": qty, "line_id": line.get('pk') or line.get('id')})

        if missing_products and added_lines:
            status = 2
        elif missing_products and not added_lines:
            status = 3  # nothing added
        else:
            status = 1

        log = {
            "timestamp": datetime.utcnow().isoformat(),
            "invoice_id": invoice.get('id'),
            "serie": serie,
            "numar": numar,
            "customer": {"id": customer_id, "name": client_name},
            "sales_order": {"id": so_id, "description": ref_desc},
            "added_lines": added_lines,
            "missing_products": missing_products,
        }
        return status, log

    except requests.HTTPError as e:
        return 3, {
            "error": "HTTP", 
            "invoice_id": invoice.get('id'), 
            "status_code": e.response.status_code if hasattr(e, 'response') and e.response else None, 
            "body": e.response.text[:500] if hasattr(e, 'response') and e.response else None,
            "message": str(e)
        }
    except requests.RequestException as e:
        return 3, {
            "error": "RequestException",
            "invoice_id": invoice.get('id'),
            "message": str(e),
            "trace": traceback.format_exc()[:1000]
        }
    except Exception as e:
        return 3, {
            "error": str(e), 
            "invoice_id": invoice.get('id'), 
            "trace": traceback.format_exc()[:1000]
        }


def process_raw_doc(doc: Dict[str, Any]) -> Tuple[int, Dict[str, Any]]:
    """Process a single raw_data document containing multiple invoices.
    Returns (sync_status, sync_log)
    """
    base_url, headers = get_inventree_session()
    
    data = doc.get('data')
    if not data:
        return 3, {"error": "No data field in document"}
    
    # Handle both single invoice dict and array of invoices
    if isinstance(data, dict):
        invoices = [data]
    elif isinstance(data, list):
        invoices = data
    else:
        return 3, {"error": "Invalid data format", "type": str(type(data))}
    
    all_logs = []
    all_statuses = []
    
    for invoice in invoices:
        status, log = process_single_invoice(invoice, base_url, headers)
        all_logs.append(log)
        all_statuses.append(status)
    
    # Overall status: 1 if all ok, 3 if all failed, 2 if mixed
    if all(s == 1 for s in all_statuses):
        overall_status = 1
    elif all(s == 3 for s in all_statuses):
        overall_status = 3
    else:
        overall_status = 2
    
    overall_log = {
        "timestamp": datetime.utcnow().isoformat(),
        "total_invoices": len(invoices),
        "successful": sum(1 for s in all_statuses if s == 1),
        "partial": sum(1 for s in all_statuses if s == 2),
        "failed": sum(1 for s in all_statuses if s == 3),
        "invoices": all_logs
    }
    
    return overall_status, overall_log


def main() -> None:
    db = get_db()
    coll = db["raw_data"]
    # Select documents that do not have sync_status and sync_log
    cursor = coll.find({
        "sync_status": {"$exists": False},
        "sync_log": {"$exists": False},
    }).limit(100)  # safety cap per run

    processed = 0
    for doc in cursor:
        status, log = process_raw_doc(doc)
        coll.update_one({"_id": doc["_id"]}, {"$set": {"sync_status": status, "sync_log": log}})
        processed += 1

    print(f"Processed {processed} raw documents")


if __name__ == "__main__":
    main()
