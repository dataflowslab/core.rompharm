/**
 * Date formatting utilities
 * 
 * Provides consistent date formatting across the application
 */

/**
 * Format date to DD.MM.YYYY format
 * @param dateString - ISO date string or Date object
 * @returns Formatted date string or '-' if invalid
 */
export function formatDate(dateString?: string | Date | null): string {
  if (!dateString) return '-';
  
  try {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    
    if (isNaN(date.getTime())) return '-';
    
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    
    return `${day}.${month}.${year}`;
  } catch (error) {
    return '-';
  }
}

/**
 * Format datetime to DD.MM.YYYY HH:MM format
 * @param dateString - ISO datetime string or Date object
 * @returns Formatted datetime string or '-' if invalid
 */
export function formatDateTime(dateString?: string | Date | null): string {
  if (!dateString) return '-';
  
  try {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    
    if (isNaN(date.getTime())) return '-';
    
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    return `${day}.${month}.${year} ${hours}:${minutes}`;
  } catch (error) {
    return '-';
  }
}
