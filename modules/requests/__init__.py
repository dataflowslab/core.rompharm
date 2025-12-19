"""
Requests Module - Internal Stock Transfer Requests
"""
from .routes import router

__all__ = ['router', 'get_router']


def get_router():
    """Get the router for this module"""
    return router
