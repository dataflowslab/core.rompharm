# Changelog - Requests Module

## Version 1.0.0 - Initial Release

### Added
- Complete stock transfer request management system
- Auto-generated reference numbers (REQ-NNNN format)
- Part selection with stock information from MongoDB
- BOM support for assemblies
- Approval workflow integration
- Operations and Reception approval flows
- Document generation support
- Batch code management
- Status tracking workflow

### Features
- Create/Read/Update/Delete requests
- Source and destination location selection
- Part search with autocomplete
- Stock information display (total, allocated, available)
- Batch codes with expiry dates
- Recipe integration with BOM fallback
- Config-based approval flows
- Signature workflows
- Status management with reason tracking

### API Endpoints
- 15+ endpoints for complete request management
- Stock location integration
- Part search and stock info
- BOM and recipe integration
- Approval flow management
- Signature operations

### Database
- `depo_requests_items` - Request documents
- `approval_flows` - Approval workflows
- Integration with `depo_parts`, `depo_stocks`

### Notes
- Requests stored in MongoDB (not InvenTree)
- Stock information from MongoDB `depo_stocks`
- Approval flows use config-based system
- Document templates: 6LL5WVTR8BTY, RC45WVTRBDGT
- Source and destination validation
- Auto-create approval flow on request creation
