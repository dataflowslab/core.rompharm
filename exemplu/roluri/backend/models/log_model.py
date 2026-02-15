"""
Log Model - Centralized logging system
Stores all application logs including API calls, errors, warnings, and access logs
"""
from datetime import datetime
from typing import Optional, Dict, Any, ClassVar
from pydantic import BaseModel, Field

class LogModel(BaseModel):
    """Model for application logs"""
    collection_name: ClassVar[str] = "logs"
    
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    level: str  # 'error', 'warning', 'info', 'debug', 'api', 'access'
    category: str  # 'api_call', 'database', 'auth', 'procurement', 'pdf_generation', etc.
    subject: str  # Brief description of what happened
    content: Optional[str] = None  # Detailed content/message
    ip_address: Optional[str] = None
    user_id: Optional[str] = None
    user_email: Optional[str] = None
    request_method: Optional[str] = None  # GET, POST, PUT, DELETE
    request_path: Optional[str] = None
    request_body: Optional[Dict[str, Any]] = None
    response_status: Optional[int] = None
    response_body: Optional[Dict[str, Any]] = None
    error_traceback: Optional[str] = None
    duration_ms: Optional[float] = None  # Request duration in milliseconds
    metadata: Optional[Dict[str, Any]] = None  # Additional context-specific data
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

class LogEntry:
    """Helper class for creating log entries"""
    
    @staticmethod
    def error(
        subject: str,
        content: Optional[str] = None,
        category: str = "general",
        error_traceback: Optional[str] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """Create an error log entry"""
        return {
            "timestamp": datetime.utcnow(),
            "level": "error",
            "category": category,
            "subject": subject,
            "content": content,
            "error_traceback": error_traceback,
            **kwargs
        }
    
    @staticmethod
    def warning(
        subject: str,
        content: Optional[str] = None,
        category: str = "general",
        **kwargs
    ) -> Dict[str, Any]:
        """Create a warning log entry"""
        return {
            "timestamp": datetime.utcnow(),
            "level": "warning",
            "category": category,
            "subject": subject,
            "content": content,
            **kwargs
        }
    
    @staticmethod
    def info(
        subject: str,
        content: Optional[str] = None,
        category: str = "general",
        **kwargs
    ) -> Dict[str, Any]:
        """Create an info log entry"""
        return {
            "timestamp": datetime.utcnow(),
            "level": "info",
            "category": category,
            "subject": subject,
            "content": content,
            **kwargs
        }
    
    @staticmethod
    def api_call(
        subject: str,
        request_method: str,
        request_path: str,
        response_status: int,
        duration_ms: Optional[float] = None,
        request_body: Optional[Dict[str, Any]] = None,
        response_body: Optional[Dict[str, Any]] = None,
        ip_address: Optional[str] = None,
        user_id: Optional[str] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """Create an API call log entry"""
        return {
            "timestamp": datetime.utcnow(),
            "level": "api",
            "category": "api_call",
            "subject": subject,
            "request_method": request_method,
            "request_path": request_path,
            "response_status": response_status,
            "duration_ms": duration_ms,
            "request_body": request_body,
            "response_body": response_body,
            "ip_address": ip_address,
            "user_id": user_id,
            **kwargs
        }
    
    @staticmethod
    def access(
        subject: str,
        user_id: Optional[str] = None,
        user_email: Optional[str] = None,
        ip_address: Optional[str] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """Create an access log entry"""
        return {
            "timestamp": datetime.utcnow(),
            "level": "access",
            "category": "access",
            "subject": subject,
            "user_id": user_id,
            "user_email": user_email,
            "ip_address": ip_address,
            **kwargs
        }
