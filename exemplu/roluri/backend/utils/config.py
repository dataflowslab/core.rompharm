"""
Configuration loader with caching.
"""
from __future__ import annotations

from functools import lru_cache
from typing import Any, Dict, Optional
import os
import yaml

DEFAULT_CONFIG_PATH = os.path.join(
    os.path.dirname(__file__), '..', '..', '..', 'config', 'config.yaml'
)


def resolve_config_path(config_path: Optional[str] = None) -> str:
    """Resolve the config path with optional override from env."""
    if config_path:
        return config_path

    env_path = os.getenv('DATAFLOWS_CONFIG_PATH') or os.getenv('DF_CONFIG_PATH')
    if env_path:
        return env_path

    return DEFAULT_CONFIG_PATH


@lru_cache(maxsize=1)
def load_config(config_path: Optional[str] = None) -> Dict[str, Any]:
    """Load configuration from config.yaml (cached)."""
    path = resolve_config_path(config_path)
    try:
        with open(path, 'r', encoding='utf-8') as f:
            return yaml.safe_load(f) or {}
    except FileNotFoundError:
        return {}


def clear_config_cache() -> None:
    """Clear cached configuration (useful for tests)."""
    load_config.cache_clear()


def get_config_value(*keys: str, default: Any = None) -> Any:
    """Get nested config value by keys with a default."""
    config = load_config()
    current: Any = config
    for key in keys:
        if not isinstance(current, dict) or key not in current:
            return default
        current = current[key]
    return current
