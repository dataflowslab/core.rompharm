# Utils & Resources

This folder contains utility scripts, technical documentation, API collections, templates, and other development resources.

## Contents

### Setup Scripts

- **`init_jobs.py`** - Initialize default jobs in MongoDB (run once during setup)
- **`init_procurement_approval_template.py`** - Create default approval template for procurement orders

### Technical Documentation

- **`DOCUMENT_GENERATION.md`** - Complete guide for the reusable DocumentManager component
- **`IMPLEMENTARE_REQUESTS_UPDATES.md`** - Implementation notes for Requests module updates

### Postman Collections

- **`OfficeClerk_API.postman_collection.json`** - DataFlows Docu (OfficeClerk) API endpoints
- **`DataFlowsDepoStocks_API.postman_collection.json`** - InvenTree plugin API endpoints

### Document Templates

- **`TEMPLATE_ILY5WVAV8SQD_PURCHASE_ORDER.html`** - Purchase Order template (Comandă Achiziție)
- **`TEMPLATE_RC45WVTRBDGT.html`** - Transfer Note template (Nota de transfer)

## Usage

### Running Setup Scripts

```bash
# Initialize jobs
python utils/init_jobs.py

# Initialize procurement approval template
python utils/init_procurement_approval_template.py
```

### Importing Postman Collections

1. Open Postman
2. Click Import
3. Select the JSON file
4. Configure environment variables (base URL, tokens, etc.)

## Notes

- Setup scripts should be run only once during initial setup
- Postman collections are useful for testing API endpoints
- Document templates are HTML files with Jinja2 syntax for OfficeClerk
- This folder serves as a utility bin for scripts, documentation, and development resources
