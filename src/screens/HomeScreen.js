import { StatusBar } from 'expo-status-bar';
import { useCallback, useMemo, useState } from 'react';
import { Text, View, TouchableOpacity, ActivityIndicator, FlatList, RefreshControl, ScrollView, TextInput, Keyboard, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { cssInterop } from 'nativewind';
import { useHomeData } from '../hooks/useHomeData';
import { useLanguage } from '../hooks/useLanguage';
import AuthBottomNav from '../components/AuthBottomNav';
import AppBottomNav from '../components/AppBottomNav';
import TestCard from '../components/TestCard';

cssInterop(SafeAreaView, { className: 'style' });

export default function HomeScreen({ onStartTest, onOpenTestDetails, startingTestId, user, onGoCreateTest, isLoggedIn, onGoLogin, onGoRegister, onGoTests, onGoPractice, onGoStats, onGoProfile }) {
  const { language, t } = useLanguage();
  const { data, tests, loading, refreshing, error, refetch } = useHomeData({ language });
  const canCreateTests = Boolean(isLoggedIn && (user?.role_id === 1 || user?.role_id === 2));
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [categoryInput, setCategoryInput] = useState('');
  const [isCategoryListOpen, setIsCategoryListOpen] = useState(false);
  const [selectedDifficulty, setSelectedDifficulty] = useState('all');

  const closeCategoryDropdown = () => {
    setIsCategoryListOpen(false);
    Keyboard.dismiss();
  };

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

  if (loading) {
    return (
      <View className="flex-1 bg-mf-bg justify-center items-center">
        <ActivityIndicator size="large" color="#575ddb" />
        <Text className="text-mf-secondary mt-4">{t('common.loading')}</Text>
      </View>
    );
  }

  const renderTestCard = ({ item }) => {
    const difficultyKey = item?._difficultyKey || getDifficultyKey(item);
    return (
      <TestCard
        test={item}
        difficultyKey={difficultyKey}
        isStarting={Boolean(startingTestId) && String(startingTestId) === String(item?.id)}
        onStart={() => onStartTest(item)}
        onOpenDetails={() => onOpenTestDetails(item)}
      />
    );
  };

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
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderTestCard}
            showsVerticalScrollIndicator={false}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            onScrollBeginDrag={closeCategoryDropdown}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={refetch}
                tintColor="#575ddb"
                colors={['#575ddb']}
              />
            }
          ListHeaderComponent={
            <>
              <View className="mt-8 mb-8 w-full bg-mf-secondary/10 rounded-2xl p-5 border border-mf-secondary/20 shadow-xl">
                <Text className="text-mf-text text-center text-base italic font-solway">
                  "{data?.dailyQuote}"
                </Text>
              </View>

              <Text className="text-mf-text text-xl font-solway-bold mb-2">{t('home.availableTests')}</Text>

              {canCreateTests ? (
                <TouchableOpacity
                  className="mb-4 self-start px-4 py-3 rounded-2xl border border-mf-primary/30 bg-mf-primary/10"
                  onPress={onGoCreateTest}
                >
                  <Text className="text-mf-text font-solway-extrabold text-xs uppercase tracking-widest">{t('home.newTest')}</Text>
                </TouchableOpacity>
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
                    <TouchableOpacity
                      className={`mb-2 px-3 py-2 rounded-lg border ${selectedCategory === 'all' && !normalizedCategoryInput ? 'bg-mf-primary border-mf-primary' : 'bg-mf-secondary/10 border-mf-secondary/30'}`}
                      onPress={() => handleCategoryPick('all')}
                    >
                      <Text className={`font-solway-bold text-xs uppercase tracking-wider ${selectedCategory === 'all' && !normalizedCategoryInput ? 'text-mf-text' : 'text-mf-secondary'}`}>
                        {t('home.all')}
                      </Text>
                    </TouchableOpacity>

                    <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
                      {matchingCategories.length > 0 ? (
                        matchingCategories.map((category) => (
                          <TouchableOpacity
                            key={category}
                            className={`mb-2 px-3 py-2 rounded-lg border ${selectedCategory === category ? 'bg-mf-primary border-mf-primary' : 'bg-mf-secondary/10 border-mf-secondary/30'}`}
                            onPress={() => handleCategoryPick(category)}
                          >
                            <Text className={`font-solway-bold text-xs uppercase tracking-wider ${selectedCategory === category ? 'text-mf-text' : 'text-mf-secondary'}`}>
                              {category}
                            </Text>
                          </TouchableOpacity>
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
                  <TouchableOpacity
                    className={`mr-2 px-3 py-2 rounded-lg border ${selectedDifficulty === 'all' ? 'bg-mf-primary border-mf-primary' : 'bg-mf-secondary/10 border-mf-secondary/30'}`}
                    onPress={() => setSelectedDifficulty('all')}
                  >
                    <Text className={`font-solway-bold text-xs uppercase tracking-wider ${selectedDifficulty === 'all' ? 'text-mf-text' : 'text-mf-secondary'}`}>
                      {t('home.all')}
                    </Text>
                  </TouchableOpacity>
                   {difficulties.map((difficultyKey) => (
                     <TouchableOpacity
                       key={difficultyKey}
                       className={`mr-2 px-3 py-2 rounded-lg border ${selectedDifficulty === difficultyKey ? 'bg-mf-primary border-mf-primary' : 'bg-mf-secondary/10 border-mf-secondary/30'}`}
                       onPress={() => setSelectedDifficulty(difficultyKey)}
                     >
                       <Text className={`font-solway-bold text-xs uppercase tracking-wider ${selectedDifficulty === difficultyKey ? 'text-mf-text' : 'text-mf-secondary'}`}>
                         {t(`difficulty.${difficultyKey}`)}
                       </Text>
                     </TouchableOpacity>
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

      {isLoggedIn ? (
        <AppBottomNav
          active="tests"
          onTestsPress={onGoTests}
          onPracticePress={onGoPractice}
          onStatsPress={onGoStats}
          onProfilePress={onGoProfile}
        />
      ) : (
        <AuthBottomNav
          active="login"
          onLoginPress={onGoLogin}
          onRegisterPress={onGoRegister}
        />
      )}
    </View>
  );
}
