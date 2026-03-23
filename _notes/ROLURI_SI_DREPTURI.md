# ROLURI SI DREPTURI

Data: 2026-03-23

## Context
Am migrat de la roluri hardcodate (is_admin/is_staff etc.) la un sistem bazat pe roluri cu drepturi (sections) si meniu (menu_items). Acest document sumarizeaza schimbarile facute in proiect pentru noul sistem.

## Schema roluri (DB)
Fiecare rol are acum:
- `sections`: map cu drepturi pe sectiuni, ex:
  ```json
  {
    "build-orders": ["get", "post", "patch", "delete", "own", "dep"],
    "inventory/articles": ["*"],
    "requests": ["get", "dep"],
    "sales": ["get", "own"]
  }
  ```
- `menu_items`: lista JSON cu meniul (identic ca structura cu meniul din UI).

Semnificatie permisiuni:
- `get` / `post` / `patch` / `delete` = CRUD clasic
- `own` = doar intrarile create de userul curent
- `dep` = doar intrarile create de utilizatori din departamentele (locations) pe care userul le are
- `*` = acces total

Notificari si dashboard: acces public (nu se restrictioneaza).

## Backend - logica de drepturi
### Utilitare
- `src/backend/utils/sections_permissions.py`
  - `require_section(section, action?)` aplica controlul accesului la fiecare ruta.
  - `get_section_permissions`, `is_action_allowed`, `get_section_scope`.
  - `apply_scope_to_query` + `is_doc_in_scope` pentru filtre `own/dep`.
  - `get_department_usernames` foloseste `users.locations` (ObjectId) pentru filtrare.

### Auth
- `/api/auth/me` expune acum:
  - `role_sections`
  - `role_menu_items`

### Rute backend actualizate
Toate zonele au fost trecute pe `require_section` si/sau validari de scope, eliminand vechile verificari `is_admin/is_staff`:
- `src/backend/routes/*`: audit, forms, data, approvals, roles, recipes, returns, sales, system, users, users_local
- `modules/*`: requests, build-orders, production, reception, procurement, inventory, stocks etc.
- Semnaturi si flows de aprobare: au fost eliminate override-urile de admin.

### Semnaturi
- `check_user_can_sign` nu mai permite admin bypass.
- Stergerea semnaturilor permite doar `delete` pe sectiunea respectiva sau propria semnatura.

## Frontend - logica de drepturi
### AuthContext
- `src/frontend/src/context/AuthContext.tsx`
  - stocheaza in localStorage `roleSections` + `roleMenuItems`.

### Navbar
- `src/frontend/src/components/Layout/Navbar.tsx`
  - meniul este construit din `roleMenuItems`.

### Utilitare
- `src/frontend/src/utils/permissions.ts`
  - helper: `hasSectionPermission`, `getSectionScope`.

### Pagini/Componente actualizate
- au fost inlocuite check-urile de `isAdmin` cu drepturi pe sectiune (ex. users, audit, forms, requests, procurement, returns etc.).

## Migrare roluri
- `_tools/migrate_roles_sections.py`
  - seteaza rolul `admin` cu `sections: {"*": ["*"]}` + meniu complet.
  - adauga rol `section-chief` cu drepturi limitate.

## UI Management Roluri
### Pagina roles
- `src/frontend/src/pages/RolesPage.tsx`
  - lista roluri + CRUD.
  - modal separat pentru acces (larg) cu taburi `Menu` si `Rights`.
  - `Menu` foloseste template-ul de Admin (din DB daca exista, altfel fallback).
  - `Rights` permite bife pe `get/post/patch/delete/own/dep`.
  - optiune `Global access (*)`.

### Ruta
- `src/frontend/src/App.tsx`: adaugata ruta `/roles`.

## Note suplimentare
- Am adaugat in admin menu item `Roles` (icon `IconShieldLock`).
- Pentru admin, meniul poate fi ajustat direct in UI, sau rerulat scriptul de migrare.

## Fisiere cheie
- Backend:
  - `src/backend/utils/sections_permissions.py`
  - `src/backend/routes/auth.py`
  - `src/backend/routes/roles.py`
  - `src/backend/utils/approval_helpers.py`
  - `modules/*` (requests, inventory, procurement, returns, sales etc.)
- Frontend:
  - `src/frontend/src/context/AuthContext.tsx`
  - `src/frontend/src/utils/permissions.ts`
  - `src/frontend/src/components/Layout/Navbar.tsx`
  - `src/frontend/src/pages/RolesPage.tsx`
  - `src/frontend/src/App.tsx`
- Tooling:
  - `_tools/migrate_roles_sections.py`

## Status
- Implementarea este completa pentru migrarea pe roluri cu sectiuni/menu.
- UI de editare roluri are modal mai lat si taburile cerute.
- Teste automate: nu au fost rulate.
