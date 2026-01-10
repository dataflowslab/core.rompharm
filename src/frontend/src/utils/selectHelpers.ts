/**
 * Select Helpers
 * Utility functions to prevent common Select/MultiSelect errors
 */

/**
 * Debounce function to limit rate of function calls
 * 
 * @param func - Function to debounce
 * @param wait - Wait time in milliseconds
 * @returns Debounced function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
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

export interface SelectOption {
  value: string;
  label: string;
  [key: string]: any;
}

/**
 * Sanitize select options to prevent duplicate/undefined errors
 * 
 * Fixes:
 * - Removes options with undefined/null/empty values
 * - Removes duplicate values (keeps first occurrence)
 * - Ensures all options have both value and label
 * 
 * @param options - Array of select options
 * @param defaultLabel - Default label for options without label (default: value)
 * @returns Sanitized array of options
 */
export function sanitizeSelectOptions<T extends SelectOption>(
  options: T[] | undefined | null,
  defaultLabel?: string
): T[] {
  if (!options || !Array.isArray(options)) {
    return [];
  }

  const seen = new Set<string>();
  const sanitized: T[] = [];

  for (const option of options) {
    // Skip if no option or no value
    if (!option || option.value === undefined || option.value === null || option.value === '') {
      continue;
    }

    // Convert value to string
    const value = String(option.value);

    // Skip duplicates
    if (seen.has(value)) {
      console.warn(`[SelectHelper] Duplicate option value detected: "${value}"`);
      continue;
    }

    seen.add(value);

    // Ensure label exists
    const label = option.label || defaultLabel || value;

    sanitized.push({
      ...option,
      value,
      label
    });
  }

  return sanitized;
}

/**
 * Create select options from array of objects
 * 
 * @param items - Array of items
 * @param valueKey - Key to use for value (default: 'id' or '_id')
 * @param labelKey - Key to use for label (default: 'name')
 * @returns Sanitized array of select options
 */
export function createSelectOptions<T extends Record<string, any>>(
  items: T[] | undefined | null,
  valueKey: keyof T = '_id' as keyof T,
  labelKey: keyof T = 'name' as keyof T
): SelectOption[] {
  if (!items || !Array.isArray(items)) {
    return [];
  }

  const options = items.map(item => ({
    value: String(item[valueKey] || item['id'] || item['_id'] || ''),
    label: String(item[labelKey] || item['name'] || item[valueKey] || 'Unknown')
  }));

  return sanitizeSelectOptions(options);
}

/**
 * Validate select value against available options
 * Returns valid value or undefined if not found
 * 
 * @param value - Current value
 * @param options - Available options
 * @returns Valid value or undefined
 */
export function validateSelectValue(
  value: string | undefined | null,
  options: SelectOption[]
): string | undefined {
  if (!value) return undefined;
  
  const sanitized = sanitizeSelectOptions(options);
  const found = sanitized.find(opt => opt.value === value);
  
  if (!found) {
    console.warn(`[SelectHelper] Value "${value}" not found in options`);
    return undefined;
  }
  
  return value;
}

/**
 * Validate multi-select values against available options
 * Returns only valid values
 * 
 * @param values - Current values
 * @param options - Available options
 * @returns Array of valid values
 */
export function validateMultiSelectValues(
  values: string[] | undefined | null,
  options: SelectOption[]
): string[] {
  if (!values || !Array.isArray(values)) return [];
  
  const sanitized = sanitizeSelectOptions(options);
  const validValues = new Set(sanitized.map(opt => opt.value));
  
  return values.filter(value => {
    if (!value) return false;
    const isValid = validValues.has(value);
    if (!isValid) {
      console.warn(`[SelectHelper] Value "${value}" not found in options`);
    }
    return isValid;
  });
}

/**
 * Safe wrapper for Select component data prop
 * Use this to wrap any Select data to prevent errors
 * 
 * @example
 * <Select data={safeSelectData(myOptions)} />
 */
export const safeSelectData = sanitizeSelectOptions;

/**
 * Create options from simple string array
 * 
 * @param items - Array of strings
 * @returns Select options where value === label
 */
export function createOptionsFromStrings(
  items: string[] | undefined | null
): SelectOption[] {
  if (!items || !Array.isArray(items)) {
    return [];
  }

  return sanitizeSelectOptions(
    items.map(item => ({
      value: String(item),
      label: String(item)
    }))
  );
}
