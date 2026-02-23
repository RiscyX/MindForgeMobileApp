import { createContext, useCallback, useContext, useState } from 'react';
import { Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../hooks/useLanguage';
import { startAttemptRequest } from '../services/attemptsApi';
import { fetchTestDetails } from '../services/api';
import { getOnlineStatus } from '../services/networkStatus';
import { useOfflineCache } from './OfflineCacheContext';

const TestActionsContext = createContext(null);

export function TestActionsProvider({ children }) {
  const navigation = useNavigation();
  const { isAuthenticated, authFetch, logout } = useAuth();
  const { language } = useLanguage();
  const { getCachedTest } = useOfflineCache();
  const [startingTestId, setStartingTestId] = useState(null);

  const handleStartTest = useCallback(async (test) => {
    if (startingTestId) {
      return;
    }

    if (!isAuthenticated) {
      navigation.navigate('Login');
      return;
    }

    const testId = test?.id;
    if (!testId) {
      return;
    }

    // ── Offline branch ────────────────────────────────────────────────────────
    if (!getOnlineStatus()) {
      const cached = getCachedTest(testId);
      if (!cached || !Array.isArray(cached.questions) || cached.questions.length === 0) {
        Alert.alert(
          'Offline',
          'This test is not available offline. Connect to the internet and open the app to cache your favorites.',
        );
        return;
      }
      navigation.navigate('Test', {
        testId,
        attemptId: null,
        offlineQuestions: cached.questions,
        offlineTest: cached,
      });
      return;
    }
    try {
      setStartingTestId(testId);

      // Sanity check: token must be accepted by backend.
      try {
        await authFetch('/auth/me', { method: 'GET', timeoutMs: 15000 });
      } catch (meError) {
        const status = meError?.status;
        const apiMessage = meError?.data?.error?.message || meError?.data?.message;
        const apiCode = meError?.data?.error?.code;

        if (status === 401) {
          await logout();
          navigation.navigate('Login');
          const msg = apiMessage || meError?.message || 'Authentication required.';
          alert(apiCode ? `${msg} (${apiCode})` : msg);
          return;
        }
      }

      const attempt = await startAttemptRequest({ authFetch, testId, language });
      if (!attempt?.id) {
        throw new Error('Could not start test attempt.');
      }

      navigation.navigate('Test', { testId, attemptId: attempt.id });
    } catch (e) {
      if (__DEV__) {
        console.warn('Start test failed:', e);
        console.log('[StartTest] status=', e?.status);
        console.log('[StartTest] endpoint=', e?.data?._meta?.endpoint);
        console.log('[StartTest] sentAuth=', e?.data?._meta?.sentAuth);
        console.log('[StartTest] redirected=', e?.data?._meta?.redirected);
        console.log('[StartTest] url=', e?.data?._meta?.url);
        console.log('[StartTest] apiCode=', e?.data?.error?.code);
        console.log('[StartTest] apiMessage=', e?.data?.error?.message || e?.data?.message);
        console.log('[StartTest] contentType=', e?.data?._raw?.contentType);
        console.log('[StartTest] bodySnippet=', e?.data?._raw?.bodySnippet);
      }
      const status = e?.status;
      const apiMessage = e?.data?.error?.message || e?.data?.message;
      const apiCode = e?.data?.error?.code;
      const message = apiMessage || e?.message || 'Failed to start test.';
      const redirected = e?.data?._meta?.redirected;
      const url = e?.data?._meta?.url;

      if (status === 401) {
        const contentType = e?.data?._raw?.contentType || '';
        const bodySnippet = e?.data?._raw?.bodySnippet || '';
        const isHtmlAuthPage = contentType.includes('text/html') && bodySnippet.includes('Authentication is required to continue');

        const diag = redirected ? `redirected=${String(redirected)} url=${url || ''}` : '';

        if (isHtmlAuthPage) {
          alert(
            'Backend returned an HTML auth page for /api/v1/tests/{id}/start. ' +
            'This usually means the route is wired to the WEB controller stack (session auth) instead of the API stack (bearer auth), ' +
            'or the API error handler is rendering HTML in debug. Please fix backend routing/Api controller for this endpoint.'
          );
          navigation.navigate('Login');
          return;
        }

        navigation.navigate('Login');
        alert(apiCode ? `${message} (${apiCode}) ${diag}` : `${message} ${diag}`);
        return;
      }

      alert(apiCode ? `${message} (${apiCode})` : message);
    } finally {
      setStartingTestId(null);
    }
  }, [startingTestId, isAuthenticated, authFetch, logout, language, navigation, getCachedTest]);

  const handleStartPractice = useCallback(async (test) => {
    if (startingTestId) {
      return;
    }

    const testId = test?.id;
    if (!testId) {
      return;
    }

    if (!getOnlineStatus()) {
      const cached = getCachedTest(testId);
      if (!cached || !Array.isArray(cached.questions) || cached.questions.length === 0) {
        Alert.alert(
          'Offline',
          'This test is not available offline. Connect to the internet and open the app to cache your favorites.',
        );
        return;
      }

      navigation.navigate('Test', {
        testId,
        attemptId: null,
        offlineQuestions: cached.questions,
        offlineTest: cached,
        practiceMode: true,
      });
      return;
    }

    try {
      setStartingTestId(testId);
      const testDetails = await fetchTestDetails({ testId, language });
      const questions = Array.isArray(testDetails?.questions) ? testDetails.questions : [];

      if (questions.length === 0) {
        Alert.alert('Practice', 'This practice test has no available questions.');
        return;
      }

      navigation.navigate('Test', {
        testId,
        attemptId: null,
        offlineQuestions: questions,
        offlineTest: testDetails,
        practiceMode: true,
      });
    } catch (e) {
      const apiMessage = e?.data?.error?.message || e?.data?.message;
      const message = apiMessage || e?.message || 'Failed to start practice.';
      alert(message);
    } finally {
      setStartingTestId(null);
    }
  }, [startingTestId, getCachedTest, navigation, language]);

  return (
    <TestActionsContext.Provider value={{ startingTestId, handleStartTest, handleStartPractice }}>
      {children}
    </TestActionsContext.Provider>
  );
}

export function useTestActions() {
  const ctx = useContext(TestActionsContext);
  if (!ctx) {
    throw new Error('useTestActions must be used within a TestActionsProvider');
  }
  return ctx;
}
