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

from src.backend.utils.db import get_db
from src.backend.models.data_model import DataModel
from src.backend.models.form_state_model import FormStateModel
from src.backend.routes.auth import verify_token, verify_admin
from src.backend.utils.audit import log_action
from src.backend.utils.file_handler import save_upload_file, get_file_path

router = APIRouter(prefix="/api/data", tags=["data"])


class DataSubmit(BaseModel):
    form_id: str
    data: Dict[Any, Any]


@router.post("/")
def submit_data(submission: DataSubmit, request: Request, authorization: Optional[str] = Header(None)):
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
            # Manually verify token since this is a def not async def
            # We can reuse the verify_token function directly (it's now sync)
            user = verify_token(authorization)
            submitted_by = user['username']
        except HTTPException:
            raise HTTPException(status_code=401, detail="Authentication required for this form")
    elif authorization:
        # If authenticated, save username even for public forms
        try:
            user = verify_token(authorization)
            submitted_by = user['username']
        except:
            pass  # Ignore auth errors for public forms
    
    # Create data document
    data_doc = DataModel.create(
        form_id=submission.form_id,
        data=submission.data,
        submitted_by=submitted_by
    )
    
    result = data_collection.insert_one(data_doc)
    data_doc['_id'] = result.inserted_id
    
    # Log action
    log_action(
        action='form_submitted',
        username=submitted_by,
        request=request,
        resource_type='submission',
        resource_id=str(result.inserted_id),
        details={'form_id': submission.form_id}
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
            from src.backend.utils.newsman import send_form_notification
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
def get_form_data(form_id: str, user = Depends(verify_admin)):
    """
    Get all submissions for a form (requires administrator access)
    """
    db = get_db()
    data_collection = db[DataModel.collection_name]
    
    submissions = list(data_collection.find({'form_id': form_id}))
    
    return [DataModel.to_dict(submission) for submission in submissions]


@router.get("/submission/{submission_id}")
def get_submission(submission_id: str, user = Depends(verify_admin)):
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
    
    # Enrich with form slug
    form = forms_collection.find_one({'_id': ObjectId(submission['form_id'])})
    if form:
        submission['form_slug'] = form.get('slug', '')
    
    return DataModel.to_dict(submission)


@router.delete("/submission/{submission_id}")
def delete_submission(submission_id: str, request: Request, user = Depends(verify_admin)):
    """
    Delete a submission (requires administrator access)
    """
    db = get_db()
    data_collection = db[DataModel.collection_name]
    
    try:
        obj_id = ObjectId(submission_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid submission ID")
    
    result = data_collection.delete_one({'_id': obj_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Submission not found")
    
    # Log action
    log_action(
        action='submission_deleted',
        username=user['username'],
        request=request,
        resource_type='submission',
        resource_id=submission_id
    )
    
    return {'message': 'Submission deleted successfully'}


# New endpoints for state management and files

class StateUpdate(BaseModel):
    state: str
    notes: Optional[str] = ""
    notify_author: bool = False


@router.get("/submissions/stats")
def get_submissions_stats(user = Depends(verify_admin)):
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
def get_all_submissions(user = Depends(verify_admin)):
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
def update_submission_state(
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
    
    # Log action
    log_action(
        action='state_changed',
        username=user['username'],
        request=request,
        resource_type='submission',
        resource_id=submission_id,
        details={'new_state': state_update.state, 'notes': state_update.notes}
    )
    
    # TODO: Send notification to author if notify_author is True
    # This will be implemented later with email functionality
    
    return {'message': 'State updated successfully', 'state': state_update.state}


@router.get("/submission/{submission_id}/history")
def get_submission_history(submission_id: str, user = Depends(verify_admin)):
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
    Note: kept as async def because file upload involves async I/O
    """
    try:
        file_metadata = await save_upload_file(file)
        return file_metadata
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload file: {str(e)}")


@router.get("/files/{file_hash}")
def get_file(file_hash: str):
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
