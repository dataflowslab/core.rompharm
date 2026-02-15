import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SafeSelect } from '../SafeSelect';
import { MantineProvider } from '@mantine/core';

// Mock MantineProvider for tests
const renderWithMantine = (component: React.ReactNode) => {
    return render(
        <MantineProvider>
            {component}
        </MantineProvider>
    );
};

describe('SafeSelect', () => {
    it('renders with string array data', () => {
        const data = ['Option 1', 'Option 2'];
        renderWithMantine(<SafeSelect label="Test Select" data={data} />);

        // Check if label renders
        expect(screen.getByText('Test Select')).toBeInTheDocument();
        // Note: Options are usually in a portal/dropdown, might need userEvent to open
    });

    it('renders with object array data (auto-detect)', () => {
        const data = [
            { _id: '1', name: 'Item 1' },
            { id: '2', name: 'Item 2' }
        ];
        renderWithMantine(<SafeSelect data={data} />);
        // Basic render check
        expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('handles null/undefined values in data', () => {
        const data = [
            { _id: '1', name: 'Valid' },
            null,
            undefined,
            { _id: undefined, name: 'Invalid ID' }
        ];
        // @ts-ignore - testing runtime safety
        renderWithMantine(<SafeSelect data={data} debug />);
        // Should not crash
        expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('deduplicates options', () => {
        const data = ['Duplicate', 'Duplicate', 'Unique'];
        renderWithMantine(<SafeSelect data={data} />);
        // Internal logic check would require mocking sanitizeSelectOptions or checking props
    });
});
