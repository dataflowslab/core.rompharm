# API Routes Documentation
**Last Updated:** 2026-02-22 19:01:14
**Auto-generated** - Do not edit manually. Run `python src/scripts/generate_routes_doc.py` to update.
---
## 🌐 Global Platform Routes
### Data
- `POST /api/data/` - Upload a file (public endpoint for form submissions)
- `DELETE /api/data/submission/{submission_id}` - Upload a file (public endpoint for form submissions)
- `GET /api/data/submission/{submission_id}` - Upload a file (public endpoint for form submissions)
- `GET /api/data/submission/{submission_id}/history` - Upload a file (public endpoint for form submissions)
- `PUT /api/data/submission/{submission_id}/state` - Upload a file (public endpoint for form submissions)
- `GET /api/data/submissions/all` - Upload a file (public endpoint for form submissions)
- `GET /api/data/submissions/stats` - Upload a file (public endpoint for form submissions)
- `POST /api/data/upload` - Upload a file (public endpoint for form submissions)
- `GET /api/data/{form_id}` - Upload a file (public endpoint for form submissions)

### Forms
- `GET /api/forms/{slug}` - List all forms (requires administrator access)

### Sales
- `GET /api/sales/customers` - Stub endpoint for customers list.
- `GET /api/sales/order-statuses` - Stub endpoint for sales order statuses.
- `GET /api/sales/sales-orders` - Stub endpoint for sales orders list.
- `GET /api/sales/sales-orders/{order_id}` - Stub endpoint for sales order detail.
- `GET /api/sales/sales-orders/{order_id}/attachments` - Stub endpoint for sales order attachments.
- `GET /api/sales/sales-orders/{order_id}/items` - Stub endpoint for sales order items.
- `GET /api/sales/sales-orders/{order_id}/shipments` - Stub endpoint for sales order shipments.
- `PATCH /api/sales/sales-orders/{order_id}/status` - Stub endpoint for updating sales order status.

---

## 📦 Module Routes
### depo_procurement (`/modules/depo_procurement/api`)

**Document Templates**
- `GET /modules/depo_procurement/api/document-templates` - Get document template codes for procurement orders

**Order Statuses**
- `GET /modules/depo_procurement/api/order-statuses` - Get available purchase order statuses/states

**Parts**
- `GET /modules/depo_procurement/api/parts` - Get list of parts from MongoDB

**Purchase Orders**
- `GET /modules/depo_procurement/api/purchase-orders` - Get list of purchase orders from MongoDB with filters
- `POST /modules/depo_procurement/api/purchase-orders` - Create a new purchase order in MongoDB
- `GET /modules/depo_procurement/api/purchase-orders/{order_id}` - Get a specific purchase order from MongoDB
- `PATCH /modules/depo_procurement/api/purchase-orders/{order_id}` - Update a purchase order in MongoDB
- `GET /modules/depo_procurement/api/purchase-orders/{order_id}/approval-flow` - Get approval flow for a purchase order
- `POST /modules/depo_procurement/api/purchase-orders/{order_id}/approval-flow` - Create approval flow for a purchase order using approval_templates
- `GET /modules/depo_procurement/api/purchase-orders/{order_id}/attachments` - Get attachments for a purchase order
- `POST /modules/depo_procurement/api/purchase-orders/{order_id}/attachments` - Upload an attachment to a purchase order
- `DELETE /modules/depo_procurement/api/purchase-orders/{order_id}/attachments/{attachment_id}` - Delete an attachment from a purchase order
- `PATCH /modules/depo_procurement/api/purchase-orders/{order_id}/documents` - Update documents field in purchase order
- `GET /modules/depo_procurement/api/purchase-orders/{order_id}/items` - Get items for a purchase order
- `POST /modules/depo_procurement/api/purchase-orders/{order_id}/items` - Add an item to a purchase order
- `DELETE /modules/depo_procurement/api/purchase-orders/{order_id}/items/{item_id}` - Delete an item from a purchase order by item _id
- `PUT /modules/depo_procurement/api/purchase-orders/{order_id}/items/{item_id}` - Update an item in a purchase order by item _id
- `GET /modules/depo_procurement/api/purchase-orders/{order_id}/journal` - Get activity journal for purchase order
- `GET /modules/depo_procurement/api/purchase-orders/{order_id}/qc-records` - Get QC records for a purchase order
- `POST /modules/depo_procurement/api/purchase-orders/{order_id}/qc-records` - Create a new QC record for a purchase order
- `PATCH /modules/depo_procurement/api/purchase-orders/{order_id}/qc-records/{qc_id}` - Update a QC record
- `POST /modules/depo_procurement/api/purchase-orders/{order_id}/receive-stock` - Receive stock items for a purchase order line
- `GET /modules/depo_procurement/api/purchase-orders/{order_id}/received-items` - Get received stock items for a purchase order
- `GET /modules/depo_procurement/api/purchase-orders/{order_id}/received-stock-approval-flow` - Get approval flow for received stock
- `POST /modules/depo_procurement/api/purchase-orders/{order_id}/received-stock-approval-flow` - Create approval flow for received stock
- `DELETE /modules/depo_procurement/api/purchase-orders/{order_id}/received-stock-signatures/{user_id}` - Remove signature from received stock approval flow
- `POST /modules/depo_procurement/api/purchase-orders/{order_id}/sign` - Sign a purchase order approval flow
- `POST /modules/depo_procurement/api/purchase-orders/{order_id}/sign-received-stock` - Sign received stock approval flow
- `DELETE /modules/depo_procurement/api/purchase-orders/{order_id}/signatures/{user_id}` - Remove signature from purchase order approval flow (admin only)
- `PATCH /modules/depo_procurement/api/purchase-orders/{order_id}/state` - Update purchase order state

**Stock Items**
- `DELETE /modules/depo_procurement/api/stock-items/{stock_id}` - Delete a received stock item

**Stock Statuses**
- `GET /modules/depo_procurement/api/stock-statuses` - Get available stock statuses from depo_stocks_states collection

### requests (`/modules/requests/api`)

**Parts**
- `GET /modules/requests/api/parts` - Get list of parts from MongoDB depo_parts with search
- `GET /modules/requests/api/parts/{part_id}/batch-codes` - Get available batch codes for a part from MongoDB depo_stocks using ObjectId
- `GET /modules/requests/api/parts/{part_id}/bom` - Get BOM (Bill of Materials) for a part from MongoDB depo_bom using ObjectId
- `GET /modules/requests/api/parts/{part_id}/recipe` - Get recipe for a part (with fallback to BOM if no recipe exists) using ObjectId
- `GET /modules/requests/api/parts/{part_id}/stock-info` - Get stock information for a part from MongoDB depo_stocks with batches using ObjectId
- `GET /modules/requests/api/` - List all requests with location names from depo_locations
- `POST /modules/requests/api/` - Create a new request

**States**
- `GET /modules/requests/api/states` - Get list of request states from MongoDB depo_requests_states

**Stock Locations**
- `GET /modules/requests/api/stock-locations` - Get list of stock locations from MongoDB depo_locations

**{Request_Id}**
- `DELETE /modules/requests/api/{request_id}` - Delete a request
- `GET /modules/requests/api/{request_id}` - Get a specific request by ID with location and part details from MongoDB
- `PATCH /modules/requests/api/{request_id}` - Update a request

---

## 📝 Notes

- All routes except `/api/auth/login` require authentication
- Admin-only routes require `is_staff` or `is_superuser` flag
- Module routes follow pattern: `/modules/{module_name}/api/{resource}`
- Global routes follow pattern: `/api/{resource}`

---

**To update this documentation, run:**
```bash
python src/scripts/generate_routes_doc.py
```
