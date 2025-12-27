/**
 * Select Helpers - Utilities for Mantine Select components
 * 
 * Prevents "Duplicate options" errors by sanitizing option arrays
 * Provides debounce functionality for search inputs
 */

export interface SelectOption {
  value: string | number;
  label: string;
  [key: string]: any;
}

/**
 * Debounce function - delays execution until after wait time has elapsed
 * 
 * @param func - Function to debounce
 * @param wait - Wait time in milliseconds (default: 250ms)
 * @returns Debounced function
 * 
 * @example
 * ```typescript
 * const debouncedSearch = debounce((query: string) => {
 *   searchParts(query);
 * }, 250);
 * 
 * <Select
 *   onSearchChange={(query) => {
 *     setPartSearch(query);
 *     debouncedSearch(query);
 *   }}
 * />
 * ```
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number = 250
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };
    
    if (timeout) {
      clearTimeout(timeout);
    }
    
    timeout = setTimeout(later, wait);
  };
}

/**
 * Sanitize select options to prevent duplicate values and undefined/null values
 * 
 * @param options - Array of select options
 * @returns Filtered array with unique, valid options
 * 
 * @example
 * ```typescript
 * <Select
 *   data={sanitizeSelectOptions(
 *     parts.map(part => ({
 *       value: String(part.pk),
 *       label: part.name
 *     }))
 *   )}
 * />
 * ```
 */
export function sanitizeSelectOptions<T extends SelectOption>(options: T[]): T[] {
  const seen = new Set<string>();
  
  return options.filter(option => {
    // Filter out undefined, null, or empty values
    if (
      option.value === undefined || 
      option.value === null || 
      option.value === '' ||
      option.label === undefined ||
      option.label === null
    ) {
      console.warn('[selectHelpers] Filtered out invalid option:', option);
      return false;
    }
    
    // Convert value to string for comparison
    const key = String(option.value);
    
    // Filter out duplicates
    if (seen.has(key)) {
      console.warn('[selectHelpers] Filtered out duplicate option:', option);
      return false;
    }
    
    seen.add(key);
    return true;
  });
}

/**
 * Create safe select options from array of objects
 * 
 * @param items - Array of items
 * @param valueKey - Key to use for value
 * @param labelKey - Key to use for label
 * @returns Sanitized select options
 * 
 * @example
 * ```typescript
 * <Select
 *   data={createSelectOptions(locations, '_id', 'name')}
 * />
 * ```
 */
export function createSelectOptions<T extends Record<string, any>>(
  items: T[],
  valueKey: keyof T,
  labelKey: keyof T
): SelectOption[] {
  const options = items
    .filter(item => item[valueKey] !== undefined && item[valueKey] !== null)
    .map(item => ({
      value: String(item[valueKey]),
      label: String(item[labelKey] || item[valueKey])
    }));
  
  return sanitizeSelectOptions(options);
}

/**
 * Merge selected item with search results for Select component
 * Useful when you want to keep the selected item visible even if not in search results
 * 
 * @param selectedItem - Currently selected item
 * @param searchResults - Array of search results
 * @param valueKey - Key to use for value
 * @param labelKey - Key to use for label
 * @returns Sanitized merged options
 * 
 * @example
 * ```typescript
 * <Select
 *   data={mergeSelectedWithResults(
 *     selectedPart,
 *     searchResults,
 *     '_id',
 *     'name'
 *   )}
 * />
 * ```
 */
export function mergeSelectedWithResults<T extends Record<string, any>>(
  selectedItem: T | null,
  searchResults: T[],
  valueKey: keyof T,
  labelKey: keyof T
): SelectOption[] {
  const options: SelectOption[] = [];
  
  // Add selected item first if exists
  if (selectedItem && selectedItem[valueKey]) {
    options.push({
      value: String(selectedItem[valueKey]),
      label: String(selectedItem[labelKey] || selectedItem[valueKey])
    });
  }
  
  // Add search results (filter out selected to avoid duplicates)
  const selectedValue = selectedItem ? String(selectedItem[valueKey]) : null;
  searchResults.forEach(item => {
    if (item[valueKey] && String(item[valueKey]) !== selectedValue) {
      options.push({
        value: String(item[valueKey]),
        label: String(item[labelKey] || item[valueKey])
      });
    }
  });
  
  return sanitizeSelectOptions(options);
}
