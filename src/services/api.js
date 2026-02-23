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

const resolveTestsArray = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.tests)) return payload.tests;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data?.tests)) return payload.data.tests;
  if (Array.isArray(payload?.data?.items)) return payload.data.items;
  return [];
};

const resolvePagination = (payload, { page, limit, fetchedCount }) => {
  const pagination = payload?.pagination || payload?.meta?.pagination || payload?.meta || {};
  const currentPage = Number(
    pagination.current_page
    ?? pagination.page
    ?? page
  );
  const totalPages = Number(
    pagination.total_pages
    ?? pagination.last_page
    ?? 0
  );
  const nextPageFromPayload = Number(
    pagination.next_page
    ?? pagination.nextPage
    ?? 0
  );

  if (Number.isFinite(nextPageFromPayload) && nextPageFromPayload > 0) {
    return { hasMore: true, nextPage: nextPageFromPayload };
  }

  if (Number.isFinite(totalPages) && totalPages > 0 && Number.isFinite(currentPage)) {
    const hasMore = currentPage < totalPages;
    return { hasMore, nextPage: hasMore ? currentPage + 1 : null };
  }

  if (typeof pagination.has_more === 'boolean') {
    const nextPage = pagination.has_more ? page + 1 : null;
    return { hasMore: pagination.has_more, nextPage };
  }

  if (typeof pagination.hasMore === 'boolean') {
    const nextPage = pagination.hasMore ? page + 1 : null;
    return { hasMore: pagination.hasMore, nextPage };
  }

  const hasMoreByCount = fetchedCount >= limit;
  return { hasMore: hasMoreByCount, nextPage: hasMoreByCount ? page + 1 : null };
};

// Tesztek lekérése a backendről
export const fetchTests = async ({ language = 'en', page = 1, limit = 20 } = {}) => {
  try {
    const lang = normalizeLanguage(language);
    const query = `?lang=${encodeURIComponent(lang)}&page=${encodeURIComponent(String(page))}&limit=${encodeURIComponent(String(limit))}`;
    const data = await apiRequest(`/tests${query}`, { method: 'GET' });
    const tests = resolveTestsArray(data);
    const pagination = resolvePagination(data, { page, limit, fetchedCount: tests.length });

    if (tests.length === 0 && __DEV__) {
      console.warn('Tests endpoint returned empty array. Using local fallback tests in development.');
      return {
        tests: page === 1 ? FALLBACK_TESTS[lang] : [],
        hasMore: false,
        nextPage: null,
      };
    }

    return {
      tests,
      hasMore: pagination.hasMore,
      nextPage: pagination.nextPage,
    };
  } catch (error) {
    if (__DEV__) {
      console.error('Fetch tests error:', error);
    }
    const lang = normalizeLanguage(language);
    return {
      tests: __DEV__ && page === 1 ? FALLBACK_TESTS[lang] : [],
      hasMore: false,
      nextPage: null,
    };
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
    const response = await fetch(`https://api.forismatic.com/api/1.0/?method=getQuote&format=json&lang=en&key=${Math.floor(Math.random() * 100000)}`);
    
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
    if (__DEV__) {
      console.warn('Daily quote fetch error:', error);
    }
    return null;
  }
};

// Header data (welcome message, subtitle, etc.)
// TODO: Replace with real API call when /home endpoint is available on the backend.
export const fetchHomeData = async (language = 'en') => {
  const lang = normalizeLanguage(language);
  return FALLBACK_HOME[lang];
};
