import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import kn from './locales/kn.json';
import hi from './locales/hi.json';

// Retrieve saved language preference or default to English
const savedLanguage = localStorage.getItem('worklink_language') || 'en';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      kn: { translation: kn },
      hi: { translation: hi }
    },
    lng: savedLanguage,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false // React already escapes values
    },
    react: {
      useSuspense: false
    }
  });

// Listen for language change to persist in localStorage
i18n.on('languageChanged', (lng) => {
  localStorage.setItem('worklink_language', lng);
});

export default i18n;
