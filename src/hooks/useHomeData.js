import { useState, useEffect } from 'react';
import { EN_FALLBACK_QUOTE, fetchHomeData, fetchTests, fetchDailyQuote } from '../services/api';

export const useHomeData = ({ language = 'en' } = {}) => {
  const [data, setData] = useState(null);
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        // Párhuzamosan lekérjük a header adatokat, a teszteket és az idézetet
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
      }
    };

    loadData();
  }, [language]);

  return { data, tests, loading, error };
};
