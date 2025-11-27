"""
Configuration loader utility
Centralized configuration loading for DataFlows Core
"""
import os
import yaml
from typing import Dict, Any

# Global config cache
_config_cache: Dict[str, Any] = None


def get_config_path() -> str:
    """Get the path to config.yaml"""
    return os.path.join(os.path.dirname(__file__), '..', '..', '..', 'config', 'config.yaml')


def load_config(force_reload: bool = False) -> Dict[str, Any]:
    """
    Load configuration from config.yaml
    
    Args:
        force_reload: Force reload config from file (ignore cache)
        
    Returns:
        Configuration dictionary
    """
    global _config_cache
    
    if _config_cache is not None and not force_reload:
        return _config_cache
    
    config_path = get_config_path()
    
    try:
        with open(config_path, 'r') as f:
            _config_cache = yaml.safe_load(f)
            return _config_cache
    except FileNotFoundError:
        raise FileNotFoundError(
            f"Configuration file not found at {config_path}. "
            "Please copy config/config_sample.yaml to config/config.yaml and configure it."
        )
    except yaml.YAMLError as e:
        raise ValueError(f"Error parsing configuration file: {e}")


def get_config_value(key_path: str, default: Any = None) -> Any:
    """
    Get a configuration value using dot notation
    
    Args:
        key_path: Path to config value (e.g., 'api.search_results_limit')
        default: Default value if key not found
        
    Returns:
        Configuration value or default
        
    Example:
        >>> get_config_value('api.search_results_limit', 30)
        30
    """
    config = load_config()
    keys = key_path.split('.')
    
    value = config
    for key in keys:
        if isinstance(value, dict) and key in value:
            value = value[key]
        else:
            return default
    
    return value
