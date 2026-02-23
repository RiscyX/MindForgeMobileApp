import { StatusBar } from 'expo-status-bar';
import { useCallback, useMemo, useState } from 'react';
import { Text, View, ActivityIndicator, FlatList, RefreshControl, ScrollView, TextInput, Keyboard, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { cssInterop } from 'nativewind';
import { useHomeData } from '../hooks/useHomeData';
import { useRecentAttempts } from '../hooks/useRecentAttempts';
import { useLanguage } from '../hooks/useLanguage';
import { useAuth } from '../hooks/useAuth';
import { useTestActions } from '../context/TestActionsContext';
import { useFavorites } from '../context/FavoritesContext';
import TestCard from '../components/TestCard';
import GlassCard from '../components/GlassCard';
import RecentAttemptsWidget from '../components/RecentAttemptsWidget';

cssInterop(SafeAreaView, { className: 'style' });

export default function HomeScreen() {
  const navigation = useNavigation();
  const { language, t } = useLanguage();
  const { user, isAuthenticated, authFetch } = useAuth();
  const { startingTestId, handleStartTest } = useTestActions();
  const { isFavorite, toggleFavorite } = useFavorites();
  const { data, tests, loading, refreshing, error, refetch } = useHomeData({ language });
  const {
    attempts,
    isLoading: attemptsLoading,
    error: attemptsError,
    refetch: refetchAttempts,
  } = useRecentAttempts({ authFetch, language, isAuthenticated });
  const canCreateTests = Boolean(isAuthenticated && (user?.role_id === 1 || user?.role_id === 2));
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [categoryInput, setCategoryInput] = useState('');
  const [isCategoryListOpen, setIsCategoryListOpen] = useState(false);
  const [selectedDifficulty, setSelectedDifficulty] = useState('all');

  const closeCategoryDropdown = useCallback(() => {
    setIsCategoryListOpen(false);
    Keyboard.dismiss();
  }, []);

  const categories = useMemo(() => {
    const values = Array.from(new Set((tests || []).map((item) => item?.category).filter(Boolean)));
    return values.sort((a, b) => a.localeCompare(b));
  }, [tests]);

  const getDifficultyKey = useCallback((item) => {
    const fromNumber = (n) => {
      if (n === 1) return 'easy';
      if (n === 2) return 'medium';
      if (n === 3) return 'hard';
      return 'unknown';
    };

    const numeric = Number(item?.difficulty_level ?? item?.difficulty_id);
    if (!Number.isNaN(numeric) && Number.isFinite(numeric) && numeric > 0) {
      return fromNumber(numeric);
    }

    const raw = String(item?.difficulty ?? item?.difficulty_name ?? '').trim().toLowerCase();
    const normalized = raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    if (['hard', 'difficult', 'advanced', 'expert', 'nehez'].some((x) => normalized.includes(x))) {
      return 'hard';
    }
    if (['medium', 'intermediate', 'kozepes', 'kozepsu'].some((x) => normalized.includes(x))) {
      return 'medium';
    }
    if (['easy', 'beginner', 'konnyu'].some((x) => normalized.includes(x))) {
      return 'easy';
    }

    return 'unknown';
  }, []);

  const testsWithDifficulty = useMemo(() => {
    return (tests || []).map((item) => ({
      ...item,
      _difficultyKey: getDifficultyKey(item),
    }));
  }, [getDifficultyKey, tests]);

  const difficulties = useMemo(() => {
    const order = ['easy', 'medium', 'hard', 'unknown'];
    const values = Array.from(new Set((testsWithDifficulty || []).map((item) => item?._difficultyKey).filter(Boolean)));
    return values.sort((a, b) => order.indexOf(a) - order.indexOf(b));
  }, [testsWithDifficulty]);

  const normalizedCategoryInput = categoryInput.trim().toLowerCase();

  const matchingCategories = useMemo(() => {
    if (!normalizedCategoryInput) {
      return categories;
    }
    return categories.filter((category) => category.toLowerCase().includes(normalizedCategoryInput));
  }, [categories, normalizedCategoryInput]);

  const filteredTests = useMemo(() => {
    return (testsWithDifficulty || []).filter((item) => {
      const bySelectedCategory = selectedCategory === 'all' || item?.category === selectedCategory;
      const byTypedCategory = !normalizedCategoryInput || (item?.category || '').toLowerCase().includes(normalizedCategoryInput);
      const categoryOk = bySelectedCategory && byTypedCategory;
      const difficultyOk = selectedDifficulty === 'all' || item?._difficultyKey === selectedDifficulty;
      return categoryOk && difficultyOk;
    });
  }, [normalizedCategoryInput, selectedCategory, selectedDifficulty, testsWithDifficulty]);

  const handleCategoryPick = (category) => {
    if (category === 'all') {
      setSelectedCategory('all');
      setCategoryInput('');
    } else {
      setSelectedCategory(category);
      setCategoryInput(category);
    }
    setIsCategoryListOpen(false);
  };

  const handleOpenTestDetails = useCallback((test) => {
    navigation.navigate('TestDetails', { testId: test?.id });
  }, [navigation]);

  const handleRefresh = useCallback(() => {
    refetch();
    refetchAttempts();
  }, [refetch, refetchAttempts]);

  const keyExtractor = useCallback((item) => String(item.id), []);

  const renderTestCard = useCallback(({ item }) => {
    return (
      <TestCard
        test={item}
        difficultyKey={item._difficultyKey}
        startingTestId={startingTestId}
        onStart={handleStartTest}
        onOpenDetails={handleOpenTestDetails}
        isFavorite={isFavorite(item.id)}
        onToggleFavorite={toggleFavorite}
      />
    );
  }, [startingTestId, handleStartTest, handleOpenTestDetails, isFavorite, toggleFavorite]);

  if (loading) {
    return (
      <View className="flex-1 bg-mf-bg justify-center items-center">
        <ActivityIndicator size="large" color="#575ddb" />
        <Text className="text-mf-secondary mt-4">{t('common.loading')}</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-transparent">
      {isCategoryListOpen ? (
        <Pressable
          style={[StyleSheet.absoluteFill, { zIndex: 10 }]}
          onPress={closeCategoryDropdown}
        />
      ) : null}

      <SafeAreaView className="flex-1 px-6" edges={['top', 'left', 'right']}>
        <StatusBar style="light" />

        <FlatList
          data={filteredTests}
          keyExtractor={keyExtractor}
          renderItem={renderTestCard}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          onScrollBeginDrag={closeCategoryDropdown}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#575ddb"
              colors={['#575ddb']}
            />
          }
          ListHeaderComponent={
            <>
              <GlassCard style={{ marginTop: 32, marginBottom: 24 }}>
                <View className="p-5">
                  <Text className="text-mf-text text-center text-base italic font-solway">
                    "{data?.dailyQuote}"
                  </Text>
                </View>
              </GlassCard>

              {isAuthenticated ? (
                <RecentAttemptsWidget
                  attempts={attempts}
                  isLoading={attemptsLoading}
                  error={attemptsError}
                  onStart={handleStartTest}
                />
              ) : null}

              <Text className="text-mf-text text-xl font-solway-bold mb-2">{t('home.availableTests')}</Text>

              {canCreateTests ? (
                <Pressable
                  className="mb-4 self-start px-4 py-3 rounded-2xl border border-mf-primary/30 bg-mf-primary/10"
                  onPress={() => navigation.navigate('CreateTest')}
                >
                  <Text className="text-mf-text font-solway-extrabold text-xs uppercase tracking-widest">{t('home.newTest')}</Text>
                </Pressable>
              ) : null}

              <View className="mb-5">
                <Text className="text-mf-secondary text-xs uppercase tracking-widest font-solway-bold mb-2">{t('home.categoryFilter')}</Text>
                <View className="rounded-xl border border-mf-secondary/30 bg-mf-secondary/10 px-3 py-2">
                  <TextInput
                    className="text-mf-text font-solway"
                    placeholder={t('home.categorySearchPlaceholder')}
                    placeholderTextColor="#8a89a2"
                    value={categoryInput}
                    onFocus={() => setIsCategoryListOpen(true)}
                    onBlur={() => setIsCategoryListOpen(false)}
                    onChangeText={(text) => {
                      setCategoryInput(text);
                      setIsCategoryListOpen(true);
                      if (selectedCategory !== 'all' && text !== selectedCategory) {
                        setSelectedCategory('all');
                      }
                    }}
                  />
                </View>
                {isCategoryListOpen ? (
                  <View style={{ zIndex: 20, elevation: 20 }} className="mt-2 rounded-xl border border-mf-secondary/30 bg-mf-bg/95 p-2 max-h-44">
                    <Pressable
                      className={`mb-2 px-3 py-2 rounded-lg border ${selectedCategory === 'all' && !normalizedCategoryInput ? 'bg-mf-primary border-mf-primary' : 'bg-mf-secondary/10 border-mf-secondary/30'}`}
                      onPress={() => handleCategoryPick('all')}
                    >
                      <Text className={`font-solway-bold text-xs uppercase tracking-wider ${selectedCategory === 'all' && !normalizedCategoryInput ? 'text-mf-text' : 'text-mf-secondary'}`}>
                        {t('home.all')}
                      </Text>
                    </Pressable>

                    <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
                      {matchingCategories.length > 0 ? (
                        matchingCategories.map((category) => (
                          <Pressable
                            key={category}
                            className={`mb-2 px-3 py-2 rounded-lg border ${selectedCategory === category ? 'bg-mf-primary border-mf-primary' : 'bg-mf-secondary/10 border-mf-secondary/30'}`}
                            onPress={() => handleCategoryPick(category)}
                          >
                            <Text className={`font-solway-bold text-xs uppercase tracking-wider ${selectedCategory === category ? 'text-mf-text' : 'text-mf-secondary'}`}>
                              {category}
                            </Text>
                          </Pressable>
                        ))
                      ) : (
                        <Text className="text-mf-secondary font-solway text-sm px-2 py-2">{t('home.noCategoryMatches')}</Text>
                      )}
                    </ScrollView>
                  </View>
                ) : null}
              </View>

              <View className="mb-5">
                <Text className="text-mf-secondary text-xs uppercase tracking-widest font-solway-bold mb-2">{t('home.difficultyFilter')}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 8 }} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
                  <Pressable
                    className={`mr-2 px-3 py-2 rounded-lg border ${selectedDifficulty === 'all' ? 'bg-mf-primary border-mf-primary' : 'bg-mf-secondary/10 border-mf-secondary/30'}`}
                    onPress={() => setSelectedDifficulty('all')}
                  >
                    <Text className={`font-solway-bold text-xs uppercase tracking-wider ${selectedDifficulty === 'all' ? 'text-mf-text' : 'text-mf-secondary'}`}>
                      {t('home.all')}
                    </Text>
                  </Pressable>
                  {difficulties.map((difficultyKey) => (
                    <Pressable
                      key={difficultyKey}
                      className={`mr-2 px-3 py-2 rounded-lg border ${selectedDifficulty === difficultyKey ? 'bg-mf-primary border-mf-primary' : 'bg-mf-secondary/10 border-mf-secondary/30'}`}
                      onPress={() => setSelectedDifficulty(difficultyKey)}
                    >
                      <Text className={`font-solway-bold text-xs uppercase tracking-wider ${selectedDifficulty === difficultyKey ? 'text-mf-text' : 'text-mf-secondary'}`}>
                        {t(`difficulty.${difficultyKey}`)}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>

              {error ? (
                <View className="mb-4 w-full bg-red-500/10 rounded-xl p-3 border border-red-500/30">
                  <Text className="text-red-300 text-sm font-solway">{t('home.loadError')}</Text>
                </View>
              ) : null}
            </>
          }
          ListEmptyComponent={
            <Text className="text-mf-secondary font-solway text-center mt-10">{tests.length > 0 ? t('home.noFilteredTests') : t('home.noTests')}</Text>
          }
          contentContainerStyle={{ paddingBottom: 120 }}
        />
      </SafeAreaView>
    </View>
  );
}
