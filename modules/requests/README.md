# Requests Module

Version: 1.0.0

## Description

Internal stock transfer request management system for DataFlows Core. Manages stock transfer requests between locations with approval workflows and document generation.

## Features

- Create stock transfer requests between locations
- Auto-generated reference numbers (REQ-NNNN)
- Part selection with stock information
- BOM support for assemblies
- Approval workflow integration
- Operations and Reception flows
- Document generation (Fisa de solicitare, Nota de transfer)
- Batch code management
- Status tracking (Pending, Approved, Finished, Completed, Refused)

## API Endpoints

- `GET /modules/requests/api/` - List all requests
- `GET /modules/requests/api/{id}` - Get request details
- `POST /modules/requests/api/` - Create new request
- `PATCH /modules/requests/api/{id}` - Update request
- `DELETE /modules/requests/api/{id}` - Delete request
- `GET /modules/requests/api/stock-locations` - Get stock locations
- `GET /modules/requests/api/parts` - Search parts
- `GET /modules/requests/api/parts/{id}/stock-info` - Get stock information
- `GET /modules/requests/api/parts/{id}/bom` - Get BOM
- `GET /modules/requests/api/parts/{id}/batch-codes` - Get batch codes
- `GET /modules/requests/api/parts/{id}/recipe` - Get recipe with BOM fallback
- `GET /modules/requests/api/{id}/approval-flow` - Get approval flow
- `POST /modules/requests/api/{id}/approval-flow` - Create approval flow
- `POST /modules/requests/api/{id}/sign` - Sign request
- `DELETE /modules/requests/api/{id}/signatures/{user_id}` - Remove signature

## Database

- Collection: `depo_requests_items`
- Approval flows: `approval_flows` (object_type: "stock_request", "stock_request_operations", "stock_request_reception")

## Configuration

Approval flows configured in MongoDB `config` collection with slug `requests_operations_flow`.

## Installation

Module is automatically loaded when enabled in `config.yaml`:

```yaml
modules:
  active:
    - requests
```
