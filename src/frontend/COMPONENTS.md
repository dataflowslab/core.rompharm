# Frontend Components Documentation

## ApiSelect Component

### Overview
`ApiSelect` is a reusable Select component that automatically loads data from API endpoints. It eliminates the need to manually manage data loading, caching, and search functionality for dropdown selects.

### Features
- ✅ **Auto-loading**: Loads first 20 results alphabetically when dropdown opens
- ✅ **Search support**: Filters results up to 50 items when user types (min 2 characters)
- ✅ **Smart caching**: Caches results to avoid redundant API calls
- ✅ **Loading states**: Shows loading indicator while fetching data
- ✅ **Error handling**: Gracefully handles API errors
- ✅ **Flexible mapping**: Supports custom value/label formatting
- ✅ **MongoDB ready**: Works with `_id` fields by default

### Basic Usage

```tsx
import { ApiSelect } from '../components/Common/ApiSelect';

// Simple select with default settings
<ApiSelect
  label="Currency"
  endpoint="/api/currencies"
  value={selectedCurrency}
  onChange={setSelectedCurrency}
  valueField="_id"
  labelField="name"
/>
```

### Common Use Cases

#### 1. Currency Select
```tsx
<ApiSelect
  label="Currency"
  endpoint="/api/currencies"
  value={formData.currency_id}
  onChange={(value) => setFormData({ ...formData, currency_id: value || '' })}
  valueField="_id"
  labelFormat={(item) => `${item.name} (${item.abrev})`}
  searchable
  required
/>
```

#### 2. Location Select
```tsx
<ApiSelect
  label="Destination"
  endpoint="/modules/inventory/api/locations"
  value={formData.location_id}
  onChange={(value) => setFormData({ ...formData, location_id: value || '' })}
  valueField="_id"
  labelField="name"
  searchable
  clearable
  placeholder="Select stock location"
/>
```

#### 3. Parts/Articles Select with Search
```tsx
<ApiSelect
  label="Part"
  endpoint="/modules/inventory/api/articles"
  value={formData.part_id}
  onChange={(value) => setFormData({ ...formData, part_id: value || '' })}
  valueField="_id"
  labelFormat={(item) => `${item.name} ${item.ipn ? `(${item.ipn})` : ''}`}
  searchable
  searchParam="search"
  dataPath="results"  // If API returns { results: [...] }
  placeholder="Type at least 2 characters to search..."
  required
/>
```

#### 4. Supplier Select
```tsx
<ApiSelect
  label="Supplier"
  endpoint="/modules/inventory/api/companies"
  queryParams={{ is_supplier: true }}  // Additional filters
  value={formData.supplier_id}
  onChange={(value) => setFormData({ ...formData, supplier_id: value || '' })}
  valueField="_id"
  labelField="name"
  searchable
/>
```

### Props Reference

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `endpoint` | `string` | **required** | API endpoint to fetch data from |
| `valueField` | `string` | `'_id'` | Field to use as option value |
| `labelField` | `string` | `'name'` | Field to use as option label |
| `labelFormat` | `(item: any) => string` | - | Custom function to format the label |
| `valueFormat` | `(item: any) => string` | - | Custom function to format the value |
| `searchParam` | `string` | `'search'` | Query parameter name for search |
| `queryParams` | `Record<string, any>` | `{}` | Additional query parameters |
| `dataPath` | `string` | - | Path to data array in response (e.g., `'results'`) |
| `value` | `string \| null` | - | Current selected value |
| `onChange` | `(value: string \| null) => void` | - | Callback when value changes |
| `limit` | `number` | `20` / `50` | Max results (20 for initial, 50 for search) |
| `sortBy` | `string` | `labelField` | Field to sort by |
| `sortOrder` | `'asc' \| 'desc'` | `'asc'` | Sort order |
| `searchable` | `boolean` | `false` | Enable search functionality |
| `placeholder` | `string` | `'Select...'` | Placeholder text |

All standard Mantine `Select` props are also supported (e.g., `label`, `required`, `disabled`, `clearable`, etc.)

### API Endpoint Requirements

For `ApiSelect` to work correctly, your API endpoints should support:

1. **Pagination/Limit**: Accept `limit` query parameter
   ```
   GET /api/currencies?limit=20
   ```

2. **Search**: Accept search query parameter (default: `search`)
   ```
   GET /api/currencies?search=euro&limit=50
   ```

3. **Sorting**: Accept `sort_by` and `sort_order` parameters
   ```
   GET /api/currencies?sort_by=name&sort_order=asc&limit=20
   ```

4. **Response Format**: Return array directly or nested in object
   ```json
   // Direct array
   [{ "_id": "123", "name": "Euro", "abrev": "EUR" }]
   
   // Or nested
   { "results": [{ "_id": "123", "name": "Euro" }], "total": 100 }
   ```

### Data Structure Requirements

Items in the response should have:
- A unique identifier field (default: `_id`)
- A display name field (default: `name`)
- All fields should be non-null and non-empty

Example MongoDB document:
```json
{
  "_id": "694322d98728e4d75ae72794",
  "name": "Romanian Leu",
  "abrev": "RON"
}
```

### Caching Behavior

- **Initial load**: Cached with key `'initial'`
- **Search results**: Cached with key `'search:{query}'`
- Cache persists for component lifetime
- No automatic cache invalidation (reload component to refresh)

### Performance Tips

1. **Use `dataPath`** if your API returns nested data to avoid processing overhead
2. **Set appropriate `limit`** values based on expected dataset size
3. **Enable `searchable`** for large datasets (>50 items)
4. **Use `queryParams`** to pre-filter data server-side

### Migration Guide

#### Before (Manual Implementation)
```tsx
const [currencies, setCurrencies] = useState([]);
const [loading, setLoading] = useState(false);

useEffect(() => {
  const loadCurrencies = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/currencies');
      const options = response.data.map(c => ({
        value: c._id,
        label: `${c.name} (${c.abrev})`
      }));
      setCurrencies(options);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };
  loadCurrencies();
}, []);

<Select
  label="Currency"
  data={currencies}
  value={value}
  onChange={onChange}
  disabled={loading}
/>
```

#### After (Using ApiSelect)
```tsx
<ApiSelect
  label="Currency"
  endpoint="/api/currencies"
  value={value}
  onChange={onChange}
  valueField="_id"
  labelFormat={(item) => `${item.name} (${item.abrev})`}
/>
```

### Troubleshooting

#### Select is empty
- Check browser console for `[ApiSelect]` logs
- Verify endpoint returns data in correct format
- Check `dataPath` if data is nested
- Ensure `valueField` and `labelField` match your data structure

#### Search not working
- Verify `searchable={true}` is set
- Check if API endpoint supports search parameter
- Ensure minimum 2 characters are typed
- Check `searchParam` matches your API's expected parameter name

#### Values not matching
- Verify `valueField` points to correct field in your data
- Check if values are being converted to strings correctly
- Use `valueFormat` for custom value transformation

### Examples in Codebase

See these files for real-world usage:
- `src/frontend/src/components/Procurement/ItemsTab.tsx` - Currency and Location selects
- `src/frontend/src/pages/ArticleDetailPage.tsx` - Supplier and Category selects
