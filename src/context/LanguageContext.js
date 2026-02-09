import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { SUPPORTED_LANGUAGES, translations } from '../i18n/translations';

const LANGUAGE_KEY = 'mf_language';

const detectLanguage = () => {
  const locale = Intl.DateTimeFormat().resolvedOptions().locale?.toLowerCase() || 'en';
  if (locale.startsWith('hu')) {
    return 'hu';
  }

  return 'en';
};

const resolveLanguage = (language) => {
  if (SUPPORTED_LANGUAGES.includes(language)) {
    return language;
  }

  return 'en';
};

const interpolate = (template, values = {}) => {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => {
    const value = values[key];
    return value === undefined || value === null ? '' : String(value);
  });
};

export const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState('en');
  const [isLanguageReady, setIsLanguageReady] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const stored = await SecureStore.getItemAsync(LANGUAGE_KEY);
        setLanguageState(resolveLanguage(stored || detectLanguage()));
      } finally {
        setIsLanguageReady(true);
      }
    };

    load();
  }, []);

  const setLanguage = useCallback(async (nextLanguage) => {
    const resolved = resolveLanguage(nextLanguage);
    setLanguageState(resolved);
    await SecureStore.setItemAsync(LANGUAGE_KEY, resolved);
  }, []);

  const t = (key, values) => {
    const parts = key.split('.');
    const dictionary = translations[language] || translations.en;
    let current = dictionary;

    for (const part of parts) {
      current = current?.[part];
      if (current === undefined) {
        current = null;
        break;
      }
    }

    if (typeof current !== 'string') {
      return key;
    }

    return interpolate(current, values);
  };

  const value = useMemo(() => ({
    language,
    isLanguageReady,
    setLanguage,
    t,
  }), [isLanguageReady, language, setLanguage]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}
