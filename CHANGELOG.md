# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added - 2024-12-23

#### Centralized State System for Requests
- **State Management**: Implemented centralized state system with 9 predefined states
  - New (workflow_level: 50)
  - Approved (workflow_level: 100)
  - Warehouse Approved (workflow_level: 250)
  - Warehouse Rejected (workflow_level: -1)
  - Stock Received (workflow_level: 350)
  - Warehouse Transfer Refused (workflow_level: -2)
  - Produced (workflow_level: 400)
  - Failed (workflow_level: -3)
  - Canceled (workflow_level: -4)

- **Database Collection**: `depo_requests_states` with indexed fields (slug, workflow_level, order)
- **State Transitions**: Defined allowed transitions between states
- **Workflow Levels**: Positive levels for active states, negative for terminal states
- **Helper Functions**: 
  - `get_state_by_slug()` - Retrieve state by slug
  - `update_request_state()` - Update request with state_id and workflow_level

#### Scripts and Tools
- `utils/import_requests_states.py` - Import states into MongoDB
- `utils/migrate_requests_to_states.py` - Migrate existing requests to state system
- `utils/refactor_status_to_states.py` - Refactor hardcoded status to use states
- `utils/REQUESTS_STATES.md` - Complete documentation

#### Operations Flow Improvements
- **Decision Section**: Always visible, not just when flow completed
- **Decision Persistence**: Saved in `operations_result` and `operations_result_reason` fields
- **Sign Validation**: Requires decision to be set before signing
- **Status Updates**: Automatic status update when flow completed with decision
- **Tab Visibility**: Operations tab remains visible when status = "Finished"

#### Frontend Enhancements
- Operations tab shows decision section at all times
- Decision saved and reloaded on refresh
- Improved workflow: Select decision → Save → Sign → Status updates automatically
- Receive Stock tab appears when status = "Finished"

### Changed
- Refactored `approval_routes.py` to use state system instead of hardcoded strings
- Updated status updates to use `update_request_state()` helper
- Migrated existing requests to include `state_id` and `workflow_level` fields

### Technical Details
- **Backward Compatibility**: `status` field maintained for compatibility
- **State Validation**: States validated against allowed_transitions
- **Indexing**: Unique index on slug, indexes on workflow_level and order
- **Backup**: Automatic backup created during refactoring

---

## Previous Changes

See git history for changes before 2024-12-23.
