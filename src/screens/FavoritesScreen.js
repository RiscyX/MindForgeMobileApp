import { StatusBar } from 'expo-status-bar';
import { useCallback } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { cssInterop } from 'nativewind';
import { useLanguage } from '../hooks/useLanguage';
import { useFavorites } from '../context/FavoritesContext';
import { useTestActions } from '../context/TestActionsContext';
import TestCard from '../components/TestCard';
import GlassCard from '../components/GlassCard';

cssInterop(SafeAreaView, { className: 'style' });

export default function FavoritesScreen() {
  const navigation = useNavigation();
  const { t } = useLanguage();
  const { tests, isLoading, error, reload, isFavorite, toggleFavorite } = useFavorites();
  const { startingTestId, handleStartTest } = useTestActions();

  const handleOpenTestDetails = useCallback(
    (test) => navigation.navigate('TestDetails', { testId: test?.id }),
    [navigation],
  );

  const keyExtractor = useCallback((item, idx) => {
    const id = item?.test_id || item?.test?.id || item?.id;
    return String(id ?? idx);
  }, []);

  const renderItem = useCallback(({ item }) => {
    // Normalize: items from the favorites API may have the test nested or flat.
    const test = item?.test ?? item;
    const testId = test?.id ?? item?.test_id;
    const normalizedTest = { ...test, id: testId };

    return (
      <TestCard
        test={normalizedTest}
        difficultyKey={normalizedTest._difficultyKey ?? 'unknown'}
        startingTestId={startingTestId}
        onStart={handleStartTest}
        onOpenDetails={handleOpenTestDetails}
        isFavorite={isFavorite(testId)}
        onToggleFavorite={toggleFavorite}
      />
    );
  }, [startingTestId, handleStartTest, handleOpenTestDetails, isFavorite, toggleFavorite]);

  return (
    <View className="flex-1 bg-transparent">
      <SafeAreaView className="flex-1 px-6" edges={['top', 'left', 'right']}>
        <StatusBar style="light" />

        <View className="mt-6 mb-4">
          <Text className="text-mf-text text-2xl font-solway-extrabold tracking-wide">
            {t('favorites.title')}
          </Text>
          <View className="flex-row items-center justify-between mt-2">
            <Text className="text-mf-secondary text-sm font-solway flex-1">
              {t('favorites.subtitle')}
            </Text>
            <View
              style={{
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: tests.length >= 10
                  ? 'rgba(220,53,69,0.45)'
                  : 'rgba(87,93,219,0.35)',
                backgroundColor: tests.length >= 10
                  ? 'rgba(220,53,69,0.12)'
                  : 'rgba(87,93,219,0.12)',
                marginLeft: 12,
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '800',
                  color: tests.length >= 10
                    ? 'rgba(220,53,69,0.95)'
                    : 'rgba(234,233,252,0.80)',
                }}
              >
                {tests.length} / 10
              </Text>
            </View>
          </View>
        </View>

        {error ? (
          <View className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-4">
            <Text className="text-red-300 font-solway-bold">{error}</Text>
            <Pressable className="mt-3 bg-mf-primary py-3 rounded-xl items-center" onPress={reload}>
              <Text className="text-mf-text font-solway-bold">{t('favorites.refresh')}</Text>
            </Pressable>
          </View>
        ) : null}

        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#575ddb" />
            <Text className="text-mf-secondary font-solway mt-4">{t('common.loading')}</Text>
          </View>
        ) : tests.length === 0 ? (
          <GlassCard style={{ marginTop: 24 }}>
            <View className="p-5">
              <Text className="text-mf-secondary font-solway">{t('favorites.noData')}</Text>
            </View>
          </GlassCard>
        ) : (
          <FlatList
            data={tests}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 120 }}
          />
        )}
      </SafeAreaView>
    </View>
  );
}
