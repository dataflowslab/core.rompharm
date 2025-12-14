# Recipes System (Rețete de Producție)

## Overview

Sistemul de rețete oferă o alternativă mai complexă la BOM (Bill of Materials) din InvenTree, permițând gestionarea avansată a ingredientelor cu suport pentru:
- Produse alternative (oricare dintre produsele specificate poate fi folosit)
- Validitate temporală (date start/fin pentru componente)
- Componente obligatorii vs opționale
- Structură ierarhică (grupuri în grupuri)
- Audit trail complet (toate modificările sunt loggate)

## Database Schema

### Collection: `depo_recipes`

```javascript
{
  "_id": ObjectId("..."),
  "id": 123,  // ID-ul produsului din InvenTree (NOTA: va fi înlocuit cu oid în viitor)
  "items": [
    {
      "type": 1,  // 1 = Single product, 2 = Alternative group
      "id": 456,  // ID produs din InvenTree (pentru type=1)
      "q": 10,    // Cantitate
      "start": ISODate("2024-01-01"),  // Data validitate început
      "fin": ISODate("2025-12-31"),    // Data validitate sfârșit (optional)
      "mandatory": true,  // Obligatoriu pentru producție
      "rev": 0,           // Revision number
      "rev_date": ISODate("2024-01-01"),  // Revision date
      "notes": "Optional notes",
      "items": [  // Pentru type=2 (grup alternative)
        {
          "type": 1,
          "id": 789,
          "q": 8,
          "start": ISODate("2024-01-01"),
          "mandatory": true,
          "rev": 0,
          "rev_date": ISODate("2024-01-01")
        }
      ]
    }
  ],
  "created_at": ISODate("2024-01-01"),
  "created_by": "username",
  "updated_at": ISODate("2024-01-01"),
  "updated_by": "username"
}
```

### Collection: `depo_parts`

```javascript
{
  "_id": ObjectId("..."),
  "id": 123,  // ID din InvenTree (NOTA: va fi înlocuit cu oid în viitor)
  "name": "Product Name",
  "IPN": "PROD-001",  // Internal Part Number (code)
  // ... alte câmpuri
}
```

### Collection: `depo_recipes_logs`

```javascript
{
  "_id": ObjectId("..."),
  "recipe_id": ObjectId("..."),  // Reference to depo_recipes
  "action": "create" | "update" | "delete" | "add_item" | "remove_item" | "update_item",
  "changes": {
    // Detailed changes
  },
  "timestamp": ISODate("2024-01-01"),
  "user": "username",
  "ip_address": "192.168.1.1",
  "user_agent": "Mozilla/5.0..."
}
```

## Business Rules

### Validitate Temporală

1. **Data Start**: Componenta devine validă de la această dată
2. **Data Fin**: 
   - Dacă lipsește → componenta este validă indefinit
   - Dacă există și este > data curentă → componenta este validă
   - Dacă există și este < data curentă → componenta NU este validă

### Type System

- **Type 1 (Single)**: Un singur produs specific
- **Type 2 (Alternatives)**: Grup de produse alternative (se poate folosi oricare)

### Structură Ierarhică

- Type 2 poate conține items (array de componente)
- Fiecare item din grup poate fi Type 1 sau Type 2
- Suport pentru nested groups (grupuri în grupuri)

### Mandatory Flag

- `true`: Componenta este obligatorie pentru producție
- `false`: Componenta este opțională

### Revision System

- `rev`: Număr de revizie (implicit 0)
- `rev_date`: Data reviziei (implicit data curentă)

## API Endpoints

### Recipes Management

```python
GET    /api/recipes                    # List all recipes
GET    /api/recipes/{id}               # Get recipe details
POST   /api/recipes                    # Create new recipe
PUT    /api/recipes/{id}               # Update recipe
DELETE /api/recipes/{id}               # Delete recipe

# Items management
POST   /api/recipes/{id}/items         # Add item to recipe
PUT    /api/recipes/{id}/items/{idx}   # Update item
DELETE /api/recipes/{id}/items/{idx}   # Remove item

# Alternative items (for type=2)
POST   /api/recipes/{id}/items/{idx}/alternatives  # Add alternative
DELETE /api/recipes/{id}/items/{idx}/alternatives/{alt_idx}  # Remove alternative

# Logs
GET    /api/recipes/{id}/logs          # Get recipe change history
```

### Parts Search

```python
GET    /api/recipes/parts              # Search parts from depo_parts
```

## Frontend Components

### RecipesPage.tsx
- List all recipes with search and sort
- Columns: Product Name, Code (IPN), Items Count, Created, Updated
- Search by product name and code
- Sort by any column
- New Recipe button

### RecipeDetailPage.tsx
- Recipe header (product info)
- Dynamic ingredients table
- Add/Edit/Delete ingredients
- Support for alternatives (nested structure)
- Audit log display

### Modals
- **NewRecipeModal**: Select product or enter manually
- **AddIngredientModal**: Add single product or group
- **AddAlternativeModal**: Add alternative to group

## Display Format

### Alternatives Display

When displaying a Type 2 (group) in the table, show alternatives as:
```
Solutie A (x10), Solutie B (x8), Solutie C (x12)
```

Format: `Name (xQuantity), Name2 (xQuantity2), ...`

## Migration Notes

**IMPORTANT**: Currently using `id` field which references InvenTree ID. 
In the future, this will be replaced with `oid` (ObjectId reference).

When migrating:
1. Add `oid` field to all documents
2. Populate `oid` with ObjectId references
3. Update all queries to use `oid` instead of `id`
4. Keep `id` for backward compatibility during transition
5. Eventually remove `id` field

## Usage in Requests Module

The Recipes system will replace InvenTree BOM as the source for the Requests module:
- When creating a request for a product, fetch recipe from `depo_recipes`
- Filter items by validity (start/fin dates)
- Display alternatives as selectable options
- Respect mandatory flag for validation

## Audit Trail

All changes to recipes are logged in `depo_recipes_logs`:
- Recipe creation/update/deletion
- Item addition/removal/update
- Alternative addition/removal
- User, timestamp, IP, and user agent tracked
- Detailed change information stored

## Example Recipe

```javascript
{
  "_id": ObjectId("..."),
  "id": 100,  // Product: "Aspirin 500mg Tablets"
  "items": [
    {
      "type": 1,  // Single ingredient
      "id": 200,  // "Aspirin Powder"
      "q": 500,
      "start": ISODate("2024-01-01"),
      "mandatory": true,
      "rev": 1,
      "rev_date": ISODate("2024-06-01"),
      "notes": "USP Grade required"
    },
    {
      "type": 2,  // Alternative group
      "q": 1,
      "start": ISODate("2024-01-01"),
      "mandatory": true,
      "rev": 0,
      "rev_date": ISODate("2024-01-01"),
      "notes": "Any approved binder",
      "items": [
        {
          "type": 1,
          "id": 300,  // "Starch Binder A"
          "q": 50,
          "start": ISODate("2024-01-01"),
          "mandatory": true,
          "rev": 0,
          "rev_date": ISODate("2024-01-01")
        },
        {
          "type": 1,
          "id": 301,  // "Starch Binder B"
          "q": 45,
          "start": ISODate("2024-01-01"),
          "mandatory": true,
          "rev": 0,
          "rev_date": ISODate("2024-01-01")
        }
      ]
    }
  ]
}
```

Display in table:
```
Row 1: Aspirin Powder | Single | 500 | 2024-01-01 | - | Yes | Rev 1
Row 2: Starch Binder A (x50), Starch Binder B (x45) | Alternatives | 1 | 2024-01-01 | - | Yes | Rev 0
```
