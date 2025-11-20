# Changelog

All notable changes to this project will be documented in this file.

## [1.4.4] - 2024-11-20

### Added
- **External API System**: Programmatic API access using Bearer tokens
  - New `/api/ext/*` endpoints for external integrations
  - API token authentication via `api_tokens` collection
  - Token expiration validation
  - Rights-based access control per token
  - New endpoints:
    - `POST /api/ext/fgo-client-invoices` - Save FGO client invoices
    - `POST /api/ext/fgo-supplier-invoices` - Save FGO supplier invoices
- **Raw Data Storage**: New `raw_data` collection for external data dumps
  - Stores JSON payloads from external sources
  - Tracks source and timestamp for each entry
  - Supports any JSON structure
- **API Token Model**: New `ApiTokenModel` for managing API tokens
- **Raw Data Model**: New `RawDataModel` for external data storage

### Fixed
- **Dashboard Shortcuts**: Fixed empty shortcuts issue for users with roles
  - Now correctly matches role IDs (both string and ObjectId formats)
  - Properly retrieves forms from dashboard configuration
  - Returns form details (slug, title, description)

### Technical
- New route file: `src/backend/routes/external.py`
- New models: `ApiTokenModel`, `RawDataModel`
- Bearer token authentication for external API access
- Token rights validation before endpoint access
- Integrated with main FastAPI application

### Database Collections
- `api_tokens`: Store API tokens with expiration and rights
- `raw_data`: Store external data dumps with source tracking

### Notes
- API tokens use Bearer authentication (e.g., `Authorization: Bearer <token>`)
- Each token has specific rights for endpoint access
- Token expiration is checked on each request
- Raw data is stored as-is without validation
- Useful for integrating with external systems like FGO

## [1.4.3] - 2024-11-17

### Added
- **URL Parameters Support**: Forms now accept URL parameters for pre-population
  - Parameters are sanitized (HTML tags removed)
  - Type conversion based on JSON Schema (string, number, integer, boolean, array)
  - Only fields defined in schema are accepted
  - Example: `/web/forms/ABC123?name=John&age=25&agree=true`

### Fixed
- **Form Link URL**: Fixed slug button in forms table to use correct path `/web/forms/{slug}` instead of `/{slug}`

### Technical
- Added `useSearchParams` hook to FormPage
- Implemented `sanitizeValue` function for safe parameter handling
- URL params are validated against form schema before pre-population

## [1.4.2] - 2024-11-17

### Added
- **WYSIWYG Editor for Campaigns**: Rich text editor for campaign messages
  - Mantine TipTap integration with full formatting toolbar
  - Bold, italic, underline, strikethrough formatting
  - Headings (H1, H2, H3)
  - Lists (bullet and ordered)
  - Blockquotes and horizontal rules
  - Link insertion and removal
  - Undo/Redo functionality
  - HTML output for email campaigns
- **Image Upload with Dropzone**: Drag-and-drop image upload for campaigns
  - Integrated with existing secure file upload system
  - Drag and drop or click to select
  - Image preview after upload
  - Remove uploaded image option
  - 5MB file size limit
  - Automatic hash-based file storage
  - Secure file serving via `/api/data/files/{hash}`

### Changed
- Campaign modal redesigned with better UX
- Image URL field replaced with visual dropzone
- Message textarea replaced with rich text editor
- Modal size increased to XL for better editing experience

### Technical
- Added dependencies:
  - `@mantine/tiptap` - Rich text editor
  - `@mantine/dropzone` - File upload component
  - `@tiptap/react` - TipTap React integration
  - `@tiptap/starter-kit` - TipTap base extensions
  - `@tiptap/extension-link` - Link support
- New component: `CampaignModal.tsx` in `src/frontend/src/components/CRM/`
- Updated `CampaignsPage.tsx` to use new modal component
- Added CSS imports for TipTap and Dropzone in `main.tsx`
- Integrated with existing file upload endpoint `/api/data/upload`

### Notes
- Campaign messages now support rich HTML formatting
- Images are stored securely using the existing file handler system
- File uploads use SHA256 hash-based storage with date organization
- Uploaded images are served via secure hash URLs

## [1.4.1] - 2024-11-17

### Changed
- **Template Selector Enhancement**: Replaced manual template code input with MultiSelect dropdown
  - Automatically loads available templates from API
  - Shows template name and code in dropdown (e.g., "Invoice Template (ABC123DEF456)")
  - Searchable dropdown for easy template finding
  - Clearable selection
  - Loading state while fetching templates
  - Error handling if templates fail to load
  - No templates available message when list is empty

### Technical
- Updated `TemplateSelector.tsx` to use MultiSelect component
- Added API call to `/api/templates` to fetch available templates
- Improved UX with loading spinner and error messages

## [1.4.0] - 2024-11-17

### Added
- **Mantine Form Renderers**: Custom JSON Forms renderers using Mantine UI components
  - Text input with maxLength support
  - Textarea with character counter and autosize
  - Number input with min/max validation (decimal numbers)
  - Integer input with min/max validation (whole numbers only, no decimals)
  - Date picker with intelligent date selection (DD-MM-YYYY format)
  - Select dropdown with search and clear functionality
  - Multi-select with search and clear functionality
  - Single checkbox for boolean values
  - Checkbox group for multiple selections
  - Radio button group
  - Vertical layout (default stacking)
  - Horizontal layout (side-by-side fields with responsive grid)
  - Group layout (simple divider separator, no borders/shadows)
- **Form Submission Confirmation**: Modal dialog before submitting form
  - Confirmation message in Romanian
  - Summary table showing all field labels and values
  - Confirm and Cancel buttons
  - Mobile-friendly fullscreen modal
- **Post-Submission Alerts**: Success and error messages displayed after form submission
  - Success alert: "Cererea a fost înregistrată" (green, dismissible)
  - Error alert: Shows specific error message (red, dismissible)
  - Alerts appear below form title
  - Auto-scroll to top to show alerts
  - Close button on each alert
- **Enhanced Form Features**:
  - Consistent label width in horizontal layouts
  - Required field indicators (asterisk)
  - Built-in validation with error messages
  - Clearable inputs for better UX
  - Searchable select fields
  - Character counting for textareas
  - Responsive layouts for mobile/tablet/desktop
- **Slug Column Enhancement**: Slug column in forms table now displays as clickable button with external link icon that opens form in new tab
- **Dependencies**: Added `@mantine/dates` and `dayjs` for date picker functionality

### Changed
- Replaced vanilla JSON Forms renderers with custom Mantine renderers
- Forms now use Mantine UI components throughout for consistent styling
- Date fields now use intelligent date picker instead of basic HTML input
- Select fields now support search and clear functionality
- Textarea fields automatically resize and show character count

### Technical
- New components in `src/frontend/src/components/JsonForms/`:
  - `MantineTextControl.tsx` - Text and textarea inputs
  - `MantineDateControl.tsx` - Date picker with dayjs
  - `MantineNumberControl.tsx` - Number input
  - `MantineSelectControl.tsx` - Select and multi-select
  - `MantineCheckboxControl.tsx` - Checkbox and checkbox group
  - `MantineRadioControl.tsx` - Radio button group
  - `MantineGroupLayout.tsx` - Grouped fields with border
  - `MantineVerticalLayout.tsx` - Vertical stacking
  - `MantineHorizontalLayout.tsx` - Horizontal grid layout
  - `index.ts` - Exports all renderers
- Updated `FormPage.tsx` to use Mantine renderers
- Updated `FormsPage.tsx` to make slug column clickable
- Added CSS imports for `@mantine/dates` in `main.tsx`
- Updated `package.json` with new dependencies

### Documentation
- Added comprehensive Mantine Form System section to README
- Documented all supported field types with JSON Schema examples
- Documented layout options (vertical, horizontal, group)
- Added complete form example with multiple field types
- Listed all features and capabilities of the new form system

### Notes
- All forms now have modern, consistent UI with Mantine components
- Date picker provides better UX with calendar popup
- Horizontal layouts automatically adjust for mobile devices
- Character counters help users stay within field limits
- Searchable selects improve usability for long option lists

## [1.3.0] - 2024-11-16

### Added
- **Template Management System**: Complete CRUD operations for OfficeClerk/DataFlows Docu templates
  - List all templates with parts grouping
  - Create new templates with first part (base, header, footer, css, code)
  - Add parts to existing templates
  - Get template bundle details
  - Get individual part metadata and raw content
  - Update template metadata and part content
  - Delete templates and individual parts
- **Template Model**: New `TemplateModel` for storing template metadata locally
- **Template Routes**: New `/api/templates` endpoints for template management
  - `GET /api/templates` - List all templates
  - `POST /api/templates` - Create new template
  - `GET /api/templates/{code}` - Get template bundle
  - `PUT /api/templates/{code}` - Update template metadata
  - `DELETE /api/templates/{code}` - Delete template
  - `POST /api/templates/{code}/parts` - Add part to template
  - `GET /api/templates/{code}/{type}` - Get part metadata
  - `GET /api/templates/{code}/{type}/raw` - Get part raw content
  - `PUT /api/templates/{code}/{type}` - Update part
  - `DELETE /api/templates/{code}/{type}` - Delete part

### Technical
- Integrated with OfficeClerk API (DataFlows Docu)
- Template parts: base (required), header, footer, css, code (optional)
- 12-character template codes from OfficeClerk
- Local metadata storage with MongoDB
- Audit logging for all template operations
- Support for Jinja2 templating in content

### Database Collections
- `templates`: Store template metadata (code, name, description, timestamps)

### Notes
- Templates are managed via OfficeClerk API
- Local database stores metadata only
- Template codes are unique identifiers from OfficeClerk
- Base part is required for all templates
- Frontend implementation needed for UI (code editor with syntax highlighting)

## [1.2.0] - 2024-11-16

### Added
- **User Model Extensions**: Added `firstname`, `lastname`, `local_role`, and `last_login` fields to user model
- **Role Management**: New `roles` collection to store InvenTree roles synchronized from API
- **Job Scheduler System**: APScheduler-based cron-like job system for recurring tasks
  - Job configuration stored in `jobs` collection
  - Cron expression support (e.g., "*/5 * * * *" for every 5 minutes)
  - Manual job execution via invoke tasks or API
  - Automatic job execution on schedule
  - Job status tracking (last_run, last_status, last_output)
- **Role Synchronization Script**: `src/scripts/update_roles.py` syncs roles from InvenTree
- **Soft Delete for Forms**: Forms now use soft delete with `deleted` timestamp
  - Forms with `deleted: null` or future date are visible
  - Deleted forms remain in database for audit purposes
- **Campaign Delivery Date**: Added `delivery_date` field to campaigns
  - Empty delivery_date means manual send only
  - Scheduled campaigns can be sent automatically
- **Job Management API**: New endpoints in `/api/system/jobs`
  - `GET /api/system/jobs` - List all jobs
  - `POST /api/system/jobs` - Create new job
  - `PUT /api/system/jobs/{name}` - Update job
  - `DELETE /api/system/jobs/{name}` - Delete job
  - `POST /api/system/jobs/{name}/run` - Manually trigger job
- **Invoke Tasks for Jobs**:
  - `invoke job-run --name=<job_name>` - Run job manually
  - `invoke job-list` - List configured jobs
  - `invoke scheduler-start` - Start scheduler service

### Changed
- Forms deletion now sets `deleted` timestamp instead of removing from database
- Form queries filter out deleted forms (where deleted is null or in future)
- Campaign model updated to support scheduled delivery
- Backend app now starts job scheduler on startup
- Scheduler automatically loads jobs from database

### Technical
- Added `apscheduler==3.10.4` dependency
- New models: `RoleModel`, `JobModel`
- New module: `src/backend/scheduler.py` for job scheduling
- New directory: `src/scripts/` for scheduled job scripts
- Enhanced system routes with job management endpoints
- Scheduler integrates with FastAPI lifecycle (startup/shutdown)

### Database Collections
- `roles`: Store InvenTree roles (synced via update_roles job)
- `jobs`: Store job configurations (name, frequency, enabled, status)

### Notes
- Job scripts should be placed in `src/scripts/` directory
- Job names correspond to script filenames (without .py extension)
- Scheduler runs in background as part of main application
- Jobs can be managed via API or invoke tasks
- Use semicolon (;) instead of && for command chaining per project standards

## [1.1.0] - 2024-11-12

### Added
- **Auto-generated Form Slugs**: 8-character slugs (A-Z, 0-9) generated automatically
- **QR Code Generation**: SVG QR codes for each form via `/api/forms/{slug}/qr`
- **Workflow Management**: Multi-state approval system for submissions
  - States: New, In Review, Approved, Rejected, Cancelled
  - State history tracking with user and timestamp
  - Notes field for each state change
- **File Upload System**: Secure file handling for form submissions
  - SHA256 hash-based storage
  - Date-organized directory structure (YYYY/MM/DD)
  - Configurable size limits and allowed extensions
  - Secure file serving via hash URLs
- **CRM Module**: Complete subscriber and campaign management
  - Subscriber management with ANAF tax ID verification
  - Segment-based organization
  - Email campaign creation and tracking
  - Import subscribers from InvenTree
  - Marketing consent tracking (email/SMS)
- **Submissions Management**: Dedicated pages for viewing and managing all submissions
  - All submissions list page
  - Detailed submission view with state management
  - State change history display
  - File attachments display
- **Form Routes**: Changed to `/web/forms/{slug}` for better organization
- **Menu Reorganization**: New menu structure (Dashboard, Formulare, CRM, Templates, Notifications, Users, Audit Log)

### Changed
- Form creation no longer requires manual slug input
- Slug field removed from form creation UI
- Form URLs now use `/web/forms/{slug}` pattern
- Dashboard simplified to welcome message
- Forms management moved to dedicated "Formulare" page

### Technical
- Added `qrcode[pil]` library for QR code generation
- Added `email-validator` for email validation
- New models: `form_state_model`, `subscriber_model`, `segment_model`, `campaign_model`
- New utilities: `slug_generator`, `file_handler`, `anaf` (tax ID verification)
- New routes: CRM endpoints, file upload/download, state management
- Enhanced data model with state tracking fields

## [1.0.0] - 2024-11-11

### Project
- **Name**: DataFlows Core
- **Description**: Dynamic forms platform with InvenTree 1.0.1 authentication
- **InvenTree Version**: 1.0.1 (see [InvenTree 1.0.1 Documentation](https://docs.inventree.org/en/1.0.1/))

### Recent Updates (2024-11-11)
- ✅ Renamed dataflows_depo to dataflows_docu throughout the codebase
- ✅ Updated all references in config, backend, and frontend
- ✅ Changed command separator from && to ; in package.json and documentation
- ✅ Removed extra documentation files (frontend README, locales README)
- ✅ Simplified documentation to only README and CHANGELOG per project
- ✅ Fixed InvenTree authentication (HTTP Basic Auth with GET request)
- ✅ Auto-generate slug from form title (removes diacritics and special characters)
- ✅ Slug duplicate protection with real-time validation
- ✅ Form editing functionality
- ✅ Link to JSON Forms documentation in schema editor
- ✅ Improved error handling and logging
- ✅ Persistent error messages in login form
- ✅ Gettext-based translation system (.po files)
- ✅ Multi-language support (English, Romanian)
- ✅ Translation extraction and compilation scripts
- ✅ Invoke task runner for build automation (replaces .bat files)
- ✅ Administrator role verification from InvenTree
- ✅ Public and protected forms
- ✅ Username tracking for form submissions
- ✅ Full mobile responsive design
- ✅ Mobile-optimized header with drawer navigation
- ✅ Touch-friendly UI elements (44px minimum tap targets)
- ✅ Adaptive layouts for mobile, tablet, and desktop
- ✅ Mobile-specific CSS optimizations
- ✅ PWA-ready meta tags
- ✅ Cross-platform task runner with Invoke
- ✅ Simplified build and deployment workflow

### Added
- Initial project structure
- FastAPI backend with RESTful API
- MongoDB integration for data storage
- InvenTree authentication system (compatible with InvenTree 1.0.1)
- Form management endpoints (CRUD operations)
- Data submission endpoints
- Configuration management
- User authentication with token storage
- Public form access via slug
- Protected endpoints for form management and data viewing
- Health check endpoint
- CORS middleware for frontend integration
- Static file serving for media files
- Automatic database connection management

### Database Collections
- `forms`: Store form definitions with JSON Schema and UI Schema
- `data`: Store form submissions
- `users`: Store InvenTree user tokens
- `config`: Store application configuration (company name, logo)

### API Endpoints
- `POST /api/auth/login` - Authenticate with InvenTree
- `GET /api/auth/verify` - Verify token validity
- `GET /api/forms/{slug}` - Get form by slug (public)
- `GET /api/forms/` - List all forms (authenticated)
- `POST /api/forms/` - Create new form (authenticated)
- `PUT /api/forms/{form_id}` - Update form (authenticated)
- `DELETE /api/forms/{form_id}` - Delete form (authenticated)
- `POST /api/data/` - Submit form data (public)
- `GET /api/data/{form_id}` - Get form submissions (authenticated)
- `GET /api/data/submission/{submission_id}` - Get specific submission (authenticated)
- `DELETE /api/data/submission/{submission_id}` - Delete submission (authenticated)
- `GET /api/config/` - Get configuration (public)
- `POST /api/config/` - Update configuration (authenticated)
- `GET /health` - Health check endpoint

### Configuration
- YAML-based configuration file
- InvenTree URL configuration (no credentials stored)
- MongoDB connection settings
- Web application settings
- Media file paths
- Users authenticate with their own InvenTree credentials

### Security
- Token-based authentication via InvenTree
- Protected endpoints for sensitive operations
- Token verification against InvenTree API
- Secure token storage in MongoDB

### Frontend
- React 18 with TypeScript
- Mantine UI v7 component library
- Vite build tool for fast development
- React Router for navigation
- Axios for API communication
- JSON Forms integration for dynamic form rendering
- Authentication context with token management
- Protected routes for authenticated pages
- Responsive design with Mantine components

### Pages
- **LoginPage**: InvenTree authentication
- **FormPage**: Public form rendering and submission
- **DashboardPage**: Form management (create, view, delete)
- **DataListPage**: View and manage form submissions

### Components
- **Header**: Navigation with company branding and user info
- **ProtectedRoute**: Route guard for authenticated pages
- **AuthContext**: Global authentication state management

### Features
- Token-based authentication with localStorage persistence
- Automatic token refresh and validation
- Form creation with JSON Schema editor
- Real-time form rendering with JSON Forms
- Submission management and viewing
- Company branding configuration
- Notifications for user feedback
- Error handling and loading states

### Deployment
- Single service architecture: backend serves both API and frontend
- Frontend built as static files served by FastAPI
- Production-ready for Ubuntu/NGINX deployment
- Can run as systemd service
- Frontend build output in `src/frontend/dist/`
- Development mode supports hot reload via Vite dev server

### Branding
- Application name: DataFlows Core
- Logo: `/media/img/logo.svg`
- Favicons: `/media/img/favicon.png` and `/media/img/favicon_256.png`
- Symbol: `/media/img/symbol.svg`
- Default company name: DataFlows Core
- Customizable branding via config API

### Notes
- Backend and frontend fully integrated
- Compatible with InvenTree 1.0.1 API
- Supports JSON Forms specification
- Single service for production (port 8000)
- Development server with API proxy (optional)
- Production build ready
- Responsive design for mobile and desktop
- MongoDB connection via single connection string
- Custom branding support
