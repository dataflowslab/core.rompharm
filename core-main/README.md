# DataFlows Core

Dynamic forms platform with InvenTree 1.0.1 authentication, document generation, CRM, and workflow management.

## Quick Start for Developers

### Understanding the Project

**What is DataFlows Core?**
- Dynamic forms platform (like Google Forms but with advanced features)
- Integrates with InvenTree 1.0.1 for authentication
- Supports workflows, document generation, CRM, and email notifications
- Built with FastAPI (backend) + React/TypeScript (frontend)

**Key Concepts**:
- **Forms**: JSON Schema + UI Schema define form structure
- **Submissions**: User-submitted data stored in MongoDB
- **Workflows**: Submissions can be reviewed/approved/rejected
- **Templates**: HTML templates for document generation (Jinja2)
- **Email Notifications**: Automatic emails via Newsman API on form submission

### Project Architecture

```
Backend (FastAPI):
  src/backend/
    ├── routes/        # API endpoints (forms.py, data.py, auth.py, etc.)
    ├── models/        # MongoDB models (form_model.py, data_model.py, etc.)
    ├── utils/         # Utilities (db.py, newsman.py, audit.py, etc.)
    └── app.py         # Main FastAPI application

Frontend (React + TypeScript):
  src/frontend/src/
    ├── pages/         # Main pages (FormsPage, FormPage, SubmissionsPage, etc.)
    ├── components/    # Reusable components
    ├── services/      # API client (api.ts)
    └── context/       # React context (AuthContext)

Configuration:
  config/              # Configuration folder
    config.yaml        # Main config (MongoDB, InvenTree, email, etc.) - gitignored
    config_sample.yaml # Configuration template
    firebase-admin-sdk.json # Firebase credentials (if using Firebase) - gitignored
  tasks.py             # Invoke commands (build, run, test, etc.)
```

### Common Development Tasks

**1. Add a new API endpoint**:
- Edit `src/backend/routes/{module}.py`
- Add route with `@router.get/post/put/delete`
- Use `Depends(verify_admin)` for protected routes
- Test at `http://localhost:8000/docs`

**2. Add a new frontend page**:
- Create component in `src/frontend/src/pages/`
- Add route in `src/frontend/src/App.tsx`
- Use `useAuth()` for authentication
- Use `api.get/post/put/delete` for API calls

**3. Modify form rendering**:
- Edit `src/frontend/src/components/JsonForms/`
- Custom renderers for each field type (text, date, select, etc.)
- Uses Mantine UI components

**4. Change email templates**:
- Edit HTML files in `media/mail_templates/`
- Use placeholders: `{{ config.web.base_url }}`, `{{ form_submisions }}`
- Test with `invoke test-email --to=your@email.com`

**5. Add translations**:
```bash
cd src/frontend
npm run i18n:extract          # Extract new strings
# Edit locales/ro/translation.po
npm run i18n:compile          # Compile to JSON
npm run build                 # Rebuild frontend
```

### Development Workflow

```bash
# 1. Start backend with auto-reload
invoke dev

# 2. In another terminal, start frontend dev server
invoke dev-frontend

# 3. Make changes to code
# Backend: Changes auto-reload
# Frontend: Hot reload in browser

# 4. Build for production
invoke build

# 5. Deploy to server
git push
# On server:
cd /opt/dataflows-forms
git pull
python -m invoke build
sudo systemctl restart dataflows-core 
```

### Debugging Tips

**Backend logs**:
```bash
# Local: Check terminal where `invoke dev` is running
# Server: sudo journalctl -u dataflows-core -f
```

**Frontend debugging**:
- Open browser DevTools (F12)
- Check Console for errors
- Network tab for API calls

**Database inspection**:
- Use MongoDB Compass or Atlas web interface
- Collections: `forms`, `data`, `users`, `roles`, `jobs`, etc.

**Common issues**:
- **401 Unauthorized**: Check InvenTree token is valid
- **CORS errors**: Backend must be running on correct port
- **Email not sending**: Check `config/config.yaml` email settings, run `invoke test-email`
- **Build fails**: Delete `node_modules`, run `npm install` again

### API Quick Reference

**Authentication** (all require InvenTree credentials):
- `POST /api/auth/login` - Login with username/password
- `GET /api/auth/verify` - Verify token validity

**Forms** (admin only):
- `GET /api/forms` - List all forms
- `POST /api/forms` - Create form
- `GET /api/forms/{slug}` - Get form by slug (public if form is public)
- `PUT /api/forms/{id}` - Update form
- `DELETE /api/forms/{id}` - Delete form

**Submissions**:
- `POST /api/data/` - Submit form data (public/protected based on form)
- `GET /api/data/{form_id}` - Get submissions for form (admin only)
- `GET /api/data/submissions/all` - Get all submissions (admin only)
- `PUT /api/data/submission/{id}/state` - Update submission state (admin only)

**Templates** (admin only):
- `GET /api/templates` - List templates
- `POST /api/templates` - Create template
- `PUT /api/templates/{code}/{type}` - Update template part

**Email**:
- Test via CLI: `invoke test-email --to=email@test.com`
- Configured per form in "Notification Emails" field
- Templates in `media/mail_templates/`

### Environment Variables

Set in `config/config.yaml`:
- `inventree.url` - InvenTree instance URL
- `mongo.auth_string` - MongoDB connection string
- `web.base_url` - Public URL (used in emails)
- `email.*` - Newsman API credentials
- `app.secret_key` - JWT secret (generate random string)

### Testing

```bash
# Test email configuration
invoke test-email --to=your@email.com

# Test MongoDB connection
invoke test-config

# Run backend tests
invoke test-backend

# Lint frontend
invoke lint-frontend
```

## Features

- **Dynamic Forms**: Create and manage JSON-based forms with custom schemas
- **InvenTree Authentication**: Seamless integration with InvenTree 1.0.1 for user management
- **Workflow Management**: Multi-state approval system (New, In Review, Approved, Rejected, Cancelled)
- **File Uploads**: Secure file handling with hash-based storage
- **Document Generation**: Integration with DataFlows Docu for template-based documents
- **CRM Module**: Subscriber management, segmentation, and email campaigns
- **QR Code Generation**: Automatic QR codes for easy form access
- **Audit Logging**: Complete activity tracking
- **Multi-language**: English and Romanian support
- **Job Scheduler**: Cron-like system for recurring tasks (role sync, data processing, etc.)
- **Soft Delete**: Forms are archived instead of permanently deleted
- **Template Management**: Full CRUD for OfficeClerk document templates with multiple parts

## Technology Stack

- **Backend**: Python 3.11, FastAPI, MongoDB
- **Frontend**: React, TypeScript, Mantine UI
- **Authentication**: InvenTree 1.0.1 API
- **Database**: MongoDB Atlas

## Installation

### Prerequisites

- Python 3.11+
- Node.js 18+ and npm
- MongoDB instance (local or Atlas)
- InvenTree 1.0.1 instance
- Git

### Setup

1. **Clone the repository**
```bash
git clone https://github.com/dataflowslab/core.git
cd core
```

2. **Configure the application**
```bash
cp config/config_sample.yaml config/config.yaml
```

Edit `config/config.yaml` with your settings:
- InvenTree URL
- MongoDB connection string
- Application secret key (generate a secure random string)
- DataFlows Docu credentials (optional)
- File upload settings

3. **Install Python dependencies**
```bash
pip install -r requirements.txt
pip install -r src/backend/requirements.txt
```

4. **Install frontend dependencies**
```bash
cd src/frontend
npm install
cd ../..
```

5. **Build the frontend**
```bash
python -m invoke build
```

6. **Run the application**
```bash
python -m invoke run
```

The application will be available at `http://localhost:8000/web/`

## Ubuntu Service Setup

To run DataFlows Core as a systemd service on Ubuntu:

1. **Create service file**
```bash
sudo nano /etc/systemd/system/dataflows-core.service
```

2. **Add service configuration**
```ini
[Unit]
Description=DataFlows Core - Dynamic Forms Platform
After=network.target

[Service]
Type=simple
User=your-username
WorkingDirectory=/path/to/dataflows-forms
Environment="PATH=/path/to/dataflows-forms/venv/bin"
ExecStart=/path/to/dataflows-forms/venv/bin/python -m uvicorn src.backend.app:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Replace:
- `your-username` with your system user
- `/path/to/dataflows-forms` with actual project path
- Adjust port if needed

3. **Enable and start service**
```bash
sudo systemctl daemon-reload
sudo systemctl enable dataflows-core
sudo systemctl start dataflows-core
```

4. **Check service status**
```bash
sudo systemctl status dataflows-core
```

5. **View logs**
```bash
sudo journalctl -u dataflows-core -f
```

## Translations

DataFlows Core supports multiple languages (English and Romanian). All UI text uses the `t('...')` function for translations.

### Extracting New Translations

When you add new text to the UI, extract it to the translation files:

```bash
cd src/frontend
npm run i18n:extract
```

This will:
- Scan all TypeScript/TSX files for `t('...')` calls
- Update `locales/en/translation.po` (English - auto-filled)
- Update `locales/ro/translation.po` (Romanian - needs manual translation)

### Adding Romanian Translations

1. Open `src/frontend/locales/ro/translation.po`
2. Find entries with empty `msgstr ""`
3. Add Romanian translations:
```po
msgid "Campaign created successfully"
msgstr "Campania a fost creată cu succes"
```

### Compiling Translations

After editing .po files, compile them to JSON:

```bash
cd src/frontend
npm run i18n:compile
```

This converts .po files to JSON format used by the application.

### Translation Workflow

1. Add new text in code: `t('My new text')`
2. Extract translations:
```bash
cd src/frontend
npm run i18n:extract
```

3. Edit `locales/ro/translation.po` and add Romanian translations

4. Compile translations to JSON:
```bash
cd src/frontend
npm run i18n:compile
```

5. Build frontend to see translations in application:
```bash
cd src/frontend
npm run build
cd ../..
```

Or all in one command:
```bash
cd src/frontend ; npm run i18n:compile ; npm run build ; cd ../..
```

## Development

### Project Structure

```
dataflows-forms/
├── src/
│   ├── backend/          # FastAPI backend
│   │   ├── models/       # Database models
│   │   ├── routes/       # API endpoints
│   │   └── utils/        # Utilities
│   └── frontend/         # React frontend
│       └── src/
│           ├── components/
│           ├── pages/
│           └── services/
├── media/                # Static files
│   ├── img/             # Images
│   └── files/           # Uploaded files (gitignored)
├── config/              # Configuration folder
│   ├── config.yaml      # Configuration (gitignored)
│   ├── config_sample.yaml # Configuration template
│   └── firebase-admin-sdk.json # Firebase credentials (gitignored)
└── tasks.py             # Invoke tasks
```

### Available Commands

```bash
# Setup and Installation
invoke install              # Install all dependencies
invoke setup                # Complete setup (install + build)

# Development
invoke dev                  # Run backend with auto-reload
invoke dev-frontend         # Run frontend dev server

# Building
invoke build                # Build frontend for production
invoke build-frontend       # Build only frontend

# Running
invoke run                  # Run complete application
invoke run-backend          # Run only backend

# Jobs Management
invoke job-run --name=update_roles  # Run a job manually
invoke job-list                     # List all configured jobs
invoke scheduler-start              # Start scheduler service (foreground)

# Maintenance
invoke clean                # Clean build artifacts
invoke check                # Run linter and tests
invoke lint-frontend        # Lint frontend code
invoke test-backend         # Run backend tests

# Database
invoke db-init              # Initialize database

# Help
invoke --list               # List all tasks
invoke help                 # Show help
```

### API Documentation

Once running, visit:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## Form Management

### Creating Forms

1. Login with InvenTree credentials
2. Navigate to "Formulare" (Forms)
3. Click "Create Form"
4. Enter form details (title, description)
5. Define JSON Schema and UI Schema
6. Form receives auto-generated 8-character slug (e.g., A3B7K9M2)

### Form URLs

Forms are accessible at: `http://your-domain/web/forms/{SLUG}`

### QR Codes

Download QR code for any form: `http://your-domain/api/forms/{SLUG}/qr`

### Form Submission

**Confirmation Modal**:
- Before submitting, users see a confirmation dialog
- Summary table displays all field labels and values
- Confirm or Cancel options
- Mobile-friendly fullscreen modal

**Post-Submission Alerts**:
- Success: "Cererea a fost înregistrată" (green, dismissible)
- Error: Specific error message (red, dismissible)
- Alerts appear below form title
- Auto-scroll to top to show alerts
- Close button on each alert

**Validation**:
- Friendly validation - errors appear only after user interaction
- No intimidating red borders on initial page load
- Clear error messages for required fields

### Mantine Form System

DataFlows Core uses custom Mantine renderers for JSON Forms, providing a modern and consistent UI with enhanced functionality:

#### Supported Field Types

**Text Input**
```json
{
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "title": "Name",
      "maxLength": 100
    }
  }
}
```

**Textarea** (with character counter)
```json
{
  "type": "object",
  "properties": {
    "description": {
      "type": "string",
      "title": "Description",
      "format": "textarea",
      "maxLength": 500
    }
  }
}
```

Or using UI Schema:
```json
{
  "type": "Control",
  "scope": "#/properties/description",
  "options": {
    "multi": true,
    "rows": 5
  }
}
```

**Number Input** (decimal)
```json
{
  "type": "object",
  "properties": {
    "price": {
      "type": "number",
      "title": "Price",
      "minimum": 0
    }
  }
}
```

**Integer Input** (whole numbers only)
```json
{
  "type": "object",
  "properties": {
    "age": {
      "type": "integer",
      "title": "Age",
      "minimum": 0,
      "maximum": 120
    }
  }
}
```

**Date Picker** (with intelligent date selection)
```json
{
  "type": "object",
  "properties": {
    "startDate": {
      "type": "string",
      "format": "date",
      "title": "Start Date"
    }
  }
}
```

**Select Dropdown**
```json
{
  "type": "object",
  "properties": {
    "type": {
      "type": "string",
      "title": "Type",
      "enum": ["option1", "option2", "option3"],
      "enumNames": ["Option 1", "Option 2", "Option 3"]
    }
  }
}
```

**Multi-Select**
```json
{
  "type": "object",
  "properties": {
    "interests": {
      "type": "array",
      "title": "Interests",
      "items": {
        "type": "string",
        "enum": ["sports", "music", "reading"],
        "enumNames": ["Sports", "Music", "Reading"]
      }
    }
  }
}
```

**Checkbox** (single boolean)
```json
{
  "type": "object",
  "properties": {
    "agree": {
      "type": "boolean",
      "title": "I agree to terms"
    }
  }
}
```

**Checkbox Group** (multiple selections)
```json
{
  "type": "object",
  "properties": {
    "preferences": {
      "type": "array",
      "title": "Preferences",
      "items": {
        "type": "string",
        "enum": ["email", "sms", "phone"],
        "enumNames": ["Email", "SMS", "Phone"]
      }
    }
  }
}
```

**Radio Buttons**
```json
// JSON Schema
{
  "type": "object",
  "properties": {
    "gender": {
      "type": "string",
      "title": "Gender",
      "enum": ["male", "female", "other"],
      "enumNames": ["Male", "Female", "Other"]
    }
  }
}

// UI Schema
{
  "type": "Control",
  "scope": "#/properties/gender",
  "options": {
    "format": "radio"
  }
}
```

#### Layout Options

**Vertical Layout** (default)
```json
{
  "type": "VerticalLayout",
  "elements": [
    {
      "type": "Control",
      "scope": "#/properties/field1"
    },
    {
      "type": "Control",
      "scope": "#/properties/field2"
    }
  ]
}
```

**Horizontal Layout** (fields side by side)
```json
{
  "type": "HorizontalLayout",
  "elements": [
    {
      "type": "Control",
      "scope": "#/properties/firstName"
    },
    {
      "type": "Control",
      "scope": "#/properties/lastName"
    }
  ]
}
```

**Group Layout** (with border and title)
```json
{
  "type": "Group",
  "label": "Personal Information",
  "elements": [
    {
      "type": "Control",
      "scope": "#/properties/name"
    },
    {
      "type": "Control",
      "scope": "#/properties/email"
    }
  ]
}
```

#### Complete Example

```json
// JSON Schema
{
  "type": "object",
  "properties": {
    "applicantName": {
      "type": "string",
      "title": "Applicant Name",
      "maxLength": 100
    },
    "daysNo": {
      "type": "number",
      "title": "Number of Days",
      "minimum": 1,
      "maximum": 365
    },
    "leaveType": {
      "type": "string",
      "title": "Leave Type",
      "enum": ["vacation", "sick", "personal"],
      "enumNames": ["Vacation", "Sick Leave", "Personal"]
    },
    "startDate": {
      "type": "string",
      "format": "date",
      "title": "Start Date"
    },
    "reason": {
      "type": "string",
      "title": "Reason",
      "format": "textarea",
      "maxLength": 500
    },
    "agree": {
      "type": "boolean",
      "title": "I agree to the terms and conditions"
    }
  },
  "required": ["applicantName", "daysNo", "leaveType", "startDate"]
}

// UI Schema
{
  "type": "VerticalLayout",
  "elements": [
    {
      "type": "Group",
      "label": "Applicant Information",
      "elements": [
        {
          "type": "Control",
          "scope": "#/properties/applicantName"
        },
        {
          "type": "HorizontalLayout",
          "elements": [
            {
              "type": "Control",
              "scope": "#/properties/daysNo"
            },
            {
              "type": "Control",
              "scope": "#/properties/leaveType"
            }
          ]
        },
        {
          "type": "Control",
          "scope": "#/properties/startDate"
        }
      ]
    },
    {
      "type": "Control",
      "scope": "#/properties/reason",
      "options": {
        "multi": true,
        "rows": 4
      }
    },
    {
      "type": "Control",
      "scope": "#/properties/agree"
    }
  ]
}
```

#### Features

- **Consistent styling**: All fields use Mantine components for a unified look
- **Smart date picker**: Intelligent date selection with calendar popup
- **Character counter**: Automatic character counting for textarea fields
- **Equal label width**: In horizontal layouts, labels maintain consistent width
- **Validation**: Built-in validation with error messages
- **Required fields**: Visual indicators (asterisk) for required fields
- **Responsive**: Mobile-friendly layouts
- **Searchable selects**: Dropdown fields with search functionality
- **Clearable inputs**: Easy clearing of field values

## Workflow States

Submissions can have the following states:
- **Nou** (New): Initial state after submission
- **În analiză** (In Review): Under review by administrator
- **Aprobat** (Approved): Approved by administrator
- **Respins** (Rejected): Rejected by administrator
- **Anulat** (Cancelled): Cancelled

State changes are logged with timestamp, user, and notes.

## Job Scheduler

DataFlows Core includes a built-in job scheduler for recurring tasks.

### How It Works

- Jobs are configured in the `jobs` collection in MongoDB
- Each job has a cron expression (e.g., `*/5 * * * *` for every 5 minutes)
- Jobs are Python scripts in `src/scripts/` directory
- Scheduler runs automatically when the application starts
- Jobs can also be triggered manually via API or invoke tasks

### Default Jobs

- **update_roles**: Synchronizes roles from InvenTree (runs every 5 minutes)

### Managing Jobs

**Via API** (requires admin access):
- `GET /api/system/jobs` - List all jobs
- `POST /api/system/jobs` - Create new job
- `PUT /api/system/jobs/{name}` - Update job
- `DELETE /api/system/jobs/{name}` - Delete job
- `POST /api/system/jobs/{name}/run` - Manually trigger job

**Via Command Line**:
```bash
# Run a job manually
invoke job-run --name=update_roles

# List all jobs
invoke job-list

# Initialize default jobs
python init_jobs.py
```

### Creating Custom Jobs

1. Create a Python script in `src/scripts/` (e.g., `my_job.py`)
2. Add job configuration to database:
```python
{
    "name": "my_job",
    "frequency": "0 * * * *",  # Every hour
    "enabled": true,
    "description": "My custom job"
}
```
3. Job will run automatically according to schedule

### Cron Expression Format

```
* * * * *
│ │ │ │ │
│ │ │ │ └─ Day of week (0-6, Sunday=0)
│ │ │ └─── Month (1-12)
│ │ └───── Day of month (1-31)
│ └─────── Hour (0-23)
└───────── Minute (0-59)
```

Examples:
- `*/5 * * * *` - Every 5 minutes
- `0 * * * *` - Every hour
- `0 0 * * *` - Every day at midnight
- `0 9 * * 1` - Every Monday at 9 AM

## Template Management

DataFlows Core integrates with OfficeClerk (DataFlows Docu) for document template management.

### Template Structure

Templates consist of multiple parts:
- **base** (required): Main HTML body with Jinja2 variables
- **header** (optional): Running header on every page
- **footer** (optional): Running footer on every page
- **css** (optional): Stylesheet for print/screen
- **code** (optional): JavaScript code

### Template Operations

**Via API** (requires admin access):
- `GET /api/templates` - List all templates
- `POST /api/templates` - Create new template
- `GET /api/templates/{code}` - Get template details
- `PUT /api/templates/{code}` - Update template metadata
- `DELETE /api/templates/{code}` - Delete template
- `POST /api/templates/{code}/parts` - Add part to template
- `GET /api/templates/{code}/{type}/raw` - Get part content
- `PUT /api/templates/{code}/{type}` - Update part
- `DELETE /api/templates/{code}/{type}` - Delete part

### Jinja2 Templating

Templates use Jinja2 syntax for dynamic content:

```html
<!-- Variables -->
<h1>{{title}}</h1>
<p>{{content}}</p>

<!-- Loops -->
{% for item in items %}
  <li>{{item.name}}: {{item.price}}</li>
{% endfor %}

<!-- Conditionals -->
{% if total > 1000 %}
  <p class="warning">High value!</p>
{% endif %}
```

### Document Generation

Generate documents from templates:

```bash
# Via API
POST /api/documents/generate
{
  "submission_id": "...",
  "template_code": "ABC123DEF456",
  "template_name": "Invoice Template"
}
```

See `TEMPLATES_GUIDE.md` for detailed documentation.

## Email Notifications

### Configuration

Email notifications are sent via Newsman API when forms are submitted.

**Setup in `config/config.yaml`**:
```yaml
email:
  newsman_api_key: "YOUR_API_KEY"
  newsman_account_id: "YOUR_ACCOUNT_ID"
  from_email: "noreply@dataflows.ro"  # Must be verified in Newsman
  from_name: "DataFlows Forms"

web:
  base_url: "https://your-domain.com"  # Used in email links
```

### Form Configuration

1. Edit form in admin panel
2. Add comma-separated emails in "Notification Emails" field: `email1@test.com, email2@test.com`
3. Select email template (default: `default.html`)
4. Save form

### Email Templates

Templates are stored in `media/mail_templates/` as HTML files.

**Available Placeholders**:
- `{{ config.web.base_url }}` - Application URL
- `{{ form_submisions }}` - Link to submissions page

**Create Custom Template**:
1. Create HTML file in `media/mail_templates/` (e.g., `custom.html`)
2. Use placeholders for dynamic content
3. Template appears automatically in dropdown

**Important**: 
- Templates should use English text to avoid encoding issues
- Subject line is auto-sanitized (Romanian diacritics: ă→a, î→i, ș→s, ț→t)
- HTML content supports full UTF-8 (Romanian characters work in email body)

### Testing Email Configuration

```bash
# Test with prompt for email
invoke test-email

# Test with specific email
invoke test-email --to=your@email.com
```

### Troubleshooting

**No emails received**:
1. Check `config/config.yaml` has valid Newsman credentials
2. Verify sender email is verified in Newsman account
3. Check form has emails in "Notification Emails" field
4. Check server logs: `sudo journalctl -u dataflows-core -f | grep -E "\[SUBMIT\]|\[EMAIL\]"`

**Common log messages**:
- `[EMAIL] SUCCESS: Email sent successfully` - Email queued ✓
- `[EMAIL] ERROR: Email configuration incomplete` - Missing config
- `[EMAIL] FAILED: Newsman API error` - Check credentials or sender verification

### Character Encoding

The system automatically handles Romanian characters:
- **Subject line**: Diacritics removed (ă→a, î→i, ș→s, ț→t) to ensure delivery
- **Email body**: Full UTF-8 support, Romanian characters work perfectly
- **Console logging**: Safe logging without encoding errors

## External API Access

DataFlows Core supports programmatic API access using Bearer tokens for external integrations.

### API Token Authentication

API tokens are stored in the `api_tokens` collection with the following structure:
```json
{
  "token": "YOUR_API_TOKEN_HERE",
  "expires": "2026-11-20T12:00:00",
  "rights": [
    "ext/fgo-client-invoices",
    "ext/fgo-supplier-invoices"
  ]
}
```

### Using API Tokens

**Authentication Header**:
```
Authorization: Bearer YOUR_API_TOKEN_HERE
```

**Example with cURL**:
```bash
curl -X POST https://core.simai.dataflows.ro/api/ext/fgo-client-invoices \
  -H "Authorization: Bearer C4EWoKB00TsiTplL5prXFv43Y3sWooQkC94KiVia5c2pqBFoGeFoijdwcGra6sFC" \
  -H "Content-Type: application/json" \
  -d '{"invoice_id": "12345", "amount": 1000, "client": "ACME Corp"}'
```

**Example with Python**:
```python
import requests

url = "https://core.simai.dataflows.ro/api/ext/fgo-client-invoices"
headers = {
    "Authorization": "Bearer YOUR_API_TOKEN_HERE",
    "Content-Type": "application/json"
}
data = {
    "invoice_id": "12345",
    "amount": 1000,
    "client": "ACME Corp"
}

response = requests.post(url, json=data, headers=headers)
print(response.json())
```

### Available Endpoints

**FGO Client Invoices**:
```
POST /api/ext/fgo-client-invoices
```
Saves client invoice data to `raw_data` collection.

**FGO Supplier Invoices**:
```
POST /api/ext/fgo-supplier-invoices
```
Saves supplier invoice data to `raw_data` collection.

### Data Storage

All external API data is stored in the `raw_data` collection:
```json
{
  "date_added": "2025-11-20T17:55:00",
  "source": "ext/fgo-client-invoices",
  "data": {
    // Your JSON payload here
  }
}
```

### Token Management

**Token Validation**:
- Token must exist in `api_tokens` collection
- Token must not be expired
- Token must have the required right for the endpoint

**Rights System**:
Each token has a list of rights (permissions). The right must match the endpoint path:
- `ext/fgo-client-invoices` - Access to client invoices endpoint
- `ext/fgo-supplier-invoices` - Access to supplier invoices endpoint

**Error Responses**:
- `401 Unauthorized` - Invalid or expired token
- `403 Forbidden` - Token doesn't have required right
- `400 Bad Request` - Invalid JSON data

### Creating API Tokens

Add tokens directly to MongoDB `api_tokens` collection:
```javascript
db.api_tokens.insertOne({
  token: "YOUR_SECURE_RANDOM_TOKEN",
  expires: new Date("2026-11-20T12:00:00"),
  rights: [
    "ext/fgo-client-invoices",
    "ext/fgo-supplier-invoices"
  ]
})
```

**Token Generation** (Python):
```python
import secrets
token = secrets.token_urlsafe(64)
print(token)
```

### Security Best Practices

- Use long, random tokens (64+ characters)
- Set expiration dates on tokens
- Grant minimal rights needed
- Rotate tokens periodically
- Store tokens securely (environment variables, secrets manager)
- Use HTTPS in production
- Monitor `raw_data` collection for suspicious activity

## CRM Features

### Subscribers
- Import from InvenTree
- ANAF tax ID verification (Romania)
- Email and SMS marketing consent tracking
- Segment assignment

### Segments
- Organize subscribers into groups
- Target specific audiences

### Campaigns

**Rich Text Editor**:
- WYSIWYG editor for campaign messages (Mantine TipTap)
- Full formatting toolbar: bold, italic, underline, strikethrough
- Headings (H1, H2, H3)
- Lists (bullet and ordered)
- Blockquotes and horizontal rules
- Link insertion and removal
- Undo/Redo functionality
- HTML output for email campaigns

**Image Upload**:
- Drag-and-drop image upload with Dropzone
- Visual preview after upload
- Remove uploaded image option
- 5MB file size limit
- Automatic hash-based storage
- Secure file serving

**Campaign Management**:
- Email campaigns (more channels coming soon)
- Segment targeting
- Campaign status tracking (draft, sending, sent)
- Scheduled sending via cron
- Template selection from dropdown (searchable)

## File Uploads

Files are:
- Validated by extension and size
- Stored with SHA256 hash names
- Organized by upload date (YYYY/MM/DD)
- Served securely via hash-based URLs

## Configuration Reference

See `config/config_sample.yaml` for all available configuration options.

## Security Notes

- Never commit `config/config.yaml` or Firebase credentials to version control
- Use strong secret keys (minimum 32 characters)
- Configure MongoDB with authentication
- Use HTTPS in production
- Regularly update dependencies
- Review audit logs periodically

## Documentation

- InvenTree 1.0.1: https://docs.inventree.org/en/1.0.1/
- JSON Forms: https://jsonforms.io/docs/
- FastAPI: https://fastapi.tiangolo.com/
- Mantine UI: https://mantine.dev/

## License

Copyright © 2024 DataFlows Lab

## Support

For issues and questions, please use the GitHub issue tracker.
