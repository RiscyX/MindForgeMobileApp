import { Text, View, Pressable, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { useLanguage } from '../hooks/useLanguage';
import { useAuth } from '../hooks/useAuth';

function AnimatedTabButton({ tabName, isActive, label, onPress }) {
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[{ flex: 1 }, animStyle]}>
      <Pressable
        className={`rounded-xl py-3 items-center ${isActive ? 'bg-mf-primary' : 'bg-transparent'}`}
        onPress={onPress}
        onPressIn={() => { scale.value = withTiming(0.93, { duration: 80 }); }}
        onPressOut={() => { scale.value = withTiming(1, { duration: 160 }); }}
      >
        <Text className={`font-solway-bold text-sm ${isActive ? 'text-mf-text' : 'text-mf-secondary'}`}>
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

export default function CustomTabBar({ state, descriptors, navigation }) {
  const { t } = useLanguage();
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
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

  const tabKeys = ['Home', 'Stats', 'Profile', 'Favorites'];
  const tabLabels = {
    Home: t('nav.tests'),
    Stats: t('nav.stats'),
    Profile: t('nav.profile'),
    Favorites: t('nav.favorites'),
  };

  return (
    <View className="w-full px-6 pb-6">
      <View style={styles.barContainer}>
        <BlurView intensity={22} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={styles.barSurface} pointerEvents="none" />
        <View style={styles.barRow}>
          {tabKeys.map((tabName) => {
            const isActive = state.routes[state.index]?.name === tabName;
            return (
              <AnimatedTabButton
                key={tabName}
                tabName={tabName}
                isActive={isActive}
                label={tabLabels[tabName]}
                onPress={() => navigation.navigate(tabName)}
              />
            );
          })}
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
