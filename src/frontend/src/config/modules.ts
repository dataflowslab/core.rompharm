/**
 * Module configuration
 * Centralized API prefixes for modules
 */

export const MODULE_API_PREFIXES = {
  procurement: '/modules/depo_procurement/api',
  // Add more modules here as needed
};

/**
 * Get API prefix for a module
 */
export function getModuleApiPrefix(moduleName: keyof typeof MODULE_API_PREFIXES): string {
  return MODULE_API_PREFIXES[moduleName];
}
