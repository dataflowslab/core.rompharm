"""
External API routes for programmatic access
"""
from fastapi import APIRouter, HTTPException, Depends, Header, Request
from pydantic import BaseModel
from typing import Optional, Any, Dict, List
from datetime import datetime

from ..utils.db import get_db

router = APIRouter(prefix="/api/ext", tags=["external"])


async def verify_api_token(authorization: Optional[str] = Header(None)):
    """
    Dependency to verify API token from api_tokens collection
    """
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header missing")
    
    # Extract token from "Bearer <token>"
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != 'bearer':
        raise HTTPException(status_code=401, detail="Invalid authorization header format. Use: Bearer <token>")
    
    token = parts[1]
    
    # Verify token exists in database
    db = get_db()
    api_tokens_collection = db['api_tokens']
    token_doc = api_tokens_collection.find_one({'token': token})
    
    if not token_doc:
        raise HTTPException(status_code=401, detail="Invalid API token")
    
    # Check if token is expired
    if 'expires' in token_doc:
        expires = token_doc['expires']
        # Handle both string and datetime formats
        if isinstance(expires, str):
            try:
                expires = datetime.fromisoformat(expires.replace('Z', '+00:00'))
            except:
                pass
        
        if isinstance(expires, datetime):
            if expires < datetime.utcnow():
                raise HTTPException(status_code=401, detail="API token has expired")
    
    return token_doc


async def verify_api_right(right: str, token_doc: Dict[str, Any]):
    """
    Verify that the API token has the required right
    """
    rights = token_doc.get('rights', [])
    if right not in rights:
        raise HTTPException(
            status_code=403, 
            detail=f"API token does not have permission for: {right}"
        )


