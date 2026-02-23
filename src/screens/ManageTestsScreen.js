import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../hooks/useLanguage';
import { listTestsForManagementRequest } from '../services/testManagementApi';

const PAGE_SIZE = 20;

const resolveOwnerId = (item) => {
  const candidate =
    item?.creator_id
    ?? item?.user_id
    ?? item?.owner_id
    ?? item?.created_by_user_id
    ?? item?.author_id
    ?? item?.created_by?.id
    ?? item?.owner?.id
    ?? null;

  const numeric = Number(candidate);
  return Number.isFinite(numeric) ? numeric : null;
};

const mergeById = (prev, next) => {
  const map = new Map();
  [...prev, ...next].forEach((item, idx) => {
    const id = item?.id;
    const key = id === null || id === undefined ? `fallback-${idx}` : String(id);
    map.set(key, item);
  });
  return Array.from(map.values());
};

export default function ManageTestsScreen() {
  const navigation = useNavigation();
  const { t, language } = useLanguage();
  const { authFetch, user, isAuthenticated } = useAuth();

  const [tests, setTests] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [nextPage, setNextPage] = useState(2);

  const roleId = Number(user?.role_id);
  const userId = Number(user?.id);
  const canManageTests = Boolean(isAuthenticated && (roleId === 1 || roleId === 2));
  const isAdmin = roleId === 1;
  const isCreator = roleId === 2;

  const applyRoleFilter = useCallback((items) => {
    if (!isCreator) {
      return items;
    }
    return items.filter((item) => {
      if (item?.is_mine === true) return true;
      const ownerId = resolveOwnerId(item);
      return ownerId !== null && ownerId === userId;
    });
  }, [isCreator, userId]);

  const loadFirstPage = useCallback(async ({ silent = false } = {}) => {
    if (!canManageTests) return;
    if (!silent) setLoading(true);
    setErrorMessage(null);
    try {
      const result = await listTestsForManagementRequest({
        authFetch,
        language,
        page: 1,
        limit: PAGE_SIZE,
        mineOnly: isCreator,
      });
      const filtered = applyRoleFilter(result.tests || []);
      setTests(filtered);
      setHasMore(Boolean(result?.hasMore));
      setNextPage(Number(result?.nextPage || 2));
    } catch (error) {
      setErrorMessage(error?.data?.error?.message || error?.message || t('manageTests.loadError'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [applyRoleFilter, authFetch, canManageTests, isCreator, language, t]);

  useEffect(() => {
    loadFirstPage();
  }, [loadFirstPage]);

  const loadMore = useCallback(async () => {
    if (loading || refreshing || loadingMore || !hasMore || !canManageTests) return;
    setLoadingMore(true);
    try {
      const result = await listTestsForManagementRequest({
        authFetch,
        language,
        page: nextPage,
        limit: PAGE_SIZE,
        mineOnly: isCreator,
      });
      const filtered = applyRoleFilter(result.tests || []);
      setTests((prev) => mergeById(prev, filtered));
      setHasMore(Boolean(result?.hasMore));
      if (result?.nextPage) setNextPage(Number(result.nextPage));
    } catch {
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  }, [applyRoleFilter, authFetch, canManageTests, hasMore, isCreator, language, loading, loadingMore, nextPage, refreshing]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadFirstPage({ silent: true });
  }, [loadFirstPage]);

  const filteredTests = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return tests;
    return tests.filter((item) => {
      const title = String(item?.title || '').toLowerCase();
      const description = String(item?.description || '').toLowerCase();
      const category = String(item?.category || '').toLowerCase();
      return title.includes(query) || description.includes(query) || category.includes(query);
    });
  }, [search, tests]);

  const renderFooter = useCallback(() => {
    if (!loadingMore) return null;
    return (
      <View className="py-4 items-center">
        <ActivityIndicator size="small" color="#575ddb" />
      </View>
    );
  }, [loadingMore]);

  if (!canManageTests) {
    return (
      <View className="flex-1 bg-transparent">
        <SafeAreaView className="flex-1 px-6" edges={['top', 'left', 'right']}>
          <StatusBar style="light" />
          <View className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-4">
            <Text className="text-red-200 font-solway-bold">{t('manageTests.noAccess')}</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-transparent">
      <SafeAreaView className="flex-1 px-6" edges={['top', 'left', 'right']}>
        <StatusBar style="light" />

        <View className="mt-3 flex-row items-center">
          <Pressable
            className="w-11 h-11 rounded-xl border border-mf-secondary/25 bg-mf-secondary/10 items-center justify-center"
            onPress={() => navigation.goBack()}
          >
            <Text className="text-mf-text font-solway-bold text-lg">&lt;</Text>
          </Pressable>
          <View className="flex-1 items-center px-3">
            <Text className="text-mf-text font-solway-extrabold text-base tracking-wider">{t('manageTests.title')}</Text>
            <Text className="text-mf-secondary font-solway text-xs mt-1">{isAdmin ? t('manageTests.scopeAdmin') : t('manageTests.scopeCreator')}</Text>
          </View>
          <View className="w-11 h-11" />
        </View>

        <View className="mt-4 rounded-2xl border border-mf-secondary/25 bg-mf-secondary/10 px-3 py-2">
          <TextInput
            className="text-mf-text font-solway"
            value={search}
            onChangeText={setSearch}
            placeholder={t('manageTests.searchPlaceholder')}
            placeholderTextColor="#8a89a2"
          />
        </View>

        {errorMessage ? (
          <View className="mt-3 rounded-xl border border-red-500/35 bg-red-500/10 p-3">
            <Text className="text-red-200 font-solway">{errorMessage}</Text>
          </View>
        ) : null}

        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#575ddb" />
          </View>
        ) : (
          <FlatList
            className="mt-4"
            data={filteredTests}
            keyExtractor={(item, index) => String(item?.id ?? `test-${index}`)}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#575ddb" colors={['#575ddb']} />}
            onEndReachedThreshold={0.5}
            onEndReached={() => { if (hasMore) loadMore(); }}
            ListFooterComponent={renderFooter}
            ListEmptyComponent={
              <Text className="text-mf-secondary font-solway text-center mt-10">
                {t('manageTests.noTests')}
              </Text>
            }
            renderItem={({ item }) => (
              <Pressable
                className="mb-3 rounded-2xl border border-mf-secondary/25 bg-mf-secondary/10 p-4"
                onPress={() => navigation.navigate('EditTest', { testId: item?.id })}
              >
                <Text className="text-mf-text font-solway-extrabold text-base">{item?.title || '-'}</Text>
                <Text className="text-mf-secondary font-solway mt-1" numberOfLines={2}>{item?.description || t('home.noDescription')}</Text>
                <View className="mt-3 flex-row items-center justify-between">
                  <Text className="text-mf-secondary font-solway-bold text-xs uppercase tracking-wider">
                    {`${item?.category || '-'} • ${item?.difficulty || '-'}`}
                  </Text>
                  <Text className="text-mf-text font-solway-bold text-xs uppercase tracking-wider">{t('manageTests.edit')}</Text>
                </View>
              </Pressable>
            )}
            contentContainerStyle={{ paddingBottom: 120 }}
          />
        )}
      </SafeAreaView>
    </View>
  );
}
