"""
Centralized Logger Utility
Provides easy-to-use logging functions for the entire application
"""
import os
import sys
import traceback
from typing import Optional, Dict, Any
from datetime import datetime

# Add backend to path if not already there
backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

from utils.db import get_db
from models.log_model import LogEntry

class AppLogger:
    """Application logger that writes to MongoDB"""
    
    def __init__(self):
        self.db = get_db()
        self.collection = self.db["logs"]
    
    def _write_log(self, log_entry: Dict[str, Any]):
        """Write log entry to database"""
        try:
            self.collection.insert_one(log_entry)
        except Exception as e:
            # If logging fails, print to console as fallback
            self._safe_print(f"[LOGGER ERROR] Failed to write log: {e}")
            self._safe_print(f"[LOGGER ERROR] Log entry: {log_entry}")
    
    def _safe_print(self, message: str):
        """Print message with UTF-8 encoding support for Windows console"""
        try:
            print(message)
        except UnicodeEncodeError:
            # Fallback: replace problematic characters
            print(message.encode('ascii', errors='replace').decode('ascii'))
    
    def error(
        self,
        subject: str,
        content: Optional[str] = None,
        category: str = "general",
        exception: Optional[Exception] = None,
        **kwargs
    ):
        """Log an error"""
        error_traceback = None
        if exception:
            error_traceback = traceback.format_exc()
            if not content:
                content = str(exception)
        
        log_entry = LogEntry.error(
            subject=subject,
            content=content,
            category=category,
            error_traceback=error_traceback,
            **kwargs
        )
        self._write_log(log_entry)
        
        # Also print to console for immediate visibility
        self._safe_print(f"[ERROR] {subject}: {content}")
    
    def warning(
        self,
        subject: str,
        content: Optional[str] = None,
        category: str = "general",
        **kwargs
    ):
        """Log a warning"""
        log_entry = LogEntry.warning(
            subject=subject,
            content=content,
            category=category,
            **kwargs
        )
        self._write_log(log_entry)
        self._safe_print(f"[WARNING] {subject}: {content}")
    
    def info(
        self,
        subject: str,
        content: Optional[str] = None,
        category: str = "general",
        **kwargs
    ):
        """Log an info message"""
        log_entry = LogEntry.info(
            subject=subject,
            content=content,
            category=category,
            **kwargs
        )
        self._write_log(log_entry)
        self._safe_print(f"[INFO] {subject}: {content}")
    
    def api_call(
        self,
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
    ):
        """Log an API call"""
        log_entry = LogEntry.api_call(
            subject=subject,
            request_method=request_method,
            request_path=request_path,
            response_status=response_status,
            duration_ms=duration_ms,
            request_body=request_body,
            response_body=response_body,
            ip_address=ip_address,
            user_id=user_id,
            **kwargs
        )
        self._write_log(log_entry)
        self._safe_print(f"[API] {request_method} {request_path} - {response_status} ({duration_ms}ms)")
    
    def access(
        self,
        subject: str,
        user_id: Optional[str] = None,
        user_email: Optional[str] = None,
        ip_address: Optional[str] = None,
        **kwargs
    ):
        """Log an access event"""
        log_entry = LogEntry.access(
            subject=subject,
            user_id=user_id,
            user_email=user_email,
            ip_address=ip_address,
            **kwargs
        )
        self._write_log(log_entry)
        self._safe_print(f"[ACCESS] {subject} - User: {user_email or user_id}")
    
    def debug(
        self,
        subject: str,
        content: Optional[str] = None,
        category: str = "general",
        **kwargs
    ):
        """Log a debug message"""
        log_entry = {
            "timestamp": datetime.utcnow(),
            "level": "debug",
            "category": category,
            "subject": subject,
            "content": content,
            **kwargs
        }
        self._write_log(log_entry)
        self._safe_print(f"[DEBUG] {subject}: {content}")

# Global logger instance
logger = AppLogger()

# Convenience functions for direct import
def log_error(subject: str, content: Optional[str] = None, **kwargs):
    """Convenience function to log an error"""
    logger.error(subject, content, **kwargs)

def log_warning(subject: str, content: Optional[str] = None, **kwargs):
    """Convenience function to log a warning"""
    logger.warning(subject, content, **kwargs)

def log_info(subject: str, content: Optional[str] = None, **kwargs):
    """Convenience function to log info"""
    logger.info(subject, content, **kwargs)

def log_api_call(subject: str, request_method: str, request_path: str, response_status: int, **kwargs):
    """Convenience function to log an API call"""
    logger.api_call(subject, request_method, request_path, response_status, **kwargs)

def log_access(subject: str, **kwargs):
    """Convenience function to log access"""
    logger.access(subject, **kwargs)

def log_debug(subject: str, content: Optional[str] = None, **kwargs):
    """Convenience function to log debug"""
    logger.debug(subject, content, **kwargs)
