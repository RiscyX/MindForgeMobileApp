import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fetchTestDetails } from '../services/api';
import { useLanguage } from '../hooks/useLanguage';

export default function TestDetailsScreen({ testId, onBack, onStart }) {
  const { language, t } = useLanguage();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [test, setTest] = useState(null);

  useEffect(() => {
    const load = async () => {
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
    };

    load();
  }, [language, testId]);

  const questions = useMemo(() => Array.isArray(test?.questions) ? test.questions : [], [test]);

  const renderQuestion = ({ item, index }) => (
    <View className="mb-3 rounded-2xl border border-mf-secondary/20 bg-mf-bg/40 p-4">
      <Text className="text-mf-secondary font-solway text-xs">#{index + 1}</Text>
      <Text className="text-mf-text font-solway-bold mt-1">{item?.content || ''}</Text>
    </View>
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
          <TouchableOpacity
            className="w-11 h-11 rounded-xl border border-mf-secondary/25 bg-mf-secondary/10 items-center justify-center"
            onPress={onBack}
          >
            <Text className="text-mf-text font-solway-bold text-lg">&lt;</Text>
          </TouchableOpacity>
          <View className="flex-1 items-center">
            <Text className="text-mf-text font-solway-extrabold text-base tracking-widest">{t('home.openDetails')}</Text>
          </View>
          <View className="w-11 h-11" />
        </View>

        {error ? (
          <View className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-5">
            <Text className="text-red-300 font-solway-bold text-base">{error}</Text>
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

              <View className="mt-6 rounded-2xl border border-mf-secondary/20 bg-mf-secondary/10 p-5">
                <Text className="text-mf-secondary text-xs uppercase tracking-widest font-solway-bold">{t('testDetails.questions')}</Text>
                <Text className="text-mf-text font-solway mt-2">{t('testDetails.count', { count: questions.length })}</Text>
              </View>

              <View className="mt-6" />
            </>
          }
          ListFooterComponent={
            <TouchableOpacity
              className="mt-3 bg-mf-primary py-4 rounded-2xl items-center border border-white/10 shadow-lg shadow-mf-primary/30"
              onPress={onStart}
            >
              <Text className="text-mf-text font-solway-bold text-base uppercase tracking-widest">{t('home.startTest')}</Text>
            </TouchableOpacity>
          }
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      </SafeAreaView>
    </View>
  );
}
