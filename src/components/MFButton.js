import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const PRIMARY_GRADIENT = [
  'rgba(87,93,219,0.92)',
  'rgba(87,93,219,0.72)',
];
const GRADIENT_START = { x: 0.2, y: 0.1 };
const GRADIENT_END = { x: 1, y: 1 };

/**
 * Primary gradient button matching the web app's `.btn-primary` style.
 * Includes LinearGradient, sheen overlay, and press scale animation.
 */
export function GradientButton({ onPress, disabled, loading, label, style }) {
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withTiming(0.97, { duration: 100 });
  };
  const handlePressOut = () => {
    scale.value = withTiming(1, { duration: 160 });
  };

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled || loading}
      style={[animStyle, style]}
    >
      <LinearGradient
        colors={PRIMARY_GRADIENT}
        start={GRADIENT_START}
        end={GRADIENT_END}
        style={styles.gradient}
      >
        {/* Radial sheen overlay — mimics web radial-gradient(120% 140% at 20% 10%, rgba(255,255,255,0.18), transparent 55%) */}
        <View style={styles.sheen} pointerEvents="none" />
        {loading ? (
          <ActivityIndicator size="small" color="#eae9fc" />
        ) : (
          <Text style={styles.label}>{label}</Text>
        )}
      </LinearGradient>
    </AnimatedPressable>
  );
}

/**
 * Secondary outline button matching the web app's `.btn-outline-light` style.
 */
export function OutlineButton({ onPress, disabled, label, style }) {
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withTiming(0.97, { duration: 100 });
  };
  const handlePressOut = () => {
    scale.value = withTiming(1, { duration: 160 });
  };

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      style={[styles.outline, animStyle, style]}
    >
      <Text style={styles.outlineLabel}>{label}</Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  gradient: {
    borderRadius: 15,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(234,233,252,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.44,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  sheen: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: '70%',
    height: '70%',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderBottomRightRadius: 80,
    opacity: 0.6,
  },
  label: {
    color: '#eae9fc',
    fontFamily: 'Solway_800ExtraBold',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  outline: {
    borderRadius: 15,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(234,233,252,0.18)',
    backgroundColor: 'rgba(234,233,252,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  outlineLabel: {
    color: 'rgba(234,233,252,0.92)',
    fontFamily: 'Solway_700Bold',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
