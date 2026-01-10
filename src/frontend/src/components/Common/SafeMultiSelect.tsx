/**
 * SafeMultiSelect Component
 * 
 * Wrapper around Mantine MultiSelect that automatically:
 * - Sanitizes options (removes undefined/duplicates)
 * - Normalizes _id to id
 * - Validates selected values
 * - Provides better error messages
 */

import { MultiSelect, MultiSelectProps } from '@mantine/core';
import { forwardRef, useMemo } from 'react';
import { sanitizeSelectOptions, validateMultiSelectValues, SelectOption } from '../../utils/selectHelpers';

interface SafeMultiSelectProps extends Omit<MultiSelectProps, 'data'> {
  /**
   * Data can be:
   * - Array of {value, label} objects
   * - Array of objects with _id/id and name fields (auto-converted)
   * - Array of strings (auto-converted to {value, label})
   */
  data?: 
    | SelectOption[] 
    | Array<{ _id?: string; id?: string; name?: string; [key: string]: any }>
    | string[]
    | null
    | undefined;
  
  /**
   * Key to use for value (default: tries _id, then id)
   */
  valueKey?: string;
  
  /**
   * Key to use for label (default: 'name')
   */
  labelKey?: string;
  
  /**
   * Enable debug logging
   */
  debug?: boolean;
}

export const SafeMultiSelect = forwardRef<HTMLInputElement, SafeMultiSelectProps>(
  ({ data, valueKey, labelKey = 'name', debug = false, value, onChange, ...props }, ref) => {
    
    const sanitizedData = useMemo(() => {
      if (!data || !Array.isArray(data)) {
        if (debug) console.log('[SafeMultiSelect] No data provided');
        return [];
      }

      // Handle string arrays
      if (typeof data[0] === 'string') {
        const options = (data as string[]).map(item => ({
          value: String(item),
          label: String(item)
        }));
        return sanitizeSelectOptions(options);
      }

      // Handle objects
      const options = (data as any[]).map((item, index) => {
        // Try to get value from multiple possible keys
        let itemValue: string | undefined;
        
        if (valueKey) {
          itemValue = item[valueKey];
        } else {
          // Auto-detect: try _id first, then id, then first property
          itemValue = item._id || item.id || item.value;
        }

        // Get label
        const label = item[labelKey] || item.label || item.name || itemValue || `Item ${index + 1}`;

        // Validate value
        if (!itemValue || itemValue === 'undefined' || itemValue === 'null') {
          if (debug) {
            console.warn('[SafeMultiSelect] Invalid value detected:', {
              item,
              value: itemValue,
              label,
              index
            });
          }
          return null;
        }

        return {
          value: String(itemValue),
          label: String(label),
          ...item // Keep original data for reference
        };
      }).filter(Boolean) as SelectOption[];

      const sanitized = sanitizeSelectOptions(options);
      
      if (debug) {
        console.log('[SafeMultiSelect] Data processed:', {
          input: data.length,
          output: sanitized.length,
          removed: data.length - sanitized.length,
          sample: sanitized[0]
        });
      }

      return sanitized;
    }, [data, valueKey, labelKey, debug]);

    // Validate current values
    const validatedValues = useMemo(() => {
      if (!value || !Array.isArray(value)) return value;
      
      const validated = validateMultiSelectValues(value, sanitizedData);
      
      if (debug && validated.length !== value.length) {
        console.warn('[SafeMultiSelect] Some values not found in options:', {
          input: value,
          output: validated,
          removed: value.filter(v => !validated.includes(v))
        });
      }
      
      return validated;
    }, [value, sanitizedData, debug]);

    const handleChange = (newValues: string[]) => {
      if (onChange) {
        const validated = validateMultiSelectValues(newValues, sanitizedData);
        onChange(validated);
      }
    };

    return (
      <MultiSelect
        ref={ref}
        {...props}
        data={sanitizedData}
        value={validatedValues}
        onChange={handleChange}
      />
    );
  }
);

SafeMultiSelect.displayName = 'SafeMultiSelect';
