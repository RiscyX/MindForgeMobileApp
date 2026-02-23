import { StatusBar } from 'expo-status-bar';
import { useCallback, useMemo, useState } from 'react';
import { Text, View, TouchableOpacity, ActivityIndicator, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useHomeData } from '../hooks/useHomeData';
import { useLanguage } from '../hooks/useLanguage';
import { useTestActions } from '../context/TestActionsContext';

export default function PracticeSelectScreen({
  onStart,
  startingTestId,
}) {
  const { language, t } = useLanguage();
  const { startingTestId: contextStartingTestId, handleStartPractice } = useTestActions();
  const { tests, loading, refreshing, error, refetch } = useHomeData({ language });
  const [selectedCategory, setSelectedCategory] = useState(null);
  const resolvedStartingTestId = startingTestId ?? contextStartingTestId;
  const startHandler = onStart ?? handleStartPractice;

  const categories = useMemo(() => {
    const values = Array.from(new Set((tests || []).map((item) => item?.category).filter(Boolean)));
    return values.sort((a, b) => a.localeCompare(b));
  }, [tests]);

  const testsInCategory = useMemo(() => {
    if (!selectedCategory) return [];
    return (tests || []).filter((item) => item?.category === selectedCategory);
  }, [tests, selectedCategory]);

  const handleStart = useCallback(() => {
    if (!selectedCategory) return;
    if (testsInCategory.length === 0) {
      alert(t('practice.noTestsInCategory'));
      return;
    }
    const randomIndex = Math.floor(Math.random() * testsInCategory.length);
    startHandler(testsInCategory[randomIndex], testsInCategory);
  }, [selectedCategory, startHandler, t, testsInCategory]);

  if (loading) {
    return (
      <View className="flex-1 bg-transparent">
        <SafeAreaView className="flex-1 justify-center items-center" edges={['top', 'left', 'right']}>
          <StatusBar style="light" />
          <ActivityIndicator size="large" color="#575ddb" />
          <Text className="text-mf-secondary mt-4 font-solway">{t('common.loading')}</Text>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-transparent">
      <SafeAreaView className="flex-1" edges={['top', 'left', 'right']}>
        <StatusBar style="light" />
        <View className="flex-1 px-6">
          <View className="mt-8 mb-4">
            <Text className="text-mf-text text-2xl font-solway-extrabold tracking-widest">
              {t('practice.title')}
            </Text>
            <Text className="text-mf-secondary font-solway mt-2">
              {t('practice.subtitle')}
            </Text>
          </View>

          <Text className="text-mf-secondary text-xs uppercase tracking-widest font-solway-bold mb-3">
            {t('practice.selectCategory')}
          </Text>

          <ScrollView
            className="flex-1"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 16 }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={refetch}
                tintColor="#575ddb"
                colors={['#575ddb']}
              />
            }
          >
            {error ? (
              <View className="mb-4 bg-red-500/10 rounded-xl p-3 border border-red-500/30">
                <Text className="text-red-300 text-sm font-solway">{t('home.loadError')}</Text>
              </View>
            ) : null}

            {categories.length === 0 ? (
              <Text className="text-mf-secondary font-solway text-center mt-10">
                {t('home.noTests')}
              </Text>
            ) : (
              categories.map((category) => {
                const isSelected = selectedCategory === category;
                const count = (tests || []).filter((item) => item?.category === category).length;
                return (
                  <TouchableOpacity
                    key={category}
                    className={`mb-3 px-4 py-4 rounded-2xl border ${
                      isSelected
                        ? 'bg-mf-primary/25 border-mf-primary'
                        : 'bg-mf-secondary/10 border-mf-secondary/30'
                    }`}
                    onPress={() => setSelectedCategory(isSelected ? null : category)}
                  >
                    <View className="flex-row items-center justify-between">
                      <Text
                        className={`font-solway-bold text-base ${
                          isSelected ? 'text-mf-text' : 'text-mf-secondary'
                        }`}
                      >
                        {category}
                      </Text>
                      <View className="px-3 py-1 rounded-full bg-mf-secondary/20">
                        <Text className="text-mf-secondary font-solway-bold text-xs">
                          {count}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>

          {selectedCategory ? (
            <View className="pb-4">
              <TouchableOpacity
                className={`py-4 rounded-2xl items-center shadow-xl ${
                  resolvedStartingTestId ? 'bg-mf-primary/50' : 'bg-mf-primary'
                }`}
                onPress={handleStart}
                disabled={Boolean(resolvedStartingTestId)}
              >
                {resolvedStartingTestId ? (
                  <View className="flex-row items-center">
                    <ActivityIndicator size="small" color="#eae9fc" />
                    <Text className="text-mf-text font-solway-bold text-lg ml-2">
                      {t('common.loading')}
                    </Text>
                  </View>
                ) : (
                  <Text className="text-mf-text font-solway-bold text-lg">
                    {t('practice.start')}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      </SafeAreaView>
    </View>
  );
}
