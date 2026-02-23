import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../hooks/useLanguage';
import { fetchTestDetails } from '../services/api';
import {
  loadFavoritesSnapshot,
  saveFavoritesSnapshot,
} from '../services/offlineCache';
import { getOnlineStatus } from '../services/networkStatus';

const OfflineCacheContext = createContext(null);

export function OfflineCacheProvider({ children }) {
  const { isAuthenticated, authFetch } = useAuth();
  const { language } = useLanguage();

  // Cached tests (with questions) loaded from disk.
  const [cachedTests, setCachedTests] = useState([]);
  const [cachedAt, setCachedAt] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refreshingRef = useRef(false);

  // Load snapshot from disk on mount / auth change.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const snap = await loadFavoritesSnapshot();
      if (!cancelled && snap?.tests) {
        setCachedTests(snap.tests);
        setCachedAt(snap.cachedAt || null);
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
        ids.map((testId) =>
          fetchTestDetails({ testId, language }).catch(() => null)
        )
      );

      const hydrated = results
        .map((r) => (r.status === 'fulfilled' ? r.value : null))
        .filter(Boolean);

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
  }, [isAuthenticated, language]);

  /**
   * Find a cached test by id (returns the full test object with questions, or null).
   */
  const getCachedTest = useCallback((testId) => {
    const id = String(testId ?? '');
    return cachedTests.find((t) => String(t?.id ?? '') === id) || null;
  }, [cachedTests]);

  return (
    <OfflineCacheContext.Provider value={{ cachedTests, cachedAt, isRefreshing, refreshSnapshot, getCachedTest }}>
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
