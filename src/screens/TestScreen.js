import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Easing, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { useAuth } from '../hooks/useAuth';
import { getAttemptRequest, reviewAttemptRequest, submitAttemptRequest } from '../services/attemptsApi';
import { useLanguage } from '../hooks/useLanguage';

export default function TestScreen({ attemptId, testId, onExit, onRetry }) {
  const { language, t } = useLanguage();
  const { authFetch } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [test, setTest] = useState(null);
  const [step, setStep] = useState(0);
  const [answersByQuestionId, setAnswersByQuestionId] = useState({});
  const [mode, setMode] = useState('quiz');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const isTransitioningRef = useRef(false);

  const [attemptSummary, setAttemptSummary] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [reviewQuestions, setReviewQuestions] = useState(null);

  const animOpacity = useRef(new Animated.Value(1)).current;
  const animTranslate = useRef(new Animated.Value(0)).current;

  const IconX = ({ size = 18, color = '#eae9fc' }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M18 6L6 18M6 6l12 12"
        stroke={color}
        strokeWidth={2.4}
        strokeLinecap="round"
      />
    </Svg>
  );

  const handleExitPress = useCallback(() => {
    // Always stop animations so we don't get stuck in a disabled state.
    animOpacity.stopAnimation();
    animTranslate.stopAnimation();
    isTransitioningRef.current = false;
    setIsTransitioning(false);

    if (mode !== 'quiz') {
      onExit();
      return;
    }

    const hasAnyAnswer = Object.keys(answersByQuestionId || {}).length > 0;
    if (!hasAnyAnswer) {
      onExit();
      return;
    }

    Alert.alert(
      t('test.exitConfirmTitle'),
      t('test.exitConfirmMessage'),
      [
        { text: t('test.exitConfirmStay'), style: 'cancel' },
        { text: t('test.exitConfirmLeave'), style: 'destructive', onPress: onExit },
      ]
    );
  }, [animOpacity, animTranslate, answersByQuestionId, mode, onExit, t]);

  const Header = ({ title, rightContent }) => (
    <View className="mt-3 flex-row items-center justify-between">
      <View className="w-11 h-11" />

      <View className="flex-1 items-center px-3">
        {title ? (
          <Text numberOfLines={1} className="text-mf-text font-solway-extrabold text-base tracking-widest">{title}</Text>
        ) : null}
      </View>

      <View className="flex-row items-center" style={{ gap: 10 }}>
        {rightContent || null}
        <TouchableOpacity
          className="w-11 h-11 rounded-xl border border-mf-secondary/25 bg-mf-secondary/10 items-center justify-center"
          onPress={handleExitPress}
          activeOpacity={0.85}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <IconX />
        </TouchableOpacity>
      </View>
    </View>
  );

  useEffect(() => {
    const load = async () => {
      if (attemptId === null || attemptId === undefined) {
        setError('Missing attempt id.');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError('');
      try {
        const payload = await getAttemptRequest({ authFetch, attemptId, language });
        setAttemptSummary(payload?.attempt || null);
        setTest(payload?.test || null);
        setQuestions(Array.isArray(payload?.questions) ? payload.questions : []);
        setReviewQuestions(null);
        setStep(0);
        setMode('quiz');
        setAnswersByQuestionId({});
        animOpacity.setValue(1);
        animTranslate.setValue(0);
      } catch (e) {
        setError(e?.message || 'Failed to load test.');
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [attemptId, authFetch, language]);

  const animateTo = useCallback((toOpacity, toTranslate, durationMs) => {
    return new Promise((resolve) => {
      animOpacity.stopAnimation();
      animTranslate.stopAnimation();
      Animated.parallel([
        Animated.timing(animOpacity, {
          toValue: toOpacity,
          duration: durationMs,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(animTranslate, {
          toValue: toTranslate,
          duration: durationMs,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(() => resolve());
    });
  }, [animOpacity, animTranslate]);

  const transitionStep = useCallback(async ({ nextStep, direction }) => {
    if (isTransitioningRef.current) {
      return;
    }

    isTransitioningRef.current = true;
    setIsTransitioning(true);

    const outTranslate = direction === 'forward' ? -6 : 6;
    const inTranslate = direction === 'forward' ? 6 : -6;

    await animateTo(0, outTranslate, 180);
    setStep(nextStep);
    animTranslate.setValue(inTranslate);
    await animateTo(1, 0, 220);

    setIsTransitioning(false);
    isTransitioningRef.current = false;
  }, [animateTo, animTranslate]);

  const transitionMode = useCallback(async (nextMode) => {
    if (isTransitioningRef.current) {
      return;
    }

    isTransitioningRef.current = true;
    setIsTransitioning(true);
    await animateTo(0, -5, 160);
    setMode(nextMode);
    animTranslate.setValue(5);
    await animateTo(1, 0, 200);
    setIsTransitioning(false);
    isTransitioningRef.current = false;
  }, [animateTo, animTranslate]);

  const activeQuestions = reviewQuestions || questions;
  const currentQuestion = activeQuestions[step] || null;
  const totalQuestions = activeQuestions.length;

  const getChosenAnswerId = useCallback((question) => {
    const answers = question?.answers || [];
    const chosen = answers.find((a) => a.is_chosen);
    if (chosen?.id) {
      return chosen.id;
    }

    const embedded = question?.answer?.answer_id ?? question?.user_answer?.answer_id;
    if (embedded) {
      return embedded;
    }

    return null;
  }, []);

  const currentAnswer = currentQuestion ? answersByQuestionId[currentQuestion.id] : null;
  const selectedAnswerId = mode === 'review'
    ? (getChosenAnswerId(currentQuestion) || currentAnswer?.answer_id || null)
    : (currentAnswer?.answer_id || null);
  const selectedText = mode === 'review'
    ? (currentQuestion?.answer?.text || currentQuestion?.user_answer?.text || currentAnswer?.text || '')
    : (currentAnswer?.text || '');

  const isTextQuestion = useMemo(() => {
    const type = (currentQuestion?.type || '').toString().toLowerCase();
    return type.includes('text') || type.includes('free');
  }, [currentQuestion?.type]);

  const canGoNext = Boolean(currentQuestion && (isTextQuestion ? selectedText.trim().length > 0 : selectedAnswerId));

  const score = useMemo(() => {
    if (mode !== 'results') {
      return null;
    }

    const total = attemptSummary?.total_questions ?? activeQuestions.length;
    const correct = attemptSummary?.correct_answers ?? null;
    const percent = attemptSummary?.score ?? null;
    return { correct, total, percent };
  }, [activeQuestions.length, attemptSummary, mode]);

  const currentQuestionCorrectAnswer = useMemo(() => {
    if (!currentQuestion) {
      return null;
    }
    return (currentQuestion.answers || []).find((a) => a.is_correct) || null;
  }, [currentQuestion]);

  const isCurrentCorrect = useMemo(() => {
    if (!currentQuestion || !selectedAnswerId || !currentQuestionCorrectAnswer) {
      return null;
    }
    return String(selectedAnswerId) === String(currentQuestionCorrectAnswer.id);
  }, [currentQuestion, currentQuestionCorrectAnswer, selectedAnswerId]);

  const getAnswerLabel = useCallback((question, answer) => {
    const raw = (answer?.content ?? '').toString();
    const normalized = raw.trim().toLowerCase();
    const normalizedAscii = normalized.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    const questionType = (question?.type ?? '').toString().toLowerCase();
    const isTrueFalseType = questionType.includes('true') || questionType.includes('false') || questionType.includes('boolean');

    const trueTokens = new Set(['true', 't', '1', 'yes', 'y', 'igaz']);
    const falseTokens = new Set(['false', 'f', '0', 'no', 'n', 'hamis']);

    const looksLikeTrueFalse = isTrueFalseType || trueTokens.has(normalizedAscii) || falseTokens.has(normalizedAscii);
    if (!looksLikeTrueFalse) {
      return raw;
    }

    if (trueTokens.has(normalizedAscii)) {
      return t('test.true');
    }
    if (falseTokens.has(normalizedAscii)) {
      return t('test.false');
    }

    return raw;
  }, [t]);

  const handlePickAnswer = (answerId) => {
    if (!currentQuestion) {
      return;
    }
    setAnswersByQuestionId((prev) => ({
      ...prev,
      [currentQuestion.id]: { answer_id: answerId },
    }));
  };

  const handleTextChange = (text) => {
    if (!currentQuestion) {
      return;
    }
    setAnswersByQuestionId((prev) => ({
      ...prev,
      [currentQuestion.id]: { text },
    }));
  };

  const handleNext = () => {
    if (mode !== 'quiz' || !canGoNext) {
      return;
    }

    if (step >= questions.length - 1) {
      // Submit attempt
      (async () => {
        try {
          const answersPayload = {};
          for (const q of questions) {
            const v = answersByQuestionId[q.id];
            if (!v) continue;
            if (v.answer_id) {
              answersPayload[q.id] = { answer_id: v.answer_id };
            } else if (typeof v.text === 'string' && v.text.trim() !== '') {
              answersPayload[q.id] = { text: v.text.trim() };
            }
          }
          const submit = await submitAttemptRequest({ authFetch, attemptId, answers: answersPayload });
          setAttemptSummary(submit?.attempt || attemptSummary);
          transitionMode('results');
        } catch (e) {
          setError(e?.message || 'Submit failed.');
        }
      })();
      return;
    }

    transitionStep({ nextStep: step + 1, direction: 'forward' });
  };

  const handleBack = () => {
    if (step <= 0) {
      return;
    }

    transitionStep({ nextStep: Math.max(0, step - 1), direction: 'back' });
  };

  const handleRetry = () => {
    if (onRetry) {
      onRetry();
      return;
    }
    setAnswersByQuestionId({});
    setStep(0);
    transitionMode('quiz');
  };

  const handleReview = () => {
    (async () => {
      try {
        const payload = await reviewAttemptRequest({ authFetch, attemptId, language });
        const review = payload?.review;
        if (!Array.isArray(review)) {
          throw new Error('Invalid review response (missing review array).');
        }

        const normalized = review.map((item) => {
          const q = item?.question || {};
          return {
            ...q,
            // Review endpoint returns answers separately, with is_correct + is_chosen flags.
            answers: Array.isArray(item?.answers) ? item.answers : [],
            answer: item?.answer || null,
            correct_texts: Array.isArray(item?.correct_texts) ? item.correct_texts : [],
          };
        });

        setReviewQuestions(normalized);
        setStep(0);
        transitionMode('review');
      } catch (e) {
        setError(e?.message || 'Review failed.');
      }
    })();
  };

  const handleReviewNext = () => {
    if (step >= totalQuestions - 1) {
      transitionMode('results');
      return;
    }

    transitionStep({ nextStep: step + 1, direction: 'forward' });
  };

  const handleReviewBack = () => {
    if (step <= 0) {
      return;
    }

    transitionStep({ nextStep: Math.max(0, step - 1), direction: 'back' });
  };

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

  if (error) {
    return (
      <View className="flex-1 bg-transparent">
        <SafeAreaView className="flex-1 px-6" edges={['top', 'left', 'right']}>
          <StatusBar style="light" />
          <Header title={t('test.exit')} />
          <View className="mt-10 rounded-2xl border border-red-500/30 bg-red-500/10 p-5">
            <Text className="text-red-300 font-solway-bold text-base">{error}</Text>
          </View>
          <TouchableOpacity className="mt-6 bg-mf-primary py-4 rounded-xl items-center" onPress={handleExitPress}>
            <Text className="text-mf-text font-solway-bold text-lg">{t('test.exit')}</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    );
  }

  if (mode === 'results') {
    return (
      <View className="flex-1 bg-transparent">
        <SafeAreaView className="flex-1 px-6" edges={['top', 'left', 'right']}>
          <StatusBar style="light" />
          <Header title={t('test.results')} />
          <View className="mt-8">
            <Text className="text-mf-secondary font-solway mt-2">{test?.title || ''}</Text>
          </View>

          <View className="mt-8 rounded-2xl border border-mf-secondary/20 bg-mf-secondary/10 p-5">
            <Text className="text-mf-secondary text-xs uppercase tracking-widest font-solway-bold">{t('test.score')}</Text>
            <Text className="text-mf-text font-solway-extrabold text-4xl mt-2">
              {score?.correct ?? 0}/{score?.total ?? 0}
            </Text>
          </View>

          <TouchableOpacity className="mt-6 bg-mf-primary py-4 rounded-xl items-center" onPress={handleReview}>
            <Text className="text-mf-text font-solway-bold text-lg">{t('test.reviewTest')}</Text>
          </TouchableOpacity>

          <TouchableOpacity className="mt-3 bg-mf-secondary/10 py-4 rounded-xl items-center border border-mf-secondary/20" onPress={handleRetry}>
            <Text className="text-mf-secondary font-solway-bold text-lg">{t('test.retry')}</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    );
  }

  if (mode === 'review') {
    const correctAnswer = currentQuestionCorrectAnswer;
    const selectedAnswer = currentQuestion ? (currentQuestion.answers || []).find((a) => String(a.id) === String(selectedAnswerId)) : null;
    const showDiff = Boolean(currentQuestion && correctAnswer && selectedAnswer && String(correctAnswer.id) !== String(selectedAnswer.id));

    const correctTexts = Array.isArray(currentQuestion?.correct_texts)
      ? currentQuestion.correct_texts
      : Array.isArray(currentQuestion?.correct_text)
        ? currentQuestion.correct_text
        : [];

    return (
      <View className="flex-1 bg-transparent">
        <SafeAreaView className="flex-1 px-6" edges={['top', 'left', 'right']}>
          <StatusBar style="light" />
          <Header
            title={t('test.review')}
            rightContent={
              <TouchableOpacity
                className="px-3 py-2 rounded-xl border border-mf-primary/40 bg-mf-primary/15"
                onPress={() => transitionMode('results')}
                disabled={isTransitioning}
              >
                <Text className="text-mf-text font-solway-bold text-xs uppercase tracking-widest">{t('test.results')}</Text>
              </TouchableOpacity>
            }
          />

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
            <View className="mt-6">
              <Text className="text-mf-secondary font-solway mt-2">{test?.title || ''}</Text>

            <View className="mt-4 px-3 py-2 rounded-xl border border-mf-secondary/25 bg-mf-secondary/10">
              <Text className="text-mf-secondary font-solway text-sm">
                  {t('test.progress', { current: step + 1, total: Math.max(totalQuestions, 1) })}
              </Text>
            </View>
            </View>

            <View className="mt-6 rounded-2xl border border-mf-secondary/20 bg-mf-secondary/10 p-5 shadow-xl">
              <Animated.View style={{ opacity: animOpacity, transform: [{ translateY: animTranslate }] }}>
                <Text className="text-mf-text font-solway-bold text-lg">{currentQuestion?.content || ''}</Text>

                <View className="mt-4">
                {isTextQuestion ? (
                  <View className="rounded-xl border border-mf-secondary/20 bg-mf-bg/40 p-4">
                    <Text className="text-mf-secondary font-solway text-xs uppercase tracking-widest">{t('test.yourAnswer')}</Text>
                    <Text className="text-mf-text font-solway mt-2">{selectedText || ''}</Text>

                    {correctTexts.length > 0 ? (
                      <>
                        <Text className="text-mf-secondary font-solway text-xs uppercase tracking-widest mt-4">{t('test.correctAnswer')}</Text>
                        {correctTexts.map((ct, idx) => (
                          <Text key={idx} className="text-green-300 font-solway mt-1">{String(ct)}</Text>
                        ))}
                      </>
                    ) : null}
                  </View>
                ) : (
                  (currentQuestion?.answers || []).map((a) => {
                  const isCorrect = Boolean(a.is_correct);
                  const isSelected = String(selectedAnswerId) === String(a.id);

                  const base = 'mb-3 px-4 py-4 rounded-xl border';
                  const style = isCorrect
                    ? 'bg-green-500/10 border-green-500/40'
                    : isSelected
                      ? 'bg-red-500/10 border-red-500/40'
                      : 'bg-mf-bg/40 border-mf-secondary/25';

                  const textStyle = isCorrect
                    ? 'text-green-300'
                    : isSelected
                      ? 'text-red-300'
                      : 'text-mf-text';

                  return (
                    <View key={a.id} className={`${base} ${style}`}>
                      <Text className={`font-solway ${textStyle}`}>{getAnswerLabel(currentQuestion, a)}</Text>
                    </View>
                  );
                  })
                )}
                </View>

              {showDiff ? (
                <View className="mt-2 rounded-xl border border-mf-secondary/20 bg-mf-bg/40 p-4">
                  <Text className="text-mf-secondary font-solway text-xs uppercase tracking-widest">{t('test.yourAnswer')}</Text>
                  <Text className="text-red-300 font-solway mt-1">{selectedAnswer ? getAnswerLabel(currentQuestion, selectedAnswer) : ''}</Text>

                  <Text className="text-mf-secondary font-solway text-xs uppercase tracking-widest mt-3">{t('test.correctAnswer')}</Text>
                  <Text className="text-green-300 font-solway mt-1">{correctAnswer ? getAnswerLabel(currentQuestion, correctAnswer) : ''}</Text>
                </View>
              ) : null}

              {currentQuestion?.explanation ? (
                <View className="mt-4">
                  <Text className="text-mf-secondary font-solway text-sm">{currentQuestion.explanation}</Text>
                </View>
              ) : null}
              </Animated.View>
            </View>

            <View className="mt-6 flex-row">
              <TouchableOpacity
                className={`flex-1 py-4 rounded-xl items-center border mr-3 ${step <= 0 ? 'bg-mf-secondary/5 border-mf-secondary/10' : 'bg-mf-secondary/10 border-mf-secondary/20'}`}
                onPress={handleReviewBack}
                disabled={step <= 0}
              >
                <Text className="text-mf-secondary font-solway-bold">{t('test.back')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                className={`flex-1 py-4 rounded-xl items-center ${isTransitioning ? 'bg-mf-secondary/15' : 'bg-mf-primary'}`}
                onPress={handleReviewNext}
                disabled={isTransitioning}
              >
                <Text className="text-mf-text font-solway-bold">{step >= totalQuestions - 1 ? t('test.results') : t('test.next')}</Text>
              </TouchableOpacity>
            </View>

          </ScrollView>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-transparent">
      <SafeAreaView className="flex-1 px-6" edges={['top', 'left', 'right']}>
        <StatusBar style="light" />
        <Header
          title={test?.title || ''}
          rightContent={
            <View className="px-3 py-2 rounded-xl border border-mf-secondary/25 bg-mf-secondary/10">
              <Text className="text-mf-secondary font-solway text-xs">{t('test.progress', { current: step + 1, total: Math.max(totalQuestions, 1) })}</Text>
            </View>
          }
        />

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
          <View className="mt-6">
            <Text className="text-mf-text text-2xl font-solway-extrabold tracking-wide">{test?.title || ''}</Text>
            {test?.description ? (
              <Text className="text-mf-secondary font-solway mt-2">{test.description}</Text>
            ) : null}

            {/* Progress is shown in the header */}
          </View>

          <View className="mt-6 rounded-2xl border border-mf-secondary/20 bg-mf-secondary/10 p-5 shadow-xl">
            <Animated.View style={{ opacity: animOpacity, transform: [{ translateY: animTranslate }] }}>
              <Text className="text-mf-text font-solway-bold text-lg">{currentQuestion?.content || ''}</Text>

              <View className="mt-4">
              {isTextQuestion ? (
                <View className="rounded-xl border border-mf-secondary/20 bg-mf-bg/40 p-4">
                  <Text className="text-mf-secondary font-solway text-xs uppercase tracking-widest">{t('test.yourAnswer')}</Text>
                  <TextInput
                    className="mt-3 w-full bg-mf-bg/40 text-mf-text p-3 rounded-xl border border-mf-secondary/25 font-solway"
                    value={selectedText}
                    onChangeText={handleTextChange}
                    editable={!isTransitioning}
                    placeholderTextColor="#8a89a2"
                    placeholder="..."
                    multiline
                  />
                </View>
              ) : (
                (currentQuestion?.answers || []).map((a) => {
                  const isSelected = String(selectedAnswerId) === String(a.id);
                  return (
                    <TouchableOpacity
                      key={a.id}
                      className={`mb-3 px-4 py-4 rounded-xl border ${isSelected ? 'bg-mf-primary/25 border-mf-primary' : 'bg-mf-bg/40 border-mf-secondary/25'}`}
                      onPress={() => handlePickAnswer(a.id)}
                      disabled={isTransitioning}
                    >
                      <Text className={`font-solway ${isSelected ? 'text-mf-text font-solway-bold' : 'text-mf-text'}`}>{getAnswerLabel(currentQuestion, a)}</Text>
                    </TouchableOpacity>
                  );
                })
              )}
              </View>

            {currentQuestion?.explanation ? (
              <View className="mt-2">
                <Text className="text-mf-secondary font-solway text-xs">{currentQuestion.explanation}</Text>
              </View>
            ) : null}
            </Animated.View>
          </View>

          <View className="mt-6 flex-row">
            <TouchableOpacity
              className={`flex-1 py-4 rounded-xl items-center border mr-3 ${step <= 0 ? 'bg-mf-secondary/5 border-mf-secondary/10' : 'bg-mf-secondary/10 border-mf-secondary/20'}`}
              onPress={handleBack}
              disabled={step <= 0}
            >
              <Text className="text-mf-secondary font-solway-bold">{t('test.back')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              className={`flex-1 py-4 rounded-xl items-center ${canGoNext && !isTransitioning ? 'bg-mf-primary' : 'bg-mf-secondary/15'}`}
              onPress={handleNext}
              disabled={!canGoNext || isTransitioning}
            >
              <Text className="text-mf-text font-solway-bold">{step >= questions.length - 1 ? t('test.finish') : t('test.next')}</Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
