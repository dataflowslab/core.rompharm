"""Data Submissions - Handle form submission CRUD operations"""
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from datetime import datetime
from bson import ObjectId

from ..utils.db import get_db
from ..utils.logger import logger
from .auth import verify_admin, verify_token

router = APIRouter()


class DataSubmit(BaseModel):
    form_id: str
    data: Dict[str, Any]
    user_id: Optional[str] = None
    user_email: Optional[str] = None


class StateUpdate(BaseModel):
    state: str
    notes: Optional[str] = None


@router.post("/")
async def submit_data(submission: DataSubmit, request: Request, authorization: Optional[str] = None):
    """Submit form data"""
    db = get_db()
    
    try:
        form = db.forms.find_one({'_id': ObjectId(submission.form_id)})
        if not form:
            raise HTTPException(status_code=404, detail="Form not found")
        
        submission_data = {
            'form_id': submission.form_id,
            'form_slug': form.get('slug', ''),
            'form_title': form.get('title', ''),
            'data': submission.data,
            'user_id': submission.user_id,
            'user_email': submission.user_email,
            'state': 'pending',
            'ip_address': request.client.host if request.client else None,
            'user_agent': request.headers.get('user-agent'),
            'submitted_at': datetime.utcnow(),
            'created_at': datetime.utcnow()
        }
        
        result = db.data_submissions.insert_one(submission_data)
        submission_id = str(result.inserted_id)
        
        logger.info(
            subject=f"New submission for form {form.get('title', submission.form_id)}",
            content=f"Submission ID: {submission_id}, User: {submission.user_email or 'anonymous'}",
            category="data",
            metadata={
                "submission_id": submission_id,
                "form_id": submission.form_id,
                "user_email": submission.user_email
            }
        )
        
        return {
            'success': True,
            'submission_id': submission_id,
            'message': 'Data submitted successfully'
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            subject="Error submitting data",
            content=str(e),
            category="data"
        )
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{form_id}")
async def get_form_data(form_id: str, user = Depends(verify_admin)):
    """Get all submissions for a specific form"""
    db = get_db()
    
    try:
        submissions = list(db.data_submissions.find({'form_id': form_id}).sort('submitted_at', -1))
        
        result = []
        for sub in submissions:
            sub['_id'] = str(sub['_id'])
            sub['submitted_at'] = sub.get('submitted_at', datetime.utcnow()).isoformat()
            result.append(sub)
        
        return result
    
    except Exception as e:
        logger.error(
            subject="Error fetching form data",
            content=str(e),
            category="data"
        )
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/submission/{submission_id}")
async def get_submission(submission_id: str, user = Depends(verify_admin)):
    """Get specific submission by ID"""
    db = get_db()
    
    try:
        submission = db.data_submissions.find_one({'_id': ObjectId(submission_id)})
        
        if not submission:
            raise HTTPException(status_code=404, detail="Submission not found")
        
        submission['_id'] = str(submission['_id'])
        submission['submitted_at'] = submission.get('submitted_at', datetime.utcnow()).isoformat()
        
        return submission
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            subject="Error fetching submission",
            content=str(e),
            category="data"
        )
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/submission/{submission_id}")
async def delete_submission(submission_id: str, request: Request, user = Depends(verify_admin)):
    """Delete a submission"""
    db = get_db()
    
    try:
        submission = db.data_submissions.find_one({'_id': ObjectId(submission_id)})
        
        if not submission:
            raise HTTPException(status_code=404, detail="Submission not found")
        
        result = db.data_submissions.delete_one({'_id': ObjectId(submission_id)})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Submission not found")
        
        logger.info(
            subject=f"Submission deleted: {submission_id}",
            content=f"Deleted by: {user.get('username', 'unknown')}",
            category="data",
            metadata={
                "submission_id": submission_id,
                "deleted_by": user.get('username', 'unknown')
            }
        )
        
        return {'success': True, 'message': 'Submission deleted successfully'}
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            subject="Error deleting submission",
            content=str(e),
            category="data"
        )
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/submissions/stats")
async def get_submissions_stats(user = Depends(verify_admin)):
    """Get submission statistics"""
    db = get_db()
    
    try:
        total = db.data_submissions.count_documents({})
        pending = db.data_submissions.count_documents({'state': 'pending'})
        approved = db.data_submissions.count_documents({'state': 'approved'})
        rejected = db.data_submissions.count_documents({'state': 'rejected'})
        
        pipeline = [
            {
                '$group': {
                    '_id': '$form_id',
                    'count': {'$sum': 1},
                    'form_title': {'$first': '$form_title'}
                }
            },
            {'$sort': {'count': -1}}
        ]
        
        by_form = list(db.data_submissions.aggregate(pipeline))
        
        return {
            'total': total,
            'pending': pending,
            'approved': approved,
            'rejected': rejected,
            'by_form': by_form
        }
    
    except Exception as e:
        logger.error(
            subject="Error fetching submission stats",
            content=str(e),
            category="data"
        )
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/submissions/all")
async def get_all_submissions(user = Depends(verify_admin)):
    """Get all submissions across all forms"""
    db = get_db()
    
    try:
        submissions = list(db.data_submissions.find().sort('submitted_at', -1).limit(100))
        
        result = []
        for sub in submissions:
            sub['_id'] = str(sub['_id'])
            sub['submitted_at'] = sub.get('submitted_at', datetime.utcnow()).isoformat()
            result.append(sub)
        
        return result
    
    except Exception as e:
        logger.error(
            subject="Error fetching all submissions",
            content=str(e),
            category="data"
        )
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/submission/{submission_id}/state")
async def update_submission_state(
    submission_id: str,
    state_update: StateUpdate,
    user = Depends(verify_admin)
):
    """Update submission state (pending/approved/rejected)"""
    db = get_db()
    
    try:
        submission = db.data_submissions.find_one({'_id': ObjectId(submission_id)})
        
        if not submission:
            raise HTTPException(status_code=404, detail="Submission not found")
        
        valid_states = ['pending', 'approved', 'rejected', 'processing']
        if state_update.state not in valid_states:
            raise HTTPException(status_code=400, detail=f"Invalid state. Must be one of: {', '.join(valid_states)}")
        
        update_data = {
            'state': state_update.state,
            'updated_at': datetime.utcnow(),
            'updated_by': user.get('username', 'unknown')
        }
        
        if state_update.notes:
            update_data['state_notes'] = state_update.notes
        
        history_entry = {
            'state': state_update.state,
            'notes': state_update.notes,
            'changed_by': user.get('username', 'unknown'),
            'changed_at': datetime.utcnow()
        }
        
        db.data_submissions.update_one(
            {'_id': ObjectId(submission_id)},
            {
                '$set': update_data,
                '$push': {'state_history': history_entry}
            }
        )
        
        logger.info(
            subject=f"Submission state updated: {submission_id}",
            content=f"New state: {state_update.state}, Updated by: {user.get('username', 'unknown')}",
            category="data",
            metadata={
                "submission_id": submission_id,
                "new_state": state_update.state,
                "updated_by": user.get('username', 'unknown')
            }
        )
        
        return {'success': True, 'message': 'State updated successfully'}
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            subject="Error updating submission state",
            content=str(e),
            category="data"
        )
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/submission/{submission_id}/history")
async def get_submission_history(submission_id: str, user = Depends(verify_admin)):
    """Get state change history for a submission"""
    db = get_db()
    
    try:
        submission = db.data_submissions.find_one({'_id': ObjectId(submission_id)})
        
        if not submission:
            raise HTTPException(status_code=404, detail="Submission not found")
        
        history = submission.get('state_history', [])
        
        for entry in history:
            if isinstance(entry.get('changed_at'), datetime):
                entry['changed_at'] = entry['changed_at'].isoformat()
        
        return history
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            subject="Error fetching submission history",
            content=str(e),
            category="data"
        )
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/submission/{submission_id}/sign")
async def sign_submission(
    submission_id: str,
    signature_data: Dict[str, Any],
    user = Depends(verify_token)
):
    """Sign a submission (for approval workflows)"""
    db = get_db()
    
    try:
        submission = db.data_submissions.find_one({'_id': ObjectId(submission_id)})
        
        if not submission:
            raise HTTPException(status_code=404, detail="Submission not found")
        
        signature = {
            'user_id': str(user.get('_id', '')),
            'username': user.get('username', 'unknown'),
            'email': user.get('email', ''),
            'signed_at': datetime.utcnow(),
            'signature_type': signature_data.get('type', 'approval'),
            'notes': signature_data.get('notes', '')
        }
        
        db.data_submissions.update_one(
            {'_id': ObjectId(submission_id)},
            {
                '$push': {'signatures': signature},
                '$set': {'updated_at': datetime.utcnow()}
            }
        )
        
        logger.info(
            subject=f"Submission signed: {submission_id}",
            content=f"Signed by: {user.get('username', 'unknown')}",
            category="data",
            metadata={
                "submission_id": submission_id,
                "signed_by": user.get('username', 'unknown')
            }
        )
        
        return {'success': True, 'message': 'Submission signed successfully'}
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            subject="Error signing submission",
            content=str(e),
            category="data"
        )
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/submission/{submission_id}/approval-status")
async def get_approval_status(submission_id: str, user = Depends(verify_token)):
    """Get approval status and signatures for a submission"""
    db = get_db()
    
    try:
        submission = db.data_submissions.find_one({'_id': ObjectId(submission_id)})
        
        if not submission:
            raise HTTPException(status_code=404, detail="Submission not found")
        
        signatures = submission.get('signatures', [])
        
        for sig in signatures:
            if isinstance(sig.get('signed_at'), datetime):
                sig['signed_at'] = sig['signed_at'].isoformat()
        
        return {
            'state': submission.get('state', 'pending'),
            'signatures': signatures,
            'signature_count': len(signatures)
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            subject="Error fetching approval status",
            content=str(e),
            category="data"
        )
        raise HTTPException(status_code=500, detail=str(e))
