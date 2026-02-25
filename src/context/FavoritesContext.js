import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../hooks/useLanguage';
import {
  addFavoriteTestRequest,
  listFavoriteTestsRequest,
  removeFavoriteTestRequest,
} from '../services/favoritesApi';
import { useOfflineCache } from './OfflineCacheContext';
import { getOnlineStatus } from '../services/networkStatus';

const FAVORITES_LIMIT = 10;

const FavoritesContext = createContext(null);

export function FavoritesProvider({ children }) {
  const { isAuthenticated, authFetch } = useAuth();
  const { language, t } = useLanguage();
  const { refreshSnapshot } = useOfflineCache();

  const [favoriteIds, setFavoriteIds] = useState(new Set());
  const [tests, setTests] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Track in-flight toggles to prevent double taps.
  const pendingRef = useRef(new Set());

  const load = useCallback(async () => {
    if (!isAuthenticated) {
      setFavoriteIds(new Set());
      setTests([]);
      return;
    }

    // If offline, skip the network request entirely — the screen will fall back
    // to the cached snapshot from OfflineCacheContext.
    if (!getOnlineStatus()) {
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      const result = await listFavoriteTestsRequest({ authFetch, language });
      setTests(result.tests);
      setFavoriteIds(new Set(result.favoriteIds));
      // Refresh offline cache snapshot in the background (no await).
      refreshSnapshot(result.tests).catch(() => {});
    } catch (e) {
      // If the request failed because we went offline mid-flight, suppress the
      // error — the screen will show the cached snapshot instead.
      if (!getOnlineStatus()) {
        return;
      }
      setError(e?.message || 'Could not load favorites.');
    } finally {
      setIsLoading(false);
    }
  }, [authFetch, isAuthenticated, language, refreshSnapshot]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleFavorite = useCallback(async (test) => {
    const testId = String(test?.id ?? '');
    if (!testId || pendingRef.current.has(testId)) return;

    const wasFavorite = favoriteIds.has(testId);

    // Enforce client-side limit before attempting to add.
    if (!wasFavorite && favoriteIds.size >= FAVORITES_LIMIT) {
      Alert.alert(
        t('favorites.limitReachedTitle'),
        t('favorites.limitReached'),
        [{ text: 'OK', style: 'default' }],
      );
      return;
    }

    // Optimistic update.
    pendingRef.current.add(testId);
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      if (wasFavorite) {
        next.delete(testId);
      } else {
        next.add(testId);
      }
      return next;
    });
    if (wasFavorite) {
      setTests((prev) => prev.filter((t) => String(t?.test_id || t?.test?.id || t?.id) !== testId));
    } else {
      setTests((prev) => {
        const alreadyIn = prev.some((t) => String(t?.test_id || t?.test?.id || t?.id) === testId);
        return alreadyIn ? prev : [...prev, test];
      });
    }

    try {
      if (wasFavorite) {
        await removeFavoriteTestRequest({ authFetch, testId });
      } else {
        await addFavoriteTestRequest({ authFetch, testId });
      }
    } catch (e) {
      // Check if the server rejected due to limit (for when backend enforces it too).
      const isLimitError =
        e?.status === 422 ||
        e?.status === 403 ||
        (typeof e?.message === 'string' &&
          /limit|maximum|max|kedvenc|favorite/i.test(e.message));

      if (!wasFavorite && isLimitError) {
        // Add was rejected by server — revert optimistic add, show limit alert.
        setFavoriteIds((prev) => {
          const next = new Set(prev);
          next.delete(testId);
          return next;
        });
        setTests((prev) => prev.filter((t) => String(t?.test_id || t?.test?.id || t?.id) !== testId));
        Alert.alert(
          t('favorites.limitReachedTitle'),
          t('favorites.limitReached'),
          [{ text: 'OK', style: 'default' }],
        );
      } else {
        // Generic revert on failure.
        setFavoriteIds((prev) => {
          const next = new Set(prev);
          if (wasFavorite) {
            next.add(testId);
          } else {
            next.delete(testId);
          }
          return next;
        });
        if (wasFavorite) {
          setTests((prev) => {
            const alreadyIn = prev.some((t) => String(t?.test_id || t?.test?.id || t?.id) === testId);
            return alreadyIn ? prev : [...prev, test];
          });
        } else {
          setTests((prev) => prev.filter((t) => String(t?.test_id || t?.test?.id || t?.id) !== testId));
        }
      }
    } finally {
      pendingRef.current.delete(testId);
    }
  }, [authFetch, favoriteIds, t]);

  const isFavorite = useCallback((testId) => favoriteIds.has(String(testId ?? '')), [favoriteIds]);

  return (
    <FavoritesContext.Provider value={{ favoriteIds, tests, isLoading, error, isFavorite, toggleFavorite, reload: load }}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error('useFavorites must be used within FavoritesProvider');
  return ctx;
}
