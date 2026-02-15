"""
Notifications Routes
Handles user notifications for approval flows and other events
"""
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime
from bson import ObjectId

from utils.db import get_db
from routes.auth import verify_token
from utils.logger import logger
from utils.notification_helpers import (
    get_user_notifications,
    get_unread_count,
    mark_notification_as_read
)

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


class MarkReadRequest(BaseModel):
    notification_ids: List[str]


@router.get("")
async def list_notifications(
    unread_only: bool = False,
    limit: int = 50,
    skip: int = 0,
    current_user: dict = Depends(verify_token)
):
    """
    Get notifications for current user
    
    Query params:
    - unread_only: Only return unread notifications
    - limit: Maximum number of notifications (default: 50)
    - skip: Number of notifications to skip (default: 0)
    """
    db = get_db()
    user_id = str(current_user.get('_id', ''))
    
    try:
        notifications = get_user_notifications(
            db=db,
            user_id=user_id,
            unread_only=unread_only,
            limit=limit,
            skip=skip
        )
        
        unread_count = get_unread_count(db, user_id)
        
        return {
            'notifications': notifications,
            'unread_count': unread_count,
            'total': len(notifications)
        }
    except Exception as e:
        logger.error(
            subject="Error fetching notifications",
            content=str(e),
            category="notifications"
        )
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/unread-count")
async def get_unread_notifications_count(
    current_user: dict = Depends(verify_token)
):
    """Get count of unread notifications for current user"""
    db = get_db()
    user_id = str(current_user.get('_id', ''))
    
    try:
        count = get_unread_count(db, user_id)
        return {'count': count}
    except Exception as e:
        logger.error(
            subject="Error getting unread count",
            content=str(e),
            category="notifications"
        )
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{notification_id}/mark-read")
async def mark_notification_read(
    notification_id: str,
    current_user: dict = Depends(verify_token)
):
    """Mark a notification as read"""
    db = get_db()
    user_id = str(current_user.get('_id', ''))
    
    try:
        success = mark_notification_as_read(db, notification_id, user_id)
        
        if not success:
            raise HTTPException(
                status_code=404,
                detail="Notification not found or already read"
            )
        
        return {'success': True, 'message': 'Notification marked as read'}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            subject=f"Error marking notification {notification_id} as read",
            content=str(e),
            category="notifications"
        )
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/mark-read-bulk")
async def mark_notifications_read_bulk(
    data: MarkReadRequest,
    current_user: dict = Depends(verify_token)
):
    """Mark multiple notifications as read"""
    db = get_db()
    user_id = str(current_user.get('_id', ''))
    
    try:
        marked_count = 0
        for notification_id in data.notification_ids:
            try:
                success = mark_notification_as_read(db, notification_id, user_id)
                if success:
                    marked_count += 1
            except:
                pass
        
        return {
            'success': True,
            'marked_count': marked_count,
            'total': len(data.notification_ids)
        }
    except Exception as e:
        logger.error(
            subject="Error marking notifications as read (bulk)",
            content=str(e),
            category="notifications"
        )
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/mark-all-read")
async def mark_all_notifications_read(
    current_user: dict = Depends(verify_token)
):
    """Mark all notifications as read for current user"""
    db = get_db()
    user_id = str(current_user.get('_id', ''))
    
    try:
        result = db.notifications.update_many(
            {
                'user_id': user_id,
                'read': False
            },
            {
                '$set': {
                    'read': True,
                    'read_at': datetime.utcnow()
                }
            }
        )
        
        return {
            'success': True,
            'marked_count': result.modified_count
        }
    except Exception as e:
        logger.error(
            subject="Error marking all notifications as read",
            content=str(e),
            category="notifications"
        )
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{notification_id}")
async def delete_notification(
    notification_id: str,
    current_user: dict = Depends(verify_token)
):
    """Delete a notification"""
    db = get_db()
    user_id = str(current_user.get('_id', ''))
    
    try:
        result = db.notifications.delete_one({
            '_id': ObjectId(notification_id),
            'user_id': user_id
        })
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Notification not found")
        
        return {'success': True, 'message': 'Notification deleted'}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            subject=f"Error deleting notification {notification_id}",
            content=str(e),
            category="notifications"
        )
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/delete-all")
async def delete_all_notifications(
    current_user: dict = Depends(verify_token)
):
    """Delete all notifications for current user"""
    db = get_db()
    user_id = str(current_user.get('_id', ''))
    
    try:
        result = db.notifications.delete_many({'user_id': user_id})
        
        return {
            'success': True,
            'deleted_count': result.deleted_count
        }
    except Exception as e:
        logger.error(
            subject="Error deleting all notifications",
            content=str(e),
            category="notifications"
        )
        raise HTTPException(status_code=500, detail=str(e))
