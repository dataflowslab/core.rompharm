"""
MongoDB connection utilities with multi-tenant support
"""
from pymongo import MongoClient
from typing import Optional

from .config import load_config

_client: Optional[MongoClient] = None


def get_db(domain: Optional[str] = None):
    """
    Get MongoDB database instance with multi-tenant support

    Args:
        domain: Domain name (without prefix). If provided, connects to dataflows_{domain}
                If None, uses default database from connection string

    Returns:
        MongoDB database instance

    Raises:
        HTTPException: If domain database doesn't exist
    """
    global _client

    config = load_config()
    mongo_config = config.get('mongo', {})
    connection_string = mongo_config.get('auth_string') or mongo_config.get('connection_string')

    if not connection_string:
        raise RuntimeError('MongoDB connection string missing in config')

    # Initialize client if not exists
    if _client is None:
        tls_allow_invalid = mongo_config.get('tls_allow_invalid_certificates', True)
        _client = MongoClient(
            connection_string,
            tlsAllowInvalidCertificates=tls_allow_invalid
        )

    # Normalize domain
    domain = domain or None

    # Determine database name
    if domain:
        # Multi-tenant mode: use dataflows_{domain}
        db_name = f"dataflows_{domain}"

        # Verify database exists
        existing_dbs = _client.list_database_names()
        if db_name not in existing_dbs:
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail=f"Domeniul '{domain}' nu exista!")

        return _client[db_name]

    # Default mode: use database from connection string
    return _client.get_default_database()


def get_client():
    """Get MongoDB client instance"""
    global _client

    if _client is None:
        config = load_config()
        mongo_config = config.get('mongo', {})
        connection_string = mongo_config.get('auth_string') or mongo_config.get('connection_string')

        if not connection_string:
            raise RuntimeError('MongoDB connection string missing in config')

        tls_allow_invalid = mongo_config.get('tls_allow_invalid_certificates', True)
        _client = MongoClient(
            connection_string,
            tlsAllowInvalidCertificates=tls_allow_invalid
        )

    return _client


def list_domains():
    """
    List all available domains (databases with dataflows_ prefix)

    Returns:
        List of domain names (without prefix)
    """
    client = get_client()
    all_dbs = client.list_database_names()

    # Filter databases with dataflows_ prefix
    domains = []
    for db_name in all_dbs:
        if db_name.startswith('dataflows_'):
            domain = db_name.replace('dataflows_', '')
            domains.append(domain)

    return sorted(domains)


def close_db():
    """Close MongoDB connection"""
    global _client

    if _client:
        _client.close()
        _client = None
