import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const isSubmittingRef = useRef(false);
  const [activeMatchingLeftId, setActiveMatchingLeftId] = useState(null);
  const [showConnections, setShowConnections] = useState(true);
  const [showMatchingOverview, setShowMatchingOverview] = useState(false);
  const [matchingCanvasLayout, setMatchingCanvasLayout] = useState(null);
  const [matchingLeftColumnLayout, setMatchingLeftColumnLayout] = useState(null);
  const [matchingRightColumnLayout, setMatchingRightColumnLayout] = useState(null);
  const [matchingLeftLayouts, setMatchingLeftLayouts] = useState({});
  const [matchingRightLayouts, setMatchingRightLayouts] = useState({});
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

  const isMatchingQuestion = useMemo(() => {
    const type = (currentQuestion?.type || '').toString().toLowerCase();
    return type.includes('matching');
  }, [currentQuestion?.type]);

  const normalizePairs = useCallback((pairs) => {
    if (!pairs || typeof pairs !== 'object') {
      return {};
    }

    return Object.entries(pairs).reduce((acc, [leftId, rightId]) => {
      const normalizedLeft = String(leftId);
      const normalizedRight = rightId === null || rightId === undefined || rightId === '' ? null : String(rightId);
      if (normalizedLeft && normalizedRight) {
        acc[normalizedLeft] = normalizedRight;
      }
      return acc;
    }, {});
  }, []);

  const matchingModel = useMemo(() => {
    if (!isMatchingQuestion || !currentQuestion) {
      return { left: [], right: [], correctPairs: {} };
    }

    const fromReview = currentQuestion?.matching;
    if (fromReview && Array.isArray(fromReview.left) && Array.isArray(fromReview.right)) {
      return {
        left: fromReview.left.map((item) => ({ id: String(item?.id), content: String(item?.content || '') })).filter((item) => item.id),
        right: fromReview.right.map((item) => ({ id: String(item?.id), content: String(item?.content || '') })).filter((item) => item.id),
        correctPairs: normalizePairs(fromReview.correct_pairs || {}),
      };
    }

    const answers = Array.isArray(currentQuestion.answers) ? currentQuestion.answers : [];
    const left = [];
    const right = [];
    const leftByGroup = {};
    const rightByGroup = {};

    answers.forEach((answer, index) => {
      const id = String(answer?.id || '');
      if (!id) {
        return;
      }
      const content = String(answer?.content || '');
      const sideRaw = String(answer?.match_side || '').toLowerCase();
      const side = sideRaw === 'left' || sideRaw === 'right' ? sideRaw : (index % 2 === 0 ? 'left' : 'right');
      const group = Number(answer?.match_group || 0);

      if (side === 'left') {
        left.push({ id, content });
        if (group > 0) {
          leftByGroup[group] = id;
        }
      } else {
        right.push({ id, content });
        if (group > 0) {
          rightByGroup[group] = id;
        }
      }
    });

    const correctPairs = {};
    Object.keys(leftByGroup).forEach((groupKey) => {
      const leftId = leftByGroup[groupKey];
      const rightId = rightByGroup[groupKey];
      if (leftId && rightId) {
        correctPairs[leftId] = rightId;
      }
    });

    return { left, right, correctPairs };
  }, [currentQuestion, isMatchingQuestion, normalizePairs]);

  const selectedPairs = useMemo(() => {
    if (!isMatchingQuestion) {
      return {};
    }

    if (mode === 'review') {
      return normalizePairs(currentQuestion?.matching?.user_pairs || {});
    }

    return normalizePairs(currentAnswer?.pairs || {});
  }, [currentAnswer?.pairs, currentQuestion?.matching?.user_pairs, isMatchingQuestion, mode, normalizePairs]);

  const usedRightToLeftMap = useMemo(() => {
    const map = {};
    Object.entries(selectedPairs).forEach(([leftId, rightId]) => {
      if (rightId) {
        map[String(rightId)] = String(leftId);
      }
    });
    return map;
  }, [selectedPairs]);

  const matchingProgress = useMemo(() => {
    const total = matchingModel.left.length;
    const current = matchingModel.left.reduce((sum, leftItem) => {
      return selectedPairs[String(leftItem.id)] ? sum + 1 : sum;
    }, 0);
    return { current, total };
  }, [matchingModel.left, selectedPairs]);

  const matchingLeftIndexById = useMemo(() => {
    const map = {};
    matchingModel.left.forEach((leftItem, index) => {
      map[String(leftItem.id)] = index + 1;
    });
    return map;
  }, [matchingModel.left]);

  const activeMatchingLeft = useMemo(() => {
    if (!activeMatchingLeftId) {
      return null;
    }
    return matchingModel.left.find((item) => String(item.id) === String(activeMatchingLeftId)) || null;
  }, [activeMatchingLeftId, matchingModel.left]);

  const matchingPairPreview = useMemo(() => {
    return matchingModel.left.map((leftItem) => {
      const leftId = String(leftItem.id);
      const rightId = selectedPairs[leftId] || null;
      const rightItem = rightId ? matchingModel.right.find((item) => String(item.id) === String(rightId)) : null;
      return {
        leftId,
        leftLabel: matchingLeftIndexById[leftId],
        leftContent: leftItem.content,
        rightId,
        rightContent: rightItem?.content || null,
      };
    });
  }, [matchingLeftIndexById, matchingModel.left, matchingModel.right, selectedPairs]);

  const questionTypeLabel = useMemo(() => {
    if (isMatchingQuestion) {
      return t('test.questionTypeMatching');
    }
    if (isTextQuestion) {
      return t('test.questionTypeText');
    }
    return t('test.questionTypeChoice');
  }, [isMatchingQuestion, isTextQuestion, t]);

  useEffect(() => {
    if (!isMatchingQuestion) {
      setActiveMatchingLeftId(null);
      setShowMatchingOverview(false);
      setMatchingCanvasLayout(null);
      setMatchingLeftColumnLayout(null);
      setMatchingRightColumnLayout(null);
      setMatchingLeftLayouts({});
      setMatchingRightLayouts({});
      return;
    }

    const firstUnpaired = matchingModel.left.find((leftItem) => !selectedPairs[String(leftItem.id)]);
    setActiveMatchingLeftId(firstUnpaired ? String(firstUnpaired.id) : (matchingModel.left[0] ? String(matchingModel.left[0].id) : null));
  }, [currentQuestion?.id, isMatchingQuestion, matchingModel.left, selectedPairs]);

  const canGoNext = useMemo(() => {
    if (!currentQuestion) {
      return false;
    }
    if (isTextQuestion) {
      return selectedText.trim().length > 0;
    }
    if (isMatchingQuestion) {
      const leftItems = matchingModel.left;
      if (!leftItems.length) {
        return false;
      }

      const chosenRights = new Set();
      for (const leftItem of leftItems) {
        const rightId = selectedPairs[String(leftItem.id)];
        if (!rightId || chosenRights.has(String(rightId))) {
          return false;
        }
        chosenRights.add(String(rightId));
      }
      return true;
    }
    return Boolean(selectedAnswerId);
  }, [currentQuestion, isMatchingQuestion, isTextQuestion, matchingModel.left, selectedAnswerId, selectedPairs, selectedText]);

  const triggerHaptic = useCallback(async (kind) => {
    try {
      if (kind === 'success') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        return;
      }
      if (kind === 'error') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }
      await Haptics.selectionAsync();
    } catch {
      // Ignore unavailable haptics on unsupported devices.
    }
  }, []);

  const matchingConnections = useMemo(() => {
    if (!isMatchingQuestion || !matchingLeftColumnLayout || !matchingRightColumnLayout) {
      return [];
    }

    return matchingModel.left.map((leftItem) => {
      const leftId = String(leftItem.id);
      const rightId = selectedPairs[leftId] ? String(selectedPairs[leftId]) : null;
      if (!rightId) {
        return null;
      }

      const leftBox = matchingLeftLayouts[leftId];
      const rightBox = matchingRightLayouts[rightId];
      if (!leftBox || !rightBox) {
        return null;
      }

      const fromX = matchingLeftColumnLayout.x + leftBox.x + leftBox.width;
      const fromY = matchingLeftColumnLayout.y + leftBox.y + leftBox.height / 2;
      const toX = matchingRightColumnLayout.x + rightBox.x;
      const toY = matchingRightColumnLayout.y + rightBox.y + rightBox.height / 2;

      const isActive = String(activeMatchingLeftId) === leftId;
      const colorPalette = ['#7f84ff', '#2bc4a8', '#ff9f43', '#ff5d8f', '#5ec6ff', '#9f7aea'];
      const leftIndex = Math.max(0, (matchingLeftIndexById[leftId] || 1) - 1);
      const color = colorPalette[leftIndex % colorPalette.length];
      return {
        id: `${leftId}->${rightId}`,
        fromX,
        fromY,
        toX,
        toY,
        isActive,
        color,
      };
    }).filter(Boolean);
  }, [
    activeMatchingLeftId,
    isMatchingQuestion,
    matchingLeftColumnLayout,
    matchingLeftLayouts,
    matchingLeftIndexById,
    matchingModel.left,
    matchingRightColumnLayout,
    matchingRightLayouts,
    selectedPairs,
  ]);

  const visibleMatchingConnections = useMemo(() => {
    if (showMatchingOverview) {
      return matchingConnections;
    }
    return matchingConnections.filter((connection) => connection.isActive);
  }, [matchingConnections, showMatchingOverview]);

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

  const handlePickMatchingPair = (leftId, rightId) => {
    if (!currentQuestion) {
      return;
    }

    const normalizedLeft = String(leftId);
    const normalizedRight = rightId === null || rightId === undefined ? null : String(rightId);
    setAnswersByQuestionId((prev) => {
      const prevPairs = normalizePairs(prev?.[currentQuestion.id]?.pairs || {});
      const nextPairs = { ...prevPairs };

      Object.keys(nextPairs).forEach((existingLeftId) => {
        if (nextPairs[existingLeftId] === normalizedRight) {
          delete nextPairs[existingLeftId];
        }
      });

      if (normalizedRight) {
        nextPairs[normalizedLeft] = normalizedRight;
      } else {
        delete nextPairs[normalizedLeft];
      }

      return {
        ...prev,
        [currentQuestion.id]: { pairs: nextPairs },
      };
    });

    triggerHaptic(rightId ? 'selection' : 'error');
  };

  const handleSelectMatchingLeft = (leftId) => {
    setActiveMatchingLeftId(String(leftId));
    triggerHaptic('selection');
  };

  const handlePickMatchingRight = (rightId) => {
    const normalizedRight = String(rightId);
    let targetLeftId = activeMatchingLeftId;

    if (!targetLeftId) {
      const firstUnpaired = matchingModel.left.find((leftItem) => !selectedPairs[String(leftItem.id)]);
      targetLeftId = firstUnpaired ? String(firstUnpaired.id) : (matchingModel.left[0] ? String(matchingModel.left[0].id) : null);
    }

    if (!targetLeftId) {
      return;
    }

    handlePickMatchingPair(targetLeftId, normalizedRight);

    const nextUnpaired = matchingModel.left.find((leftItem) => {
      const id = String(leftItem.id);
      if (id === String(targetLeftId)) {
        return false;
      }
      return !selectedPairs[id];
    });

    setActiveMatchingLeftId(nextUnpaired ? String(nextUnpaired.id) : String(targetLeftId));

    const nextCount = matchingModel.left.reduce((sum, item) => {
      const id = String(item.id);
      if (id === String(targetLeftId)) {
        return sum + 1;
      }
      return selectedPairs[id] ? sum + 1 : sum;
    }, 0);
    if (matchingModel.left.length > 0 && nextCount >= matchingModel.left.length) {
      triggerHaptic('success');
    }
  };

  const handleClearMatchingPair = (leftId) => {
    handlePickMatchingPair(leftId, null);
    setActiveMatchingLeftId(String(leftId));
    triggerHaptic('error');
  };

  const handleToggleConnections = () => {
    setShowConnections((prev) => !prev);
    triggerHaptic('selection');
  };

  const handleToggleOverview = () => {
    setShowMatchingOverview((prev) => !prev);
    triggerHaptic('selection');
  };

  const handleNext = () => {
    if (mode !== 'quiz' || !canGoNext) {
      return;
    }

    if (step >= questions.length - 1) {
      // Prevent double submit
      if (isSubmittingRef.current) {
        return;
      }
      isSubmittingRef.current = true;
      setIsSubmitting(true);
      setSubmitError('');

      (async () => {
        try {
          const answersPayload = {};
          for (const q of questions) {
            const v = answersByQuestionId[q.id];
            if (!v) continue;
            if (v.answer_id) {
              answersPayload[q.id] = { answer_id: v.answer_id };
            } else if (v.pairs && typeof v.pairs === 'object') {
              answersPayload[q.id] = { pairs: normalizePairs(v.pairs) };
            } else if (typeof v.text === 'string' && v.text.trim() !== '') {
              answersPayload[q.id] = { text: v.text.trim() };
            }
          }
          const submit = await submitAttemptRequest({ authFetch, attemptId, answers: answersPayload });
          setAttemptSummary(submit?.attempt || attemptSummary);
          isSubmittingRef.current = false;
          setIsSubmitting(false);
          transitionMode('results');
        } catch (e) {
          isSubmittingRef.current = false;
          setIsSubmitting(false);
          setSubmitError(e?.message || t('test.submitError'));
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
            matching: item?.matching || null,
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
    const showDiff = Boolean(
      currentQuestion
      && !isTextQuestion
      && !isMatchingQuestion
      && correctAnswer
      && selectedAnswer
      && String(correctAnswer.id) !== String(selectedAnswer.id)
    );

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
              <View className="flex-row items-center justify-between">
                <Text className="text-mf-secondary font-solway text-sm">
                  {t('test.progress', { current: step + 1, total: Math.max(totalQuestions, 1) })}
                </Text>
                <Text className="text-mf-text font-solway-bold text-xs">{questionTypeLabel}</Text>
              </View>
              <View className="mt-2 h-1.5 rounded-full bg-mf-secondary/20 overflow-hidden">
                <View
                  className="h-1.5 rounded-full bg-mf-primary"
                  style={{ width: `${Math.max(4, Math.min(100, ((step + 1) / Math.max(totalQuestions, 1)) * 100))}%` }}
                />
              </View>
            </View>
            </View>

            <View className="mt-6 rounded-2xl border border-mf-secondary/20 bg-mf-secondary/10 p-5 shadow-xl">
              <Animated.View style={{ opacity: animOpacity, transform: [{ translateY: animTranslate }] }}>
                <Text className="text-mf-text font-solway-bold text-xl">{currentQuestion?.content || ''}</Text>

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
                ) : isMatchingQuestion ? (
                  <View className="rounded-xl border border-mf-secondary/20 bg-mf-bg/40 p-4">
                    <Text className="text-mf-secondary font-solway text-xs uppercase tracking-widest">{t('test.matchingTitle')}</Text>
                    {matchingModel.left.map((leftItem, idx) => {
                      const chosenRightId = selectedPairs[String(leftItem.id)] || null;
                      const correctRightId = matchingModel.correctPairs[String(leftItem.id)] || null;
                      const chosenRight = matchingModel.right.find((item) => String(item.id) === String(chosenRightId));
                      const correctRight = matchingModel.right.find((item) => String(item.id) === String(correctRightId));
                      const rowCorrect = chosenRightId && correctRightId && String(chosenRightId) === String(correctRightId);

                      return (
                        <View key={`${leftItem.id}-${idx}`} className="mt-4 rounded-xl border border-mf-secondary/20 bg-mf-secondary/5 p-3">
                          <View className="flex-row items-center justify-between">
                            <Text className="text-mf-text font-solway-bold flex-1 mr-3">{leftItem.content || '...'}</Text>
                            <View className={`px-2 py-1 rounded-lg border ${rowCorrect ? 'border-green-500/40 bg-green-500/10' : 'border-red-500/40 bg-red-500/10'}`}>
                              <Text className={`font-solway-bold text-xs ${rowCorrect ? 'text-green-300' : 'text-red-300'}`}>
                                {rowCorrect ? t('test.matchingCorrect') : t('test.matchingIncorrect')}
                              </Text>
                            </View>
                          </View>
                          <View className="mt-3 rounded-lg border border-mf-secondary/20 bg-mf-bg/30 p-3">
                            <Text className="text-mf-secondary font-solway text-xs uppercase tracking-widest">{t('test.matchingYourPair')}</Text>
                            <Text className={`font-solway mt-1 ${rowCorrect ? 'text-green-300' : 'text-red-300'}`}>
                              {chosenRight?.content || t('test.matchingNoAnswer')}
                            </Text>
                          </View>
                          <View className="mt-2 rounded-lg border border-mf-secondary/20 bg-mf-bg/30 p-3">
                            <Text className="text-mf-secondary font-solway text-xs uppercase tracking-widest">{t('test.matchingCorrectPair')}</Text>
                            <Text className="text-green-300 font-solway mt-1">{correctRight?.content || '...'}</Text>
                          </View>
                        </View>
                      );
                    })}
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
                      <Text className={`font-solway text-base ${textStyle}`}>{getAnswerLabel(currentQuestion, a)}</Text>
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
          rightContent={null}
        />

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
          <View className="mt-6">
            {test?.description ? (
              <Text className="text-mf-secondary font-solway text-sm">{test.description}</Text>
            ) : null}

            <View className="mt-3 rounded-xl border border-mf-secondary/20 bg-mf-secondary/10 p-3">
              <View className="flex-row items-center justify-between">
                <Text className="text-mf-secondary font-solway text-xs uppercase tracking-widest">
                  {t('test.progress', { current: step + 1, total: Math.max(totalQuestions, 1) })}
                </Text>
                <Text className="text-mf-text font-solway-bold text-xs">{questionTypeLabel}</Text>
              </View>
              <View className="mt-2 h-2 rounded-full bg-mf-secondary/20 overflow-hidden">
                <View
                  className="h-2 rounded-full bg-mf-primary"
                  style={{ width: `${Math.max(4, Math.min(100, ((step + 1) / Math.max(totalQuestions, 1)) * 100))}%` }}
                />
              </View>
            </View>
          </View>

          <View className="mt-6 rounded-2xl border border-mf-secondary/20 bg-mf-secondary/10 p-5 shadow-xl">
            <Animated.View style={{ opacity: animOpacity, transform: [{ translateY: animTranslate }] }}>
              <Text className="text-mf-text font-solway-bold text-xl">{currentQuestion?.content || ''}</Text>

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
              ) : isMatchingQuestion ? (
                <View className="rounded-xl border border-mf-secondary/20 bg-mf-bg/40 p-4">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-mf-secondary font-solway text-sm uppercase tracking-widest">{t('test.matchingTitle')}</Text>
                    <TouchableOpacity
                      className="px-3 py-2 rounded-xl border border-mf-secondary/25 bg-mf-secondary/10"
                      onPress={handleToggleConnections}
                    >
                      <Text className="text-mf-secondary font-solway-bold text-sm">
                        {showConnections ? t('test.matchingConnectionsOn') : t('test.matchingConnectionsOff')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <Text className="text-mf-secondary font-solway text-sm mt-2">{t('test.matchingHint')}</Text>

                  <View className="mt-3 rounded-xl border border-mf-primary/25 bg-mf-primary/10 px-3 py-2 flex-row items-center justify-between">
                    <Text className="text-mf-text font-solway-bold text-sm">
                      {t('test.matchingProgress', { current: matchingProgress.current, total: Math.max(matchingProgress.total, 1) })}
                    </Text>
                    <TouchableOpacity onPress={handleToggleOverview}>
                      <Text className="text-mf-secondary font-solway-bold text-sm">
                        {showMatchingOverview ? t('test.matchingHideOverview') : t('test.matchingShowOverview')}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {activeMatchingLeft ? (
                    <View className="mt-3 rounded-xl border border-mf-primary/35 bg-mf-primary/15 px-3 py-3">
                      <Text className="text-mf-secondary font-solway text-sm uppercase tracking-widest">{t('test.matchingNowLinking')}</Text>
                      <Text className="text-mf-text font-solway-bold text-base mt-1">
                        #{matchingLeftIndexById[String(activeMatchingLeft.id)] || '?'} {activeMatchingLeft.content || '...'}
                      </Text>
                    </View>
                  ) : null}

                  <View
                    className="mt-4 rounded-xl border border-mf-secondary/20 bg-mf-secondary/5 p-3"
                    onLayout={(event) => setMatchingCanvasLayout(event.nativeEvent.layout)}
                  >
                    <View className="flex-row" style={{ gap: 12 }}>
                      <View
                        className="w-16"
                        onLayout={(event) => setMatchingLeftColumnLayout(event.nativeEvent.layout)}
                      >
                        {matchingModel.left.map((leftItem, idx) => {
                          const leftId = String(leftItem.id);
                          const isActiveLeft = String(activeMatchingLeftId) === leftId;
                          const hasPair = Boolean(selectedPairs[leftId]);
                          return (
                            <TouchableOpacity
                              key={`${leftId}-${idx}`}
                              className={`mt-3 rounded-xl border items-center py-3 ${isActiveLeft ? 'border-mf-primary bg-mf-primary/15' : 'border-mf-secondary/20 bg-mf-bg/30'}`}
                              onPress={() => handleSelectMatchingLeft(leftId)}
                              onLayout={(event) => {
                                const nextLayout = event.nativeEvent.layout;
                                setMatchingLeftLayouts((prev) => ({ ...prev, [leftId]: nextLayout }));
                              }}
                              disabled={isTransitioning}
                            >
                              <Text className="text-mf-text font-solway-bold text-sm">#{matchingLeftIndexById[leftId] || idx + 1}</Text>
                              <View className={`mt-1 w-2 h-2 rounded-full ${hasPair ? 'bg-green-300' : 'bg-mf-secondary/40'}`} />
                            </TouchableOpacity>
                          );
                        })}
                      </View>

                      <View
                        className="flex-1"
                        onLayout={(event) => setMatchingRightColumnLayout(event.nativeEvent.layout)}
                      >
                        {matchingModel.right.map((rightItem) => {
                          const rightId = String(rightItem.id);
                          const usedByLeft = usedRightToLeftMap[rightId] || null;
                          const isSelectedForActive = usedByLeft && String(usedByLeft) === String(activeMatchingLeftId);
                          const isLocked = usedByLeft && !isSelectedForActive;

                          return (
                            <TouchableOpacity
                              key={`right-${rightId}`}
                              className={`mt-3 rounded-xl border px-3 py-4 ${isSelectedForActive ? 'bg-mf-primary/25 border-mf-primary' : isLocked ? 'bg-mf-secondary/10 border-mf-secondary/10' : 'bg-mf-bg/40 border-mf-secondary/25'}`}
                              onPress={() => handlePickMatchingRight(rightId)}
                              onLayout={(event) => {
                                const nextLayout = event.nativeEvent.layout;
                                setMatchingRightLayouts((prev) => ({ ...prev, [rightId]: nextLayout }));
                              }}
                              disabled={isTransitioning || isLocked}
                            >
                              <View className="flex-row items-center justify-between">
                                <Text className={`font-solway text-base flex-1 pr-2 ${isLocked ? 'text-mf-secondary' : 'text-mf-text'}`}>
                                  {rightItem.content || t('test.matchingChoose')}
                                </Text>
                                {usedByLeft ? (
                                  <View className={`px-2 py-1 rounded-full ${isSelectedForActive ? 'bg-mf-primary/40' : 'bg-mf-secondary/20'}`}>
                                    <Text className="text-mf-text font-solway-bold text-sm">#{matchingLeftIndexById[String(usedByLeft)] || '?'}</Text>
                                  </View>
                                ) : null}
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>

                    {showConnections && matchingCanvasLayout ? (
                      <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
                        <Svg width={matchingCanvasLayout.width} height={matchingCanvasLayout.height}>
                          {visibleMatchingConnections.map((connection) => {
                            const curve = Math.max(24, Math.abs(connection.toX - connection.fromX) * 0.35);
                            const d = `M ${connection.fromX} ${connection.fromY} C ${connection.fromX + curve} ${connection.fromY}, ${connection.toX - curve} ${connection.toY}, ${connection.toX} ${connection.toY}`;
                            return (
                              <Path
                                key={connection.id}
                                d={d}
                                stroke={connection.color}
                                strokeWidth={connection.isActive ? 2.4 : 1.2}
                                strokeOpacity={connection.isActive ? 0.72 : 0.2}
                                fill="none"
                              />
                            );
                          })}
                        </Svg>
                      </View>
                    ) : null}
                  </View>

                  {showMatchingOverview && matchingPairPreview.length ? (
                    <View className="mt-3 rounded-xl border border-mf-secondary/20 bg-mf-secondary/5 p-3">
                      <Text className="text-mf-secondary font-solway text-sm uppercase tracking-widest">{t('test.matchingOverview')}</Text>
                      {matchingPairPreview.map((row) => (
                        <Text key={`pair-${row.leftId}`} className="text-mf-text font-solway text-sm mt-2">
                          #{row.leftLabel || '?'} {row.leftContent || '...'} -> {row.rightContent || t('test.matchingChoose')}
                        </Text>
                      ))}
                    </View>
                  ) : null}
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
                      <Text className={`font-solway text-base ${isSelected ? 'text-mf-text font-solway-bold' : 'text-mf-text'}`}>{getAnswerLabel(currentQuestion, a)}</Text>
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
              className={`flex-1 py-4 rounded-xl items-center ${canGoNext && !isTransitioning && !isSubmitting ? 'bg-mf-primary' : 'bg-mf-secondary/15'}`}
              onPress={handleNext}
              disabled={!canGoNext || isTransitioning || isSubmitting}
            >
              {isSubmitting ? (
                <View className="flex-row items-center">
                  <ActivityIndicator size="small" color="#eae9fc" />
                  <Text className="text-mf-text font-solway-bold ml-2">{t('test.submitting')}</Text>
                </View>
              ) : (
                <Text className="text-mf-text font-solway-bold">{step >= questions.length - 1 ? t('test.finish') : t('test.next')}</Text>
              )}
            </TouchableOpacity>
          </View>

          {submitError ? (
            <View className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
              <Text className="text-red-300 font-solway text-sm">{submitError}</Text>
              <TouchableOpacity
                className="mt-2 self-start px-3 py-2 rounded-lg border border-red-400/40 bg-red-500/10"
                onPress={handleNext}
              >
                <Text className="text-red-200 font-solway-bold text-xs uppercase tracking-widest">{t('test.submitRetry')}</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {!canGoNext && !submitError ? (
            <View className="mt-3 rounded-xl border border-mf-secondary/20 bg-mf-secondary/5 px-3 py-2">
              <Text className="text-mf-secondary font-solway text-sm">
                {isMatchingQuestion ? t('test.matchingNeedAllPairs') : t('test.answerRequiredHint')}
              </Text>
            </View>
          ) : null}

        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
