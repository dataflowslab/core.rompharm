"""Password hashing utilities with legacy SHA256 support."""
from __future__ import annotations

from typing import Tuple
import hashlib

from passlib.context import CryptContext

_pwd_context = CryptContext(schemes=['bcrypt'], deprecated='auto')


def hash_password(password: str) -> str:
    """Hash a password using bcrypt."""
    return _pwd_context.hash(password)


def verify_password(password: str, stored_hash: str) -> Tuple[bool, bool]:
    """
    Verify a password against the stored hash.

    Returns:
        (is_valid, needs_upgrade)
    """
    if not stored_hash:
        return False, False

    # Bcrypt hashes start with $2...
    if stored_hash.startswith('$2'):
        return _pwd_context.verify(password, stored_hash), False

    # Legacy SHA256 hex digest
    if len(stored_hash) == 64:
        legacy_hash = hashlib.sha256(password.encode()).hexdigest()
        if legacy_hash == stored_hash:
            return True, True

    return False, False
