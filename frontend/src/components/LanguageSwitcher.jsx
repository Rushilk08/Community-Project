import React from 'react';
import { useTranslation } from 'react-i18next';

const languages = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'kn', label: 'Kannada', native: 'ಕನ್ನಡ' },
  { code: 'hi', label: 'Hindi', native: 'हिन्दी' }
];

export default function LanguageSwitcher({ className = '' }) {
  const { i18n, t } = useTranslation();

  const handleLanguageChange = (e) => {
    const selectedLang = e.target.value;
    i18n.changeLanguage(selectedLang);
  };

  // Match current active language or prefix
  const currentLang = i18n.language ? i18n.language.split('-')[0] : 'en';

  return (
    <div className={`language-switcher-container ${className}`}>
      <label htmlFor="worklink-lang-select" className="sr-only">
        {t('selectLanguage')}
      </label>
      <select
        id="worklink-lang-select"
        value={currentLang}
        onChange={handleLanguageChange}
        className="language-switcher-select"
        title={t('selectLanguage')}
        aria-label={t('selectLanguage')}
      >
        {languages.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.native}
          </option>
        ))}
      </select>
    </div>
  );
}
