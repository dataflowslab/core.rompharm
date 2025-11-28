# Procurement Edit Permissions - Test Guide

## Quick Test

```bash
# 1. Edit credentials in test script
# Open test_procurement_edit.py and set:
TEST_USERNAME = "your_username"
TEST_PASSWORD = "your_password"

# 2. Run test
python test_procurement_edit.py
```

## What the Test Checks

### 1. Authentication
- ✓ Login works with InvenTree credentials
- ✓ `/api/auth/me` endpoint returns user info
- ✓ Token is valid and contains `is_staff` flag

### 2. Order Access
- ✓ Can fetch purchase orders list
- ✓ Can get order details
- ✓ Order contains `responsible` field

### 3. Approval Flow
- ✓ Can fetch approval flow (or handle missing flow)
- ✓ Signatures count is correct
- ✓ Flow status is tracked

### 4. Edit Permissions Logic
```python
canEdit = True when:
  - User is admin (is_staff=True) OR
  - User is creator AND no signatures exist
  
canEdit = False when:
  - Order has signatures AND user is not admin
```

### 5. Update Functionality
- ✓ PATCH request works when allowed
- ✓ Returns 403 when not allowed

## Expected Output

### Admin User (can always edit):
```
✓ Login successful - User: admin, Admin: True
✓ Auth /me works - User ID: 123, Admin: True
✓ Found 5 purchase orders
✓ Order 3: PO-0003 - Status: Placed
✓ Approval flow exists - Signatures: 0
✓ User is admin - CAN EDIT
✓ Order update successful
```

### Creator User (can edit if no signatures):
```
✓ Login successful - User: john, Admin: False
✓ Auth /me works - User ID: 456, Admin: False
✓ Found 2 purchase orders
✓ Order 3: PO-0003 - Status: Placed
⚠ No approval flow exists yet
✓ User is creator and no signatures - CAN EDIT
✓ Order update successful
```

### Regular User (cannot edit):
```
✓ Login successful - User: jane, Admin: False
✓ Auth /me works - User ID: 789, Admin: False
✓ Found 2 purchase orders
✓ Order 3: PO-0003 - Status: Placed
✓ Approval flow exists - Signatures: 1
⚠ Order has signatures - CANNOT EDIT
ℹ Skipping update test - user cannot edit
```

## Troubleshooting

### Error: "Login failed: 401"
- Check username/password in script
- Verify InvenTree is accessible at https://rompharm.dataflows.ro

### Error: "/api/auth/me failed: 404"
- Backend needs restart after adding endpoint
- Run: `python -m invoke dev` or restart service

### Error: "Approval flow not found"
- This is OK if approval system not set up yet
- Script will still test edit permissions

### Fields are readonly in browser
- Check browser console for `[canEdit]` logs
- Verify `isAdmin` is `true` in logs
- Check `approvalFlow` is loaded correctly

## Manual Browser Test

1. Open browser DevTools (F12)
2. Go to Console tab
3. Navigate to procurement order details
4. Look for logs:
```
[canEdit] Checking permissions: {
  isAdmin: true,
  currentUserId: "123",
  orderResponsible: "123",
  approvalFlow: {...},
  signatures: 0
}
[canEdit] User is admin - CAN EDIT
```

5. Fields should be:
   - **White background** = editable
   - **Gray background** = readonly
   - **Save Changes button** visible when canEdit=true

## Backend Restart

After code changes:

**Windows:**
```powershell
cd d:\DEV\dataflows-core-rompharm
python -m invoke dev
```

**Linux (server):**
```bash
cd /home/rompharm/core.rompharm.dataflows.ro
git pull origin master
systemctl restart corerompharm.service
```

## Frontend Rebuild

After frontend changes:

```bash
cd src/frontend
npm run build
```

## API Endpoints Used

- `POST /api/auth/login` - Authenticate user
- `GET /api/auth/me` - Get current user info
- `GET /api/procurement/purchase-orders` - List orders
- `GET /api/procurement/purchase-orders/{id}` - Get order details
- `GET /api/procurement/purchase-orders/{id}/approval-flow` - Get signatures
- `PATCH /api/procurement/purchase-orders/{id}` - Update order
