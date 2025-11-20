"""
Newsman Email API integration
API Documentation: https://cluster.newsmanapp.com/api/1.0/message.send
"""
import requests
import yaml
import os
from typing import List, Optional, Dict
import unicodedata


def load_config():
    """Load configuration from config.yaml"""
    config_path = os.path.join(os.path.dirname(__file__), '..', '..', '..', 'config.yaml')
    with open(config_path, 'r') as f:
        return yaml.safe_load(f)


def sanitize_text(text: str) -> str:
    """
    Remove diacritics and special characters from text
    Converts Romanian characters: ă→a, â→a, î→i, ș→s, ț→t
    
    Args:
        text: Text to sanitize
        
    Returns:
        Sanitized text without diacritics
    """
    if not text:
        return text
    
    # Romanian specific replacements
    replacements = {
        'ă': 'a', 'Ă': 'A',
        'â': 'a', 'Â': 'A',
        'î': 'i', 'Î': 'I',
        'ș': 's', 'Ș': 'S',
        'ț': 't', 'Ț': 'T',
    }
    
    # Apply Romanian replacements
    for old, new in replacements.items():
        text = text.replace(old, new)
    
    # Normalize unicode (NFD = decompose, then remove combining marks)
    text = unicodedata.normalize('NFD', text)
    text = ''.join(char for char in text if unicodedata.category(char) != 'Mn')
    
    return text


def send_email(
    to_email: str,
    subject: str,
    html_content: str,
    text_content: Optional[str] = None,
    to_name: Optional[str] = None,
    params: Optional[Dict] = None
) -> bool:
    """
    Send email via Newsman API
    
    Args:
        to_email: Recipient email address
        subject: Email subject
        html_content: HTML email content
        text_content: Plain text email content (optional)
        to_name: Recipient name (optional)
        params: Template parameters for recipient (optional)
        
    Returns:
        True if email sent successfully, False otherwise
    """
    try:
        print(f"[EMAIL] Attempting to send email to {to_email}")
        
        config = load_config()
        email_config = config.get('email', {})
        
        api_key = email_config.get('newsman_api_key')
        account_id = email_config.get('newsman_account_id')
        from_email = email_config.get('from_email')
        from_name = email_config.get('from_name', 'DataFlows Core')
        
        print(f"[EMAIL] Config loaded: api_key={bool(api_key)}, account_id={bool(account_id)}, from_email={from_email}")
        
        if not all([api_key, account_id, from_email]):
            print("[EMAIL] ERROR: Email configuration incomplete!")
            print(f"[EMAIL] Missing: api_key={not bool(api_key)}, account_id={not bool(account_id)}, from_email={not bool(from_email)}")
            return False
        
        # Newsman API endpoint
        url = "https://cluster.newsmanapp.com/api/1.0/message.send"
        
        # Prepare request payload
        payload = {
            "key": api_key,
            "account_id": account_id,
            "message": {
                "from_name": from_name,
                "from_email": from_email,
                "html": html_content,
                "subject": subject,
            },
            "recipients": [
                {
                    "email": to_email,
                    "name": to_name or to_email,
                    "params": params or {}
                }
            ]
        }
        
        # Add optional text content
        if text_content:
            payload["message"]["text"] = text_content
        
        print(f"[EMAIL] Sending request to Newsman API...")
        
        # Send request
        response = requests.post(
            url,
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=30
        )
        
        print(f"[EMAIL] Response status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"[EMAIL] Response body: {result}")
            
            # Newsman can return either a dict or a list
            if isinstance(result, list):
                # List response - check first item
                if result and result[0].get('status') in ['queued', 'sent']:
                    print(f"[EMAIL] SUCCESS: Email sent successfully to {to_email} (status: {result[0].get('status')})")
                    return True
                else:
                    print(f"[EMAIL] FAILED: Email failed: {result[0].get('reason', 'Unknown error')}")
                    return False
            elif isinstance(result, dict):
                # Dict response
                if result.get('code') == 0 or not result.get('errors'):
                    print(f"[EMAIL] SUCCESS: Email sent successfully to {to_email}")
                    return True
                else:
                    print(f"[EMAIL] FAILED: Newsman API error: {result.get('errors', 'Unknown error')}")
                    return False
            else:
                print(f"[EMAIL] FAILED: Unexpected response format: {type(result)}")
                return False
        else:
            print(f"[EMAIL] FAILED: HTTP error: {response.status_code} - {response.text}")
            return False
            
    except Exception as e:
        print(f"[EMAIL] EXCEPTION: Failed to send email: {str(e)}")
        import traceback
        traceback.print_exc()
        return False


def send_form_notification(
    form_title: str,
    notification_emails: List[str],
    submission_data: dict,
    html_template: Optional[str] = None,
    form_slug: Optional[str] = None,
    base_url: Optional[str] = None
) -> bool:
    """
    Send notification email about new form submission
    
    Args:
        form_title: Title of the form
        notification_emails: List of email addresses to notify
        submission_data: Submitted form data
        html_template: Custom HTML template (optional, uses default if not provided)
        form_slug: Form slug (optional, for backward compatibility)
        base_url: Base URL of the application (optional, for backward compatibility)
        
    Returns:
        True if all emails sent successfully
    """
    print(f"[EMAIL] send_form_notification called")
    print(f"[EMAIL] Recipients: {notification_emails}")
    print(f"[EMAIL] Using custom template: {bool(html_template)}")
    
    if not notification_emails:
        print("[EMAIL] No notification emails configured, skipping")
        return True
    
    # Use custom template if provided, otherwise use default
    if html_template:
        html_content = html_template
        print(f"[EMAIL] Using custom HTML template ({len(html_content)} chars)")
    else:
        # Build submission summary
        data_rows = ""
        for key, value in submission_data.items():
            data_rows += f"<tr><td style='padding: 8px; border: 1px solid #ddd;'><strong>{key}</strong></td>"
            data_rows += f"<td style='padding: 8px; border: 1px solid #ddd;'>{value}</td></tr>"
        
        # HTML email content (default template)
        html_content = f"""
        <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background-color: #228be6; color: white; padding: 20px; text-align: center; }}
                .content {{ padding: 20px; background-color: #f8f9fa; }}
                table {{ width: 100%; border-collapse: collapse; margin: 20px 0; }}
                th, td {{ padding: 8px; text-align: left; border: 1px solid #ddd; }}
                .button {{ display: inline-block; padding: 10px 20px; background-color: #228be6; 
                          color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Submisie Nouă Formular</h1>
                </div>
                <div class="content">
                    <h2>{form_title}</h2>
                    <p>O nouă submisie a fost primită pentru formularul: <strong>{form_title}</strong></p>
                    
                    <h3>Date Trimise:</h3>
                    <table>
                        {data_rows}
                    </table>
                    
                    <a href="{base_url or ''}/web/submissions" class="button">Vezi Toate Submisiile</a>
                </div>
            </div>
        </body>
        </html>
        """
        print(f"[EMAIL] Using default HTML template")
    
    # Plain text version
    text_content = f"""
    Submisie Noua Formular
    
    Formular: {form_title}
    
    Date Trimise:
    {chr(10).join([f'{k}: {v}' for k, v in submission_data.items()])}
    
    Vezi toate submisiile: {base_url or ''}/web/submissions
    """
    
    # Sanitize subject to remove diacritics (Newsman API doesn't handle them well)
    subject = f"New Form Submission: {sanitize_text(form_title)}"
    print(f"[EMAIL] Subject (sanitized): {subject}")
    
    # Send to all notification emails
    success = True
    for email in notification_emails:
        print(f"[EMAIL] Sending to {email}...")
        if not send_email(email, subject, html_content, text_content):
            success = False
            print(f"[EMAIL] Failed to send to {email}")
        else:
            print(f"[EMAIL] Successfully sent to {email}")
    
    return success


def send_campaign_email(
    recipients: List[Dict[str, str]],
    subject: str,
    html_content: str,
    text_content: Optional[str] = None,
    global_params: Optional[Dict] = None
) -> bool:
    """
    Send campaign email to multiple recipients
    
    Args:
        recipients: List of dicts with 'email', 'name', and optional 'params'
        subject: Email subject
        html_content: HTML email content
        text_content: Plain text email content (optional)
        global_params: Global template parameters (optional)
        
    Returns:
        True if campaign sent successfully
    """
    try:
        config = load_config()
        email_config = config.get('email', {})
        
        api_key = email_config.get('newsman_api_key')
        account_id = email_config.get('newsman_account_id')
        from_email = email_config.get('from_email')
        from_name = email_config.get('from_name', 'DataFlows Core')
        
        if not all([api_key, account_id, from_email]):
            print("[EMAIL] Email configuration incomplete for campaign")
            return False
        
        # Newsman API endpoint
        url = "https://cluster.newsmanapp.com/api/1.0/message.send"
        
        # Prepare request payload
        payload = {
            "key": api_key,
            "account_id": account_id,
            "message": {
                "from_name": from_name,
                "from_email": from_email,
                "html": html_content,
                "subject": subject,
                "template_engine": "handlebars"
            },
            "recipients": recipients
        }
        
        # Add optional fields
        if text_content:
            payload["message"]["text"] = text_content
        
        if global_params:
            payload["global_params"] = global_params
        
        # Send request
        response = requests.post(
            url,
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=30
        )
        
        if response.status_code == 200:
            result = response.json()
            if result.get('code') == 0 or not result.get('errors'):
                print(f"[EMAIL] Campaign sent successfully to {len(recipients)} recipients")
                return True
            else:
                print(f"[EMAIL] Newsman API error: {result.get('errors', 'Unknown error')}")
                return False
        else:
            print(f"[EMAIL] HTTP error: {response.status_code} - {response.text}")
            return False
            
    except Exception as e:
        print(f"[EMAIL] Failed to send campaign: {str(e)}")
        return False
