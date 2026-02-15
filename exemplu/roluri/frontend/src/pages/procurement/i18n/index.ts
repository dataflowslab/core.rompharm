import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import roTranslation from '../locales/ro/translation.json';
import enTranslation from '../locales/en/translation.json';

// Configurare i18n pentru modulul Procurement
const procurementI18n = i18n.createInstance();

procurementI18n
  .use(initReactI18next)
  .init({
    resources: {
      ro: {
        procurement: roTranslation.procurement
      },
      en: {
        procurement: enTranslation.procurement
      }
    },
    lng: 'ro', // Limba implicită
    fallbackLng: 'ro',
    ns: ['procurement'], // Namespace pentru modul
    defaultNS: 'procurement',
    interpolation: {
      escapeValue: false
    },
    react: {
      useSuspense: false
    }
  });

export default procurementI18n;
