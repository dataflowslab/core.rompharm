/**
 * SafeSelect Component
 * 
 * Wrapper around Mantine Select that automatically:
 * - Sanitizes options (removes undefined/duplicates)
 * - Normalizes _id to id
 * - Validates selected value
 * - Provides better error messages
 */

import { Select, SelectProps } from '@mantine/core';
import { forwardRef, useMemo } from 'react';
import { sanitizeSelectOptions, SelectOption } from '../../utils/selectHelpers';

interface SafeSelectProps extends Omit<SelectProps, 'data'> {
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

export const SafeSelect = forwardRef<HTMLInputElement, SafeSelectProps>(
  ({ data, valueKey, labelKey = 'name', debug = false, ...props }, ref) => {
    
    const sanitizedData = useMemo(() => {
      if (!data || !Array.isArray(data)) {
        if (debug) console.log('[SafeSelect] No data provided');
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
        let value: string | undefined;
        
        if (valueKey) {
          value = item[valueKey];
        } else {
          // Auto-detect: try _id first, then id, then first property
          value = item._id || item.id || item.value;
        }

        // Get label
        const label = item[labelKey] || item.label || item.name || value || `Item ${index + 1}`;

        // Validate value
        if (!value || value === 'undefined' || value === 'null') {
          if (debug) {
            console.warn('[SafeSelect] Invalid value detected:', {
              item,
              value,
              label,
              index
            });
          }
          return null;
        }

        return {
          value: String(value),
          label: String(label),
          ...item // Keep original data for reference
        };
      }).filter(Boolean) as SelectOption[];

      const sanitized = sanitizeSelectOptions(options);
      
      if (debug) {
        console.log('[SafeSelect] Data processed:', {
          input: data.length,
          output: sanitized.length,
          removed: data.length - sanitized.length,
          sample: sanitized[0]
        });
      }

      return sanitized;
    }, [data, valueKey, labelKey, debug]);

    // Validate current value
    const validatedValue = useMemo(() => {
      if (!props.value) return props.value;
      
      const found = sanitizedData.find(opt => opt.value === props.value);
      if (!found && debug) {
        console.warn('[SafeSelect] Selected value not found in options:', {
          value: props.value,
          availableValues: sanitizedData.map(o => o.value)
        });
      }
      
      return found ? props.value : undefined;
    }, [props.value, sanitizedData, debug]);

    return (
      <Select
        ref={ref}
        {...props}
        data={sanitizedData}
        value={validatedValue}
      />
    );
  }
);

SafeSelect.displayName = 'SafeSelect';
