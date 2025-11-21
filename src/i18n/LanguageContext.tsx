import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Language, translations, languageNames } from './translations';

// Re-export Language type
export type { Language };

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: typeof translations.en;
  languageNames: typeof languageNames;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
};

interface LanguageProviderProps {
  children: ReactNode;
}

export const LanguageProvider: React.FC<LanguageProviderProps> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    // Get browser language setting
    const browserLang = navigator.language || navigator.languages[0];
    
    // Get saved language from localStorage
    const savedLang = localStorage.getItem('gis-converter-language') as Language | null;
    if (savedLang && translations[savedLang]) {
      return savedLang;
    }
    
    // Determine language based on browser language
    if (browserLang.startsWith('ja')) return 'ja';
    if (browserLang.startsWith('zh-TW') || browserLang.startsWith('zh-Hant')) return 'zh-Hant';
    if (browserLang.startsWith('zh')) return 'zh-Hans';
    if (browserLang.startsWith('ko')) return 'ko';
    if (browserLang.startsWith('es')) return 'es';
    if (browserLang.startsWith('fr')) return 'fr';
    if (browserLang.startsWith('de')) return 'de';
    if (browserLang.startsWith('pt')) return 'pt';
    if (browserLang.startsWith('ru')) return 'ru';
    if (browserLang.startsWith('it')) return 'it';
    if (browserLang.startsWith('nl')) return 'nl';
    if (browserLang.startsWith('pl')) return 'pl';
    if (browserLang.startsWith('ar')) return 'ar';
    if (browserLang.startsWith('sv')) return 'sv';
    if (browserLang.startsWith('bg')) return 'bg';
    if (browserLang.startsWith('th')) return 'th';
    if (browserLang.startsWith('ca')) return 'ca';
    if (browserLang.startsWith('tr')) return 'tr';
    if (browserLang.startsWith('uk')) return 'uk';
    if (browserLang.startsWith('el')) return 'el';
    if (browserLang.startsWith('vi')) return 'vi';
    if (browserLang.startsWith('hi')) return 'hi';
    if (browserLang.startsWith('id')) return 'id';
    if (browserLang.startsWith('ms')) return 'ms';
    
    return 'en';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('gis-converter-language', lang);
  };

  useEffect(() => {
    localStorage.setItem('gis-converter-language', language);
  }, [language]);

  // Get translations for current language
  const currentTranslations = translations[language] || translations.en;
  const value: LanguageContextType = {
    language,
    setLanguage,
    t: currentTranslations,
    languageNames,
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

