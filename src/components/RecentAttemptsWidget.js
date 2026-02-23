import { memo, useCallback } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import GlassCard from './GlassCard';
import { useLanguage } from '../hooks/useLanguage';

const rgba = (rgb, a) => `rgba(${rgb}, ${a})`;
const MF_PRIMARY_RGB = '87,93,219';
const MF_TEXT_RGB = '234,233,252';
const MF_SECONDARY_RGB = '91,91,107';

// ─── Score helpers (mirror StatsScreen logic) ────────────────────────────────

const toNumber = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const str = String(value).trim().replace('%', '');
  if (!str) return null;
  const n = Number(str);
  return Number.isFinite(n) ? n : null;
};

const getAttemptLike = (item) =>
  item?.best_attempt ||
  item?.bestAttempt ||
  item?.attempt ||
  item?.last_attempt ||
  item?.lastAttempt ||
  item;

const getCorrectTotal = (item) => {
  const a = getAttemptLike(item);
  const correct = toNumber(a?.correct_answers ?? a?.correctAnswers);
  const total = toNumber(a?.total_questions ?? a?.totalQuestions);
  if (correct === null || total === null) return null;
  return { correct, total };
};

const getPercent = (item) => {
  const a = getAttemptLike(item);
  const direct = toNumber(a?.score ?? a?.best_score ?? a?.bestScore);
  if (direct !== null) return direct;
  const frac = getCorrectTotal(item);
  if (frac && frac.total > 0) return (frac.correct / frac.total) * 100;
  return null;
};

const formatScore = (item) => {
  const frac = getCorrectTotal(item);
  const percent = getPercent(item);
  if (frac) return `${frac.correct}/${frac.total}`;
  if (percent !== null) return `${Math.round(percent)}%`;
  return null;
};

const getTestTitle = (item) =>
  item?.test?.title ||
  item?.quiz?.title ||
  item?.title ||
  item?.test_title ||
  item?.name ||
  'Quiz';

const getTestId = (item) =>
  item?.test_id ||
  item?.test?.id ||
  item?.quiz_id ||
  item?.id ||
  null;

const getScoreColor = (item) => {
  const p = getPercent(item);
  if (p === null) return rgba(MF_SECONDARY_RGB, 0.8);
  if (p >= 80) return rgba('25,135,84', 0.95);
  if (p >= 50) return rgba(MF_PRIMARY_RGB, 0.95);
  return rgba('220,53,69', 0.95);
};

// ─── Row ────────────────────────────────────────────────────────────────────

const AttemptRow = memo(function AttemptRow({ item, onStart }) {
  const title = getTestTitle(item);
  const score = formatScore(item);
  const testId = getTestId(item);
  const scoreColor = getScoreColor(item);
  const { t } = useLanguage();

  const handlePress = useCallback(() => {
    if (testId) onStart({ id: testId });
  }, [onStart, testId]);

  return (
    <View style={styles.row}>
      <View style={styles.dotWrapper}>
        <View style={styles.dot} />
      </View>

      <Text numberOfLines={1} style={styles.rowTitle}>
        {title}
      </Text>

      {score !== null ? (
        <Text style={[styles.scoreBadge, { color: scoreColor }]}>{score}</Text>
      ) : null}

      <Pressable
        onPress={handlePress}
        disabled={!testId}
        hitSlop={8}
        style={({ pressed }) => [styles.startBtn, pressed && styles.startBtnPressed]}
      >
        <Text style={styles.startBtnText}>{t('dashboard.start')}</Text>
      </Pressable>
    </View>
  );
});

// ─── Widget ─────────────────────────────────────────────────────────────────

function RecentAttemptsWidget({ attempts, isLoading, error, onStart }) {
  const { t } = useLanguage();
  const navigation = useNavigation();

  const handleSeeAll = useCallback(
    () => navigation.navigate('Stats'),
    [navigation],
  );

  return (
    <GlassCard style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('dashboard.recentActivity')}</Text>
        <Pressable onPress={handleSeeAll} hitSlop={8}>
          <Text style={styles.seeAllText}>{t('dashboard.seeAll')} →</Text>
        </Pressable>
      </View>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Body */}
      {isLoading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="small" color={rgba(MF_PRIMARY_RGB, 0.9)} />
        </View>
      ) : error ? (
        <View style={styles.centerBox}>
          <Text style={styles.emptyText}>{error}</Text>
        </View>
      ) : attempts.length === 0 ? (
        <View style={styles.centerBox}>
          <Text style={styles.emptyText}>{t('dashboard.noAttempts')}</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {attempts.map((item, idx) => (
            <AttemptRow
              key={String(getTestId(item) ?? idx)}
              item={item}
              onStart={onStart}
            />
          ))}
        </View>
      )}
    </GlassCard>
  );
}

export default memo(RecentAttemptsWidget);

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    marginBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },
  headerTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: rgba(MF_TEXT_RGB, 0.55),
  },
  seeAllText: {
    fontSize: 12,
    fontWeight: '700',
    color: rgba(MF_PRIMARY_RGB, 0.9),
    letterSpacing: 0.2,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: rgba(MF_TEXT_RGB, 0.10),
    marginHorizontal: 16,
  },
  centerBox: {
    paddingVertical: 18,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: rgba(MF_SECONDARY_RGB, 0.9),
    textAlign: 'center',
    lineHeight: 19,
  },
  list: {
    paddingBottom: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 11,
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: rgba(MF_TEXT_RGB, 0.07),
  },
  dotWrapper: {
    width: 8,
    alignItems: 'center',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: rgba(MF_PRIMARY_RGB, 0.75),
  },
  rowTitle: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '700',
    color: rgba(MF_TEXT_RGB, 0.90),
    letterSpacing: -0.1,
  },
  scoreBadge: {
    fontSize: 13,
    fontWeight: '800',
    minWidth: 38,
    textAlign: 'right',
  },
  startBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: rgba(MF_PRIMARY_RGB, 0.18),
    borderWidth: 1,
    borderColor: rgba(MF_PRIMARY_RGB, 0.32),
  },
  startBtnPressed: {
    backgroundColor: rgba(MF_PRIMARY_RGB, 0.32),
  },
  startBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: rgba(MF_TEXT_RGB, 0.92),
    letterSpacing: 0.3,
  },
});
