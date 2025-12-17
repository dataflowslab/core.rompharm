# Creating New Modules - Guidelines

## Module Structure

Each module MUST be self-contained with all its functionality inside the module folder.

### Required Structure

```
modules/
└── module_name/
    ├── frontend/                  # Frontend components (React/TypeScript)
    │   ├── pages/                # Page components
    │   │   ├── PageName.tsx
    │   │   └── index.ts         # Exports
    │   ├── components/           # Reusable components
    │   │   ├── ComponentName.tsx
    │   │   └── index.ts         # Exports
    │   └── README.md            # Frontend documentation
    ├── routes.py                 # FastAPI routes (backend)
    ├── services.py               # Business logic (backend)
    ├── config.json               # Module configuration
    ├── __init__.py               # Python package init
    ├── CHANGELOG.md              # Version history and changes
    └── README.md                 # Module documentation
```

## Important Rules

### 1. Self-Contained Modules

**✅ CORRECT:**
- All frontend pages in `modules/module_name/frontend/pages/`
- All frontend components in `modules/module_name/frontend/components/`
- All backend routes in `modules/module_name/routes.py`
- All business logic in `modules/module_name/services.py`

**❌ WRONG:**
- Frontend pages in `src/frontend/src/pages/` (outside module)
- Components scattered in core application
- Routes mixed with core routes

### 2. Module Context

When discussing a module's functionality, **everything** must be contained within that module's folder. This includes:

- Frontend pages and components
- Backend API routes
- Business logic and services
- Module-specific utilities
- Module documentation

### 3. Documentation

Each module MUST have exactly **TWO** markdown files:

1. **README.md** - Installation info, description, features, API endpoints, database schemas, requirements
2. **CHANGELOG.md** - Version history, changes, observations

**Do NOT create:**
- Deployment guides
- Setup steps documents
- Multiple documentation files

### 4. Frontend Integration

Frontend pages from modules should be imported in the main App routing:

```typescript
// In src/frontend/src/App.tsx
import { PageName } from './modules/module_name/frontend/pages';

// Add routes:
<Route path="/module-path" element={<PageName />} />
```

### 5. Backend Integration

Backend routes are automatically loaded by the core application when the module is activated in `config.yaml`:

```yaml
modules:
  active:
    - module_name
```

## Module Configuration

### config.json

```json
{
  "name": "Module Name",
  "version": "1.0.0",
  "description": "Module description",
  "author": "Author Name",
  "routes_prefix": "/modules/module_name/api",
  "requires": []
}
```

### __init__.py

```python
"""
Module Name - Description
"""
from .routes import router

__all__ = ['router']
```

## Backend Structure

### routes.py

```python
"""
Module Name - API Routes
"""
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
from typing import Optional, List

from src.backend.utils.db import get_db
from src.backend.routes.auth import verify_token

router = APIRouter(prefix="/modules/module_name/api", tags=["module_name"])

# Define routes here
```

### services.py

```python
"""
Module Name - Business Logic Services
"""
from fastapi import HTTPException
from datetime import datetime
from bson import ObjectId

from src.backend.utils.db import get_db

# Define service functions here
```

## Frontend Structure

### pages/PageName.tsx

```typescript
import { useState, useEffect } from 'react';
import { Container, Title, Paper } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { api } from '../../../../src/frontend/src/services/api';

export function PageName() {
  // Component logic here
  
  return (
    <Container size="xl">
      <Title order={2}>Page Title</Title>
      {/* Page content */}
    </Container>
  );
}
```

### pages/index.ts

```typescript
export { PageName } from './PageName';
export { AnotherPage } from './AnotherPage';
```

## Best Practices

### 1. API Endpoints

- Use consistent naming: `/modules/module_name/api/resource`
- Follow REST conventions (GET, POST, PUT, DELETE)
- Return consistent response formats

### 2. Error Handling

- Use HTTPException with appropriate status codes
- Provide clear error messages
- Log errors for debugging

### 3. Database Operations

- Use MongoDB ObjectId for references
- Serialize documents properly (convert ObjectId to string)
- Handle datetime serialization

### 4. Frontend Components

- Use TypeScript for type safety
- Use Mantine UI components for consistency
- Handle loading and error states
- Show notifications for user feedback

### 5. Code Organization

- Keep routes thin, move logic to services
- Reuse components where possible
- Follow DRY (Don't Repeat Yourself) principle

## Example Modules

### Inventory Module

```
modules/inventory/
├── frontend/
│   ├── pages/
│   │   ├── SuppliersPage.tsx
│   │   ├── SupplierDetailPage.tsx
│   │   └── index.ts
│   ├── components/
│   └── README.md
├── routes.py
├── services.py
├── config.json
├── __init__.py
├── CHANGELOG.md
└── README.md
```

### Procurement Module

```
modules/depo_procurement/
├── frontend/
│   ├── pages/
│   │   ├── ProcurementPage.tsx
│   │   ├── ProcurementDetailPage.tsx
│   │   └── index.ts
│   ├── components/
│   │   ├── ItemsTab.tsx
│   │   ├── ReceivedStockTab.tsx
│   │   └── index.ts
│   └── README.md
├── routes.py
├── services.py
├── config.json
├── __init__.py
├── CHANGELOG.md
└── README.md
```

## Common Mistakes to Avoid

### ❌ Don't Do This:

1. **Mixing module files with core files**
   ```
   src/frontend/src/pages/ModulePage.tsx  ❌
   ```

2. **Creating multiple documentation files**
   ```
   modules/module_name/
   ├── README.md
   ├── INSTALL.md          ❌
   ├── DEPLOYMENT.md       ❌
   └── SETUP_GUIDE.md      ❌
   ```

3. **Hardcoding paths**
   ```typescript
   const response = await api.get('/api/resource');  ❌
   ```

### ✅ Do This Instead:

1. **Keep everything in the module**
   ```
   modules/module_name/frontend/pages/ModulePage.tsx  ✅
   ```

2. **Use only README and CHANGELOG**
   ```
   modules/module_name/
   ├── README.md           ✅
   └── CHANGELOG.md        ✅
   ```

3. **Use proper API paths**
   ```typescript
   const response = await api.get('/modules/module_name/api/resource');  ✅
   ```

## Testing

- Test API endpoints with Postman or similar tools
- Test frontend components in the browser
- Verify module activation/deactivation works
- Check error handling and edge cases

## Version Control

- Update CHANGELOG.md for every change
- Use semantic versioning (MAJOR.MINOR.PATCH)
- Document breaking changes clearly

## Summary

**Remember:** When creating or working with a module, **EVERYTHING** related to that module stays inside the module folder. This ensures:

- Easy maintenance
- Clear separation of concerns
- Simple module activation/deactivation
- Better code organization
- Easier debugging and testing

If you find yourself creating files outside the module folder, **STOP** and reconsider your approach!
