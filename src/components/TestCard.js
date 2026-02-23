import { memo, useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { useLanguage } from '../hooks/useLanguage';

const rgba = (rgb, a) => `rgba(${rgb}, ${a})`;

const MF_PRIMARY_RGB = '87,93,219';
const MF_SECONDARY_RGB = '91,91,107';
const MF_TEXT_RGB = '234,233,252';

const GRADIENT_START = { x: 0, y: 0 };
const GRADIENT_END = { x: 1, y: 1 };
const GRADIENT_COLORS = [rgba(MF_PRIMARY_RGB, 0.92), rgba(MF_PRIMARY_RGB, 0.72)];

const DIFFICULTY_STYLES = {
  hard: { rgb: '220,53,69' },
  medium: { rgb: MF_PRIMARY_RGB },
  easy: { rgb: '25,135,84' },
};

const getDifficultyStyle = (key) => DIFFICULTY_STYLES[key] || { rgb: MF_SECONDARY_RGB };

function TestCard({ test, difficultyKey, startingTestId, onStart, onOpenDetails, isFavorite, onToggleFavorite }) {
  const { t } = useLanguage();
  const isStarting = Boolean(startingTestId) && String(startingTestId) === String(test?.id);

  const variant = Number(test?.id || 0) % 3;
  const accentAlpha = variant === 0 ? 0.22 : variant === 1 ? 0.16 : 0.12;

  const diff = getDifficultyStyle(difficultyKey);

  const dynamicStyles = useMemo(() => ({
    accentCircle: { backgroundColor: rgba(MF_PRIMARY_RGB, accentAlpha) },
    diffBadge: {
      borderColor: rgba(diff.rgb, 0.35),
      backgroundColor: rgba(diff.rgb, 0.10),
    },
    diffDot: {
      backgroundColor: rgba(diff.rgb, 0.95),
      shadowColor: rgba(diff.rgb, 0.95),
    },
  }), [accentAlpha, diff.rgb]);

  const title = test?.title || '';
  const description = test?.description || '';
  const category = test?.category || t('common.uncategorized');
  const difficultyLabel = (test?.difficulty && String(test.difficulty).trim() !== '')
    ? String(test.difficulty)
    : t(`difficulty.${difficultyKey}`);

  const questionCount = test?.number_of_questions ?? test?.questions_count ?? null;

  return (
    <View className="mb-4 rounded-3xl overflow-hidden" style={styles.card}>
      <View style={styles.decorationContainer} pointerEvents="none">
        <View style={[styles.accentCircle, dynamicStyles.accentCircle]} />
        <View style={styles.textGlowCircle} />
        <View style={styles.overlayTint} />
      </View>

      {/* Cover */}
      <View className="p-4 pb-3">
        <View className="flex-row items-center justify-between" style={styles.coverRow}>
          <View className="flex-row items-center flex-1 min-w-0">
            <View className="flex-1 min-w-0">
              <Text numberOfLines={1} className="font-solway-bold" style={styles.categoryText}>
                {category}
              </Text>
            </View>
          </View>

          <View className="flex-row items-center" style={styles.badgeRow}>
            <View style={[styles.diffBadge, dynamicStyles.diffBadge]}>
              <View style={[styles.diffDot, dynamicStyles.diffDot]} />
              <Text numberOfLines={1} className="font-solway-extrabold" style={styles.diffText}>
                {difficultyLabel}
              </Text>
            </View>

            {questionCount != null ? (
              <View style={styles.countBadge}>
                <Text className="text-mf-text font-solway-extrabold" style={styles.countNumber}>{Number(questionCount)}</Text>
                <Text className="font-solway" style={styles.countLabel}>q</Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>

      {/* Content */}
      <View className="px-4" style={styles.contentSection}>
        <Text numberOfLines={2} className="font-solway-extrabold" style={styles.titleText}>
          {title}
        </Text>
        <Text numberOfLines={4} className="font-solway" style={styles.descriptionText}>
          {description || t('home.noDescription')}
        </Text>
      </View>

      {/* Actions */}
      <View className="px-4 pb-4" style={styles.actionsRow}>
        <View style={styles.primaryRow}>
          <Pressable onPress={() => onStart(test)} disabled={isStarting} style={styles.primaryButtonWrapper}>
            <LinearGradient
              colors={GRADIENT_COLORS}
              start={GRADIENT_START}
              end={GRADIENT_END}
              style={styles.primaryButton}
            >
              <View style={styles.buttonSheen} />
              <Text className="text-mf-text font-solway-extrabold" style={styles.primaryButtonText}>
                {isStarting ? '' : t('home.startTest')}
              </Text>
              {isStarting ? (
                <View style={styles.loadingOverlay}>
                  <ActivityIndicator size="small" color="#eae9fc" />
                </View>
              ) : null}
            </LinearGradient>
          </Pressable>

          {onToggleFavorite ? (
            <Pressable onPress={() => onToggleFavorite(test)} style={styles.favoriteButton} hitSlop={8}>
              <Svg width={22} height={22} viewBox="0 0 24 24" fill={isFavorite ? '#575ddb' : 'none'}>
                <Path
                  d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
                  stroke={isFavorite ? '#575ddb' : rgba(MF_TEXT_RGB, 0.55)}
                  strokeWidth={1.8}
                  fill={isFavorite ? '#575ddb' : 'none'}
                />
              </Svg>
            </Pressable>
          ) : null}
        </View>

        <Pressable onPress={() => onOpenDetails(test)}>
          <View style={styles.secondaryButton}>
            <Text className="font-solway-extrabold" style={styles.secondaryButtonText}>
              {t('home.openDetails')}
            </Text>
          </View>
        </Pressable>
      </View>
    </View>
  );
}

export default memo(TestCard);

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    shadowColor: '#000',
    shadowOpacity: 0.55,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
    backgroundColor: 'rgba(234,233,252,0.05)',
    borderWidth: 1,
    borderColor: rgba(MF_TEXT_RGB, 0.10),
  },
  decorationContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  accentCircle: {
    position: 'absolute',
    top: -90,
    left: -110,
    width: 340,
    height: 340,
    borderRadius: 170,
  },
  textGlowCircle: {
    position: 'absolute',
    bottom: -140,
    right: -140,
    width: 420,
    height: 420,
    borderRadius: 210,
    backgroundColor: rgba(MF_TEXT_RGB, 0.06),
  },
  overlayTint: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    backgroundColor: rgba(MF_TEXT_RGB, 0.03),
  },
  coverRow: {
    gap: 12,
  },
  categoryText: {
    fontSize: 13.5,
    color: rgba(MF_TEXT_RGB, 0.68),
    fontWeight: '650',
    letterSpacing: 0.2,
  },
  badgeRow: {
    gap: 8,
  },
  diffBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.32,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
    maxWidth: 210,
  },
  diffDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  diffText: {
    color: rgba(MF_TEXT_RGB, 0.92),
    fontWeight: '800',
    letterSpacing: -0.1,
    fontSize: 12,
  },
  countBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: rgba(MF_PRIMARY_RGB, 0.25),
    backgroundColor: rgba(MF_PRIMARY_RGB, 0.10),
    shadowColor: '#000',
    shadowOpacity: 0.32,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  countNumber: {
    fontSize: 12,
  },
  countLabel: {
    fontSize: 11.5,
    color: rgba(MF_TEXT_RGB, 0.72),
  },
  contentSection: {
    paddingTop: 2,
    paddingBottom: 16,
    flexGrow: 1,
  },
  titleText: {
    fontSize: 19,
    lineHeight: 22,
    color: rgba(MF_TEXT_RGB, 0.98),
    letterSpacing: -0.3,
    fontWeight: '900',
  },
  descriptionText: {
    marginTop: 9,
    color: rgba(MF_TEXT_RGB, 0.72),
    lineHeight: 20,
  },
  actionsRow: {
    gap: 10,
  },
  primaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  primaryButtonWrapper: {
    flex: 1,
  },
  primaryButton: {
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: rgba(MF_TEXT_RGB, 0.12),
    shadowColor: '#000',
    shadowOpacity: 0.44,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
    overflow: 'hidden',
  },
  buttonSheen: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: '70%',
    height: '70%',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderBottomRightRadius: 80,
    opacity: 0.55,
  },
  primaryButtonText: {
    textAlign: 'center',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    fontWeight: '850',
  },
  loadingOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButton: {
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: rgba(MF_TEXT_RGB, 0.18),
    backgroundColor: rgba(MF_TEXT_RGB, 0.04),
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  favoriteButton: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: rgba(MF_TEXT_RGB, 0.18),
    backgroundColor: rgba(MF_TEXT_RGB, 0.04),
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  secondaryButtonText: {
    textAlign: 'center',
    color: rgba(MF_TEXT_RGB, 0.92),
    fontWeight: '850',
  },
});
