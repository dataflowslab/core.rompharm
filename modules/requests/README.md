# Requests Module

Version: 1.0.7

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

## Code Structure

The module is organized into separate files for better maintainability:

- `models.py` - Pydantic models for request validation
- `utils.py` - Utility functions (headers, reference generation)
- `services.py` - Business logic and external API calls
- `approval_routes.py` - Approval flow endpoints
- `routes.py` - Main API routes orchestrator
- `tests/` - Unit tests

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

## Testing

The module includes comprehensive unit tests using pytest.

### Running Tests

```bash
# Run all tests for the requests module
python -m pytest modules/requests/tests/ -v

# Run specific test file
python -m pytest modules/requests/tests/test_utils.py -v
python -m pytest modules/requests/tests/test_models.py -v

# Run with coverage
python -m pytest modules/requests/tests/ --cov=modules.requests
```

### Test Coverage

- **28 unit tests** covering models, utilities, and business logic
- Tests for validation, error handling, and edge cases
- Mock-based testing for database and external API calls

### Test Files

- `test_models.py` - Tests for Pydantic models (RequestItemCreate, RequestCreate, RequestUpdate)
- `test_utils.py` - Tests for utility functions (get_inventree_headers, generate_request_reference)
- `conftest.py` - Shared fixtures and test configuration

## Installation

Module is automatically loaded when enabled in `config.yaml`:

```yaml
modules:
  active:
    - requests
```

Install dependencies including testing tools:

```bash
pip install -r src/backend/requirements.txt
```
