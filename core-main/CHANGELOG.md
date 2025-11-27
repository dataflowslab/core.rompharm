# Changelog

## 2025-11-25

### Library (File Manager) Implementation - Enhanced v3 (FINAL)
- ✅ Creat sistem complet de management fișiere:
  - **Backend**:
    - Model `FileModel` pentru MongoDB (colecția `files`)
    - Routes complete: upload, list, update, delete, download
    - **Paginare**: skip, limit, has_more (20 items per page)
    - **Căutare**: în title, description, filename (case-insensitive)
    - **Soft delete**: deleted: true (fișierele șterse nu apar nicăieri)
    - **Bulk delete**: ștergere multiplă cu confirmare
    - Endpoint `/files/all` pentru file picker
    - Securitate: owner și shared_with (username/role)
    - Audit logging pentru toate operațiile
    - Integrare cu sistemul existent de file storage
  - **Frontend - LibraryPage**:
    - Două tab-uri: "My Files" și "Shared with Me"
    - **Grid view** cu thumbnails pentru imagini
    - **Iconițe cu extensie** pentru alte tipuri (PDF, DOC, XLS)
    - Upload cu Dropzone (drag & drop)
    - **Căutare live** în toate fișierele
    - **Load More** pentru paginare
    - **Bulk selection** cu checkbox-uri
    - **Bulk delete** cu confirmare (mesaj: "cannot be undone")
    - Edit modal cu:
      - **Preview** pentru imagini
      - **Download button** pentru alte tipuri
      - Title, description, shared_with, tags
      - Metadata: owner, created, modified, size
    - Download, edit, delete actions per file
  - **Frontend - FilePicker Component**:
    - Modal pentru selectare fișiere din library
    - Grid view cu thumbnails/iconițe
    - Căutare în timp real
    - Load More pentru paginare
    - Multi-select cu checkmark visual
    - Fără tab-uri (toate fișierele accesibile)
- ✅ Features:
  - Partajare fișiere cu useri sau roluri
  - Tag-uri (ex: "shared" pentru acces public)
  - Căutare și filtrare
  - Format size și date user-friendly
  - Thumbnails pentru imagini
  - Iconițe cu extensie pentru documente
  - Preview în edit modal
  - Soft delete (recuperabil din DB)
  - Bulk operations
- ✅ Adăugat în meniu principal (Library)
- ✅ Rută: `/library`
- ✅ Component FilePicker pentru integrare în formulare
- ✅ **UI Improvements v3 (FINAL)**:
  - **Titlul afișat corect**: `file.title` în loc de `filename`
  - **Tooltip**: title attribute pentru titluri lungi
  - **LineClamp={2}**: maxim 2 rânduri pentru titlu
  - **MinHeight**: 2.5em pentru consistență
  - **SecureImage Component**: încarcă imagini prin axios cu token
  - **Blob URL**: afișare securizată cu cleanup corect
  - **Click pe imagine**: deschide edit modal
  - **Imagini full-size**: width/height 100%, objectFit: cover
  - **Aspect-ratio 1:1**: pătrate perfecte
  - **Centrare perfectă**: extensii centrate cu flex
  - **Font monospace**: gri (#868e96) pentru extensii
  - **Background**: gri deschis (#f1f3f5) cu border
  - **Request Interceptor**: token dinamic în axios pentru autentificare
  - **Script migrare**: `migrate_file_titles.py` pentru fișiere existente

### UI Improvements
- ✅ Logo clickable → duce la Dashboard
- ✅ Buton notificări în header:
  - Icon clopot (IconBell)
  - Indicator roșu cu număr notificări noi
  - Click → duce la `/admin/notifications`
  - Auto-refresh la login

### Custom Fonts Implementation
- ✅ Configurat fonturi custom pentru aplicație:
  - **Inter**: Text normal (italic, regular, bold)
  - **Montserrat**: Titluri și headings (bold)
- ✅ Creat structură pentru fonturi locale:
  - `src/frontend/public/fonts/fonts.css` - Declarații @font-face
  - `src/frontend/public/fonts/README.md` - Instrucțiuni download
  - `.gitkeep` pentru tracking folder
- ✅ Actualizat `overrides.css`:
  - Import automat fonts.css
  - Inter aplicat la body text
  - Montserrat aplicat la toate headings (h1-h6, Title)
- ✅ Documentație completă în CUSTOMIZATION.md
- ✅ Suport pentru:
  - Fonturi locale (WOFF2 - performanță optimă)
  - Alternative: Google Fonts CDN

### Bug Fixes
- ✅ Corectat erori TypeScript în SettingsPage.tsx
- ✅ Înlocuit `family` cu `ff` pentru font-family (Mantine v7)
- ✅ Build frontend reușit fără erori
- ✅ Actualizat `sync_inventree_sales_orders.py` pentru noua locație config
  - Schimbat path de la `config.yaml` la `config/config.yaml`
  - Script rulează corect și procesează comenzile din raw_data

### Registry Statistics
- ✅ Adăugat tab-uri în pagina Registry Detail:
  - **Entries**: Lista cu toate înregistrările (existent)
  - **Statistics**: Statistici și grafice pentru evoluția completărilor
- ✅ Statistici disponibile:
  - Total intrări (all time)
  - Intrări în perioada selectată
  - Număr aprobate
  - Număr în așteptare
- ✅ Presets perioadă:
  - Săptămână (ultimele 7 zile)
  - Lună (ultimele 30 zile)
  - An (ultimul an)
- ✅ Grafice interactive:
  - Line chart: Evoluția completărilor în timp
  - Bar chart: Distribuția pe stări (nou, aprobat, etc.)
- ✅ Instalat `recharts` pentru vizualizări

### Custom CSS Overrides & Background Images
- ✅ Creat `src/frontend/src/styles/overrides.css` pentru customizări CSS
- ✅ Suport pentru background images:
  - **Sidebar**: `src/frontend/public/backgrounds/sidebar_bg.png`
  - **Main area**: `src/frontend/public/backgrounds/main_bg.png`
- ✅ Overlay-uri configurabile pentru lizibilitate text
- ✅ Documentație completă în `backgrounds/README.md`
- ✅ Import automat în `main.tsx`
- ✅ Exemple de customizări în CSS (comentate)

### Submission Notifications Logging
- ✅ Notificările email sunt acum înregistrate în jurnalul submission-ului
- ✅ Intrare nouă în history cu state='notification_sent'
- ✅ Detalii: lista de email-uri către care s-au trimis notificările
- ✅ Timestamp automat pentru fiecare notificare trimisă

### Configuration Reorganization
- ✅ Mutat toate fișierele de configurare în folderul `config/`:
  - `config_sample.yaml` → `config/config_sample.yaml`
  - `config.yaml` → `config/config.yaml`
  - Firebase Admin SDK JSON → `config/firebase-admin-sdk.json`
- ✅ Actualizat toate căile în cod (13 fișiere):
  - Backend utils (db.py, firebase_auth.py, inventree_auth.py, etc.)
  - Backend routes (auth.py, system.py, forms.py, etc.)
  - app.py
- ✅ Actualizat documentație (README.md, scripts/README.md)
- ✅ `.gitignore` deja configurat pentru `config/*.*`

### Menu Reorganization & Admin Section
- ✅ Reorganizat meniul principal:
  - Dashboard
  - Registre
  - Formulare
  - Sabloane
  - CRM (Subscribers, Segments, Campaigns)
  - **Administrare** (nou submeniu):
    - Utilizatori
    - Roluri
    - Notificări
    - Jurnal
    - Setări

### Settings Page
- ✅ Creat pagină Settings (`/admin/settings`)
- ✅ Afișare toate intrările din colecția `config` din MongoDB
- ✅ Editare valori config (suport JSON/text)
- ✅ Validare și pretty-print pentru JSON
- ✅ API endpoints:
  - `GET /api/config/entries/all` - listă toate setările
  - `GET /api/config/entry/{key}` - obține o setare
  - `PUT /api/config/entry/{key}` - actualizează o setare

### Routes Update
- ✅ Mutat rute în secțiunea Admin:
  - `/users` → `/admin/users`
  - `/audit` → `/admin/audit`
  - `/notifications` → `/admin/notifications`
- ✅ Adăugat redirects pentru compatibilitate backward
- ✅ Adăugat rută nouă `/admin/settings`

### Configuration
- ✅ Actualizat `config_sample.yaml` cu:
  - Switch `identity_server` (inventree/firebase)
  - Configurație completă Firebase
  - Token InvenTree pentru operații admin

### Audit Logging Improvements
- ✅ Adăugat `resource_name` în log_action()
- ✅ Format îmbunătățit pentru acțiuni:
  - `form_created - Nume Formular (ID: xxx)`
  - `submission_signed - Nume Formular (ID: xxx)`
  - `state_changed - Nume Formular → status (ID: xxx)`

### Subscribers Fix
- ✅ Email și Phone sunt acum opționale (cel puțin unul obligatoriu)
- ✅ Validare custom pentru email (regex)
- ✅ Validare că există cel puțin un contact (email SAU phone)
- ✅ Mesaje de eroare clare în UI
- ✅ Buton disabled când nu sunt completate datele necesare

### InvenTree Sales Orders Sync
- ✅ Creat script `sync_inventree_sales_orders.py`
- ✅ Sincronizare automată raw_data → InvenTree
- ✅ Creare/găsire clienți, produse, comenzi
- ✅ Status tracking (1=ok, 2=partial, 3=failed)
- ✅ Integrat cu job scheduler (rulează la 10 minute)
- ✅ Idempotent - nu procesează documente deja sincronizate

### Users CRUD Implementation
- ✅ Extins `src/frontend/src/pages/UsersPage.tsx` cu CRUD complet:
  - Create User (username, email, password, role, is_staff)
  - Edit User (toate câmpurile, password opțional)
  - Delete User (cu protecție să nu te ștergi pe tine)
  - Afișare email și role în listă
- ✅ Backend API complet în `src/backend/routes/users.py`:
  - `POST /api/users/` - creare user
  - `GET /api/users/{id}` - detalii user
  - `PUT /api/users/{id}` - actualizare user
  - `DELETE /api/users/{id}` - ștergere user
  - `GET /api/users/roles` - listă roluri disponibile
- ✅ Validări:
  - Username unic
  - Nu poți șterge propriul cont
  - Password hash cu SHA256
- ✅ Audit logging pentru toate operațiile CRUD

### Roles Management
- ✅ Creat `src/frontend/src/pages/admin/RolesPage.tsx`:
  - CRUD complet pentru roluri (Firebase mode)
  - Afișare notificare când este InvenTree mode
  - Detectare automată identity server
- ✅ Backend API complet în `src/backend/routes/roles.py`:
  - `GET /api/roles/` - listă roluri
  - `POST /api/roles/` - creare rol
  - `GET /api/roles/{id}` - detalii rol
  - `PUT /api/roles/{id}` - actualizare rol
  - `DELETE /api/roles/{id}` - ștergere rol
- ✅ Endpoint pentru detectare identity server:
  - `GET /api/system/identity-server` - returnează provider (inventree/firebase)
- ✅ Audit logging pentru toate operațiile cu roluri
- ✅ Rută adăugată în App.tsx: `/admin/roles`

### Firebase Authentication Implementation
- ✅ Creat `src/backend/utils/firebase_auth.py`:
  - `verify_firebase_token()` - verificare token Firebase
  - `get_firebase_user()` - obține detalii user
  - `create_firebase_user()` - creare user în Firebase
  - `update_firebase_user()` - actualizare user
  - `delete_firebase_user()` - ștergere user
  - `list_firebase_users()` - listă users
  - `is_firebase_enabled()` - verificare dacă Firebase este activ
- ✅ Actualizat `src/backend/routes/auth.py`:
  - Suport dual pentru InvenTree și Firebase
  - Login cu `firebase_token` când identity_server = 'firebase'
  - Login cu `username/password` când identity_server = 'inventree'
  - Users și roles gestionate în MongoDB pentru ambele sisteme
  - Audit logging cu identity_server în detalii
- ✅ Adăugat `firebase-admin>=6.0.0` în requirements.txt
- ✅ Configurare completă în config_sample.yaml

### How Firebase Works
1. **Frontend**: User se autentifică cu Firebase (email/password, Google, etc.)
2. **Frontend**: Primește Firebase ID token
3. **Frontend**: Trimite token la `/api/auth/login` cu `firebase_token`
4. **Backend**: Verifică token cu Firebase Admin SDK
5. **Backend**: Creează/actualizează user în MongoDB local
6. **Backend**: Returnează token pentru sesiune
7. **Users/Roles**: Gestionate în MongoDB (nu în Firebase)

### Setup Firebase
1. Creează proiect Firebase: https://console.firebase.google.com
2. Activează Authentication (Email/Password, Google, etc.)
3. Descarcă Service Account Key (Settings → Service Accounts)
4. Salvează JSON în proiect (ex: `firebase-admin-sdk.json`)
5. Actualizează `config.yaml`:
   ```yaml
   identity_server: firebase
   firebase:
     admin_sdk_json: firebase-admin-sdk.json
     api_key: YOUR_API_KEY
     auth_domain: your-project.firebaseapp.com
     project_id: your-project-id
   ```
6. Instalează: `pip install firebase-admin`

## Notes
- Firebase implementation necesită ~10-15 ore suplimentare
- Settings page este funcțională și gata de utilizare
- Menu reorganization este completă
- Toate rutele sunt actualizate cu redirects pentru compatibilitate
