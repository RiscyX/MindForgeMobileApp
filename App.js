import { useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import './globals.css';
import HomeScreen from './src/screens/HomeScreen';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import StatsScreen from './src/screens/StatsScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import TestScreen from './src/screens/TestScreen';
import TestDetailsScreen from './src/screens/TestDetailsScreen';
import CreateTestScreen from './src/screens/CreateTestScreen';
import PracticeSelectScreen from './src/screens/PracticeSelectScreen';
import AppBackground from './src/components/AppBackground';
import {
  useFonts,
  Solway_300Light,
  Solway_400Regular,
  Solway_500Medium,
  Solway_700Bold,
  Solway_800ExtraBold,
} from '@expo-google-fonts/solway';
import { AuthProvider } from './src/context/AuthContext';
import { useAuth } from './src/hooks/useAuth';
import { LanguageProvider } from './src/context/LanguageContext';
import { useLanguage } from './src/hooks/useLanguage';
import { startAttemptRequest } from './src/services/attemptsApi';

function AppContent() {
  const { user, isAuthenticated, isBootstrapping, authFetch, login, register, logout } = useAuth();
  const { t, language, isLanguageReady } = useLanguage();
  const [currentScreen, setCurrentScreen] = useState('Home');
  const [activeTestId, setActiveTestId] = useState(null);
  const [activeAttemptId, setActiveAttemptId] = useState(null);
  const [startingTestId, setStartingTestId] = useState(null);
  const [practiceCategoryTests, setPracticeCategoryTests] = useState([]);
  const [practiceScore, setPracticeScore] = useState({ correct: 0, total: 0 });

  const handleStartTest = async (test, { practice = false } = {}) => {
    if (startingTestId) {
      return;
    }

    if (!isAuthenticated) {
      setCurrentScreen('Login');
      return;
    }

    const testId = test?.id;
    if (!testId) {
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
          setCurrentScreen('Login');
          const msg = apiMessage || meError?.message || 'Authentication required.';
          alert(apiCode ? `${msg} (${apiCode})` : msg);
          return;
        }
      }

      const attempt = await startAttemptRequest({ authFetch, testId, language });
      if (!attempt?.id) {
        throw new Error('Could not start test attempt.');
      }

      setActiveTestId(testId);
      setActiveAttemptId(attempt.id);
      setCurrentScreen(practice ? 'PracticeTest' : 'Test');
    } catch (e) {
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
      const status = e?.status;
      const apiMessage = e?.data?.error?.message || e?.data?.message;
      const apiCode = e?.data?.error?.code;
      const message = apiMessage || e?.message || 'Failed to start test.';
      const sentAuth = e?.data?._meta?.sentAuth;
      const redirected = e?.data?._meta?.redirected;
      const url = e?.data?._meta?.url;

      if (status === 401) {
        const contentType = e?.data?._raw?.contentType || '';
        const bodySnippet = e?.data?._raw?.bodySnippet || '';
        const isHtmlAuthPage = contentType.includes('text/html') && bodySnippet.includes('Authentication is required to continue');

        // If /auth/me is OK but start is 401, do not force-logout (it creates a loop).
        const diag = redirected ? `redirected=${String(redirected)} url=${url || ''}` : '';

        if (isHtmlAuthPage) {
          alert(
            'Backend returned an HTML auth page for /api/v1/tests/{id}/start. ' +
            'This usually means the route is wired to the WEB controller stack (session auth) instead of the API stack (bearer auth), ' +
            'or the API error handler is rendering HTML in debug. Please fix backend routing/Api controller for this endpoint.'
          );
          setCurrentScreen('Login');
          return;
        }

        setCurrentScreen('Login');
        alert(apiCode ? `${message} (${apiCode}) ${diag}` : `${message} ${diag}`);
        return;
      }

      alert(apiCode ? `${message} (${apiCode})` : message);
    } finally {
      setStartingTestId(null);
    }
  };

  const handleLogin = async ({ email, password }) => {
    try {
      await login({ email, password });
      setCurrentScreen('Home');
    } catch (e) {
      const msg = e?.data?.error?.message || e?.data?.message || e?.message || t('login.loginFailed');
      throw new Error(msg);
    }
  };

  const handleRegister = async ({ email, password, passwordConfirm }) => {
    await register({
      email,
      password,
      passwordConfirm,
      lang: language,
      deviceName: 'MindForge Mobile App',
    });
    setCurrentScreen('Login');
  };

  const handleBackToHome = () => {
    setCurrentScreen('Home');
  };

  const handleOpenTestDetails = (test) => {
    setActiveTestId(test?.id);
    setCurrentScreen('TestDetails');
  };

  const handleOpenTestDetailsById = (testId) => {
    if (!testId) {
      return;
    }
    setActiveTestId(testId);
    setCurrentScreen('TestDetails');
  };

  const handleGoToCreateTest = () => {
    setCurrentScreen('CreateTest');
  };

  const handleBackFromDetails = () => {
    setCurrentScreen('Home');
  };

  const handleExitTest = () => {
    setActiveTestId(null);
    setActiveAttemptId(null);
    setCurrentScreen('Home');
  };

  const handleExitPractice = () => {
    setActiveTestId(null);
    setActiveAttemptId(null);
    setPracticeCategoryTests([]);
    setPracticeScore({ correct: 0, total: 0 });
    setCurrentScreen('Practice');
  };

  const handleGoToPractice = () => {
    setCurrentScreen('Practice');
  };

  const handleStartPractice = (test, categoryTests) => {
    setPracticeCategoryTests(categoryTests || []);
    setPracticeScore({ correct: 0, total: 0 });
    handleStartTest(test, { practice: true });
  };

  const handlePracticeNext = async ({ correct, total }) => {
    setPracticeScore(prev => ({
      correct: prev.correct + (correct || 0),
      total: prev.total + (total || 0),
    }));

    if (practiceCategoryTests.length === 0) {
      handleExitPractice();
      return;
    }

    const randomTest = practiceCategoryTests[Math.floor(Math.random() * practiceCategoryTests.length)];
    try {
      const attempt = await startAttemptRequest({ authFetch, testId: randomTest.id, language });
      if (!attempt?.id) {
        handleExitPractice();
        return;
      }
      setActiveTestId(randomTest.id);
      setActiveAttemptId(attempt.id);
    } catch (e) {
      console.warn('Practice next failed:', e);
      handleExitPractice();
    }
  };

  const handleGoToLogin = () => {
    setCurrentScreen('Login');
  };

  const handleGoToRegister = () => {
    setCurrentScreen('Register');
  };

  const handleGoToTests = () => {
    setCurrentScreen('Home');
  };

  const handleGoToStats = () => {
    setCurrentScreen('Stats');
  };

  const handleGoToProfile = () => {
    setCurrentScreen('Profile');
  };

  const handleLogout = async () => {
    await logout();
    setCurrentScreen('Home');
  };

  if (isBootstrapping || !isLanguageReady) {
    return (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" color="#575ddb" />
      </View>
    );
  }

  const activeScreen = !isAuthenticated && (
    currentScreen === 'Stats'
    || currentScreen === 'Profile'
    || currentScreen === 'Test'
    || currentScreen === 'TestDetails'
    || currentScreen === 'CreateTest'
    || currentScreen === 'Practice'
    || currentScreen === 'PracticeTest'
  )
    ? 'Login'
    : currentScreen;

  let content;
  switch (activeScreen) {
    case 'Login':
      content = (
        <LoginScreen
          onLogin={handleLogin}
          onBack={handleBackToHome}
          onGoLogin={handleGoToLogin}
          onGoRegister={handleGoToRegister}
        />
      );
      break;
    case 'Register':
      content = (
        <RegisterScreen
          onBack={handleBackToHome}
          onGoLogin={handleGoToLogin}
          onGoRegister={handleGoToRegister}
          onRegister={handleRegister}
        />
      );
      break;
    case 'Stats':
      content = (
        <StatsScreen
          onGoTests={handleGoToTests}
          onGoPractice={handleGoToPractice}
          onGoStats={handleGoToStats}
          onGoProfile={handleGoToProfile}
        />
      );
      break;
    case 'Profile':
      content = (
        <ProfileScreen
          user={user}
          onLogout={handleLogout}
          onGoTests={handleGoToTests}
          onGoPractice={handleGoToPractice}
          onGoStats={handleGoToStats}
          onGoProfile={handleGoToProfile}
        />
      );
      break;
    case 'Test':
      content = (
        <TestScreen
          attemptId={activeAttemptId}
          testId={activeTestId}
          onRetry={async () => {
            if (!activeTestId) return;
            await handleStartTest({ id: activeTestId });
          }}
          onExit={handleExitTest}
        />
      );
      break;
    case 'TestDetails':
      content = (
        <TestDetailsScreen
          testId={activeTestId}
          onBack={handleBackFromDetails}
          onStart={() => handleStartTest({ id: activeTestId })}
        />
      );
      break;
    case 'CreateTest':
      content = (
        <CreateTestScreen
          onBack={handleBackToHome}
          onOpenTestDetails={handleOpenTestDetailsById}
        />
      );
      break;
    case 'Practice':
      content = (
        <PracticeSelectScreen
          onStart={handleStartPractice}
          startingTestId={startingTestId}
          onGoTests={handleGoToTests}
          onGoPractice={handleGoToPractice}
          onGoStats={handleGoToStats}
          onGoProfile={handleGoToProfile}
        />
      );
      break;
    case 'PracticeTest':
      content = (
        <TestScreen
          attemptId={activeAttemptId}
          testId={activeTestId}
          isPractice={true}
          practiceScore={practiceScore}
          onPracticeNext={handlePracticeNext}
          onExit={handleExitPractice}
        />
      );
      break;
    case 'Home':
    default:
      content = (
        <HomeScreen
          onStartTest={handleStartTest}
          onOpenTestDetails={handleOpenTestDetails}
          startingTestId={startingTestId}
          user={user}
          onGoCreateTest={handleGoToCreateTest}
          isLoggedIn={isAuthenticated}
          onGoLogin={handleGoToLogin}
          onGoRegister={handleGoToRegister}
          onGoTests={handleGoToTests}
          onGoPractice={handleGoToPractice}
          onGoStats={handleGoToStats}
          onGoProfile={handleGoToProfile}
        />
      );
      break;
  }

  return content;
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Solway_300Light,
    Solway_400Regular,
    Solway_500Medium,
    Solway_700Bold,
    Solway_800ExtraBold,
  });

  if (!fontsLoaded) {
    return (
      <AppBackground>
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#575ddb" />
        </View>
      </AppBackground>
    );
  }

  return (
    <AppBackground>
      <LanguageProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </LanguageProvider>
    </AppBackground>
  );
}
