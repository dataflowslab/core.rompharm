# Recipes Frontend Implementation TODO

## Status: Backend Complete ✅ | Frontend Pending ⏳

## Backend Completed
- ✅ Models: `RecipeModel`, `RecipeLogModel`
- ✅ Routes: `/api/recipes` endpoints
- ✅ Database schema documented
- ✅ Audit logging system
- ✅ Integration with app.py

## Frontend Components Needed

### 1. RecipesPage.tsx
**Location**: `src/frontend/src/pages/RecipesPage.tsx`

**Features**:
- Table with columns: Product Name, Code (IPN), Items Count, Created, Updated
- Search bar (searches name and code)
- Sortable columns (click header to sort)
- "New Recipe" button → opens NewRecipeModal
- Click row → navigate to `/recipes/{id}`

**API Calls**:
- `GET /api/recipes?search={query}`

### 2. RecipeDetailPage.tsx
**Location**: `src/frontend/src/pages/RecipeDetailPage.tsx`

**Features**:
- Recipe header (product name, code)
- Dynamic ingredients table with columns:
  - Description (product name or alternatives list)
  - Type (Single / Alternatives)
  - Quantity
  - Start Date
  - End Date
  - Mandatory (Yes/No)
  - Revision
  - Actions (Edit, Delete)
- "Add Ingredient" button → opens AddIngredientModal
- For Type=2 (Alternatives), show button to add alternatives
- Audit log section at bottom

**Display Format for Alternatives**:
```
Solutie A (x10), Solutie B (x8), Solutie C (x12)
```

**API Calls**:
- `GET /api/recipes/{id}`
- `POST /api/recipes/{id}/items`
- `DELETE /api/recipes/{id}/items/{index}`
- `GET /api/recipes/{id}/logs`

### 3. NewRecipeModal.tsx
**Location**: `src/frontend/src/components/Recipes/NewRecipeModal.tsx`

**Features**:
- Select product from dropdown (AJAX search)
- OR manual entry: Name + Code (IPN)
- On save → redirect to `/recipes/{id}`

**API Calls**:
- `GET /api/recipes/parts?search={query}` (for dropdown)
- `POST /api/recipes`

### 4. AddIngredientModal.tsx
**Location**: `src/frontend/src/components/Recipes/AddIngredientModal.tsx`

**Features**:
- Type selector: Single / Alternatives
- Product search (AJAX)
- Quantity input
- Start date (default: today)
- End date (optional)
- Mandatory checkbox (default: checked)
- Revision number (default: 0)
- Revision date (default: today)
- Notes textarea

**For Type=2 (Alternatives)**:
- After adding, show button to add alternative products
- Each alternative has same fields as above

**API Calls**:
- `GET /api/recipes/parts?search={query}`
- `POST /api/recipes/{id}/items`

### 5. AddAlternativeModal.tsx
**Location**: `src/frontend/src/components/Recipes/AddAlternativeModal.tsx`

**Features**:
- Similar to AddIngredientModal but for adding alternatives to a group
- Product search
- Quantity, dates, mandatory, revision fields

**API Calls**:
- `GET /api/recipes/parts?search={query}`
- `POST /api/recipes/{id}/items/{index}/alternatives`

## Routing

Add to `src/frontend/src/App.tsx`:
```typescript
<Route path="/recipes" element={<ProtectedRoute><RecipesPage /></ProtectedRoute>} />
<Route path="/recipes/:id" element={<ProtectedRoute><RecipeDetailPage /></ProtectedRoute>} />
```

## Menu Integration

Add to menu in `src/frontend/src/components/Layout/Header.tsx`:
```typescript
{
  label: t('Recipes'),
  link: '/recipes',
  icon: <IconChefHat size={16} />
}
```

## API Service

Create `src/frontend/src/services/recipes.ts`:
```typescript
import api from './api';

export const recipesApi = {
  list: (search?: string) => api.get('/api/recipes', { params: { search } }),
  get: (id: string) => api.get(`/api/recipes/${id}`),
  create: (data: any) => api.post('/api/recipes', data),
  addItem: (id: string, data: any) => api.post(`/api/recipes/${id}/items`, data),
  removeItem: (id: string, index: number) => api.delete(`/api/recipes/${id}/items/${index}`),
  searchParts: (search: string) => api.get('/api/recipes/parts', { params: { search } }),
  getLogs: (id: string) => api.get(`/api/recipes/${id}/logs`)
};
```

## UI Components to Use

- **Mantine Table** for recipes list and ingredients
- **Mantine Modal** for all modals
- **Mantine Select** with searchable for product selection
- **Mantine DatePickerInput** for dates
- **Mantine Checkbox** for mandatory flag
- **Mantine NumberInput** for quantity and revision
- **Mantine Textarea** for notes
- **Mantine Badge** for Type display (Single/Alternatives)
- **Mantine ActionIcon** for edit/delete buttons

## Validation Rules

1. **Start Date**: Cannot be in the future
2. **End Date**: Must be after Start Date (if provided)
3. **Quantity**: Must be > 0
4. **Revision**: Must be >= 0
5. **Product**: Required for Type=1
6. **Alternatives**: Type=2 must have at least 1 alternative

## Display Logic

### Valid Components
Show only components where:
- `start <= today`
- `fin` is null OR `fin > today`

### Alternatives Display
For Type=2, concatenate alternatives:
```typescript
const displayAlternatives = (items) => {
  return items.map(item => `${item.part_detail.name} (x${item.q})`).join(', ');
};
```

## Next Steps

1. Create RecipesPage.tsx with table and search
2. Create NewRecipeModal.tsx
3. Create RecipeDetailPage.tsx with ingredients table
4. Create AddIngredientModal.tsx
5. Add routing and menu integration
6. Test complete flow
7. Add translations (ro/en)

## Notes

- All dates use ISO format (YYYY-MM-DD)
- Audit logs show at bottom of detail page
- Use Mantine notifications for success/error messages
- Implement optimistic UI updates where possible
- Add loading states for all async operations
