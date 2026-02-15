/**
 * SafeSelect Component
 * 
 * A wrapper around Mantine Select that ensures data is always valid
 * and prevents "Each option must have value property" errors.
 * 
 * Features:
 * - Validates data array before rendering
 * - Filters out invalid items (missing value/label)
 * - Provides default nothingFoundMessage
 * - Handles null/undefined data gracefully
 */

import { Select, SelectProps } from '@mantine/core';
import { useMemo } from 'react';

interface SafeSelectProps extends Omit<SelectProps, 'data'> {
  data?: Array<{ value: string; label: string; [key: string]: any }> | null;
  nothingFoundMessage?: string;
}

export function SafeSelect({ 
  data, 
  nothingFoundMessage = 'Nu există date disponibile',
  ...props 
}: SafeSelectProps) {
  
  // Validate and sanitize data
  const safeData = useMemo(() => {
    // Handle null/undefined
    if (!data) {
      return [];
    }
    
    // Ensure it's an array
    if (!Array.isArray(data)) {
      console.warn('SafeSelect: data is not an array', data);
      return [];
    }
    
    // Filter out invalid items
    const validData = data.filter((item, index) => {
      // Check if item is an object
      if (!item || typeof item !== 'object') {
        console.warn(`SafeSelect: Item at index ${index} is not an object`, item);
        return false;
      }
      
      // Check if value exists and is not null/undefined
      if (!('value' in item) || item.value === null || item.value === undefined) {
        console.warn(`SafeSelect: Item at index ${index} is missing 'value' property`, item);
        return false;
      }
      
      // Check if label exists
      if (!('label' in item)) {
        console.warn(`SafeSelect: Item at index ${index} is missing 'label' property`, item);
        return false;
      }
      
      return true;
    });
    
    return validData;
  }, [data]);
  
  return (
    <Select
      {...props}
      data={safeData}
      nothingFoundMessage={nothingFoundMessage}
    />
  );
}
