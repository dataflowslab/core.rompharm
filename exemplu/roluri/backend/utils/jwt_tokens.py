"""JWT helpers for access tokens."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict

import jwt

from .config import load_config


def _get_jwt_settings() -> Dict[str, Any]:
    config = load_config()
    auth_config = config.get('auth', {})
    return {
        'secret': config.get('app', {}).get('secret_key', ''),
        'algorithm': auth_config.get('jwt_algorithm', 'HS256'),
        'issuer': auth_config.get('issuer', 'dataflows-core'),
        'exp_minutes': auth_config.get('token_exp_minutes', 60),
    }


def create_access_token(payload: Dict[str, Any]) -> str:
    """Create a signed JWT access token."""
    settings = _get_jwt_settings()
    if not settings['secret']:
        raise RuntimeError('JWT secret key missing in config')

    now = datetime.now(timezone.utc)
    exp = now + timedelta(minutes=int(settings['exp_minutes']))

    token_payload = {
        **payload,
        'iat': int(now.timestamp()),
        'exp': int(exp.timestamp()),
        'iss': settings['issuer'],
    }

    return jwt.encode(token_payload, settings['secret'], algorithm=settings['algorithm'])


def decode_access_token(token: str) -> Dict[str, Any]:
    """Decode and validate a JWT access token."""
    settings = _get_jwt_settings()
    if not settings['secret']:
        raise RuntimeError('JWT secret key missing in config')

    return jwt.decode(
        token,
        settings['secret'],
        algorithms=[settings['algorithm']],
        issuer=settings['issuer'],
    )
