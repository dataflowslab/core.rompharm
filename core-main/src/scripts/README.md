# Sync Scripts

## sync_inventree_sales_orders.py

Reads unprocessed documents from MongoDB raw_data and creates/updates InvenTree sales orders (v1.0.1).

### Features

- Processes raw_data documents from external sources (e.g., FGO invoices)
- Creates/finds customers in InvenTree by name and CUI
- Creates/finds parts by name (case-insensitive, trimmed)
- Creates sales orders with unique description: SERIE={serie};NUMAR={numar}
- Does not issue orders (leaves them in draft state)
- Writes sync_log and sync_status to each processed document:
  - 1 = success (all invoices processed)
  - 2 = partial (some invoices failed)
  - 3 = failed (all invoices failed)
- Skips documents that already have sync_status and sync_log

### Configuration

Add InvenTree credentials to config/config.yaml:

Option 1 - Using token:
```yaml
inventree:
  url: https://simai.dataflows.ro/
  token: YOUR_TOKEN_HERE
```

Option 2 - Using username/password (token will be obtained automatically):
```yaml
inventree:
  url: https://simai.dataflows.ro/
  username: YOUR_USERNAME
  password: YOUR_PASSWORD
```

### Usage

**Automatic (Recommended)**: The script runs automatically via the built-in job scheduler.

**Manual run**:
```bash
python -m src.scripts.sync_inventree_sales_orders
```

### Job Scheduler

The script is configured as a scheduled job in the database and runs automatically when the application is running.

**Add/Update job**:
```bash
python add_sync_job.py
```

**Configure frequency** (edit in MongoDB `jobs` collection):
- `*/5 * * * *` - Every 5 minutes
- `*/10 * * * *` - Every 10 minutes (default)
- `*/15 * * * *` - Every 15 minutes
- `0 * * * *` - Every hour
- `0 */2 * * *` - Every 2 hours

**Enable/Disable**:
```javascript
// In MongoDB
db.jobs.updateOne(
  {name: 'sync_inventree_sales_orders'},
  {$set: {enabled: true}}  // or false to disable
)
```

**Check status**:
```javascript
// In MongoDB
db.jobs.findOne({name: 'sync_inventree_sales_orders'})
```

**Manual trigger via API** (requires admin):
```bash
POST /api/system/jobs/sync_inventree_sales_orders/run
```

### Data Structure

Expected raw_data.data format (array of invoices):
```json
[
  {
    "serie": "SIMDN",
    "numar": "221029339",
    "denumire_client": "COMPANY NAME S.R.L.",
    "cod_unic_client": "12345678",
    "data_emitere": "2025-11-20T00:00:00",
    "articole": [
      {
        "nume_produs": "Product Name",
        "cod_conta_produs": null,
        "cantitate": 6,
        "pret_unitar": 3045.7353,
        "detalii": "Additional info"
      }
    ]
  }
]
```

### Sync Log Example

```json
{
  "timestamp": "2025-11-24T10:30:00",
  "total_invoices": 13,
  "successful": 12,
  "partial": 1,
  "failed": 0,
  "invoices": [
    {
      "timestamp": "2025-11-24T10:30:00",
      "invoice_id": 85876717,
      "serie": "SIMDN",
      "numar": "221029339",
      "customer": {"id": 123, "name": "COMPANY NAME S.R.L."},
      "sales_order": {"id": 456, "description": "SERIE=SIMDN;NUMAR=221029339"},
      "added_lines": [
        {"part": 789, "qty": 6, "line_id": 1011}
      ],
      "missing_products": []
    }
  ]
}
```