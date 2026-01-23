"""
DEPO Procurement Module - Attachments Services
"""
from fastapi import HTTPException, UploadFile
from datetime import datetime
from bson import ObjectId
import os
import hashlib

from src.backend.utils.db import get_db
from ..utils import serialize_doc


async def get_order_attachments(order_id: str):
    """Get attachments for a purchase order"""
    db = get_db()
    collection = db['depo_purchase_order_attachments']
    
    try:
        cursor = collection.find({'order_id': ObjectId(order_id)}).sort('created_at', -1)
        attachments = list(cursor)
        
        # Add attachment URL for each file
        for attachment in attachments:
            if attachment.get('file_path'):
                # Convert file_path to URL path (replace backslashes with forward slashes)
                url_path = attachment['file_path'].replace('\\', '/')
                # Ensure it starts with /
                if not url_path.startswith('/'):
                    url_path = '/' + url_path
                attachment['attachment'] = url_path
        
        return serialize_doc(attachments)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch attachments: {str(e)}")



async def upload_order_attachment(order_id: str, file: UploadFile, comment: str, current_user):
    """Upload an attachment to a purchase order"""
    db = get_db()
    collection = db['depo_purchase_order_attachments']
    
    try:
        # Read file content
        file_content = await file.read()
        
        # Save file to media/files directory
        file_hash = hashlib.sha256(file_content).hexdigest()
        
        # Create date-based directory structure
        now = datetime.utcnow()
        file_dir = os.path.join('media', 'files', str(now.year), f"{now.month:02d}", f"{now.day:02d}")
        os.makedirs(file_dir, exist_ok=True)
        
        file_path = os.path.join(file_dir, file_hash)
        with open(file_path, 'wb') as f:
            f.write(file_content)
        
        # Create attachment record
        doc = {
            'order_id': ObjectId(order_id),
            'filename': file.filename,
            'file_hash': file_hash,
            'file_path': file_path,
            'content_type': file.content_type,
            'size': len(file_content),
            'comment': comment or '',
            'created_at': datetime.utcnow(),
            'created_by': current_user.get('username')
        }
        
        result = collection.insert_one(doc)
        doc['_id'] = result.inserted_id
        
        return serialize_doc(doc)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload attachment: {str(e)}")



async def delete_order_attachment(attachment_id: str):
    """Delete an attachment from a purchase order"""
    db = get_db()
    collection = db['depo_purchase_order_attachments']
    
    try:
        # Get attachment to delete file
        attachment = collection.find_one({'_id': ObjectId(attachment_id)})
        if attachment and attachment.get('file_path'):
            try:
                os.remove(attachment['file_path'])
            except:
                pass
        
        result = collection.delete_one({'_id': ObjectId(attachment_id)})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Attachment not found")
        
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete attachment: {str(e)}")

