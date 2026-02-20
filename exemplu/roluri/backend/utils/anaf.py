"""
ANAF API integration for tax ID verification
"""
import requests
from typing import Optional, Dict, Any
from datetime import datetime

DEFAULT_ANAF_URL = "https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva"


def _get_anaf_url() -> str:
    try:
        from utils.db import get_db
        db = get_db()
        config = db['config'].find_one({'slug': 'anaf_tva_check_url'})
        if config and config.get('content'):
            return str(config.get('content'))
    except Exception:
        pass
    return DEFAULT_ANAF_URL


def verify_tax_id(tax_id: str) -> Optional[Dict[str, Any]]:
    """
    Verify tax ID (CUI/CIF) with ANAF
    Returns company data if found, None otherwise
    """
    try:
        # Clean tax ID - remove RO prefix if present
        clean_tax_id = tax_id.strip().upper()
        if clean_tax_id.startswith('RO'):
            clean_tax_id = clean_tax_id[2:]
        
        # ANAF API endpoint (configurable)
        url = _get_anaf_url()
        
        payload = [{
            "cui": clean_tax_id,
            "data": datetime.now().strftime("%Y-%m-%d")
        }]
        
        headers = {
            'Content-Type': 'application/json'
        }
        
        response = requests.post(url, json=payload, headers=headers, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            found = data.get('found') or []
            if len(found) > 0:
                company_data = found[0] if isinstance(found, list) else found
                date_generale = company_data.get('date_generale') if isinstance(company_data, dict) else None
                date_generale = date_generale if isinstance(date_generale, dict) else company_data
                inregistrare_tva = company_data.get('inregistrare_scop_Tva') if isinstance(company_data, dict) else None
                if not isinstance(inregistrare_tva, dict):
                    inregistrare_tva = company_data.get('inregistrare_scop_TVA') if isinstance(company_data, dict) else None

                return {
                    'cui': date_generale.get('cui') or clean_tax_id,
                    'name': date_generale.get('denumire') or company_data.get('denumire') if isinstance(company_data, dict) else '',
                    'address': date_generale.get('adresa') or company_data.get('adresa') if isinstance(company_data, dict) else '',
                    'iban': date_generale.get('iban') or company_data.get('iban') if isinstance(company_data, dict) else '',
                    'vat_registered': (inregistrare_tva.get('scpTVA') if isinstance(inregistrare_tva, dict) else None)
                                     or (company_data.get('scpTVA') if isinstance(company_data, dict) else False),
                    'phone': date_generale.get('telefon') or company_data.get('telefon') if isinstance(company_data, dict) else '',
                    'postal_code': date_generale.get('codPostal') or company_data.get('codPostal') if isinstance(company_data, dict) else '',
                    'verified_at': datetime.utcnow().isoformat()
                }
        
        return None
    except Exception as e:
        print(f"Error verifying tax ID with ANAF: {e}")
        return None
