"""
MongoDB connection utilities
"""
from pymongo import MongoClient
from typing import Optional
import yaml
import os
import certifi

_client: Optional[MongoClient] = None
_db = None


def load_config():
    """Load configuration from config.yaml"""
    config_path = os.path.join(os.path.dirname(__file__), '..', '..', '..', 'config.yaml')
    with open(config_path, 'r') as f:
        return yaml.safe_load(f)


def get_db():
    """Get MongoDB database instance"""
    global _client, _db
    
    if _db is None:
        config = load_config()
        # Support both 'auth_string' and 'connection_string' keys
        connection_string = config['mongo'].get('auth_string') or config['mongo'].get('connection_string')
        
        # MongoDB connection with TLS settings for compatibility
        # Disable certificate verification for older OpenSSL versions
        _client = MongoClient(
            connection_string,
            tlsAllowInvalidCertificates=True
        )
        
        # Extract database name from connection string or use default
        _db = _client.get_default_database()
    
    return _db


def close_db():
    """Close MongoDB connection"""
    global _client, _db
    
    if _client:
        _client.close()
        _client = None
        _db = None
