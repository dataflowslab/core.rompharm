/**
 * Select Helpers - Utility functions for Select components
 * Prevents duplicate options and ensures data integrity
 */

export interface SelectOption {
  value: string;
  label: string;
  [key: string]: any;
}

/**
 * Remove duplicate options from a select list based on value
 * Keeps the first occurrence of each unique value
 */
export function removeDuplicateOptions(options: SelectOption[]): SelectOption[] {
  const seen = new Set<string>();
  const unique: SelectOption[] = [];
  
  for (const option of options) {
    // Convert value to string for comparison
    const valueStr = String(option.value);
    
    if (!seen.has(valueStr)) {
      seen.add(valueStr);
      unique.push(option);
    }
  }
  
  return unique;
}

/**
 * Prepare options for Select component with optional placeholder
 * Removes duplicates and adds placeholder if provided
 */
export function prepareSelectOptions(
  options: SelectOption[],
  placeholder?: string
): SelectOption[] {
  // Remove duplicates first
  let uniqueOptions = removeDuplicateOptions(options);
  
  // Add placeholder at the beginning if provided
  if (placeholder) {
    // Check if empty value already exists
    const hasEmptyValue = uniqueOptions.some(opt => opt.value === '' || opt.value === null);
    
    if (!hasEmptyValue) {
      uniqueOptions = [
        { value: '', label: placeholder },
        ...uniqueOptions
      ];
    }
  }
  
  return uniqueOptions;
}

/**
 * Validate that all options have unique values
 * Throws error if duplicates found (useful for debugging)
 */
export function validateSelectOptions(options: SelectOption[]): void {
  const values = options.map(opt => String(opt.value));
  const duplicates = values.filter((value, index) => values.indexOf(value) !== index);
  
  if (duplicates.length > 0) {
    console.error('Duplicate select options found:', duplicates);
    throw new Error(`Duplicate select options: ${duplicates.join(', ')}`);
  }
}

/**
 * Safe wrapper for Select data prop
 * Ensures no duplicates and logs warnings if found
 */
export function safeSelectData(
  options: SelectOption[],
  componentName?: string
): SelectOption[] {
  const originalLength = options.length;
  const uniqueOptions = removeDuplicateOptions(options);
  
  if (uniqueOptions.length < originalLength) {
    const duplicateCount = originalLength - uniqueOptions.length;
    console.warn(
      `[${componentName || 'Select'}] Removed ${duplicateCount} duplicate option(s)`,
      'Original:', originalLength,
      'Unique:', uniqueOptions.length
    );
  }
  
  return uniqueOptions;
}
