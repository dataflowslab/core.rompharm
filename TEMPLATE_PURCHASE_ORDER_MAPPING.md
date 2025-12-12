# Template Purchase Order (ILY5WVAV8SQD) - Data Mapping

## Fișier Template
`TEMPLATE_ILY5WVAV8SQD_PURCHASE_ORDER.html`

## Slug în MongoDB
`ILY5WVAV8SQD`

## Placeholders și Mapare Date

### 1. COMPANY (Buyer/Organization)
Date despre compania care face comanda (Rompharm):

```python
"company": {
    "name": "SC ROMPHARM COMPANY SRL",  # Din config sau InvenTree company settings
    "tax_id": "RO12345678",  # CUI
    "address": "Str. Eroilor nr. 1, București",
    "phone": "+40 21 123 4567",
    "fax": "+40 21 123 4568",
    "email": "office@rompharm.ro"
}
```

### 2. PURCHASE ORDER
Date despre comanda de achiziție:

```python
"purchase_order": {
    "reference": purchase_order.get('reference'),  # Ex: "PO-0001"
    "issue_date": purchase_order.get('issue_date'),  # Data emiterii
    "currency": purchase_order.get('order_currency'),  # "RON", "EUR", etc.
    "delivery_terms": purchase_order.get('notes') or "Franco depozit",  # Condiții livrare
    "target_date": purchase_order.get('target_date'),  # Termen de livrare
    "payment_terms": "30 zile"  # Sau din custom fields
}
```

### 3. SUPPLIER
Date despre furnizor:

```python
"supplier": {
    "name": supplier.get('name'),  # Numele furnizorului
    "contact": supplier.get('primary_contact', {}).get('name', '')  # Persoana de contact
}
```

### 4. LINE ITEMS
Lista produse comandate:

```python
"line_items": [
    {
        "part_name": line_item.get('part_detail', {}).get('name'),  # Denumire articol
        "part_IPN": line_item.get('part_detail', {}).get('IPN'),  # Cod intern
        "manufacturer": line_item.get('part_detail', {}).get('manufacturer_detail', {}).get('name', ''),
        "quantity": line_item.get('quantity'),
        "unit": line_item.get('part_detail', {}).get('units', 'buc'),  # Unitate măsură
        "price": line_item.get('purchase_price')  # Preț unitar
    }
    for line_item in line_items
]
```

### 5. OTHER
Alte date:

```python
"delivery_address": "Str. Eroilor nr. 1, București",  # Adresa de livrare
"user": {
    "name": current_user.get('name') or current_user.get('username')
}
```

## Implementare în Backend

### În `src/backend/routes/documents.py`:

```python
@router.post("/purchase-orders/{order_id}/generate")
async def generate_purchase_order_document(
    order_id: int,
    request: Request,
    current_user: dict = Depends(verify_admin)
):
    """Generate purchase order document (ILY5WVAV8SQD)"""
    config = load_config()
    inventree_url = config['inventree']['url'].rstrip('/')
    headers = get_inventree_headers(current_user)
    db = get_db()
    
    try:
        # Get purchase order
        po_response = requests.get(
            f"{inventree_url}/api/order/po/{order_id}/",
            headers=headers,
            timeout=10
        )
        po_response.raise_for_status()
        purchase_order = po_response.json()
        
        # Get supplier
        supplier_id = purchase_order.get('supplier')
        supplier_response = requests.get(
            f"{inventree_url}/api/company/{supplier_id}/",
            headers=headers,
            timeout=10
        )
        supplier_response.raise_for_status()
        supplier = supplier_response.json()
        
        # Get line items
        lines_response = requests.get(
            f"{inventree_url}/api/order/po-line/",
            headers=headers,
            params={'order': order_id},
            timeout=10
        )
        lines_response.raise_for_status()
        lines_data = lines_response.json()
        line_items = lines_data if isinstance(lines_data, list) else lines_data.get('results', [])
        
        # Get company info
        company_info = {
            "name": config.get('company', {}).get('name', 'SC ROMPHARM COMPANY SRL'),
            "tax_id": config.get('company', {}).get('tax_id', ''),
            "address": config.get('company', {}).get('address', ''),
            "phone": config.get('company', {}).get('phone', ''),
            "fax": config.get('company', {}).get('fax', ''),
            "email": config.get('company', {}).get('email', '')
        }
        
        # Prepare template data
        document_data = {
            "company": company_info,
            "purchase_order": {
                "reference": purchase_order.get('reference'),
                "issue_date": purchase_order.get('issue_date'),
                "currency": purchase_order.get('order_currency', 'RON'),
                "delivery_terms": purchase_order.get('notes', 'Franco depozit'),
                "target_date": purchase_order.get('target_date'),
                "payment_terms": "30 zile"
            },
            "supplier": {
                "name": supplier.get('name'),
                "contact": supplier.get('primary_contact', {}).get('name', '')
            },
            "line_items": [
                {
                    "part_name": item.get('part_detail', {}).get('name', ''),
                    "part_IPN": item.get('part_detail', {}).get('IPN', ''),
                    "manufacturer": item.get('part_detail', {}).get('manufacturer_detail', {}).get('name', ''),
                    "quantity": item.get('quantity', 0),
                    "unit": item.get('part_detail', {}).get('units', 'buc'),
                    "price": item.get('purchase_price', 0)
                }
                for item in line_items
            ],
            "delivery_address": company_info.get('address', ''),
            "user": {
                "name": current_user.get('name') or current_user.get('username')
            }
        }
        
        # Get template from MongoDB
        template = db.templates.find_one({'slug': 'ILY5WVAV8SQD'})
        if not template:
            raise HTTPException(status_code=404, detail="Template not found")
        
        # Render template with Jinja2
        from jinja2 import Template
        jinja_template = Template(template['content'])
        html_content = jinja_template.render(**document_data)
        
        # Generate PDF (using existing PDF generation logic)
        # ... PDF generation code ...
        
        return {"success": True, "document": html_content}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

## Testare

1. Actualizează template-ul în MongoDB:
   - Collection: `templates`
   - Slug: `ILY5WVAV8SQD`
   - Content: Conținutul din `TEMPLATE_ILY5WVAV8SQD_PURCHASE_ORDER.html`

2. Testează generarea documentului:
   ```bash
   curl -X POST http://localhost:8000/api/documents/purchase-orders/1/generate \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

3. Verifică că toate placeholders-urile sunt înlocuite corect

## Note

- Template-ul folosește Jinja2 pentru loop-uri (`{% for %}`)
- Toate datele sunt extrase din InvenTree API
- Company info poate fi stocat în config.yaml sau extras din InvenTree
- Adresa de livrare poate fi customizată per comandă
