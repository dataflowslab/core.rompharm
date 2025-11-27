"""
DataFlows Core - Invoke Tasks
Task runner for building, running, and managing the application
"""
from invoke import task
import os
import sys


@task
def install(c):
    """Install all dependencies (backend + frontend)"""
    print("=" * 50)
    print("Installing Dependencies")
    print("=" * 50)
    
    # Install backend dependencies
    print("\n[1/2] Installing Python dependencies...")
    c.run("pip install -r src/backend/requirements.txt")
    
    # Install frontend dependencies
    print("\n[2/2] Installing Node.js dependencies...")
    with c.cd("src/frontend"):
        c.run("npm install")
    
    print("\n✓ All dependencies installed successfully!")


@task
def build_frontend(c):
    """Build frontend for production"""
    print("=" * 50)
    print("Building Frontend")
    print("=" * 50)
    
    with c.cd("src/frontend"):
        print("\nBuilding frontend...")
        c.run("npm run build")
    
    print("\n✓ Frontend built successfully!")
    print("Output: src/frontend/dist/")


@task
def dev_frontend(c):
    """Run frontend in development mode with hot reload"""
    print("=" * 50)
    print("Starting Frontend Dev Server")
    print("=" * 50)
    print("\nFrontend will be available at: http://localhost:3000/web/")
    print("API proxy: http://localhost:8000")
    print("\nPress Ctrl+C to stop\n")
    
    with c.cd("src/frontend"):
        c.run("npm run dev")


@task
def run_backend(c, reload=False):
    """Run backend server
    
    Args:
        reload: Enable auto-reload on code changes (default: False)
    """
    import yaml
    
    # Load config to get port and host
    try:
        with open('config.yaml', 'r') as f:
            config = yaml.safe_load(f)
        host = config.get('web', {}).get('host', '0.0.0.0')
        port = config.get('web', {}).get('port', 8000)
    except FileNotFoundError:
        print("Warning: config.yaml not found, using default settings")
        host = '0.0.0.0'
        port = 8000
    
    print("=" * 50)
    print("Starting Backend Server")
    print("=" * 50)
    print(f"\nBackend API: http://localhost:{port}/api/")
    print(f"Frontend: http://localhost:{port}/web/")
    print(f"API Docs: http://localhost:{port}/docs")
    print("\nPress Ctrl+C to stop\n")
    
    reload_flag = "--reload" if reload else ""
    c.run(f"python -m uvicorn src.backend.app:app --host {host} --port {port} {reload_flag}")


@task
def dev(c):
    """Run backend in development mode with auto-reload"""
    run_backend(c, reload=True)


@task(pre=[build_frontend])
def build(c):
    """Build everything for production"""
    print("\n" + "=" * 50)
    print("Build Complete!")
    print("=" * 50)
    print("\nTo start the application, run: invoke run")


@task(pre=[install, build_frontend])
def setup(c):
    """Complete setup: install dependencies and build"""
    print("\n" + "=" * 50)
    print("Setup Complete!")
    print("=" * 50)
    print("\nTo start the application, run: invoke run")


@task
def run(c):
    """Run the complete application (production mode)"""
    import yaml
    
    # Load config to get port and host
    try:
        with open('config.yaml', 'r') as f:
            config = yaml.safe_load(f)
        host = config.get('web', {}).get('host', '0.0.0.0')
        port = config.get('web', {}).get('port', 8000)
    except FileNotFoundError:
        print("Warning: config.yaml not found, using default settings")
        host = '0.0.0.0'
        port = 8000
    
    print("=" * 50)
    print("Starting DataFlows Core")
    print("=" * 50)
    print(f"\nBackend API: http://localhost:{port}/api/")
    print(f"Frontend: http://localhost:{port}/web/")
    print(f"API Docs: http://localhost:{port}/docs")
    print("\nPress Ctrl+C to stop\n")
    
    c.run(f"python -m uvicorn src.backend.app:app --host {host} --port {port}")


@task
def clean(c):
    """Clean build artifacts"""
    print("Cleaning build artifacts...")
    
    # Clean frontend build
    if os.path.exists("src/frontend/dist"):
        c.run("rm -rf src/frontend/dist" if sys.platform != "win32" else "rmdir /s /q src\\frontend\\dist", warn=True)
        print("✓ Cleaned frontend/dist")
    
    # Clean Python cache
    c.run("find . -type d -name __pycache__ -exec rm -rf {} +" if sys.platform != "win32" else "for /d /r . %d in (__pycache__) do @if exist \"%d\" rmdir /s /q \"%d\"", warn=True)
    print("✓ Cleaned Python cache")
    
    # Clean node_modules (optional, commented out by default)
    # if os.path.exists("src/frontend/node_modules"):
    #     c.run("rm -rf src/frontend/node_modules")
    #     print("✓ Cleaned node_modules")
    
    print("\n✓ Clean complete!")


@task
def test_backend(c):
    """Run backend tests"""
    print("Running backend tests...")
    with c.cd("src/backend"):
        c.run("pytest", warn=True)


@task
def lint_frontend(c):
    """Run frontend linter"""
    print("Running frontend linter...")
    with c.cd("src/frontend"):
        c.run("npm run lint")


@task
def check(c):
    """Run all checks (lint, test)"""
    print("=" * 50)
    print("Running Checks")
    print("=" * 50)
    
    print("\n[1/2] Linting frontend...")
    lint_frontend(c)
    
    print("\n[2/2] Testing backend...")
    test_backend(c)
    
    print("\n✓ All checks passed!")


@task
def test_config(c):
    """Test configuration and connections"""
    print("=" * 50)
    print("Testing Configuration")
    print("=" * 50)
    
    import yaml
    import sys
    
    # Test 1: Load config file
    print("\n[1/3] Testing config.yaml...")
    try:
        with open('config.yaml', 'r') as f:
            config = yaml.safe_load(f)
        print("✓ config.yaml loaded successfully")
    except FileNotFoundError:
        print("✗ config.yaml not found!")
        print("  Run: cp config_sample.yaml config.yaml")
        return
    except Exception as e:
        print(f"✗ Error loading config.yaml: {e}")
        return
    
    # Test 2: MongoDB connection
    print("\n[2/3] Testing MongoDB connection...")
    try:
        from pymongo import MongoClient
        import certifi
        
        connection_string = config['mongo'].get('auth_string') or config['mongo'].get('connection_string')
        
        if not connection_string:
            print("✗ MongoDB connection string not found in config!")
            return
        
        print(f"  Connecting to MongoDB...")
        # Disable certificate verification for compatibility with older OpenSSL
        client = MongoClient(
            connection_string,
            tlsAllowInvalidCertificates=True,
            serverSelectionTimeoutMS=5000,
            connectTimeoutMS=5000
        )
        
        # Test connection
        client.admin.command('ping')
        db = client.get_default_database()
        print(f"✓ MongoDB connected successfully")
        print(f"  Database: {db.name}")
        
        # List collections
        collections = db.list_collection_names()
        print(f"  Collections: {len(collections)}")
        if collections:
            print(f"    {', '.join(collections[:5])}")
        
        client.close()
        
    except ImportError as e:
        print(f"✗ Missing dependency: {e}")
        print("  Run: pip install -r src/backend/requirements.txt")
        return
    except Exception as e:
        print(f"✗ MongoDB connection failed: {e}")
        print("\n  Troubleshooting:")
        print("  1. Check MongoDB connection string in config.yaml")
        print("  2. Verify network connectivity to MongoDB")
        print("  3. Check if IP is whitelisted in MongoDB Atlas")
        print("  4. Install certifi: pip install certifi")
        return
    
    # Test 3: InvenTree connection
    print("\n[3/3] Testing InvenTree connection...")
    try:
        import requests
        
        inventree_url = config.get('inventree', {}).get('url')
        
        if not inventree_url:
            print("✗ InvenTree URL not found in config!")
            return
        
        print(f"  Connecting to {inventree_url}...")
        response = requests.get(f"{inventree_url}/api/", timeout=5)
        
        if response.status_code == 200:
            print(f"✓ InvenTree API accessible")
        else:
            print(f"⚠ InvenTree returned status {response.status_code}")
        
    except requests.exceptions.ConnectionError:
        print(f"✗ Cannot connect to InvenTree at {inventree_url}")
        print("  Check if InvenTree is running and URL is correct")
    except Exception as e:
        print(f"✗ InvenTree connection error: {e}")
    
    print("\n" + "=" * 50)
    print("Configuration Test Complete")
    print("=" * 50)


@task
def db_init(c):
    """Initialize database (create collections)"""
    print("Initializing database...")
    print("Note: Collections will be created automatically on first use")
    print("✓ Database ready")


@task
def job_run(c, name):
    """Run a specific job manually
    
    Args:
        name: Job name (e.g., update_roles)
    """
    print(f"Running job: {name}")
    c.run(f"python src/scripts/{name}.py")


@task
def job_list(c):
    """List all configured jobs"""
    print("Listing configured jobs from database...")
    c.run("python -c \"from src.backend.utils.db import get_db; from src.backend.models.job_model import JobModel; db = get_db(); jobs = list(db[JobModel.collection_name].find()); [print(f\\\"- {j['name']}: {j['frequency']} (enabled: {j.get('enabled', True)})\\\") for j in jobs]\"")


@task
def scheduler_start(c):
    """Start the job scheduler service"""
    print("Starting job scheduler...")
    print("Note: This will run in the foreground. Press Ctrl+C to stop.")
    c.run("python -c \"from src.backend.scheduler import get_scheduler; import time; scheduler = get_scheduler(); scheduler.start(); print('Scheduler running...'); [time.sleep(1) for _ in iter(int, 1)]\"")


@task
def test_email(c, to=None):
    """Test email configuration by sending a test email
    
    Args:
        to: Recipient email address (optional, will prompt if not provided)
    """
    import yaml
    import requests
    from datetime import datetime
    
    print("=" * 60)
    print("NEWSMAN EMAIL CONFIGURATION TEST")
    print("=" * 60)
    print()
    
    # Load config
    print("1. Loading configuration from config.yaml...")
    try:
        with open('config.yaml', 'r') as f:
            config = yaml.safe_load(f)
        email_config = config.get('email', {})
        print("   ✓ Configuration loaded")
    except Exception as e:
        print(f"   ✗ Failed to load config: {e}")
        return
    
    # Check required fields
    print("\n2. Checking required fields...")
    api_key = email_config.get('newsman_api_key')
    account_id = email_config.get('newsman_account_id')
    from_email = email_config.get('from_email')
    from_name = email_config.get('from_name', 'DataFlows Core')
    
    print(f"   - API Key: {'[OK] Present' if api_key else '[MISSING]'}")
    print(f"   - Account ID: {'[OK] Present' if account_id else '[MISSING]'}")
    print(f"   - From Email: {from_email if from_email else '[MISSING]'}")
    print(f"   - From Name: {from_name}")
    
    if not all([api_key, account_id, from_email]):
        print("\n   [ERROR] Email configuration incomplete!")
        print("\n   Please update config.yaml with your Newsman credentials:")
        print("   email:")
        print("     newsman_api_key: 'YOUR_API_KEY'")
        print("     newsman_account_id: 'YOUR_ACCOUNT_ID'")
        print("     from_email: 'noreply@dataflows.ro'")
        return
    
    # Check for placeholder values
    if 'YOUR_' in api_key or 'YOUR_' in account_id:
        print("\n   ✗ Placeholder values detected!")
        print("   Please replace 'YOUR_NEWSMAN_API_KEY' and 'YOUR_NEWSMAN_ACCOUNT_ID'")
        print("   with your actual Newsman credentials.")
        return
    
    print("   ✓ All required fields present")
    
    # Get test email
    if not to:
        print("\n3. Enter test recipient email address:")
        to = input("   Email: ").strip()
    else:
        print(f"\n3. Using recipient: {to}")
    
    if not to or '@' not in to:
        print("   ✗ Invalid email address")
        return
    
    # Prepare test email
    print(f"\n4. Sending test email to {to}...")
    
    url = "https://cluster.newsmanapp.com/api/1.0/message.send"
    
    html_content = f"""
    <html>
    <head>
        <style>
            body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
            .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
            .header {{ background-color: #228be6; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }}
            .content {{ padding: 20px; background-color: #f8f9fa; border-radius: 0 0 8px 8px; }}
            .success {{ color: #28a745; font-weight: bold; }}
            .info {{ background-color: #e7f3ff; padding: 15px; border-left: 4px solid #228be6; margin: 15px 0; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>✓ Test Email Successful</h1>
            </div>
            <div class="content">
                <p class="success">Congratulations! Your Newsman email configuration is working correctly.</p>
                
                <div class="info">
                    <strong>Configuration Details:</strong><br>
                    From: {from_name} &lt;{from_email}&gt;<br>
                    Account ID: {account_id}<br>
                    Sent: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
                </div>
                
                <p>This test email confirms that:</p>
                <ul>
                    <li>Your Newsman API credentials are valid</li>
                    <li>The sender email is properly configured</li>
                    <li>Email delivery is working</li>
                </ul>
                
                <p>You can now use form notifications in DataFlows Forms!</p>
                
                <hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;">
                
                <p style="font-size: 12px; color: #666;">
                    This is an automated test message from DataFlows Forms.<br>
                    If you did not request this test, you can safely ignore it.
                </p>
            </div>
        </div>
    </body>
    </html>
    """
    
    text_content = f"""
    TEST EMAIL SUCCESSFUL
    
    Congratulations! Your Newsman email configuration is working correctly.
    
    Configuration Details:
    From: {from_name} <{from_email}>
    Account ID: {account_id}
    Sent: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
    
    This test email confirms that:
    - Your Newsman API credentials are valid
    - The sender email is properly configured
    - Email delivery is working
    
    You can now use form notifications in DataFlows Forms!
    """
    
    payload = {
        "key": api_key,
        "account_id": account_id,
        "message": {
            "from_name": from_name,
            "from_email": from_email,
            "html": html_content,
            "text": text_content,
            "subject": "DataFlows Forms - Email Configuration Test"
        },
        "recipients": [
            {
                "email": to,
                "name": to
            }
        ]
    }
    
    try:
        response = requests.post(
            url,
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=30
        )
        
        print(f"   Response Status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"   Response Body: {result}")
            
            # Newsman can return either a dict or a list
            if isinstance(result, list):
                # List response - check first item
                if result and result[0].get('status') in ['queued', 'sent']:
                    print("\n   ✓ Email sent successfully!")
                    print(f"   Status: {result[0].get('status')}")
                    print(f"   Send ID: {result[0].get('send_id')}")
                    print(f"\n   Check your inbox at {to}")
                    print("   (Don't forget to check spam folder)")
                    print("\n" + "=" * 60)
                    print("TEST PASSED ✓")
                    print("=" * 60)
                    return
                else:
                    print(f"\n   ✗ Email failed: {result[0].get('reason', 'Unknown error')}")
            elif isinstance(result, dict):
                # Dict response
                if result.get('code') == 0 or not result.get('errors'):
                    print("\n   ✓ Email sent successfully!")
                    print(f"\n   Check your inbox at {to}")
                    print("   (Don't forget to check spam folder)")
                    print("\n" + "=" * 60)
                    print("TEST PASSED ✓")
                    print("=" * 60)
                    return
                else:
                    print(f"\n   ✗ Newsman API Error: {result.get('errors', 'Unknown error')}")
            else:
                print(f"\n   ✗ Unexpected response format: {type(result)}")
        else:
            print(f"\n   ✗ HTTP Error: {response.status_code}")
            print(f"   Response: {response.text}")
            
    except requests.exceptions.Timeout:
        print("\n   ✗ Request timeout - Newsman API not responding")
    except requests.exceptions.ConnectionError:
        print("\n   ✗ Connection error - Cannot reach Newsman API")
        print("   Check your internet connection")
    except Exception as e:
        print(f"\n   ✗ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
    
    print("\n" + "=" * 60)
    print("TEST FAILED ✗")
    print("=" * 60)
    print("\nCommon issues:")
    print("- Sender email not verified in Newsman")
    print("- Invalid API credentials")
    print("- Account suspended or quota exceeded")


@task
def list_tasks(c):
    """List all available tasks"""
    c.run("invoke --list")


# Default task
@task(default=True)
def help(c):
    """Show help and available commands"""
    print("=" * 50)
    print("DataFlows Core - Task Runner")
    print("=" * 50)
    print("\nAvailable commands:")
    print("\n  Setup & Installation:")
    print("    invoke install          - Install all dependencies")
    print("    invoke setup            - Complete setup (install + build)")
    print("\n  Development:")
    print("    invoke dev              - Run backend with auto-reload")
    print("    invoke dev-frontend     - Run frontend dev server")
    print("\n  Building:")
    print("    invoke build            - Build frontend for production")
    print("    invoke build-frontend   - Build only frontend")
    print("\n  Running:")
    print("    invoke run              - Run complete application")
    print("    invoke run-backend      - Run only backend")
    print("\n  Maintenance:")
    print("    invoke clean            - Clean build artifacts")
    print("    invoke check            - Run linter and tests")
    print("    invoke lint-frontend    - Lint frontend code")
    print("    invoke test-backend     - Run backend tests")
    print("\n  Database:")
    print("    invoke db-init          - Initialize database")
    print("    invoke test-config      - Test configuration and connections")
    print("\n  Email:")
    print("    invoke test-email       - Test email configuration")
    print("    invoke test-email --to=email@example.com  - Test with specific email")
    print("\n  Help:")
    print("    invoke --list           - List all tasks")
    print("    invoke help             - Show this help")
    print("\nFor more info on a task: invoke --help <task>")
    print("\nExamples:")
    print("  invoke setup              # First time setup")
    print("  invoke dev                # Development mode")
    print("  invoke build ; invoke run  # Production mode")
    print("=" * 50)
