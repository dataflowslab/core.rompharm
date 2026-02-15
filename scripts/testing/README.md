# Testing Scripts

These scripts run basic smoke checks against a running API.

## Prerequisites
- Server running (default base URL: `http://localhost:8000`)
- Valid credentials

## Environment Variables
- `DF_BASE_URL` (optional) - API base URL (default: `http://localhost:8000`)
- `DF_USERNAME` (required unless `DF_TOKEN` is set)
- `DF_PASSWORD` (required unless `DF_TOKEN` is set)
- `DF_TOKEN` (optional) - if provided, scripts skip login and reuse this token

## Run
```powershell
python scripts/testing/00_auth_health.py
python scripts/testing/10_inventory_smoke.py
python scripts/testing/20_procurement_smoke.py
python scripts/testing/30_requests_smoke.py
python scripts/testing/40_sales_smoke.py

# or
python scripts/testing/run_all.py
```
