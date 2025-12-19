/**
 * ApiSelect Component
 * 
 * A reusable Select component that automatically loads data from an API endpoint.
 * 
 * Features:
 * - Loads first 20 results alphabetically by default when opened
 * - Supports search with up to 50 results
 * - Caches results to avoid redundant API calls
 * - Handles loading and error states
 * 
 * @example
 * // Simple usage with default mapping
 * <ApiSelect
 *   label="Currency"
 *   endpoint="/api/currencies"
 *   value={selectedCurrency}
 *   onChange={setCurrency}
 *   valueField="_id"
 *   labelField="name"
 *   labelFormat={(item) => `${item.name} (${item.abrev})`}
 * />
 * 
 * @example
 * // With search enabled
 * <ApiSelect
 *   label="Part"
 *   endpoint="/modules/inventory/api/articles"
 *   value={selectedPart}
 *   onChange={setSelectedPart}
 *   valueField="_id"
 *   labelField="name"
 *   searchable
 *   searchParam="search"
 *   placeholder="Type to search..."
 * />
 */

import { useState, useEffect, useRef } from 'react';
import { Select, SelectProps } from '@mantine/core';
import api from '../../services/api';

interface ApiSelectProps extends Omit<SelectProps, 'data' | 'onChange'> {
  /** API endpoint to fetch data from */
  endpoint: string;
  
  /** Field to use as option value (default: '_id') */
  valueField?: string;
  
  /** Field to use as option label (default: 'name') */
  labelField?: string;
  
  /** Custom function to format the label */
  labelFormat?: (item: any) => string;
  
  /** Custom function to format the value */
  valueFormat?: (item: any) => string;
  
  /** Query parameter name for search (default: 'search') */
  searchParam?: string;
  
  /** Additional query parameters to include in the request */
  queryParams?: Record<string, any>;
  
  /** Path to the data array in the response (e.g., 'results' or 'data.items') */
  dataPath?: string;
  
  /** Current selected value */
  value?: string | null;
  
  /** Callback when value changes */
  onChange?: (value: string | null) => void;
  
  /** Maximum results to show (default: 20 for initial load, 50 for search) */
  limit?: number;
  
  /** Field to sort by (default: labelField) */
  sortBy?: string;
  
  /** Sort order (default: 'asc') */
  sortOrder?: 'asc' | 'desc';
}

export function ApiSelect({
  endpoint,
  valueField = '_id',
  labelField = 'name',
  labelFormat,
  valueFormat,
  searchParam = 'search',
  queryParams = {},
  dataPath,
  value,
  onChange,
  limit,
  sortBy,
  sortOrder = 'asc',
  searchable = false,
  placeholder = 'Select...',
  ...selectProps
}: ApiSelectProps) {
  const [data, setData] = useState<Array<{ value: string; label: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [cache, setCache] = useState<Map<string, Array<{ value: string; label: string }>>>(new Map());
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load initial data when component mounts
  useEffect(() => {
    if (!cache.has('initial')) {
      loadData();
    } else {
      setData(cache.get('initial') || []);
    }
  }, []);

  // Load data with search when search query changes (with 250ms debounce)
  useEffect(() => {
    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (searchQuery.length >= 2) {
      const cacheKey = `search:${searchQuery}`;
      if (cache.has(cacheKey)) {
        // Use cached data immediately
        setData(cache.get(cacheKey) || []);
      } else {
        // Debounce API call by 250ms
        searchTimeoutRef.current = setTimeout(() => {
          loadData(searchQuery);
        }, 250);
      }
    } else if (searchQuery.length === 0) {
      // Reset to initial data when search is cleared
      setData(cache.get('initial') || []);
    }

    // Cleanup timeout on unmount
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  const loadData = async (search?: string) => {
    setLoading(true);
    try {
      // Build query parameters
      const params: Record<string, any> = {
        ...queryParams,
        limit: search ? (limit || 50) : (limit || 20),
        sort_by: sortBy || labelField,
        sort_order: sortOrder,
      };

      // Add search parameter if searching
      if (search) {
        params[searchParam] = search;
      }

      // Build query string
      const queryString = new URLSearchParams(
        Object.entries(params)
          .filter(([_, v]) => v !== undefined && v !== null && v !== '')
          .map(([k, v]) => [k, String(v)])
      ).toString();

      const url = queryString ? `${endpoint}?${queryString}` : endpoint;

      console.log(`[ApiSelect] Loading data from: ${url}`);
      const response = await api.get(url);
      console.log(`[ApiSelect] Response:`, response.data);

      // Extract data from response based on dataPath
      let items = response.data;
      if (dataPath) {
        const paths = dataPath.split('.');
        for (const path of paths) {
          items = items?.[path];
        }
      }

      // Ensure items is an array
      if (!Array.isArray(items)) {
        console.warn(`[ApiSelect] Response is not an array:`, items);
        items = [];
      }

      // Map items to Select options
      const options = items
        .filter((item: any) => {
          const val = valueFormat ? valueFormat(item) : item[valueField];
          return val != null && val !== undefined && val !== '';
        })
        .map((item: any) => ({
          value: valueFormat ? valueFormat(item) : String(item[valueField]),
          label: labelFormat ? labelFormat(item) : String(item[labelField] || item[valueField]),
        }));

      console.log(`[ApiSelect] Mapped ${options.length} options`);

      // Cache the results
      const cacheKey = search ? `search:${search}` : 'initial';
      setCache(prev => new Map(prev).set(cacheKey, options));
      setData(options);
    } catch (error) {
      console.error(`[ApiSelect] Failed to load data from ${endpoint}:`, error);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
  };

  return (
    <Select
      {...selectProps}
      data={data}
      value={value}
      onChange={onChange}
      searchable={searchable}
      onSearchChange={searchable ? handleSearchChange : undefined}
      searchValue={searchable ? searchQuery : undefined}
      placeholder={loading ? 'Loading...' : placeholder}
      disabled={loading || selectProps.disabled}
      nothingFoundMessage={
        searchQuery.length > 0 && searchQuery.length < 2
          ? 'Type at least 2 characters to search'
          : loading
          ? 'Loading...'
          : 'No results found'
      }
    />
  );
}
