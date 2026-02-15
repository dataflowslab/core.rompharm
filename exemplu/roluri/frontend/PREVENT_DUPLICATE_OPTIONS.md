# Preventing Duplicate Options in Select Components

## Problem
Mantine Select components throw errors when duplicate options are provided:
```
Error: Duplicate options are not supported. Option with value "XXX" was provided more than once
```

This causes:
- White/blank pages
- Application crashes
- Poor user experience

## Solution
Use the `selectHelpers` utility functions to ensure unique options.

## Usage

### 1. Import the helper
```typescript
import { prepareSelectOptions, safeSelectData } from '../../utils/selectHelpers';
```

### 2. Apply to your Select data

#### Method A: prepareSelectOptions (Recommended)
Use when you want to add a placeholder and ensure uniqueness:

```typescript
const loadOptions = async () => {
  const response = await api.get('/api/endpoint');
  const rawOptions = response.data.map(item => ({
    value: String(item.id || ''),  // Always convert to string
    label: item.name || ''
  }));
  
  // Remove duplicates and add placeholder
  const uniqueOptions = prepareSelectOptions(rawOptions, '-- Selectează --');
  setOptions(uniqueOptions);
};
```

#### Method B: safeSelectData
Use when you just want to remove duplicates without placeholder:

```typescript
const loadOptions = async () => {
  const response = await api.get('/api/endpoint');
  const rawOptions = response.data.map(item => ({
    value: String(item.id || ''),
    label: item.name || ''
  }));
  
  // Remove duplicates with warning
  const uniqueOptions = safeSelectData(rawOptions, 'ComponentName');
  setOptions(uniqueOptions);
};
```

## Best Practices

### 1. Always Convert Values to Strings
```typescript
// ✅ GOOD
value: String(item.cod || '')

// ❌ BAD
value: item.cod  // Could be number, null, undefined
```

### 2. Handle Missing Data
```typescript
// ✅ GOOD
label: item.name || item.cod || 'Unknown'

// ❌ BAD
label: item.name  // Could be undefined
```

### 3. Use Consistent Value Types
```typescript
// ✅ GOOD - All strings
const options = [
  { value: '1', label: 'Option 1' },
  { value: '2', label: 'Option 2' }
];

// ❌ BAD - Mixed types
const options = [
  { value: 1, label: 'Option 1' },      // number
  { value: '2', label: 'Option 2' }     // string
];
```

### 4. Check API Responses
```typescript
// ✅ GOOD
if (response.data && Array.isArray(response.data)) {
  const rawOptions = response.data.map(item => ({
    value: String(item.id || ''),
    label: item.name || ''
  }));
  const uniqueOptions = prepareSelectOptions(rawOptions, placeholder);
  setOptions(uniqueOptions);
} else {
  setOptions([{ value: '', label: placeholder }]);
}
```

## Components to Update

Apply this pattern to ALL Select components, especially:

### Procurement Module
- ✅ `Tabel1Row.tsx` - Program selector (FIXED)
- ⏳ `Tabel2Row.tsx` - Program selector
- ⏳ `SSISelector.tsx` - SB, SF, SSI selectors
- ⏳ `FormHeader.tsx` - Referat selector
- ⏳ `FormSectionA.tsx` - Department selector
- ⏳ Any other Select components

### Other Modules
- Check all `Select` components
- Check all `MultiSelect` components
- Check custom select-like components

## Testing Checklist

After applying the fix:
1. ✅ No console errors about duplicate options
2. ✅ Select opens without crashing
3. ✅ All options are visible
4. ✅ No duplicate values in dropdown
5. ✅ Placeholder appears correctly
6. ✅ Selection works properly

## Debugging

If you still see duplicate errors:

1. **Check the console warning**:
   ```
   [ComponentName] Removed X duplicate option(s)
   ```
   This tells you duplicates were found and removed.

2. **Inspect the API response**:
   ```typescript
   console.log('Raw API data:', response.data);
   ```

3. **Check for duplicate values in database**:
   - Query the source collection
   - Look for duplicate codes/IDs

4. **Use validateSelectOptions for debugging**:
   ```typescript
   import { validateSelectOptions } from '../../utils/selectHelpers';
   
   try {
     validateSelectOptions(options);
   } catch (error) {
     console.error('Validation failed:', error);
   }
   ```

## Migration Guide

To update existing Select components:

1. Import the helper:
   ```typescript
   import { prepareSelectOptions } from '../../utils/selectHelpers';
   ```

2. Find your data loading function

3. Replace manual option building with helper:
   ```typescript
   // BEFORE
   const options = [
     { value: '', label: '-- Selectează --' },
     ...response.data.map(item => ({ value: item.id, label: item.name }))
   ];
   
   // AFTER
   const rawOptions = response.data.map(item => ({
     value: String(item.id || ''),
     label: item.name || ''
   }));
   const options = prepareSelectOptions(rawOptions, '-- Selectează --');
   ```

4. Test thoroughly

## Summary

**Always use `prepareSelectOptions` or `safeSelectData` for Select components to prevent duplicate option errors and ensure application stability.**
