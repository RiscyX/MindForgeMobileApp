import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLanguage } from '../hooks/useLanguage';
import { useAuth } from '../hooks/useAuth';
import AppBottomNav from '../components/AppBottomNav';
import { fetchQuizStatsRequest } from '../services/statsApi';

export default function StatsScreen({ onGoTests, onGoStats, onGoProfile }) {
  const { t } = useLanguage();
  const { language } = useLanguage();
  const { authFetch } = useAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [quizzes, setQuizzes] = useState([]);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await fetchQuizStatsRequest({ authFetch, language });
      const list = Array.isArray(data?.quizzes) ? data.quizzes : [];
      setQuizzes(list);

      if (__DEV__ && list.length > 0) {
        const first = list[0];
        console.log('[Stats] first quiz keys:', first && typeof first === 'object' ? Object.keys(first) : typeof first);
      }
    } catch (e) {
      setError(e?.message || t('profile.loadError'));
    } finally {
      setIsLoading(false);
    }
  }, [authFetch, language, t]);

  useEffect(() => {
    load();
  }, [load]);

  const toNumber = (value) => {
    if (value === null || value === undefined) {
      return null;
    }
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : null;
    }
    const str = String(value).trim().replace('%', '');
    if (!str) {
      return null;
    }
    const n = Number(str);
    return Number.isFinite(n) ? n : null;
  };

  const getScoreValue = (item) => {
    const candidates = [
      item?.best_score,
      item?.bestScore,
      item?.score,
      item?.attempt?.score,
      item?.best_attempt?.score,
      item?.best_attempt?.attempt?.score,
      item?.bestAttempt?.score,
    ];

    for (const c of candidates) {
      const n = toNumber(c);
      if (n !== null) {
        return n;
      }
    }

    return null;
  };

  const getAttemptLike = (item) => {
    return item?.best_attempt
      || item?.bestAttempt
      || item?.attempt
      || item?.last_attempt
      || item?.lastAttempt
      || item;
  };

  const getCorrectTotal = (item) => {
    const a = getAttemptLike(item);
    const correct = toNumber(a?.correct_answers ?? a?.correctAnswers);
    const total = toNumber(a?.total_questions ?? a?.totalQuestions);
    if (correct === null || total === null) {
      return null;
    }
    return { correct, total };
  };

  const getPercent = (item) => {
    const a = getAttemptLike(item);
    const direct = toNumber(a?.score ?? a?.best_score ?? a?.bestScore);
    if (direct !== null) {
      return direct;
    }

    const frac = getCorrectTotal(item);
    if (frac && frac.total > 0) {
      return (frac.correct / frac.total) * 100;
    }

    return null;
  };

  const summary = useMemo(() => {
    let bestItem = null;
    let bestPercent = null;
    for (const q of quizzes) {
      const p = getPercent(q);
      if (p === null) continue;
      if (bestPercent === null || p > bestPercent) {
        bestPercent = p;
        bestItem = q;
      }
    }

    return {
      taken: quizzes.length,
      bestItem,
      bestPercent,
      bestFrac: bestItem ? getCorrectTotal(bestItem) : null,
    };
  }, [quizzes]);

  const formatPercent = (value) => {
    const n = toNumber(value);
    if (n === null) {
      return '—';
    }
    return `${Math.round(n)}%`;
  };

  const formatFraction = (frac) => {
    if (!frac) {
      return null;
    }
    return `${frac.correct}/${frac.total}`;
  };

  const formatDate = (value) => {
    if (!value) {
      return '—';
    }
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) {
      return String(value);
    }
    return d.toLocaleString();
  };

  const getQuizTitle = (item) => {
    return item?.test?.title || item?.quiz?.title || item?.title || item?.test_title || item?.name || 'Quiz';
  };

  const getAttemptsCount = (item) => {
    const n = item?.attempts_count ?? item?.attemptCount ?? item?.attempts ?? item?.count ?? item?.attempts_total;
    const num = toNumber(n);
    return num === null ? null : num;
  };

  const getLastAttemptAt = (item) => {
    return item?.last_attempt_at || item?.lastAttemptAt || item?.attempt?.finished_at || item?.attempt?.finishedAt || null;
  };

  // getScoreValue defined above

  const renderItem = ({ item }) => {
    const frac = getCorrectTotal(item);
    const percent = getPercent(item);
    const attemptsCount = getAttemptsCount(item);
    const lastAt = getLastAttemptAt(item);

    return (
      <View className="mb-4 rounded-2xl border border-mf-secondary/20 bg-mf-secondary/10 p-5">
        <View className="flex-row items-start justify-between">
          <View className="flex-1 pr-3">
            <Text className="text-mf-text font-solway-extrabold text-lg">{getQuizTitle(item)}</Text>
            {attemptsCount !== null ? (
              <Text className="text-mf-secondary font-solway text-sm mt-1">
                {t('stats.attempts')}: {attemptsCount}
              </Text>
            ) : null}
            {lastAt ? (
              <Text className="text-mf-secondary font-solway text-sm mt-1">
                {t('stats.lastAttempt')}: {formatDate(lastAt)}
              </Text>
            ) : null}
          </View>

          <View className="px-3 py-2 rounded-xl border border-mf-primary/30 bg-mf-primary/10">
            <Text className="text-mf-secondary text-xs uppercase tracking-widest font-solway-bold">{t('stats.score')}</Text>
            <Text className="text-mf-text font-solway-extrabold text-lg mt-1">{formatFraction(frac) || formatPercent(percent)}</Text>
            {frac && percent !== null ? (
              <Text className="text-mf-secondary font-solway text-xs mt-1">{formatPercent(percent)}</Text>
            ) : null}
          </View>
        </View>
      </View>
    );
  };

  return (
    <View className="flex-1 bg-transparent">
      <SafeAreaView className="flex-1 px-6" edges={['top', 'left', 'right']}>
        <StatusBar style="light" />

        <View className="mt-6">
          <Text className="text-mf-text text-2xl font-solway-extrabold tracking-wide">{t('stats.title')}</Text>
          <Text className="text-mf-secondary text-sm font-solway mt-2">{t('stats.subtitle')}</Text>
        </View>

        <View className="mt-6 rounded-2xl border border-mf-secondary/20 bg-mf-secondary/10 p-4">
          <Text className="text-mf-secondary text-xs uppercase tracking-widest font-solway-bold">{t('stats.taken')}</Text>
          <Text className="text-mf-text font-solway-extrabold text-2xl mt-2">{summary.taken}</Text>
        </View>

        <View className="mt-3 rounded-2xl border border-mf-secondary/20 bg-mf-secondary/10 p-4">
          <Text className="text-mf-secondary text-xs uppercase tracking-widest font-solway-bold">{t('stats.bestScore')}</Text>
          <Text className="text-mf-text font-solway-extrabold text-2xl mt-2">{formatFraction(summary.bestFrac) || formatPercent(summary.bestPercent)}</Text>
          {summary.bestFrac && summary.bestPercent !== null ? (
            <Text className="text-mf-secondary font-solway text-xs mt-1">{formatPercent(summary.bestPercent)}</Text>
          ) : null}
        </View>

        {error ? (
          <View className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-4">
            <Text className="text-red-300 font-solway-bold">{error}</Text>
            <TouchableOpacity className="mt-3 bg-mf-primary py-3 rounded-xl items-center" onPress={load}>
              <Text className="text-mf-text font-solway-bold">{t('stats.refresh')}</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {isLoading ? (
          <View className="mt-8 items-center">
            <ActivityIndicator size="large" color="#575ddb" />
            <Text className="text-mf-secondary font-solway mt-4">{t('common.loading')}</Text>
          </View>
        ) : quizzes.length === 0 ? (
          <View className="mt-6 rounded-2xl border border-mf-secondary/20 bg-mf-secondary/10 p-5">
            <Text className="text-mf-secondary font-solway">{t('stats.noData')}</Text>
          </View>
        ) : (
          <FlatList
            className="mt-6"
            data={quizzes}
            keyExtractor={(item, idx) => String(item?.test_id || item?.test?.id || item?.quiz_id || item?.id || idx)}
            renderItem={renderItem}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 140 }}
          />
        )}
      </SafeAreaView>

      <AppBottomNav
        active="stats"
        onTestsPress={onGoTests}
        onStatsPress={onGoStats}
        onProfilePress={onGoProfile}
      />
    </View>
  );
}
