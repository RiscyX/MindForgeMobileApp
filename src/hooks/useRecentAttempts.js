import { useCallback, useEffect, useState } from 'react';
import { fetchQuizStatsRequest } from '../services/statsApi';

const RECENT_LIMIT = 3;

/**
 * Loads the user's most recent quiz attempts (top 3) from the stats API.
 * Returns an empty array immediately when the user is not authenticated.
 */
export function useRecentAttempts({ authFetch, language, isAuthenticated }) {
  const [attempts, setAttempts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!isAuthenticated) {
      setAttempts([]);
      return;
    }

    if (!silent) setIsLoading(true);
    setError('');

    try {
      const data = await fetchQuizStatsRequest({ authFetch, language });
      const all = Array.isArray(data?.quizzes) ? data.quizzes : [];
      // Sort by last attempt date descending so the newest shows first.
      const sorted = [...all].sort((a, b) => {
        const dateA = new Date(
          a?.last_attempt_at || a?.lastAttemptAt || a?.attempt?.finished_at || 0,
        ).getTime();
        const dateB = new Date(
          b?.last_attempt_at || b?.lastAttemptAt || b?.attempt?.finished_at || 0,
        ).getTime();
        return dateB - dateA;
      });
      setAttempts(sorted.slice(0, RECENT_LIMIT));
    } catch (e) {
      setError(e?.message || 'Could not load recent activity.');
    } finally {
      setIsLoading(false);
    }
  }, [authFetch, isAuthenticated, language]);

  const refetch = useCallback(() => {
    load({ silent: true });
  }, [load]);

  useEffect(() => {
    load();
  }, [load]);

  return { attempts, isLoading, error, refetch };
}
