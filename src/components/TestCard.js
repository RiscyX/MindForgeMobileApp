import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLanguage } from '../hooks/useLanguage';

const rgba = (rgb, a) => `rgba(${rgb}, ${a})`;

const MF_PRIMARY_RGB = '87,93,219';
const MF_SECONDARY_RGB = '91,91,107';
const MF_TEXT_RGB = '234,233,252';
const MF_BG_RGB = '1,1,4';

const difficultyStyle = (difficultyKey) => {
  if (difficultyKey === 'hard') {
    return { rgb: '220,53,69' };
  }
  if (difficultyKey === 'medium') {
    return { rgb: MF_PRIMARY_RGB };
  }
  if (difficultyKey === 'easy') {
    return { rgb: '25,135,84' };
  }
  return { rgb: MF_SECONDARY_RGB };
};

export default function TestCard({ test, difficultyKey, isStarting = false, onStart, onOpenDetails }) {
  const { t } = useLanguage();

  const variant = Number(test?.id || 0) % 3;
  const accentAlpha = variant === 0 ? 0.22 : variant === 1 ? 0.16 : 0.12;

  const diff = difficultyStyle(difficultyKey);
  const diffBorder = rgba(diff.rgb, 0.35);
  const diffBg = rgba(diff.rgb, 0.10);
  const diffDot = rgba(diff.rgb, 0.95);

  const title = test?.title || '';
  const description = test?.description || '';
  const category = test?.category || t('common.uncategorized');
  const difficultyLabel = (test?.difficulty && String(test.difficulty).trim() !== '')
    ? String(test.difficulty)
    : t(`difficulty.${difficultyKey}`);

  const questionCount = test?.number_of_questions ?? test?.questions_count ?? null;

  return (
    <View className="mb-4 rounded-3xl overflow-hidden" style={{
      borderRadius: 20,
      shadowColor: '#000',
      shadowOpacity: 0.55,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 10 },
      elevation: 10,
      backgroundColor: '#010104',
      borderWidth: 1,
      borderColor: rgba(MF_TEXT_RGB, 0.10),
    }}>
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} pointerEvents="none">
        <View
          style={{
            position: 'absolute',
            top: -90,
            left: -110,
            width: 340,
            height: 340,
            borderRadius: 170,
            backgroundColor: rgba(MF_PRIMARY_RGB, accentAlpha),
          }}
        />
        <View
          style={{
            position: 'absolute',
            bottom: -140,
            right: -140,
            width: 420,
            height: 420,
            borderRadius: 210,
            backgroundColor: rgba(MF_TEXT_RGB, 0.06),
          }}
        />
        <View
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            right: 0,
            bottom: 0,
            backgroundColor: rgba(MF_TEXT_RGB, 0.03),
          }}
        />
      </View>

      {/* Cover */}
      <View className="p-4 pb-3">
        <View className="flex-row items-center justify-between" style={{ gap: 12 }}>
          <View className="flex-row items-center flex-1 min-w-0">
            <View className="flex-1 min-w-0">
              <Text numberOfLines={1} className="font-solway-bold" style={{
                fontSize: 13.5,
                color: rgba(MF_TEXT_RGB, 0.68),
                fontWeight: '650',
                letterSpacing: 0.2,
              }}>
                {category}
              </Text>
            </View>
          </View>

          <View className="flex-row items-center" style={{ gap: 8 }}>
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: diffBorder,
              backgroundColor: diffBg,
              shadowColor: '#000',
              shadowOpacity: 0.32,
              shadowRadius: 14,
              shadowOffset: { width: 0, height: 8 },
              elevation: 4,
              maxWidth: 210,
            }}>
              <View style={{
                width: 10,
                height: 10,
                borderRadius: 999,
                backgroundColor: diffDot,
                shadowColor: diffDot,
                shadowOpacity: 0.18,
                shadowRadius: 10,
                shadowOffset: { width: 0, height: 0 },
              }} />
              <Text numberOfLines={1} className="font-solway-extrabold" style={{
                color: 'rgba(234, 233, 252, 0.92)',
                fontWeight: '800',
                letterSpacing: -0.1,
                fontSize: 12,
              }}>
                {difficultyLabel}
              </Text>
            </View>

            {questionCount !== null ? (
              <View style={{
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
              }}>
                <Text className="text-mf-text font-solway-extrabold" style={{ fontSize: 12 }}>{Number(questionCount)}</Text>
                <Text className="font-solway" style={{ fontSize: 11.5, color: rgba(MF_TEXT_RGB, 0.72) }}>q</Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>

      {/* Content */}
      <View className="px-4" style={{ paddingTop: 2, paddingBottom: 16, flexGrow: 1 }}>
        <Text
          numberOfLines={2}
          className="font-solway-extrabold"
          style={{
            fontSize: 19,
            lineHeight: 22,
            color: rgba(MF_TEXT_RGB, 0.98),
            letterSpacing: -0.3,
            fontWeight: '900',
          }}
        >
          {title}
        </Text>
        <Text
          numberOfLines={4}
          className="font-solway"
          style={{
            marginTop: 9,
            color: rgba(MF_TEXT_RGB, 0.72),
            lineHeight: 20,
          }}
        >
          {description || t('home.noDescription')}
        </Text>
      </View>

      {/* Actions */}
      <View className="px-4 pb-4" style={{ gap: 10 }}>
        <TouchableOpacity onPress={onStart} activeOpacity={0.9} disabled={isStarting}>
          <LinearGradient
            colors={[rgba(MF_PRIMARY_RGB, 0.92), rgba(MF_PRIMARY_RGB, 0.72)]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
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
            }}
          >
            <View style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: '70%',
              height: '70%',
              backgroundColor: 'rgba(255,255,255,0.12)',
              borderBottomRightRadius: 80,
              opacity: 0.55,
            }} />
            <Text className="text-mf-text font-solway-extrabold" style={{
              textAlign: 'center',
              letterSpacing: 0.8,
              textTransform: 'uppercase',
              fontWeight: '850',
            }}>
              {isStarting ? '' : t('home.startTest')}
            </Text>
            {isStarting ? (
              <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator size="small" color="#eae9fc" />
              </View>
            ) : null}
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity onPress={onOpenDetails} activeOpacity={0.9}>
          <View style={{
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
          }}>
            <Text className="font-solway-extrabold" style={{
              textAlign: 'center',
              color: rgba(MF_TEXT_RGB, 0.92),
              fontWeight: '850',
            }}>
              {t('home.openDetails')}
            </Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}
