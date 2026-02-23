import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { fetchTestDetails } from '../services/api';
import { useLanguage } from '../hooks/useLanguage';
import { useTestActions } from '../context/TestActionsContext';
import { GradientButton } from '../components/MFButton';
import GlassCard from '../components/GlassCard';

export default function TestDetailsScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { testId } = route.params;
  const { language, t } = useLanguage();
  const { handleStartTest } = useTestActions();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [test, setTest] = useState(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const details = await fetchTestDetails({ testId, language });
      setTest(details);
    } catch (e) {
      setError(e?.message || 'Failed to load test details.');
    } finally {
      setIsLoading(false);
    }
  }, [language, testId]);

  useEffect(() => {
    load();
  }, [load]);

  const questions = useMemo(() => Array.isArray(test?.questions) ? test.questions : [], [test]);

  const renderQuestion = ({ item, index }) => (
    <GlassCard style={{ marginBottom: 12 }}>
      <View className="p-4">
        <Text className="text-mf-secondary font-solway text-xs">#{index + 1}</Text>
        <Text className="text-mf-text font-solway-bold mt-1">{item?.content || ''}</Text>
      </View>
    </GlassCard>
  );

  if (isLoading) {
    return (
      <View className="flex-1 bg-transparent">
        <SafeAreaView className="flex-1 px-6 justify-center items-center" edges={['top', 'left', 'right']}>
          <StatusBar style="light" />
          <ActivityIndicator size="large" color="#575ddb" />
          <Text className="text-mf-secondary font-solway mt-4">{t('common.loading')}</Text>
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
          <View className="flex-1 items-center">
            <Text className="text-mf-text font-solway-extrabold text-base tracking-widest">{t('home.openDetails')}</Text>
          </View>
          <View className="w-11 h-11" />
        </View>

        {error ? (
          <View className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-5">
            <Text className="text-red-300 font-solway-bold text-base">{error}</Text>
            <Pressable
              className="mt-3 bg-mf-primary py-3 rounded-xl items-center"
              onPress={load}
            >
              <Text className="text-mf-text font-solway-bold text-sm uppercase tracking-widest">{t('stats.refresh')}</Text>
            </Pressable>
          </View>
        ) : null}

        <FlatList
          className="mt-6"
          data={questions}
          keyExtractor={(item, idx) => String(item?.id || idx)}
          renderItem={renderQuestion}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <>
              <View>
                <Text className="text-mf-text text-2xl font-solway-extrabold tracking-wide">{test?.title || ''}</Text>
                {test?.description ? (
                  <Text className="text-mf-secondary font-solway mt-2">{test.description}</Text>
                ) : null}
              </View>

              <GlassCard style={{ marginTop: 24 }}>
                <View className="p-5">
                  <Text className="text-mf-secondary text-xs uppercase tracking-widest font-solway-bold">{t('testDetails.questions')}</Text>
                  <Text className="text-mf-text font-solway mt-2">{t('testDetails.count', { count: questions.length })}</Text>
                </View>
              </GlassCard>

              <View className="mt-6" />
            </>
          }
          ListFooterComponent={
            <GradientButton
              onPress={() => handleStartTest({ id: testId })}
              label={t('home.startTest')}
              style={{ marginTop: 12 }}
            />
          }
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      </SafeAreaView>
    </View>
  );
}
