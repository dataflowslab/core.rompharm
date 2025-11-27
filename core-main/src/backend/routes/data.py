"""
Data routes for form submissions
"""
from fastapi import APIRouter, HTTPException, Depends, Header, Request, UploadFile, File
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from bson import ObjectId
from datetime import datetime
import os

from ..utils.db import get_db
from ..models.data_model import DataModel
from ..models.form_state_model import FormStateModel
from ..routes.auth import verify_token, verify_admin
from ..utils.audit import log_action
from ..utils.file_handler import save_upload_file, get_file_path

router = APIRouter(prefix="/api/data", tags=["data"])


class DataSubmit(BaseModel):
    form_id: str
    data: Dict[Any, Any]


@router.post("/")
async def submit_data(submission: DataSubmit, request: Request, authorization: Optional[str] = Header(None)):
    """
    Submit form data
    Public forms accessible to all, protected forms require authentication
    """
    db = get_db()
    data_collection = db[DataModel.collection_name]
    
    # Verify form exists
    forms_collection = db['forms']
    try:
        form_obj_id = ObjectId(submission.form_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid form ID")
    
    form = forms_collection.find_one({'_id': form_obj_id, 'active': True})
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    
    # Check if form is protected
    submitted_by = None
    if not form.get('is_public', True):
        # Require authentication for protected forms
        if not authorization:
            raise HTTPException(status_code=401, detail="Authentication required for this form")
        
        try:
            user = await verify_token(authorization)
            submitted_by = user['username']
        except HTTPException:
            raise HTTPException(status_code=401, detail="Authentication required for this form")
    elif authorization:
        # If authenticated, save username even for public forms
        try:
            user = await verify_token(authorization)
            submitted_by = user['username']
        except:
            pass  # Ignore auth errors for public forms
    
    # Assign registry number if form has registry
    registry_number = None
    if form.get('has_registry', False):
        # Atomically increment and get the registry number
        updated_form = forms_collection.find_one_and_update(
            {'_id': form_obj_id},
            {'$inc': {'registry_current': 1}},
            return_document=True
        )
        registry_number = updated_form.get('registry_current')
    
    # Create data document
    data_doc = DataModel.create(
        form_id=submission.form_id,
        data=submission.data,
        submitted_by=submitted_by
    )
    
    # Add registry number if assigned
    if registry_number is not None:
        data_doc['registry_number'] = registry_number
    
    result = data_collection.insert_one(data_doc)
    data_doc['_id'] = result.inserted_id
    
    # Log action
    log_action(
        action='form_submitted',
        username=submitted_by,
        request=request,
        resource_type='submission',
        resource_id=str(result.inserted_id),
        resource_name=form.get('title', 'Unknown Form'),
        details={'form_id': submission.form_id, 'form_title': form.get('title')}
    )
    
    # Send email notifications if configured
    print(f"[SUBMIT] Checking for email notifications...")
    print(f"[SUBMIT] Form notification_emails field: {form.get('notification_emails')}")
    print(f"[SUBMIT] Form notification_template field: {form.get('notification_template')}")
    
    notification_emails_raw = form.get('notification_emails', '')
    
    # Parse notification emails (can be string or list)
    notification_emails = []
    if notification_emails_raw:
        if isinstance(notification_emails_raw, str):
            # Split by comma and clean
            notification_emails = [email.strip() for email in notification_emails_raw.split(',') if email.strip()]
        elif isinstance(notification_emails_raw, list):
            notification_emails = notification_emails_raw
    
    print(f"[SUBMIT] Parsed notification emails: {notification_emails}")
    
    if notification_emails:
        print(f"[SUBMIT] Attempting to send email notifications to: {notification_emails}")
        try:
            from ..utils.newsman import send_form_notification
            import yaml
            
            # Load config for base_url
            config_path = os.path.join(os.path.dirname(__file__), '..', '..', '..', 'config', 'config.yaml')
            with open(config_path, 'r') as f:
                config = yaml.safe_load(f)
            
            base_url = config.get('web', {}).get('base_url', 'http://localhost:8000')
            print(f"[SUBMIT] Base URL: {base_url}")
            
            # Load email template
            template_name = form.get('notification_template', 'default')
            template_path = os.path.join(os.path.dirname(__file__), '..', '..', '..', 'media', 'mail_templates', f'{template_name}.html')
            print(f"[SUBMIT] Template path: {template_path}")
            print(f"[SUBMIT] Template exists: {os.path.exists(template_path)}")
            
            if os.path.exists(template_path):
                with open(template_path, 'r', encoding='utf-8') as f:
                    template_content = f.read()
                
                print(f"[SUBMIT] Template loaded ({len(template_content)} chars)")
                
                # Replace placeholders
                template_content = template_content.replace('{{ config.web.base_url }}', base_url)
                template_content = template_content.replace('{{ form_submisions }}', f"{base_url}/data/{submission.form_id}")
                
                print(f"[SUBMIT] Calling send_form_notification...")
                print(f"[SUBMIT] - Recipients: {notification_emails}")
                print(f"[SUBMIT] - Number of fields: {len(submission.data)}")
                
                # Send notification
                result = send_form_notification(
                    form_title=form.get('title', 'Form'),
                    notification_emails=notification_emails,
                    submission_data=submission.data,
                    html_template=template_content,
                    base_url=base_url
                )
                print(f"[SUBMIT] Email send result: {result}")
                
                # Log notification in submission history
                if result:
                    states_collection = db[FormStateModel.collection_name]
                    notification_record = FormStateModel.create(
                        submission_id=str(data_doc['_id']),
                        state='notification_sent',
                        changed_by='system',
                        notes=f"Email notifications sent to: {', '.join(notification_emails)}"
                    )
                    states_collection.insert_one(notification_record)
                    print(f"[SUBMIT] Notification logged in submission history")
            else:
                print(f"[SUBMIT] Template file not found: {template_path}")
        except Exception as e:
            print(f"[SUBMIT] Failed to send email notification: {e}")
            import traceback
            traceback.print_exc()
            # Don't fail the submission if email fails
    else:
        print(f"[SUBMIT] No notification emails configured, skipping email")
    
    return DataModel.to_dict(data_doc)


@router.get("/{form_id}")
async def get_form_data(form_id: str, user = Depends(verify_admin)):
    """
    Get all submissions for a form (requires administrator access)
    """
    db = get_db()
    data_collection = db[DataModel.collection_name]
    
    submissions = list(data_collection.find({'form_id': form_id}))
    
    return [DataModel.to_dict(submission) for submission in submissions]


@router.get("/submission/{submission_id}")
async def get_submission(submission_id: str, user = Depends(verify_admin)):
    """
    Get a specific submission (requires administrator access)
    """
    db = get_db()
    data_collection = db[DataModel.collection_name]
    forms_collection = db['forms']
    
    try:
        obj_id = ObjectId(submission_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid submission ID")
    
    submission = data_collection.find_one({'_id': obj_id})
    
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    
    # Enrich with form slug and title
    form = forms_collection.find_one({'_id': ObjectId(submission['form_id'])})
    if form:
        submission['form_slug'] = form.get('slug', '')
        submission['form_title'] = form.get('title', '')
    
    return DataModel.to_dict(submission)


@router.delete("/submission/{submission_id}")
async def delete_submission(submission_id: str, request: Request, user = Depends(verify_admin)):
    """
    Delete a submission (requires administrator access)
    """
    db = get_db()
    data_collection = db[DataModel.collection_name]
    forms_collection = db['forms']
    
    try:
        obj_id = ObjectId(submission_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid submission ID")
    
    # Get submission details BEFORE deleting
    submission = data_collection.find_one({'_id': obj_id})
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    
    form_title = 'Unknown Form'
    form = forms_collection.find_one({'_id': ObjectId(submission['form_id'])})
    if form:
        form_title = form.get('title', 'Unknown Form')
    
    # Now delete
    result = data_collection.delete_one({'_id': obj_id})
    
    # Log action
    log_action(
        action='submission_deleted',
        username=user['username'],
        request=request,
        resource_type='submission',
        resource_id=submission_id,
        resource_name=form_title
    )
    
    return {'message': 'Submission deleted successfully'}


# New endpoints for state management and files

class StateUpdate(BaseModel):
    state: str
    notes: Optional[str] = ""
    notify_author: bool = False


@router.get("/submissions/stats")
async def get_submissions_stats(user = Depends(verify_admin)):
    """
    Get submission statistics (requires administrator access)
    """
    from datetime import timedelta
    db = get_db()
    data_collection = db[DataModel.collection_name]
    
    now = datetime.utcnow()
    seven_days_ago = now - timedelta(days=7)
    thirty_days_ago = now - timedelta(days=30)
    
    # Total submissions
    total = data_collection.count_documents({})
    
    # Last 30 days
    last_30_days = data_collection.count_documents({
        'submitted_at': {'$gte': thirty_days_ago}
    })
    
    # Last 7 days
    last_7_days = data_collection.count_documents({
        'submitted_at': {'$gte': seven_days_ago}
    })
    
    return {
        'total': total,
        'last_30_days': last_30_days,
        'last_7_days': last_7_days
    }


@router.get("/submissions/all")
async def get_all_submissions(user = Depends(verify_admin)):
    """
    Get all submissions across all forms (requires administrator access)
    """
    db = get_db()
    data_collection = db[DataModel.collection_name]
    forms_collection = db['forms']
    
    # Get all submissions sorted by date
    submissions = list(data_collection.find().sort('submitted_at', -1))
    
    # Enrich with form data
    for submission in submissions:
        form = forms_collection.find_one({'_id': ObjectId(submission['form_id'])})
        if form:
            submission['form_title'] = form.get('title', 'Unknown')
            submission['form_slug'] = form.get('slug', '')
    
    return [DataModel.to_dict(submission) for submission in submissions]


@router.put("/submission/{submission_id}/state")
async def update_submission_state(
    submission_id: str,
    state_update: StateUpdate,
    request: Request,
    user = Depends(verify_admin)
):
    """
    Update submission state (requires administrator access)
    """
    db = get_db()
    data_collection = db[DataModel.collection_name]
    states_collection = db[FormStateModel.collection_name]
    
    # Validate state
    if state_update.state not in FormStateModel.VALID_STATES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid state. Valid states: {', '.join(FormStateModel.VALID_STATES)}"
        )
    
    try:
        obj_id = ObjectId(submission_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid submission ID")
    
    submission = data_collection.find_one({'_id': obj_id})
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    
    # Update submission state
    data_collection.update_one(
        {'_id': obj_id},
        {
            '$set': {
                'state': state_update.state,
                'state_updated_at': datetime.utcnow(),
                'state_updated_by': user['username'],
                'notes': state_update.notes or submission.get('notes', '')
            }
        }
    )
    
    # Create state history record
    state_record = FormStateModel.create(
        submission_id=submission_id,
        state=state_update.state,
        changed_by=user['username'],
        notes=state_update.notes or ""
    )
    states_collection.insert_one(state_record)
    
    # Get form title for logging
    forms_collection = db['forms']
    form = forms_collection.find_one({'_id': ObjectId(submission['form_id'])})
    form_title = form.get('title', 'Unknown Form') if form else 'Unknown Form'
    
    # Log action
    log_action(
        action='state_changed',
        username=user['username'],
        request=request,
        resource_type='submission',
        resource_id=submission_id,
        resource_name=f"{form_title} → {state_update.state}",
        details={'new_state': state_update.state, 'notes': state_update.notes, 'form_title': form_title}
    )
    
    # TODO: Send notification to author if notify_author is True
    # This will be implemented later with email functionality
    
    return {'message': 'State updated successfully', 'state': state_update.state}


@router.get("/submission/{submission_id}/history")
async def get_submission_history(submission_id: str, user = Depends(verify_admin)):
    """
    Get state change history for a submission
    """
    db = get_db()
    states_collection = db[FormStateModel.collection_name]
    
    history = list(states_collection.find(
        {'submission_id': submission_id}
    ).sort('created_at', 1))
    
    # Convert to dict
    for record in history:
        record['id'] = str(record['_id'])
        del record['_id']
        if 'created_at' in record:
            record['created_at'] = record['created_at'].isoformat()
    
    return history


@router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    """
    Upload a file (public endpoint for form submissions)
    """
    try:
        file_metadata = await save_upload_file(file)
        return file_metadata
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload file: {str(e)}")


@router.get("/files/{file_hash}")
async def get_file(file_hash: str):
    """
    Serve a file by its hash (public endpoint)
    """
    file_path = get_file_path(file_hash)
    
    if not file_path or not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    
    # Get original filename from hash (if stored in metadata)
    # For now, just serve with the hash name
    return FileResponse(
        file_path,
        media_type='application/octet-stream',
        filename=os.path.basename(file_path)
    )


# Uploaded documents endpoints

@router.get("/submission/{submission_id}/documents")
async def get_submission_documents(submission_id: str, user = Depends(verify_admin)):
    """
    Get all uploaded documents for a submission
    """
    db = get_db()
    data_collection = db[DataModel.collection_name]
    
    try:
        obj_id = ObjectId(submission_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid submission ID")
    
    submission = data_collection.find_one({'_id': obj_id})
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    
    # Get uploaded documents from submission
    documents = submission.get('uploaded_documents', [])
    
    return documents


@router.post("/submission/{submission_id}/upload-document")
async def upload_submission_document(
    submission_id: str,
    file: UploadFile = File(...),
    user = Depends(verify_admin)
):
    """
    Upload a document to a submission
    """
    db = get_db()
    data_collection = db[DataModel.collection_name]
    
    try:
        obj_id = ObjectId(submission_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid submission ID")
    
    submission = data_collection.find_one({'_id': obj_id})
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    
    # Upload file
    try:
        file_metadata = await save_upload_file(file)
        
        # Create document record
        doc_record = {
            'id': str(ObjectId()),
            'filename': file_metadata['original_filename'],
            'hash': file_metadata['hash'],
            'size': file_metadata['size'],
            'uploaded_at': datetime.utcnow().isoformat()
        }
        
        # Add to submission
        data_collection.update_one(
            {'_id': obj_id},
            {'$push': {'uploaded_documents': doc_record}}
        )
        
        return doc_record
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload document: {str(e)}")


@router.delete("/submission/{submission_id}/document/{doc_id}")
async def delete_submission_document(
    submission_id: str,
    doc_id: str,
    request: Request,
    user = Depends(verify_admin)
):
    """
    Delete an uploaded document from a submission
    """
    db = get_db()
    data_collection = db[DataModel.collection_name]
    
    try:
        obj_id = ObjectId(submission_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid submission ID")
    
    submission = data_collection.find_one({'_id': obj_id})
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    
    # Remove document from array
    result = data_collection.update_one(
        {'_id': obj_id},
        {'$pull': {'uploaded_documents': {'id': doc_id}}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Get form title for logging
    forms_collection = db['forms']
    form = forms_collection.find_one({'_id': ObjectId(submission['form_id'])})
    form_title = form.get('title', 'Unknown Form') if form else 'Unknown Form'
    
    # Log action
    log_action(
        action='document_deleted',
        username=user['username'],
        request=request,
        resource_type='submission',
        resource_id=submission_id,
        resource_name=form_title,
        details={'document_id': doc_id, 'form_title': form_title}
    )
    
    return {'message': 'Document deleted successfully'}


# Approval/Signature endpoints

@router.post("/submission/{submission_id}/sign")
async def sign_submission(
    submission_id: str,
    request: Request,
    user = Depends(verify_token)
):
    """
    Sign a submission (requires authentication)
    """
    import hashlib
    
    db = get_db()
    data_collection = db[DataModel.collection_name]
    forms_collection = db['forms']
    
    try:
        obj_id = ObjectId(submission_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid submission ID")
    
    submission = data_collection.find_one({'_id': obj_id})
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    
    # Get form to check approval settings
    form = forms_collection.find_one({'_id': ObjectId(submission['form_id'])})
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    
    approval_settings = form.get('approval_settings', {})
    if not approval_settings.get('enabled', False):
        raise HTTPException(status_code=400, detail="Approval workflow is not enabled for this form")
    
    # Check if user is eligible to sign
    user_id = user.get('user_id', user['username'])
    username = user['username']
    
    can_sign_users = [u['user_id'] for u in approval_settings.get('can_sign', [])]
    must_sign_users = [u['user_id'] for u in approval_settings.get('must_sign', [])]
    
    # Check both user_id and username for compatibility
    can_sign_ids = [u['user_id'] for u in approval_settings.get('can_sign', [])]
    can_sign_names = [u['username'] for u in approval_settings.get('can_sign', [])]
    must_sign_ids = [u['user_id'] for u in approval_settings.get('must_sign', [])]
    must_sign_names = [u['username'] for u in approval_settings.get('must_sign', [])]
    
    is_authorized = (
        user_id in can_sign_ids or username in can_sign_names or
        user_id in must_sign_ids or username in must_sign_names
    )
    
    if not is_authorized:
        raise HTTPException(status_code=403, detail="You are not authorized to sign this submission")
    
    # Check if user already signed
    signatures = submission.get('signatures', [])
    if any(sig['user_id'] == user_id for sig in signatures):
        raise HTTPException(status_code=400, detail="You have already signed this submission")
    
    # Generate signature hash: username.datetime.ip encoded in SHA-512 (128 chars)
    client_ip = request.client.host if request.client else 'unknown'
    signed_at = datetime.utcnow()
    signature_string = f"{username}.{signed_at.isoformat()}.{client_ip}"
    signature_hash = hashlib.sha512(signature_string.encode()).hexdigest()
    
    # Create signature record
    signature_record = {
        'user_id': user_id,
        'username': username,
        'signature': signature_hash,
        'signed_at': signed_at.isoformat(),
        'ip_address': client_ip
    }
    
    # Add signature to submission
    data_collection.update_one(
        {'_id': obj_id},
        {'$push': {'signatures': signature_record}}
    )
    
    # Log action
    log_action(
        action='submission_signed',
        username=username,
        request=request,
        resource_type='submission',
        resource_id=submission_id,
        resource_name=form.get('title', 'Unknown Form'),
        details={'signature_hash': signature_hash[:16] + '...', 'form_title': form.get('title')}
    )
    
    return {
        'message': 'Submission signed successfully',
        'signature': signature_record
    }


@router.get("/submission/{submission_id}/approval-status")
async def get_approval_status(submission_id: str, user = Depends(verify_token)):
    """
    Get approval status for a submission
    """
    db = get_db()
    data_collection = db[DataModel.collection_name]
    forms_collection = db['forms']
    
    try:
        obj_id = ObjectId(submission_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid submission ID")
    
    submission = data_collection.find_one({'_id': obj_id})
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    
    # Get form to check approval settings
    form = forms_collection.find_one({'_id': ObjectId(submission['form_id'])})
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    
    approval_settings = form.get('approval_settings', {})
    if not approval_settings.get('enabled', False):
        return {
            'enabled': False,
            'status': 'not_applicable'
        }
    
    signatures = submission.get('signatures', [])
    min_signatures = approval_settings.get('min_signatures', 1)
    must_sign_users = approval_settings.get('must_sign', [])
    can_sign_users = approval_settings.get('can_sign', [])
    
    # Check if all must_sign users have signed
    must_sign_user_ids = [u['user_id'] for u in must_sign_users]
    signed_user_ids = [sig['user_id'] for sig in signatures]
    
    all_must_sign_signed = all(user_id in signed_user_ids for user_id in must_sign_user_ids)
    has_min_signatures = len(signatures) >= min_signatures
    
    # Determine status
    if all_must_sign_signed and has_min_signatures:
        status = 'valid'
    else:
        status = 'waiting'
    
    # Check if current user can sign (check both user_id and username)
    user_id = user.get('user_id', user['username'])
    username = user.get('username', user_id)
    
    all_signer_ids = [u['user_id'] for u in can_sign_users + must_sign_users]
    all_signer_names = [u['username'] for u in can_sign_users + must_sign_users]
    
    can_user_sign = user_id in all_signer_ids or username in all_signer_names
    has_user_signed = user_id in signed_user_ids or username in signed_user_ids
    
    return {
        'enabled': True,
        'status': status,
        'min_signatures': min_signatures,
        'current_signatures': len(signatures),
        'signatures': signatures,
        'can_sign': can_sign_users,
        'must_sign': must_sign_users,
        'all_must_sign_signed': all_must_sign_signed,
        'has_min_signatures': has_min_signatures,
        'can_user_sign': can_user_sign,
        'has_user_signed': has_user_signed
    }
