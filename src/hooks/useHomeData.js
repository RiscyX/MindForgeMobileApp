import { useState, useEffect, useCallback } from 'react';
import { EN_FALLBACK_QUOTE, fetchHomeData, fetchTests, fetchDailyQuote } from '../services/api';

export const useHomeData = ({ language = 'en' } = {}) => {
  const [data, setData] = useState(null);
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const loadData = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const [homeResult, testsResult, quoteResult] = await Promise.all([
        fetchHomeData(language),
        fetchTests({ language }),
        fetchDailyQuote(),
      ]);

      setData({
        ...homeResult,
        dailyQuote: quoteResult || EN_FALLBACK_QUOTE,
      });
      setTests(testsResult);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [language]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const refetch = useCallback(() => {
    setRefreshing(true);
    loadData({ silent: true });
  }, [loadData]);

  return { data, tests, loading, refreshing, error, refetch };
};
