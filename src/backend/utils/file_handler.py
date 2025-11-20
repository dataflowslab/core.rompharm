"""
File upload and serving utilities
"""
import os
import hashlib
from datetime import datetime
from typing import Optional, Tuple
import yaml
from fastapi import UploadFile, HTTPException


def load_config():
    """Load configuration from config.yaml"""
    config_path = os.path.join(os.path.dirname(__file__), '..', '..', '..', 'config.yaml')
    with open(config_path, 'r') as f:
        return yaml.safe_load(f)


def get_file_hash(content: bytes) -> str:
    """Generate SHA256 hash of file content"""
    return hashlib.sha256(content).hexdigest()


def get_upload_path() -> str:
    """Get the upload path from config"""
    config = load_config()
    upload_path = config.get('file_uploads', {}).get('path', 'media/files')
    
    # Create base directory if it doesn't exist
    base_dir = os.path.join(os.path.dirname(__file__), '..', '..', '..', upload_path)
    os.makedirs(base_dir, exist_ok=True)
    
    return base_dir


def get_date_path() -> str:
    """Get date-based subdirectory path (YYYY/MM/DD)"""
    now = datetime.utcnow()
    return os.path.join(str(now.year), f"{now.month:02d}", f"{now.day:02d}")


def validate_file(file: UploadFile) -> Tuple[bool, Optional[str]]:
    """
    Validate uploaded file
    
    Returns:
        Tuple of (is_valid, error_message)
    """
    config = load_config()
    file_config = config.get('file_uploads', {})
    
    # Check file size
    max_size_mb = file_config.get('max_size_mb', 10)
    max_size_bytes = max_size_mb * 1024 * 1024
    
    # Get file extension
    if not file.filename:
        return False, "Filename is required"
    
    file_ext = file.filename.rsplit('.', 1)[-1].lower() if '.' in file.filename else ''
    
    # Check allowed extensions
    allowed_extensions = file_config.get('allowed_extensions', [])
    if file_ext not in allowed_extensions:
        return False, f"File type .{file_ext} is not allowed. Allowed types: {', '.join(allowed_extensions)}"
    
    return True, None


async def save_upload_file(file: UploadFile) -> dict:
    """
    Save uploaded file and return metadata
    
    Returns:
        Dictionary with file metadata including hash, path, size, etc.
    """
    # Validate file
    is_valid, error = validate_file(file)
    if not is_valid:
        raise HTTPException(status_code=400, detail=error)
    
    # Read file content
    content = await file.read()
    
    # Check size
    config = load_config()
    max_size_mb = config.get('file_uploads', {}).get('max_size_mb', 10)
    max_size_bytes = max_size_mb * 1024 * 1024
    
    if len(content) > max_size_bytes:
        raise HTTPException(
            status_code=400,
            detail=f"File size exceeds maximum allowed size of {max_size_mb}MB"
        )
    
    # Generate hash
    file_hash = get_file_hash(content)
    
    # Get file extension
    file_ext = file.filename.rsplit('.', 1)[-1].lower() if '.' in file.filename else ''
    
    # Create date-based directory structure
    base_path = get_upload_path()
    date_path = get_date_path()
    full_dir = os.path.join(base_path, date_path)
    os.makedirs(full_dir, exist_ok=True)
    
    # Save file with hash as filename
    filename = f"{file_hash}.{file_ext}"
    file_path = os.path.join(full_dir, filename)
    
    # Save file
    with open(file_path, 'wb') as f:
        f.write(content)
    
    # Return metadata
    return {
        'hash': file_hash,
        'original_filename': file.filename,
        'filename': filename,
        'path': os.path.join(date_path, filename).replace('\\', '/'),
        'size': len(content),
        'content_type': file.content_type,
        'extension': file_ext,
        'uploaded_at': datetime.utcnow().isoformat()
    }


def save_document_file(content: bytes, filename: str) -> str:
    """
    Save generated document file
    
    Args:
        content: File content bytes
        filename: Original filename
        
    Returns:
        File hash for retrieval
    """
    # Generate hash
    file_hash = get_file_hash(content)
    
    # Get file extension
    file_ext = filename.rsplit('.', 1)[-1].lower() if '.' in filename else 'pdf'
    
    # Create date-based directory structure
    base_path = get_upload_path()
    date_path = get_date_path()
    full_dir = os.path.join(base_path, date_path)
    os.makedirs(full_dir, exist_ok=True)
    
    # Save file with hash as filename
    save_filename = f"{file_hash}.{file_ext}"
    file_path = os.path.join(full_dir, save_filename)
    
    # Save file
    with open(file_path, 'wb') as f:
        f.write(content)
    
    print(f"[FILE] Saved document: {file_path}")
    
    # Return hash for retrieval
    return file_hash


def get_file_path(file_hash: str) -> Optional[str]:
    """
    Get full file path from hash
    
    Args:
        file_hash: File hash (can include extension like hash.pdf)
        
    Returns:
        Full file path if found, None otherwise
    """
    base_path = get_upload_path()
    
    # Remove extension if present
    hash_only = file_hash.split('.')[0]
    
    # Search in date directories
    for root, dirs, files in os.walk(base_path):
        for file in files:
            if file.startswith(hash_only):
                return os.path.join(root, file)
    
    return None
