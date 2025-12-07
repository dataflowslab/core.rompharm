"""
File model for library management
"""
from datetime import datetime
from typing import Dict, Any, List, Optional


class FileModel:
    collection_name = "files"

    @staticmethod
    def create(
        filename: str,
        original_filename: str,
        hash: str,
        size: int,
        mime_type: str,
        owner: str,
        title: Optional[str] = None,
        description: Optional[str] = None,
        shared_with: Optional[List[str]] = None,
        tags: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """Create a new file document"""
        now = datetime.utcnow()
        return {
            "filename": filename,  # stored filename (hash-based)
            "original_filename": original_filename,  # original upload name
            "hash": hash,
            "size": size,
            "mime_type": mime_type,
            "owner": owner,
            "title": title or original_filename,
            "description": description or "",
            "shared_with": shared_with or [],  # list of usernames or roles
            "tags": tags or [],
            "is_shared": bool(shared_with),
            "created_at": now,
            "updated_at": now,
            "created_by": owner,
            "updated_by": owner,
        }

    @staticmethod
    def to_dict(file_doc: Dict[str, Any]) -> Dict[str, Any]:
        """Convert file document to dict for API response"""
        file_dict = dict(file_doc)
        if "_id" in file_dict:
            file_dict["id"] = str(file_dict["_id"])
            del file_dict["_id"]
        if "created_at" in file_dict and isinstance(file_dict["created_at"], datetime):
            file_dict["created_at"] = file_dict["created_at"].isoformat()
        if "updated_at" in file_dict and isinstance(file_dict["updated_at"], datetime):
            file_dict["updated_at"] = file_dict["updated_at"].isoformat()
        return file_dict
