# MUST KNOW - DataFlows Core

## Critical Issues & Solutions

### 1. Mantine Select "Duplicate options" Error - SOLVED WITH SafeSelect

**Problem**: Mantine Select throws error when receiving duplicate values or `undefined` values in options array.

**Symptoms**:
- Console error: `[@mantine/core] Duplicate options are not supported. Option with value "undefined" was provided more than once`
- White screen / page crash
- Happens when typing in searchable Select components

**Root Cause**:
- API returns `_id` but code uses `id` inconsistently
- Select receives options with `undefined`, `null`, or empty string values
- Multiple options have the same value
- State updates cause temporary undefined values during data loading

**✅ BEST SOLUTION - Use SafeSelect Component**:

```typescript
// Import the safe component
import { SafeSelect, SafeMultiSelect } from '@/components/Common';

// ✅ BEST - Automatic handling of everything
<SafeSelect
  label="Article"
  data={parts}  // API data with _id and name - auto-detected!
  value={selectedPart}
  onChange={setSelectedPart}
  searchable
  debug={true}  // Enable for troubleshooting
/>
```

**What SafeSelect Does Automatically**:
1. ✅ Detects `_id` or `id` automatically (no manual mapping!)
2. ✅ Removes `undefined`, `null`, empty values
3. ✅ Removes duplicate values
4. ✅ Validates selected value exists in options
5. ✅ Provides debug logging when `debug={true}`
6. ✅ Works with any data format (objects, strings, pre-formatted)

**SafeSelect Props**:
```typescript
<SafeSelect
  data={items}        // Array of objects, strings, or {value, label}
  valueKey="custom"   // Optional: specify value key (default: auto-detect _id/id)
  labelKey="name"     // Optional: specify label key (default: 'name')
  debug={true}        // Optional: enable console logging
  // ... all standard Mantine Select props
/>
```

**Migration Examples**:

```typescript
// ❌ OLD WAY - Manual mapping and sanitization
import { sanitizeSelectOptions } from '../utils/selectHelpers';

<Select
  data={sanitizeSelectOptions(
    parts.map(part => ({
      value: part._id,
      label: `${part.name} (${part.IPN})`
    }))
  )}
/>

// ✅ NEW WAY - Automatic with SafeSelect
import { SafeSelect } from '@/components/Common';

<SafeSelect
  data={parts.map(part => ({
    _id: part._id,
    label: `${part.name} (${part.IPN})`
  }))}
/>

// ✅ EVEN SIMPLER - Let SafeSelect handle everything
<SafeSelect
  data={parts}  // Just pass raw API data!
  labelKey="name"  // Or custom: (item) => `${item.name} (${item.IPN})`
/>
```

**Debug Mode**:
```typescript
<SafeSelect
  data={parts}
  debug={true}  // Logs to console
/>

// Console output:
// [SafeSelect] Data processed: {
//   input: 10,
//   output: 9,
//   removed: 1,
//   sample: { value: "693ea...", label: "PRODUS TEST" }
// }
```

**For MultiSelect**:
```typescript
import { SafeMultiSelect } from '@/components/Common';

<SafeMultiSelect
  label="Select Multiple Items"
  data={items}
  value={selectedItems}
  onChange={setSelectedItems}
  searchable
/>
```

**Where to Use**:
- ✅ **ALL Select components** - Replace `<Select>` with `<SafeSelect>`
- ✅ **ALL MultiSelect components** - Replace `<MultiSelect>` with `<SafeMultiSelect>`
- ✅ Search dropdowns (parts, locations, users)
- ✅ Dynamic options loaded from API
- ✅ Filtered options based on other selections

**Documentation**:
- Full guide: `src/frontend/SAFE_SELECT_GUIDE.md`
- Component location: `src/frontend/src/components/Common/SafeSelect.tsx`
- Helper functions: `src/frontend/src/utils/selectHelpers.ts`

**Prevention Checklist**:
1. ✅ Use `SafeSelect` instead of `Select`
2. ✅ Use `SafeMultiSelect` instead of `MultiSelect`
3. ✅ Enable `debug={true}` during development
4. ✅ Let SafeSelect auto-detect `_id`/`id` (don't map manually)
5. ✅ Check console for `[SafeSelect]` warnings

**Common Locations Updated**:
- ✅ `AddItemModal.tsx` - Article and batch selection
- ✅ `OperationsTab.tsx` - Part search
- ✅ `RequestsPage.tsx` - Filters

### ⚠️ CRITICAL: Select with AJAX Search - "Disappearing Value" Fix

**Problem**: Mantine Select with AJAX search causes "disappearing value" bug - selected value vanishes when clicking other inputs or when search results update.

**Root Cause**: When `parts` array updates from search, the selected item is removed from the list if it doesn't match the new search results.

**Solution**: **Add selected item to local array** (jQuery pattern)

```typescript
// ✅ BEST SOLUTION - Add to local array on selection
const [parts, setParts] = useState<Part[]>([]);

const handlePartSelect = (partId: string | null) => {
  if (partId) {
    const selected = parts.find(p => p._id === partId);
    
    if (selected && !parts.some(p => p._id === partId)) {
      // Add to parts array if not already there (keep it persistent!)
      setParts([selected, ...parts]);
    }
    
    loadBatchCodes(partId);
  }
};

<Select
  data={parts.map(part => ({
    value: part._id,
    label: `${part.name} (${part.IPN})`
  }))}
  value={selectedPartId}
  onChange={handlePartSelect}
  onSearchChange={debouncedSearch}
  searchable
/>
```

**Why This Works**:
✅ Selected item stays in `parts` array permanently  
✅ No "disappearing value" bug  
✅ Simple - no extra state needed  
✅ Classic jQuery pattern - proven solution  
✅ Works with Mantine Select's internal search  

**Alternative (More Complex)**:
```typescript
// ⚠️ ALTERNATIVE - Include selected in data prop
<Select
  data={[
    ...(selectedPart ? [{ value: selectedPart._id, label: selectedPart.name }] : []),
    ...parts.filter(p => p._id !== selectedPart?._id).map(...)
  ]}
/>
```

**When to Use What**:

| Scenario | Solution | Why |
|----------|----------|-----|
| **AJAX Search** | Add to local array | **BEST!** Simple, no bugs |
| Static dropdown | Regular Select | No search needed |
| Small list (< 50) | Regular Select | OK for static data |

**Real Examples in Project**:
- ✅ `OperationsTab.tsx` - Add Item modal (handlePartSelect)
- ✅ `RequestsPage.tsx` - Part search in New Request modal
- ✅ `AddItemModal.tsx` - Article select

### Debounce Search Inputs (250ms)

**Problem**: Too many API requests when typing in search fields.

**Solution**: Use `debounce()` helper to delay search execution.

```typescript
import { debounce } from '../utils/selectHelpers';

// Create debounced search function (250ms delay)
const debouncedSearch = debounce(searchParts, 250);

<Autocomplete
  onChange={(value) => {
    setSearchValue(value);
    debouncedSearch(value);  // Trigger API call after 250ms
  }}
/>
```

**Benefits**:
- Reduces API calls by ~80%
- Better UX (no lag)
- Lower server load

**Default Wait Time**: 250ms (optimal for search)

---

## 2. MongoDB ObjectId vs Integer ID

**Rule**: All IDs in this project use MongoDB ObjectId (string format), NOT integer IDs from InvenTree.

**Correct Types**:
```typescript
// ✅ CORRECT
interface Location {
  _id: string;  // MongoDB ObjectId
  pk: string;   // Also ObjectId for compatibility
  name: string;
}

// ❌ WRONG
interface Location {
  _id: number;  // NO! This is InvenTree legacy
  pk: number;   // NO!
}
```

**Backend**:
- Use `ObjectId(id_string)` for MongoDB queries
- Convert to string before sending to frontend: `str(obj['_id'])`

**Frontend**:
- Always use string IDs
- Never use `parseInt()` on IDs
- Send IDs as strings to backend

---

## 3. React State Updates & Conditional Rendering

**Problem**: Using `&&` operator in JSX can render `false`, `0`, or `undefined` as text.

**Solution**: Use ternary operator `? : null`

```typescript
// ❌ BAD - Can render "0" or "false" as text
{count && <Component />}
{items.length && <List />}

// ✅ GOOD - Renders nothing when false
{count > 0 ? <Component /> : null}
{items.length > 0 ? <List /> : null}
```

---

## 4. Document Generation

**Template System**: DataFlows Docu (external service)

**Key Points**:
- Templates identified by code (e.g., `6LL5WVTR8BTY`)
- Documents generated asynchronously (job-based)
- Status polling required: `queued` → `processing` → `done`
- Data sent as `data.items` (NOT `data.line_items` - that's a method!)

**Template Data Structure**:
```python
document_data = {
    'data': {
        'order': {...},
        'source_location': {...},
        'destination_location': {...},
        'line_items': items_with_details,  # Array of items
        'qr_code_svg': qr_svg
    }
}
```

**Jinja2 Template**:
```jinja2
{% for item in data.line_items %}  {# NOT data.items! #}
  {{ item.part_detail.name if item.part_detail else 'N/A' }}
{% endfor %}
```

---

## 5. Approval Flows & Signature Components

**Auto-Creation**: Approval flows are created automatically when a request is created.

**Signature Workflow**:
1. User signs → `POST /api/requests/{id}/sign`
2. Backend checks if user can sign
3. Adds signature to flow
4. Checks if flow is complete (min_signatures met + all must_sign signed)
5. Updates request status if approved

**Important**: After signing, reload page to refresh all tabs: `window.location.reload()`

### ✅ Global Signature Components (MUST USE)

**Location**: `src/frontend/src/components/Requests/`

**Two Reusable Components**:

1. **DecisionSection.tsx** - Status selection with reason field
2. **SignaturesSection.tsx** - Signature flow display and signing

**Why Use Them**:
- ✅ Consistent UI across all tabs (Operations, Reception, Production)
- ✅ DRY principle - no code duplication
- ✅ Centralized logic for signature validation
- ✅ Automatic handling of officers list, signatures table, and completion status

**Usage Example**:

```typescript
import { DecisionSection } from './DecisionSection';
import { SignaturesSection } from './SignaturesSection';

// In your tab component (OperationsTab, ReceptieTab, ProductionTab):
<Grid>
  {/* Left: Decision (1/3) */}
  <Grid.Col span={4}>
    <Paper withBorder p="md">
      <Title order={5} mb="md">{t('Decision')}</Title>
      <DecisionSection
        status={finalStatus}
        reason={refusalReason}
        isCompleted={isFlowCompleted()}
        availableStates={availableStates}
        onStatusChange={(value) => setFinalStatus(value || '')}
        onReasonChange={setRefusalReason}
        onSubmit={handleSubmitStatus}
        submitting={submitting}
      />
    </Paper>
  </Grid.Col>

  {/* Right: Signatures (2/3) */}
  <Grid.Col span={8}>
    <Paper withBorder p="md">
      <SignaturesSection
        canSign={canUserSign()}
        isCompleted={isFlowCompleted()}
        canSignOfficers={flow.can_sign_officers}
        minSignatures={flow.min_signatures}
        signatures={flow.signatures}
        isStaff={isStaff}
        onSign={handleSign}
        onRemoveSignature={handleRemoveSignature}
        signing={signing}
      />
    </Paper>
  </Grid.Col>
</Grid>
```

**DecisionSection Props**:
```typescript
interface DecisionSectionProps {
  status: string;                    // Selected state ID
  reason: string;                    // Refusal reason
  isCompleted: boolean;              // Is flow completed?
  availableStates: RequestState[];   // States from DB
  onStatusChange: (value: string | null) => void;
  onReasonChange: (value: string) => void;
  onSubmit: () => void;              // Save decision
  submitting: boolean;
}
```

**SignaturesSection Props**:
```typescript
interface SignaturesSectionProps {
  canSign: boolean;                  // Can current user sign?
  isCompleted: boolean;              // Is flow completed?
  canSignOfficers: ApprovalOfficer[]; // Officers who can sign
  minSignatures: number;             // Minimum required
  signatures: ApprovalSignature[];   // Existing signatures
  isStaff: boolean;                  // Can remove signatures?
  onSign: () => void;                // Sign handler
  onRemoveSignature: (userId: string, username: string) => void;
  signing: boolean;                  // Is signing in progress?
}
```

**What SignaturesSection Shows**:
1. **Optional Approvers Table** - List of officers with status badges (Signed/Pending)
2. **Signatures List** - Table of completed signatures with date and hash
3. **Sign Button** - Appears when user can sign and flow not completed
4. **Remove Button** - For staff to remove signatures (admin only)

**❌ DON'T Create Custom Signature UI**:
```typescript
// ❌ BAD - Custom implementation
<Table>
  {flow.signatures.map(sig => (
    <tr><td>{sig.username}</td></tr>
  ))}
</Table>
```

**✅ DO Use Global Components**:
```typescript
// ✅ GOOD - Reusable component
<SignaturesSection
  canSign={canUserSign()}
  isCompleted={isFlowCompleted()}
  canSignOfficers={flow.can_sign_officers}
  minSignatures={flow.min_signatures}
  signatures={flow.signatures}
  isStaff={isStaff}
  onSign={handleSign}
  onRemoveSignature={handleRemoveSignature}
  signing={signing}
/>
```

**Where Used**:
- ✅ `OperationsTab.tsx` - Operations flow
- ✅ `ReceptieTab.tsx` - Reception flow
- ✅ `ProductionTab.tsx` - Production flow
- ✅ Any future approval flows

**Benefits**:
- Single source of truth for signature UI
- Easy to update all tabs at once
- Consistent user experience
- Less code to maintain

---

## 6. Batch Codes & Initial Quantities

**When Creating Requests**:
- Always send `init_q` (initial quantity) = `quantity`
- Send `batch_code` if available from batch selection
- `series` field is deprecated (leave as null)

```typescript
{
  part: "693ea9fc71d731f72ad6542c",
  quantity: 12,
  init_q: 12,  // ✅ Save initial quantity
  batch_code: "BATCH001",  // ✅ If selected
  notes: "..."
}
```

---

## 7. Command Separator

**Rule**: Use `;` instead of `&&` for command chaining in Windows.

```bash
# ❌ WRONG (Linux/Mac)
cd project && npm install

# ✅ CORRECT (Windows)
cd project ; npm install
```

---

## 8. Project Documentation

**Only 2 MD Files Allowed**:
1. `README.md` - Installation, setup, description
2. `CHANGELOG.md` - Version history, changes, observations

**Forbidden**:
- Deployment guides
- Step-by-step tutorials
- Architecture documents
- API documentation files

Keep everything in README or CHANGELOG.

---

## 9. Error Handling Best Practices

**Always Log Errors**:
```typescript
try {
  await api.post(...)
} catch (error: any) {
  console.error('Failed to create request:', error);
  notifications.show({
    title: t('Error'),
    message: error.response?.data?.detail || t('Failed to create request'),
    color: 'red'
  });
}
```

**Backend**:
```python
try:
    result = collection.find_one(...)
except Exception as e:
    print(f"[ERROR] Failed to fetch: {e}")
    raise HTTPException(status_code=500, detail=str(e))
```

---

## 10. TypeScript Interfaces

**Consistency**: Keep interfaces synchronized between components.

**Example**:
```typescript
// Shared interface
interface StockLocation {
  _id: string;
  pk: string;  // For compatibility
  name: string;
  code: string;
}

// Use across all components
import { StockLocation } from '../types';
```

---

## Quick Reference

| Issue | Solution |
|-------|----------|
| Duplicate options error | Use `sanitizeSelectOptions()` helper |
| Integer IDs | Convert to ObjectId strings |
| `&&` rendering issues | Use ternary `? : null` |
| Items not editable after sign | Reload page: `window.location.reload()` |
| Document template error | Use `data.line_items` not `data.items` |
| Command chaining | Use `;` not `&&` |
| Too many MD files | Keep only README + CHANGELOG |

---

**Last Updated**: 2025-12-25
