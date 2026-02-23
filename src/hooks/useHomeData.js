import { useState, useEffect, useCallback } from 'react';
import { EN_FALLBACK_QUOTE, fetchHomeData, fetchTests, fetchDailyQuote } from '../services/api';

const TESTS_PAGE_SIZE = 20;

const mergeById = (prevItems, nextItems) => {
  const byId = new Map();
  [...prevItems, ...nextItems].forEach((item, index) => {
    const id = item?.id;
    const key = id === null || id === undefined
      ? `fallback-${item?.title || 'test'}-${item?.category || 'uncategorized'}-${index}`
      : String(id);
    byId.set(key, item);
  });
  return Array.from(byId.values());
};

export const useHomeData = ({ language = 'en' } = {}) => {
  const [data, setData] = useState(null);
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMoreTests, setHasMoreTests] = useState(true);
  const [nextPage, setNextPage] = useState(2);
  const [error, setError] = useState(null);

  const loadData = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const [homeResult, testsResult, quoteResult] = await Promise.all([
        fetchHomeData(language),
        fetchTests({ language, page: 1, limit: TESTS_PAGE_SIZE }),
        fetchDailyQuote(),
      ]);

      setData({
        ...homeResult,
        dailyQuote: quoteResult || EN_FALLBACK_QUOTE,
      });
      setTests(Array.isArray(testsResult?.tests) ? testsResult.tests : []);
      setHasMoreTests(Boolean(testsResult?.hasMore));
      setNextPage(Number(testsResult?.nextPage || 2));
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [language]);

  const loadMore = useCallback(async () => {
    if (loading || refreshing || loadingMore || !hasMoreTests) {
      return;
    }

    setLoadingMore(true);
    try {
      const testsResult = await fetchTests({ language, page: nextPage, limit: TESTS_PAGE_SIZE });
      const nextChunk = Array.isArray(testsResult?.tests) ? testsResult.tests : [];

      setTests((prev) => mergeById(prev, nextChunk));
      setHasMoreTests(Boolean(testsResult?.hasMore));
      if (testsResult?.nextPage) {
        setNextPage(Number(testsResult.nextPage));
      }
    } catch (err) {
      setError(err);
    } finally {
      setLoadingMore(false);
    }
  }, [hasMoreTests, language, loading, loadingMore, nextPage, refreshing]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const refetch = useCallback(() => {
    setRefreshing(true);
    loadData({ silent: true });
  }, [loadData]);

  return {
    data,
    tests,
    loading,
    loadingMore,
    refreshing,
    error,
    hasMoreTests,
    refetch,
    loadMore,
  };
};
