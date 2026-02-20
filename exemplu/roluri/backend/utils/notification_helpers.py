"""
Notification System Helpers
Handles creation and management of user notifications
"""
from typing import Dict, Any, List, Optional, Set
from datetime import datetime
from bson import ObjectId
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart


from .config import load_config


def get_notification_config() -> Dict[str, Any]:
    """Get notification configuration from config.yaml"""
    try:
        config = load_config()
        return config.get('notifications', {})
    except Exception:
        return {
            'send_email_notifications': False
        }


def create_notification(
    db,
    user_id: str,
    title: str,
    message: str,
    notification_type: str = 'info',
    document_type: Optional[str] = None,
    document_id: Optional[str] = None,
    document_data: Optional[Dict[str, Any]] = None,
    action_url: Optional[str] = None
) -> str:
    """
    Create a notification for a user
    
    Args:
        db: Database connection
        user_id: User ID to notify
        title: Notification title
        message: Notification message
        notification_type: Type of notification (info, warning, error, success, approval)
        document_type: Type of document (referat, fundamentare, ordonantare)
        document_id: ID of the document
        document_data: Additional document data (departament, stare, etc.)
        action_url: URL to open the document
    
    Returns:
        str: Notification ID
    """
    notification = {
        'user_id': user_id,
        'title': title,
        'message': message,
        'type': notification_type,
        'document_type': document_type,
        'document_id': document_id,
        'document_data': document_data or {},
        'action_url': action_url,
        'read': False,
        'created_at': datetime.utcnow(),
        'read_at': None
    }
    
    result = db.notifications.insert_one(notification)
    return str(result.inserted_id)


def create_approval_notification(
    db,
    user_id: str,
    document_type: str,
    document_id: str,
    document_data: Dict[str, Any],
    approval_flow_name: str
) -> str:
    """
    Create an approval notification for a user
    
    Args:
        db: Database connection
        user_id: User ID to notify
        document_type: Type of document (referat, fundamentare, ordonantare)
        document_id: ID of the document
        document_data: Document data (nr, titlu, departament, stare, etc.)
        approval_flow_name: Name of the approval flow
    
    Returns:
        str: Notification ID
    """
    # Build title based on document type
    titles = {
        'referat': 'Referat nou de semnat!',
        'fundamentare': 'Document de fundamentare nou!',
        'ordonantare': 'Ordonanțare nouă de semnat!'
    }
    
    title = titles.get(document_type, 'Document nou de semnat!')
    
    # Build message
    nr = document_data.get('nr', document_data.get('nr_inreg', document_data.get('nr_ordonant_pl', 'N/A')))
    departament = document_data.get('departament', document_data.get('compartiment', 'N/A'))
    stare = document_data.get('stare', 'N/A')
    
    message = f"Flux: {approval_flow_name}\n"
    message += f"Nr: {nr}\n"
    message += f"Departament: {departament}\n"
    message += f"Stare: {stare}"
    
    # Build action URL
    action_urls = {
        'referat': f'/procurement/referate/{document_id}',
        'fundamentare': f'/procurement/fundamentare/{document_id}',
        'ordonantare': f'/procurement/ordonantare/{document_id}'
    }
    
    action_url = action_urls.get(document_type, f'/procurement/{document_type}/{document_id}')
    
    return create_notification(
        db=db,
        user_id=user_id,
        title=title,
        message=message,
        notification_type='approval',
        document_type=document_type,
        document_id=document_id,
        document_data=document_data,
        action_url=action_url
    )


def notify_approval_officers(
    db,
    document_type: str,
    document_id: str,
    document_data: Dict[str, Any],
    approval_flow: Dict[str, Any]
) -> List[str]:
    """
    Notify all officers in an approval flow
    
    Args:
        db: Database connection
        document_type: Type of document
        document_id: ID of the document
        document_data: Document data
        approval_flow: Approval flow data
    
    Returns:
        List[str]: List of notification IDs created
    """
    notification_ids = []
    officers = _get_flow_officers(approval_flow)
    flow_name = approval_flow.get('name', 'Aprobare')

    user_ids = _resolve_officer_user_ids(db, officers)
    
    for user_id in user_ids:
        try:
            notification_id = create_approval_notification(
                db=db,
                user_id=user_id,
                document_type=document_type,
                document_id=document_id,
                document_data=document_data,
                approval_flow_name=flow_name
            )
            notification_ids.append(notification_id)
        except Exception as e:
            print(f"Error creating notification for user {user_id}: {e}")
    
    return notification_ids


def mark_notification_as_read(db, notification_id: str, user_id: str) -> bool:
    """
    Mark a notification as read
    
    Args:
        db: Database connection
        notification_id: Notification ID
        user_id: User ID (for security check)
    
    Returns:
        bool: True if successful
    """
    result = db.notifications.update_one(
        {
            '_id': ObjectId(notification_id),
            'user_id': user_id
        },
        {
            '$set': {
                'read': True,
                'read_at': datetime.utcnow()
            }
        }
    )
    
    return result.modified_count > 0


def get_user_notifications(
    db,
    user_id: str,
    unread_only: bool = False,
    limit: int = 50,
    skip: int = 0
) -> List[Dict[str, Any]]:
    """
    Get notifications for a user
    
    Args:
        db: Database connection
        user_id: User ID
        unread_only: Only return unread notifications
        limit: Maximum number of notifications to return
        skip: Number of notifications to skip
    
    Returns:
        List[Dict[str, Any]]: List of notifications
    """
    query = {'user_id': user_id}
    
    if unread_only:
        query['read'] = False
    
    notifications = list(
        db.notifications
        .find(query)
        .sort('created_at', -1)
        .skip(skip)
        .limit(limit)
    )
    
    # Convert ObjectId to string
    for notification in notifications:
        notification['_id'] = str(notification['_id'])
        if notification.get('created_at'):
            notification['created_at'] = notification['created_at'].isoformat()
        if notification.get('read_at'):
            notification['read_at'] = notification['read_at'].isoformat()
    
    return notifications


def get_unread_count(db, user_id: str) -> int:
    """
    Get count of unread notifications for a user
    
    Args:
        db: Database connection
        user_id: User ID
    
    Returns:
        int: Count of unread notifications
    """
    return db.notifications.count_documents({
        'user_id': user_id,
        'read': False
    })


def send_email_notification(
    config: Dict[str, Any],
    to_email: str,
    subject: str,
    body: str,
    html_body: Optional[str] = None
) -> bool:
    """
    Send email notification
    
    Args:
        config: Email configuration
        to_email: Recipient email
        subject: Email subject
        body: Email body (plain text)
        html_body: Email body (HTML)
    
    Returns:
        bool: True if successful
    """
    try:
        # Get email config
        smtp_host = config.get('smtp_host', 'localhost')
        smtp_port = config.get('smtp_port', 587)
        smtp_user = config.get('smtp_user', '')
        smtp_password = config.get('smtp_password', '')
        from_email = config.get('from_email', 'noreply@example.com')
        use_tls = config.get('use_tls', True)
        
        # Create message
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = from_email
        msg['To'] = to_email
        
        # Attach plain text
        part1 = MIMEText(body, 'plain', 'utf-8')
        msg.attach(part1)
        
        # Attach HTML if provided
        if html_body:
            part2 = MIMEText(html_body, 'html', 'utf-8')
            msg.attach(part2)
        
        # Send email
        with smtplib.SMTP(smtp_host, smtp_port) as server:
            if use_tls:
                server.starttls()
            if smtp_user and smtp_password:
                server.login(smtp_user, smtp_password)
            server.send_message(msg)
        
        return True
    except Exception as e:
        print(f"Error sending email: {e}")
        return False


def send_approval_email(
    db,
    config: Dict[str, Any],
    user_id: str,
    document_type: str,
    document_data: Dict[str, Any],
    approval_flow_name: str,
    action_url: str
) -> bool:
    """
    Send approval notification email to a user
    
    Args:
        db: Database connection
        config: Email configuration
        user_id: User ID
        document_type: Type of document
        document_data: Document data
        approval_flow_name: Name of approval flow
        action_url: URL to open document
    
    Returns:
        bool: True if successful
    """
    # Get user email
    user = db.users.find_one({'_id': ObjectId(user_id)})
    if not user or not user.get('email'):
        return False
    
    to_email = user['email']
    
    # Build subject
    subjects = {
        'referat': 'Referat nou de semnat',
        'fundamentare': 'Document de fundamentare nou',
        'ordonantare': 'Ordonanțare nouă de semnat'
    }
    subject = subjects.get(document_type, 'Document nou de semnat')
    
    # Build body
    nr = document_data.get('nr', document_data.get('nr_inreg', document_data.get('nr_ordonant_pl', 'N/A')))
    departament = document_data.get('departament', document_data.get('compartiment', 'N/A'))
    stare = document_data.get('stare', 'N/A')
    
    body = f"""
Bună ziua,

Aveți un document nou care necesită semnătura dumneavoastră.

Flux: {approval_flow_name}
Tip: {document_type.capitalize()}
Nr: {nr}
Departament: {departament}
Stare: {stare}

Pentru a vizualiza și semna documentul, accesați:
{action_url}

Cu stimă,
Sistemul de Management Procurement
"""
    
    html_body = f"""
<html>
<body>
<p>Bună ziua,</p>
<p>Aveți un document nou care necesită semnătura dumneavoastră.</p>
<table style="border-collapse: collapse; margin: 20px 0;">
<tr><td style="padding: 5px; font-weight: bold;">Flux:</td><td style="padding: 5px;">{approval_flow_name}</td></tr>
<tr><td style="padding: 5px; font-weight: bold;">Tip:</td><td style="padding: 5px;">{document_type.capitalize()}</td></tr>
<tr><td style="padding: 5px; font-weight: bold;">Nr:</td><td style="padding: 5px;">{nr}</td></tr>
<tr><td style="padding: 5px; font-weight: bold;">Departament:</td><td style="padding: 5px;">{departament}</td></tr>
<tr><td style="padding: 5px; font-weight: bold;">Stare:</td><td style="padding: 5px;">{stare}</td></tr>
</table>
<p><a href="{action_url}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Deschide documentul</a></p>
<p>Cu stimă,<br>Sistemul de Management Procurement</p>
</body>
</html>
"""
    
    return send_email_notification(
        config=config,
        to_email=to_email,
        subject=subject,
        body=body,
        html_body=html_body
    )


def notify_approval_officers_with_email(
    db,
    document_type: str,
    document_id: str,
    document_data: Dict[str, Any],
    approval_flow: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Notify all officers in an approval flow (in-app + email if enabled)
    
    Args:
        db: Database connection
        document_type: Type of document
        document_id: ID of the document
        document_data: Document data
        approval_flow: Approval flow data
    
    Returns:
        Dict[str, Any]: Summary of notifications sent
    """
    # Get notification config
    notification_config = get_notification_config()
    send_emails = notification_config.get('send_email_notifications', False)
    
    notification_ids = []
    emails_sent = 0
    officers = _get_flow_officers(approval_flow)
    flow_name = approval_flow.get('name', 'Aprobare')
    
    # Build action URL
    action_urls = {
        'referat': f'/web/procurement/referate/{document_id}',
        'fundamentare': f'/web/procurement/fundamentare/{document_id}',
        'ordonantare': f'/web/procurement/ordonantare/{document_id}'
    }
    action_url = action_urls.get(document_type, f'/web/procurement/{document_type}/{document_id}')
    
    user_ids = _resolve_officer_user_ids(db, officers)
    
    for user_id in user_ids:
        try:
            # Create in-app notification
            notification_id = create_approval_notification(
                db=db,
                user_id=user_id,
                document_type=document_type,
                document_id=document_id,
                document_data=document_data,
                approval_flow_name=flow_name
            )
            notification_ids.append(notification_id)
            
            # Send email if enabled
            if send_emails:
                email_sent = send_approval_email(
                    db=db,
                    config=notification_config,
                    user_id=user_id,
                    document_type=document_type,
                    document_data=document_data,
                    approval_flow_name=flow_name,
                    action_url=action_url
                )
                if email_sent:
                    emails_sent += 1
        except Exception as e:
            print(f"Error notifying user {user_id}: {e}")
    
    return {
        'notifications_created': len(notification_ids),
        'emails_sent': emails_sent,
        'officers_notified': len(user_ids)
    }


def _get_flow_officers(approval_flow: Dict[str, Any]) -> List[Dict[str, Any]]:
    steps = approval_flow.get('steps')
    if isinstance(steps, list) and steps:
        officers: List[Dict[str, Any]] = []
        for step in steps:
            step_officers = step.get('officers', [])
            if isinstance(step_officers, list):
                officers.extend(step_officers)
        return officers
    return approval_flow.get('officers', []) or []


def _resolve_officer_user_ids(db, officers: List[Dict[str, Any]]) -> Set[str]:
    user_ids: Set[str] = set()
    for officer in officers:
        officer_type = officer.get('type')
        reference = officer.get('reference')
        if officer_type not in ['user', 'role']:
            # legacy fallback
            if officer.get('user_id'):
                user_ids.add(str(officer.get('user_id')))
                continue
            if officer.get('username'):
                user_doc = db.users.find_one({'username': officer.get('username')}, {'_id': 1})
                if user_doc and user_doc.get('_id'):
                    user_ids.add(str(user_doc['_id']))
                continue
            officer_type = 'role' if officer.get('role') else 'user'
            reference = reference or officer.get('role')

        if officer_type == 'user':
            ref = str(reference or officer.get('user_id') or officer.get('username') or '')
            if ref:
                # If username provided, resolve to user_id
                if not ObjectId.is_valid(ref):
                    user_doc = db.users.find_one({'username': ref}, {'_id': 1})
                    if user_doc and user_doc.get('_id'):
                        user_ids.add(str(user_doc['_id']))
                else:
                    user_ids.add(ref)
        elif officer_type == 'role':
            role_ref = str(reference or officer.get('role') or '')
            if not role_ref:
                continue
            if not ObjectId.is_valid(role_ref):
                role_doc = db.roles.find_one({'name': role_ref}, {'_id': 1})
                if role_doc and role_doc.get('_id'):
                    role_ref = str(role_doc['_id'])
            # Find users by role or local_role
            role_query = {
                '$or': [
                    {'role': role_ref},
                    {'local_role': role_ref}
                ]
            }
            users = db.users.find(role_query, {'_id': 1})
            for user in users:
                if user.get('_id'):
                    user_ids.add(str(user['_id']))
    return user_ids
