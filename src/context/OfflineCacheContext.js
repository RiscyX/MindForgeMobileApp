import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../hooks/useLanguage';
import {
  loadFavoritesSnapshot,
  saveFavoritesSnapshot,
} from '../services/offlineCache';
import { getOnlineStatus } from '../services/networkStatus';

const OfflineCacheContext = createContext(null);

const extractTestFromPayload = (payload) => {
  if (!payload || typeof payload !== 'object') return null;
  return payload.test || payload.data?.test || payload.data || null;
};

const extractQuestions = (test) => {
  if (!test || typeof test !== 'object') return [];
  if (Array.isArray(test.questions)) return test.questions;
  if (Array.isArray(test.items)) return test.items;
  if (Array.isArray(test.test_questions)) return test.test_questions;
  if (Array.isArray(test.data?.questions)) return test.data.questions;
  return [];
};

const normalizeCachedTest = (raw, fallback = null) => {
  const test = raw?.test ?? raw;
  const fallbackTest = fallback?.test ?? fallback;
  const questions = extractQuestions(test);
  const fallbackQuestions = extractQuestions(fallbackTest);
  const id = test?.id || fallbackTest?.id || fallback?.test_id || raw?.test_id || null;
  if (!id) return null;

  return {
    ...(fallbackTest || {}),
    ...(test || {}),
    id,
    questions: questions.length > 0 ? questions : fallbackQuestions,
  };
};

export function OfflineCacheProvider({ children }) {
  const { isAuthenticated, authFetch } = useAuth();
  const { language } = useLanguage();

  // Cached tests (with questions) loaded from disk.
  const [cachedTests, setCachedTests] = useState([]);
  const [cachedAt, setCachedAt] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingFromDisk, setIsLoadingFromDisk] = useState(true);

  const refreshingRef = useRef(false);

  // Load snapshot from disk on mount / auth change.
  useEffect(() => {
    let cancelled = false;
    setIsLoadingFromDisk(true);
    (async () => {
      const snap = await loadFavoritesSnapshot();
      if (!cancelled) {
        if (snap?.tests) {
          setCachedTests(snap.tests);
          setCachedAt(snap.cachedAt || null);
        }
        setIsLoadingFromDisk(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isAuthenticated]);

  /**
   * Re-fetches full test details (with questions) for a list of favorite test
   * metadata objects, then saves the result to disk.
   *
   * Called by FavoritesContext.load() after the favorites list is fetched, and
   * only when the app is online.
   *
   * @param {Array} favoriteTests — array of test objects (need at least .id)
   */
  const refreshSnapshot = useCallback(async (favoriteTests) => {
    if (!isAuthenticated || !getOnlineStatus()) {
      return;
    }

    if (refreshingRef.current) {
      return;
    }

    const ids = Array.isArray(favoriteTests)
      ? favoriteTests.map((t) => String(t?.id || t?.test?.id || t?.test_id || '')).filter(Boolean)
      : [];

    if (ids.length === 0) {
      // Nothing to cache — save empty snapshot.
      await saveFavoritesSnapshot([]);
      setCachedTests([]);
      setCachedAt(new Date().toISOString());
      return;
    }

    refreshingRef.current = true;
    setIsRefreshing(true);

    try {
      // Fetch all favorites in parallel — gracefully skip failures.
      const results = await Promise.allSettled(
        ids.map(async (testId) => {
          const fallback = favoriteTests.find((t) => String(t?.id || t?.test?.id || t?.test_id || '') === String(testId)) || null;
          const payload = await authFetch(`/tests/${encodeURIComponent(String(testId))}?lang=${encodeURIComponent(String(language || 'en'))}`, {
            method: 'GET',
            timeoutMs: 30000,
          });
          return normalizeCachedTest(extractTestFromPayload(payload), fallback);
        })
      );

      const hydrated = results
        .map((r) => (r.status === 'fulfilled' ? r.value : null))
        .filter(Boolean)
        .filter((test) => Array.isArray(test.questions) && test.questions.length > 0);

      // Avoid wiping a previously-good cache due to transient API failures.
      if (hydrated.length === 0 && ids.length > 0 && cachedTests.length > 0) {
        if (__DEV__) {
          console.warn('[OfflineCacheContext] Snapshot refresh returned 0 hydrated tests; keeping existing cache.');
        }
        return;
      }

      await saveFavoritesSnapshot(hydrated);
      setCachedTests(hydrated);
      setCachedAt(new Date().toISOString());

      if (__DEV__) {
        console.log(`[OfflineCacheContext] Snapshot saved: ${hydrated.length}/${ids.length} tests`);
      }
    } catch (e) {
      if (__DEV__) {
        console.warn('[OfflineCacheContext] refreshSnapshot error:', e);
      }
    } finally {
      refreshingRef.current = false;
      setIsRefreshing(false);
    }
  }, [authFetch, cachedTests.length, isAuthenticated, language]);

  /**
   * Find a cached test by id (returns the full test object with questions, or null).
   */
  const getCachedTest = useCallback((testId) => {
    const id = String(testId ?? '');
    return cachedTests.find((t) => String(t?.id ?? '') === id) || null;
  }, [cachedTests]);

  return (
    <OfflineCacheContext.Provider value={{ cachedTests, cachedAt, isRefreshing, isLoadingFromDisk, refreshSnapshot, getCachedTest }}>
      {children}
    </OfflineCacheContext.Provider>
  );
}

export function useOfflineCache() {
  const ctx = useContext(OfflineCacheContext);
  if (!ctx) {
    throw new Error('useOfflineCache must be used within OfflineCacheProvider');
  }
  return ctx;
}
