"""
Slug generator utility
"""
import random
import string


def generate_form_slug(length: int = 8) -> str:
    """
    Generate a random slug for forms using uppercase letters and digits
    
    Args:
        length: Length of the slug (default 8)
        
    Returns:
        Random slug string
    """
    characters = string.ascii_uppercase + string.digits
    return ''.join(random.choice(characters) for _ in range(length))


def is_slug_available(db, slug: str) -> bool:
    """
    Check if a slug is available
    
    Args:
        db: MongoDB database instance
        slug: Slug to check
        
    Returns:
        True if available, False otherwise
    """
    forms_collection = db['forms']
    existing = forms_collection.find_one({'slug': slug})
    return existing is None


def generate_unique_slug(db, length: int = 8, max_attempts: int = 10) -> str:
    """
    Generate a unique slug that doesn't exist in the database
    
    Args:
        db: MongoDB database instance
        length: Length of the slug
        max_attempts: Maximum number of attempts to generate unique slug
        
    Returns:
        Unique slug string
        
    Raises:
        RuntimeError: If unable to generate unique slug after max_attempts
    """
    for _ in range(max_attempts):
        slug = generate_form_slug(length)
        if is_slug_available(db, slug):
            return slug
    
    raise RuntimeError(f"Unable to generate unique slug after {max_attempts} attempts")
