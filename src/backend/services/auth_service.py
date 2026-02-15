"""
Authentication Service
Handles user authentication and token management
"""
from datetime import datetime
from typing import Optional, Dict, Any
from fastapi import Request, HTTPException

from src.backend.utils.db import get_db
from src.backend.utils.local_auth import authenticate_user
from src.backend.utils.audit import log_action

class AuthService:
    @staticmethod
    def login(username: str, password: str, request: Request) -> Dict[str, Any]:
        """
        Authenticate user and return token info
        """
        # strict local authentication
        user_info = authenticate_user(username, password)
        
        if not user_info:
            raise HTTPException(
                status_code=401,
                detail="Invalid credentials. Please check your username and password."
            )
        
        # Log login action
        log_action(
            action='login',
            username=username,
            request=request,
            details={'is_staff': user_info.get('is_staff', False), 'identity_server': 'localhost'}
        )
        
        return {
            "token": user_info['access_token'],
            "username": user_info['username'],
            "is_staff": user_info.get('is_staff', False),
            "name": user_info.get('name'),
            "message": "Login successful"
        }

    @staticmethod
    def verify_token(token: str) -> Optional[Dict[str, Any]]:
        """
        Verify if a token is valid
        """
        from src.backend.utils.local_auth import get_user_from_token
        return get_user_from_token(token)
