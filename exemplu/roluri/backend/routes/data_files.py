"""Data Files - Handle file upload/download operations for submissions"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from fastapi.responses import FileResponse
from typing import Optional
from datetime import datetime
from bson import ObjectId
import os

from ..utils.db import get_db
from ..utils.logger import logger
from ..utils.file_handler import save_document_file, get_file_path
from ..utils.pdf_signatures import get_pdf_signature_info
from .auth import verify_admin

router = APIRouter()


@router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    """Upload a file and return file hash"""
    try:
        content = await file.read()
        
        file_hash = save_document_file(
            content,
            file.filename,
            file.content_type
        )
        
        logger.info(
            subject=f"File uploaded: {file.filename}",
            content=f"File hash: {file_hash}, Size: {len(content)} bytes",
            category="data",
            metadata={
                "filename": file.filename,
                "file_hash": file_hash,
                "size": len(content)
            }
        )
        
        return {
            'success': True,
            'file_hash': file_hash,
            'filename': file.filename,
            'size': len(content)
        }
    
    except Exception as e:
        logger.error(
            subject="Error uploading file",
            content=str(e),
            category="data"
        )
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/files/{file_hash}")
async def get_file(file_hash: str):
    """Download a file by hash"""
    try:
        file_path = get_file_path(file_hash)
        
        if not file_path or not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="File not found")
        
        return FileResponse(
            file_path,
            headers={
                'Content-Disposition': f'attachment; filename="{os.path.basename(file_path)}"'
            }
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            subject="Error downloading file",
            content=str(e),
            category="data"
        )
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/files/{file_hash}/signature")
async def get_file_signature(file_hash: str):
    """Get PDF signature info for a stored file"""
    try:
        file_path = get_file_path(file_hash)
        if not file_path or not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="File not found")
        return get_pdf_signature_info(file_path)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            subject="Error checking file signature",
            content=str(e),
            category="data"
        )
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/submission/{submission_id}/documents")
async def get_submission_documents(submission_id: str, user = Depends(verify_admin)):
    """Get all documents attached to a submission"""
    db = get_db()
    
    try:
        submission = db.data_submissions.find_one({'_id': ObjectId(submission_id)})
        
        if not submission:
            raise HTTPException(status_code=404, detail="Submission not found")
        
        documents = submission.get('documents', [])
        
        for doc in documents:
            if isinstance(doc.get('uploaded_at'), datetime):
                doc['uploaded_at'] = doc['uploaded_at'].isoformat()
        
        return documents
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            subject="Error fetching submission documents",
            content=str(e),
            category="data"
        )
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/submission/{submission_id}/upload-document")
async def upload_submission_document(
    submission_id: str,
    file: UploadFile = File(...),
    user = Depends(verify_admin)
):
    """Upload a document and attach it to a submission"""
    db = get_db()
    
    try:
        submission = db.data_submissions.find_one({'_id': ObjectId(submission_id)})
        
        if not submission:
            raise HTTPException(status_code=404, detail="Submission not found")
        
        content = await file.read()
        
        file_hash = save_document_file(
            content,
            file.filename,
            file.content_type
        )
        
        document = {
            'file_hash': file_hash,
            'filename': file.filename,
            'original_filename': file.filename,
            'size': len(content),
            'mime_type': file.content_type,
            'uploaded_by': user.get('username', 'unknown'),
            'uploaded_at': datetime.utcnow()
        }
        
        db.data_submissions.update_one(
            {'_id': ObjectId(submission_id)},
            {
                '$push': {'documents': document},
                '$set': {'updated_at': datetime.utcnow()}
            }
        )
        
        logger.info(
            subject=f"Document uploaded to submission: {submission_id}",
            content=f"File: {file.filename}, Uploaded by: {user.get('username', 'unknown')}",
            category="data",
            metadata={
                "submission_id": submission_id,
                "filename": file.filename,
                "file_hash": file_hash
            }
        )
        
        return {
            'success': True,
            'message': 'Document uploaded successfully',
            'file_hash': file_hash
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            subject="Error uploading submission document",
            content=str(e),
            category="data"
        )
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/submission/{submission_id}/document/{doc_id}")
async def delete_submission_document(
    submission_id: str,
    doc_id: str,
    user = Depends(verify_admin)
):
    """Delete a document from a submission"""
    db = get_db()
    
    try:
        submission = db.data_submissions.find_one({'_id': ObjectId(submission_id)})
        
        if not submission:
            raise HTTPException(status_code=404, detail="Submission not found")
        
        documents = submission.get('documents', [])
        
        updated_documents = [doc for doc in documents if doc.get('file_hash') != doc_id]
        
        if len(updated_documents) == len(documents):
            raise HTTPException(status_code=404, detail="Document not found")
        
        db.data_submissions.update_one(
            {'_id': ObjectId(submission_id)},
            {
                '$set': {
                    'documents': updated_documents,
                    'updated_at': datetime.utcnow()
                }
            }
        )
        
        logger.info(
            subject=f"Document deleted from submission: {submission_id}",
            content=f"Document ID: {doc_id}, Deleted by: {user.get('username', 'unknown')}",
            category="data",
            metadata={
                "submission_id": submission_id,
                "doc_id": doc_id,
                "deleted_by": user.get('username', 'unknown')
            }
        )
        
        return {'success': True, 'message': 'Document deleted successfully'}
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            subject="Error deleting submission document",
            content=str(e),
            category="data"
        )
        raise HTTPException(status_code=500, detail=str(e))
