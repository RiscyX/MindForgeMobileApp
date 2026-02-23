import { Text, View, Pressable, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { useLanguage } from '../hooks/useLanguage';
import { useAuth } from '../hooks/useAuth';

export default function CustomTabBar({ navigation }) {
  const { t } = useLanguage();
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return null;
  }

  return (
    <View className="w-full px-6 pb-6">
      <View style={styles.barContainer}>
        <BlurView intensity={22} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={styles.barSurface} pointerEvents="none" />
        <View style={styles.barRow}>
          <Pressable
            className="flex-1 rounded-xl py-3 items-center bg-mf-primary"
            onPress={() => navigation.navigate('Login')}
          >
            <Text className="font-solway-bold text-sm text-mf-text">
              {t('common.login')}
            </Text>
          </Pressable>

          <Pressable
            className="flex-1 rounded-xl py-3 items-center bg-transparent"
            onPress={() => navigation.navigate('Register')}
          >
            <Text className="font-solway-bold text-sm text-mf-secondary">
              {t('common.register')}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  barContainer: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(234,233,252,0.10)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  barSurface: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(1,1,4,0.75)',
  },
  barRow: {
    flexDirection: 'row',
    padding: 6,
  },
});
