import { StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';

/**
 * GlassCard — glassmorphism panel matching the web app's
 * backdrop-filter: blur(10px) + rgba(eae9fc, 0.03–0.05) background.
 *
 * Usage:
 *   <GlassCard style={styles.myCard}>...</GlassCard>
 *
 * Props:
 *   intensity  — blur intensity (default 18, web ≈ 10px)
 *   style      — additional styles for the outer container
 *   children
 */
export default function GlassCard({ intensity = 18, style, children }) {
  return (
    <View style={[styles.container, style]}>
      <BlurView intensity={intensity} tint="dark" style={StyleSheet.absoluteFill} />
      {/* Surface tint overlay: rgba(eae9fc, 0.05) */}
      <View style={styles.surface} pointerEvents="none" />
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(234,233,252,0.10)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  surface: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(234,233,252,0.05)',
  },
  content: {
    // Children render on top of blur + surface
  },
});
