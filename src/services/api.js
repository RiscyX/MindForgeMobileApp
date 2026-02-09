import { apiRequest } from './httpClient';

const FALLBACK_HOME = {
  en: {
    welcomeMessage: 'MINDFORGE',
    subtitle: 'Unlock Your Potential',
    dailyQuote: 'Success is not final, failure is not fatal: it is the courage to continue that counts.',
    userInitial: 'M',
  },
  hu: {
    welcomeMessage: 'MINDFORGE',
    subtitle: 'Hozd ki magadbol a legtobbet',
    dailyQuote: 'A siker nem vegleges, a kudarc nem vegzetes: a folytatashoz batorsag kell.',
    userInitial: 'M',
  },
};

export const EN_FALLBACK_QUOTE = 'Success is not final, failure is not fatal: it is the courage to continue that counts.';

const FALLBACK_TESTS = {
  en: [
    {
      id: 'fallback-1',
      title: 'Frontend Fundamentals',
      description: 'Core HTML, CSS and responsive UI basics.',
      difficulty: 'Easy',
      category: 'Frontend',
    },
    {
      id: 'fallback-2',
      title: 'JavaScript Essentials',
      description: 'Variables, functions, arrays and async patterns.',
      difficulty: 'Medium',
      category: 'Programming',
    },
  ],
  hu: [
    {
      id: 'fallback-1',
      title: 'Frontend alapok',
      description: 'HTML, CSS es reszponziv feluletek alapjai.',
      difficulty: 'Easy',
      category: 'Frontend',
    },
    {
      id: 'fallback-2',
      title: 'JavaScript alapok',
      description: 'Valtozok, fuggvenyek, tombok es async mintak.',
      difficulty: 'Medium',
      category: 'Programozas',
    },
  ],
};

const normalizeLanguage = (language) => (language === 'hu' ? 'hu' : 'en');

// Tesztek lekérése a backendről
export const fetchTests = async ({ language = 'en' } = {}) => {
  try {
    const lang = normalizeLanguage(language);
    const data = await apiRequest(`/tests?lang=${lang}`, { method: 'GET' });
    const tests = Array.isArray(data?.tests) ? data.tests : [];

    if (tests.length === 0 && __DEV__) {
      console.warn('Tests endpoint returned empty array. Using local fallback tests in development.');
      return FALLBACK_TESTS[lang];
    }

    return tests;
  } catch (error) {
    console.error('Fetch tests error:', error);
    const lang = normalizeLanguage(language);
    return __DEV__ ? FALLBACK_TESTS[lang] : [];
  }
};

export const fetchTestDetails = async ({ testId, language = 'en' }) => {
  const lang = normalizeLanguage(language);
  const data = await apiRequest(`/tests/${encodeURIComponent(String(testId))}?lang=${lang}`, { method: 'GET', timeoutMs: 30000 });
  return data?.test || null;
};

// Napi idézet lekérése a Forismatic API-ról
export const fetchDailyQuote = async () => {
  try {
    // A Math.random() segít elkerülni a cache-elést
    const response = await fetch(`http://api.forismatic.com/api/1.0/?method=getQuote&format=json&lang=en&key=${Math.floor(Math.random() * 100000)}`);
    
    if (!response.ok) {
       // Ha nem sikerül, visszatérünk null-lal és a fallback szöveg marad
       return null; 
    }

    const data = await response.json();
    
    // Formázzuk az idézetet
    if (data.quoteText) {
      const author = data.quoteAuthor ? ` — ${data.quoteAuthor}` : '';
      return `${data.quoteText.trim()}${author}`;
    }
    return null;

  } catch (error) {
    console.warn('Daily quote fetch error:', error);
    return null;
  }
};

// Szimuláltuk az adatlekérést egy kis késleltetéssel (Header adatok)
export const fetchHomeData = async (language = 'en') => {
  // Valós hívás esetén ez lenne:
  // const response = await fetch(`${BASE_URL}/home`);
  // return response.json();

  // Most szimuláljuk a választ:
  return new Promise((resolve) => {
    setTimeout(() => {
      const lang = normalizeLanguage(language);
      resolve(FALLBACK_HOME[lang]);
    }, 1500);
  });
};
