# Changelog - Scripts

## 2025-11-24

### sync_inventree_sales_orders.py - Initial Implementation

Created script to sync FGO invoices from MongoDB raw_data to InvenTree Sales Orders (v1.0.1).

**Features:**
- Processes raw_data documents containing arrays of invoices
- Skips documents that already have sync_status and sync_log fields
- Creates/finds customers by name (case-insensitive) and CUI (cod_unic_client)
- Creates/finds parts by name (case-insensitive, trimmed) - cod_conta_produs is often null
- Creates sales orders with unique description: "SERIE={serie};NUMAR={numar}"
- Does not issue orders (leaves in draft state)
- Handles multiple invoices per raw_data document
- Writes detailed sync_log with per-invoice results
- Sets sync_status: 1 (all ok), 2 (partial), 3 (all failed)

**Authentication:**
- Supports both token-based and username/password authentication
- Automatically obtains token if username/password provided

**Data Mapping:**
- serie → Sales Order description (part 1)
- numar → Sales Order description (part 2)
- denumire_client → Customer name
- cod_unic_client → Customer reference (CUI)
- data_emitere → Sales Order issue_date
- articole[].nume_produs → Part name
- articole[].cod_conta_produs → Part IPN (often null, fallback to name)
- articole[].cantitate → Line quantity
- articole[].pret_unitar → Line sale_price
- articole[].detalii → Line reference

**Idempotency:**
- Sales orders identified by exact description match
- Parts identified by exact name match (case-insensitive)
- Customers identified by exact name match (case-insensitive)
- Existing lines updated instead of duplicated

**Error Handling:**
- HTTP errors captured with status code and response body
- Exceptions captured with traceback (truncated to 1000 chars)
- Per-invoice error logging
- Overall document status based on all invoice results

**Testing:**
- Tested successfully with real data
- Created customer (OPEN DB SECURITY S.R.L.)
- Created 7 parts and sales order lines
- Status 1 (OK) achieved

**Job Scheduler Integration:**
- Added to built-in job scheduler system
- Runs automatically every 10 minutes (configurable)
- Can be enabled/disabled via MongoDB
- Manual trigger via API endpoint
- Tracks last_run, last_status, last_output in database

**Production Ready:**
- Runs as background job with application
- No separate cron setup needed
- Integrated with existing scheduler infrastructure
- Automatic restart on application restart
