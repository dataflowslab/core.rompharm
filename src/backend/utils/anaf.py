"""
ANAF API integration for tax ID verification
"""
import requests
from typing import Optional, Dict, Any
from datetime import datetime


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
        
        # ANAF API endpoint
        url = "https://webservicesp.anaf.ro/PlatitorTvaRest/api/v8/ws/tva"
        
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
            if data.get('found') and len(data.get('found', [])) > 0:
                company_data = data['found'][0]
                return {
                    'cui': company_data.get('cui'),
                    'name': company_data.get('denumire'),
                    'address': company_data.get('adresa'),
                    'vat_registered': company_data.get('scpTVA', False),
                    'phone': company_data.get('telefon'),
                    'postal_code': company_data.get('codPostal'),
                    'verified_at': datetime.utcnow().isoformat()
                }
        
        return None
    except Exception as e:
        print(f"Error verifying tax ID with ANAF: {e}")
        return None
