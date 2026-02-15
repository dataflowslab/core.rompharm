import { useTranslation } from 'react-i18next';
import procurementI18n from '../i18n';

/**
 * Hook personalizat pentru traducerile modulului Procurement
 * Folosește instanța separată de i18n pentru izolare completă
 */
export function useProcurementTranslation() {
  const { t, i18n } = useTranslation('procurement', { i18n: procurementI18n });
  
  return {
    t,
    i18n,
    // Helper pentru traduceri cu prefix automat
    tp: (key: string, options?: any) => t(`procurement.${key}`, options),
  };
}

// Export și alias pentru compatibilitate
export default useProcurementTranslation;
