# Changelog

All notable changes to this project will be documented in this file.

## [1.18.3] - 2024-12-20

### Fixed
- **Procurement Items**: Added MongoDB ObjectId (`_id`) to each item for proper identification
  - New items automatically get unique `_id` when created
  - Old items without `_id` get one automatically when fetched
  - Edit/Delete operations now use item `_id` instead of array index
- **Procurement Items**: Fixed destination details not showing in table
  - Backend now enriches items with `destination_detail` when fetching
  - Frontend properly displays destination name in Reference column
- **Procurement Items**: Update button now works correctly with item `_id`
- **Inventory Parts Filter**: Parts list in procurement now shows only active articles (`is_active = true`)
- **Article Edit Form**: Removed duplicate "Unit of Measure" field (kept only "System U.M." field)

### Technical Notes
- Backend routes changed from `/items/{item_index}` to `/items/{item_id}`
- Added `update_order_item_by_id()` and `delete_order_item_by_id()` service functions
- `get_order_items()` now enriches with both part and destination details
- Backward compatibility maintained for items without `_id`
- Items automatically get `_id` field on first fetch if missing
- `/modules/inventory/api/parts` endpoint now filters by `is_active: true` by default

---

*For complete changelog history, see previous versions in utils folder*
