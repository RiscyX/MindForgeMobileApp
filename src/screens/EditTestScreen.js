import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../hooks/useLanguage';
import { fetchCreatorTestMetadataRequest } from '../services/creatorAiApi';
import {
  getTestForEditDetailRequest,
  patchTestRequest,
} from '../services/testManagementApi';

// Language ID mapping: 1 = HU, 2 = EN (backend convention)
const langCodeToId = (lang) =>
  String(lang || '').toLowerCase().startsWith('hu') ? 1 : 2;

// Question type constants
const TYPE_MULTIPLE_CHOICE = 'multiple_choice';
const TYPE_TRUE_FALSE = 'true_false';
const TYPE_TEXT = 'text';
const TYPE_MATCHING = 'matching';

const ALL_TYPES = [TYPE_MULTIPLE_CHOICE, TYPE_TRUE_FALSE, TYPE_TEXT, TYPE_MATCHING];
const TYPE_LABELS = {
  [TYPE_MULTIPLE_CHOICE]: 'MC',
  [TYPE_TRUE_FALSE]: 'T/F',
  [TYPE_TEXT]: 'TXT',
  [TYPE_MATCHING]: 'MTH',
};

const SOURCE_HUMAN = 'human';

const normalizeSourceType = (value, fallback = SOURCE_HUMAN) => {
  const next = String(value || '').trim();
  return next || fallback;
};

const normalizeMatchSide = (value) => {
  const side = String(value || '').toLowerCase();
  return side === 'left' || side === 'right' ? side : null;
};

const normalizePosition = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const toNullableId = (value) => {
  if (value === null || value === undefined || value === '') return null;
  return value;
};

const buildQuestionTranslationSkeleton = (languageId, sourceType = SOURCE_HUMAN) => ({
  id: null,
  language_id: Number(languageId),
  content: '',
  explanation: '',
  source_type: normalizeSourceType(sourceType, SOURCE_HUMAN),
});

const buildAnswerTranslationSkeleton = (languageId, sourceType = SOURCE_HUMAN) => ({
  id: null,
  language_id: Number(languageId),
  content: '',
  source_type: normalizeSourceType(sourceType, SOURCE_HUMAN),
});

const buildAnswerNode = ({
  id = null,
  isCorrect = false,
  position = 1,
  sourceType = SOURCE_HUMAN,
  matchSide = null,
  matchGroup = null,
  translations = [],
}) => ({
  id: toNullableId(id),
  is_correct: Boolean(isCorrect),
  position: normalizePosition(position, 1),
  source_type: normalizeSourceType(sourceType, SOURCE_HUMAN),
  match_side: normalizeMatchSide(matchSide),
  match_group: matchGroup != null && Number.isFinite(Number(matchGroup)) ? Number(matchGroup) : null,
  answer_translations: translations,
});

const buildDefaultAnswers = (questionType, activeLangId, questionSourceType = SOURCE_HUMAN) => {
  const answerSourceType = normalizeSourceType(questionSourceType, SOURCE_HUMAN);

  if (questionType === TYPE_TRUE_FALSE) {
    return [
      buildAnswerNode({
        isCorrect: true,
        position: 1,
        sourceType: answerSourceType,
        translations: [{ ...buildAnswerTranslationSkeleton(activeLangId, answerSourceType), content: 'True' }],
      }),
      buildAnswerNode({
        isCorrect: false,
        position: 2,
        sourceType: answerSourceType,
        translations: [{ ...buildAnswerTranslationSkeleton(activeLangId, answerSourceType), content: 'False' }],
      }),
    ];
  }

  if (questionType === TYPE_TEXT) {
    return [
      buildAnswerNode({
        isCorrect: true,
        position: 1,
        sourceType: answerSourceType,
        translations: [buildAnswerTranslationSkeleton(activeLangId, answerSourceType)],
      }),
    ];
  }

  if (questionType === TYPE_MATCHING) {
    return [
      buildAnswerNode({ isCorrect: true, position: 1, sourceType: answerSourceType, matchSide: 'left', matchGroup: 1, translations: [buildAnswerTranslationSkeleton(activeLangId, answerSourceType)] }),
      buildAnswerNode({ isCorrect: true, position: 2, sourceType: answerSourceType, matchSide: 'right', matchGroup: 1, translations: [buildAnswerTranslationSkeleton(activeLangId, answerSourceType)] }),
      buildAnswerNode({ isCorrect: true, position: 3, sourceType: answerSourceType, matchSide: 'left', matchGroup: 2, translations: [buildAnswerTranslationSkeleton(activeLangId, answerSourceType)] }),
      buildAnswerNode({ isCorrect: true, position: 4, sourceType: answerSourceType, matchSide: 'right', matchGroup: 2, translations: [buildAnswerTranslationSkeleton(activeLangId, answerSourceType)] }),
      buildAnswerNode({ isCorrect: true, position: 5, sourceType: answerSourceType, matchSide: 'left', matchGroup: 3, translations: [buildAnswerTranslationSkeleton(activeLangId, answerSourceType)] }),
      buildAnswerNode({ isCorrect: true, position: 6, sourceType: answerSourceType, matchSide: 'right', matchGroup: 3, translations: [buildAnswerTranslationSkeleton(activeLangId, answerSourceType)] }),
    ];
  }

  return [
    buildAnswerNode({
      isCorrect: true,
      position: 1,
      sourceType: answerSourceType,
      translations: [buildAnswerTranslationSkeleton(activeLangId, answerSourceType)],
    }),
    buildAnswerNode({
      isCorrect: false,
      position: 2,
      sourceType: answerSourceType,
      translations: [buildAnswerTranslationSkeleton(activeLangId, answerSourceType)],
    }),
  ];
};

const resequenceAnswers = (answers, questionType, questionSourceType = SOURCE_HUMAN) => {
  const qSource = normalizeSourceType(questionSourceType, SOURCE_HUMAN);
  return (answers || []).map((a, idx) => {
    const aSource = normalizeSourceType(a?.source_type, qSource);
    const normalized = {
      id: toNullableId(a?.id),
      is_correct: Boolean(a?.is_correct),
      position: idx + 1,
      source_type: aSource,
      match_side: questionType === TYPE_MATCHING ? normalizeMatchSide(a?.match_side) : null,
      match_group: questionType === TYPE_MATCHING && a?.match_group != null && Number.isFinite(Number(a.match_group))
        ? Number(a.match_group)
        : null,
      answer_translations: (a?.answer_translations || []).map((at) => ({
        id: toNullableId(at?.id),
        language_id: Number(at?.language_id),
        content: String(at?.content || ''),
        source_type: normalizeSourceType(at?.source_type, aSource),
      })),
    };
    return normalized;
  });
};

const resequenceQuestions = (questions) => {
  return (questions || []).map((q, idx) => {
    const qSource = normalizeSourceType(q?.source_type, SOURCE_HUMAN);
    return {
      id: toNullableId(q?.id),
      question_type: q?.question_type || TYPE_MULTIPLE_CHOICE,
      position: idx + 1,
      source_type: qSource,
      is_active: q?.is_active !== false,
      question_translations: (q?.question_translations || []).map((qt) => ({
        id: toNullableId(qt?.id),
        language_id: Number(qt?.language_id),
        content: String(qt?.content || ''),
        explanation: String(qt?.explanation || ''),
        source_type: normalizeSourceType(qt?.source_type, qSource),
      })),
      answers: resequenceAnswers(q?.answers || [], q?.question_type, qSource),
      ...(q?.category_id ? { category_id: q.category_id } : {}),
    };
  });
};

const ensureQuestionTranslation = (question, languageId) => {
  const langId = Number(languageId);
  if (!Array.isArray(question.question_translations)) {
    question.question_translations = [];
  }
  let row = question.question_translations.find((qt) => Number(qt.language_id) === langId);
  if (!row) {
    row = buildQuestionTranslationSkeleton(langId, question.source_type);
    question.question_translations.push(row);
  }
  row.source_type = normalizeSourceType(row.source_type, question.source_type || SOURCE_HUMAN);
  return row;
};

const ensureAnswerTranslation = (question, answer, languageId) => {
  const langId = Number(languageId);
  if (!Array.isArray(answer.answer_translations)) {
    answer.answer_translations = [];
  }
  let row = answer.answer_translations.find((at) => Number(at.language_id) === langId);
  if (!row) {
    row = buildAnswerTranslationSkeleton(langId, answer.source_type || question.source_type || SOURCE_HUMAN);
    answer.answer_translations.push(row);
  }
  row.source_type = normalizeSourceType(
    row.source_type,
    answer.source_type || question.source_type || SOURCE_HUMAN,
  );
  return row;
};

const getQuestionTranslation = (question, languageId) => {
  const langId = Number(languageId);
  return (question?.question_translations || []).find((qt) => Number(qt.language_id) === langId) || null;
};

const getAnswerTranslation = (answer, languageId) => {
  const langId = Number(languageId);
  return (answer?.answer_translations || []).find((at) => Number(at.language_id) === langId) || null;
};

const newQuestion = (type, languageId) => {
  const sourceType = SOURCE_HUMAN;
  return {
    id: null,
    question_type: type,
    position: 1,
    source_type: sourceType,
    is_active: true,
    question_translations: [buildQuestionTranslationSkeleton(languageId, sourceType)],
    answers: buildDefaultAnswers(type, languageId, sourceType),
  };
};

const apiQuestionToEditorState = (q, fallbackLangId) => {
  const questionSourceType = normalizeSourceType(q?.source_type, SOURCE_HUMAN);
  const translations = (q?.question_translations || []).map((qt) => ({
    id: toNullableId(qt?.id),
    language_id: Number(qt?.language_id),
    content: String(qt?.content || ''),
    explanation: String(qt?.explanation || ''),
    source_type: normalizeSourceType(qt?.source_type, questionSourceType),
  }));

  if (!translations.some((qt) => Number(qt.language_id) === Number(fallbackLangId))) {
    translations.push(buildQuestionTranslationSkeleton(fallbackLangId, questionSourceType));
  }

  const answers = (q?.answers || []).map((a, idx) => {
    const answerSourceType = normalizeSourceType(a?.source_type, questionSourceType);
    const answerTranslations = (a?.answer_translations || []).map((at) => ({
      id: toNullableId(at?.id),
      language_id: Number(at?.language_id),
      content: String(at?.content || ''),
      source_type: normalizeSourceType(at?.source_type, answerSourceType),
    }));

    if (!answerTranslations.some((at) => Number(at.language_id) === Number(fallbackLangId))) {
      answerTranslations.push(buildAnswerTranslationSkeleton(fallbackLangId, answerSourceType));
    }

    return {
      id: toNullableId(a?.id),
      is_correct: Boolean(a?.is_correct),
      position: normalizePosition(a?.position, idx + 1),
      source_type: answerSourceType,
      match_side: normalizeMatchSide(a?.match_side),
      match_group: a?.match_group != null && Number.isFinite(Number(a.match_group)) ? Number(a.match_group) : null,
      answer_translations: answerTranslations,
    };
  });

  return {
    id: toNullableId(q?.id),
    question_type: q?.question_type || TYPE_MULTIPLE_CHOICE,
    position: normalizePosition(q?.position, 1),
    source_type: questionSourceType,
    is_active: q?.is_active !== false,
    question_translations: translations,
    answers,
    ...(q?.category_id ? { category_id: q.category_id } : {}),
  };
};

const buildTestUpdatePayload = (editorState) => {
  const testTranslations = Object.entries(editorState.testTranslations || {}).map(([langId, tt]) => {
    const row = {
      language_id: Number(langId),
      title: String(tt?.title || ''),
      description: String(tt?.description || ''),
    };
    if (tt?.id !== null && tt?.id !== undefined) row.id = tt.id;
    return row;
  });

  const normalizedQuestions = resequenceQuestions(editorState.questions || []);

  const questions = normalizedQuestions.map((q) => {
    const questionSourceType = normalizeSourceType(q.source_type, SOURCE_HUMAN);

    const questionTranslations = (q.question_translations || []).map((qt) => {
      const row = {
        language_id: Number(qt.language_id),
        content: String(qt.content || ''),
        explanation: String(qt.explanation || ''),
        source_type: normalizeSourceType(qt.source_type, questionSourceType),
      };
      if (qt.id !== null && qt.id !== undefined) row.id = qt.id;
      return row;
    });

    const answers = (q.answers || []).map((a, idx) => {
      const answerSourceType = normalizeSourceType(a.source_type, questionSourceType);
      const answerTranslations = (a.answer_translations || []).map((at) => {
        const row = {
          language_id: Number(at.language_id),
          content: String(at.content || ''),
          source_type: normalizeSourceType(at.source_type, answerSourceType),
        };
        if (at.id !== null && at.id !== undefined) row.id = at.id;
        return row;
      });

      const answerRow = {
        is_correct: Boolean(a.is_correct),
        position: idx + 1,
        source_type: answerSourceType,
        answer_translations: answerTranslations,
      };
      if (a.id !== null && a.id !== undefined) answerRow.id = a.id;

      if (q.question_type === TYPE_MATCHING) {
        answerRow.match_side = normalizeMatchSide(a.match_side) || (idx % 2 === 0 ? 'left' : 'right');
        const fallbackGroup = Math.floor(idx / 2) + 1;
        answerRow.match_group = a.match_group != null && Number.isFinite(Number(a.match_group))
          ? Number(a.match_group)
          : fallbackGroup;
      }

      return answerRow;
    });

    const qRow = {
      question_type: q.question_type,
      is_active: q.is_active !== false,
      source_type: questionSourceType,
      position: q.position,
      question_translations: questionTranslations,
      answers,
    };

    if (q.id !== null && q.id !== undefined) qRow.id = q.id;
    if (q.category_id) qRow.category_id = q.category_id;
    return qRow;
  });

  return {
    category_id: editorState.categoryId ? Number(editorState.categoryId) : null,
    difficulty_id: editorState.difficultyId ? Number(editorState.difficultyId) : null,
    is_public: Boolean(editorState.isPublic),
    test_translations: testTranslations,
    questions,
  };
};

const redactPayloadForDebug = (input) => {
  if (Array.isArray(input)) {
    return input.map((value) => redactPayloadForDebug(value));
  }
  if (!input || typeof input !== 'object') {
    return input;
  }

  const out = {};
  Object.keys(input).forEach((key) => {
    const value = input[key];
    if (typeof value === 'string' && ['content', 'explanation', 'title', 'description'].includes(key)) {
      out[key] = `<redacted:${value.length}>`;
      return;
    }
    out[key] = redactPayloadForDebug(value);
  });
  return out;
};

const flattenDetails = (input, prefix = '', out = []) => {
  if (Array.isArray(input)) {
    input.forEach((value, idx) => {
      const nextPrefix = prefix ? `${prefix}.${idx}` : String(idx);
      flattenDetails(value, nextPrefix, out);
    });
    return out;
  }

  if (input && typeof input === 'object') {
    Object.entries(input).forEach(([key, value]) => {
      const normalizedKey = key.replace(/\[(\d+)\]/g, '.$1');
      const nextPrefix = prefix ? `${prefix}.${normalizedKey}` : normalizedKey;
      flattenDetails(value, nextPrefix, out);
    });
    return out;
  }

  out.push({ key: prefix || 'global', message: String(input || '') });
  return out;
};

const parse422ErrorDetails = (error, fallbackMessage) => {
  const details = error?.data?.error?.details ?? error?.data?.details;
  const globalErrors = [];
  const fieldErrors = {};

  if (details === null || details === undefined) {
    if (fallbackMessage) globalErrors.push(String(fallbackMessage));
    return { globalErrors, fieldErrors };
  }

  flattenDetails(details).forEach(({ key, message }) => {
    if (!message) return;
    if (!key || key === 'global') {
      globalErrors.push(message);
      return;
    }
    const aliases = [
      key,
      key.replace(/\.question_translations\.\d+\.content$/g, '.question.content'),
      key.replace(/\.answer_translations\.\d+\.content$/g, '.content'),
      key.replace(/\.answer_translations\.\d+\.source_text$/g, '.content'),
      key.replace(/\.match_side$/g, '.matching.pairs'),
      key.replace(/\.match_group$/g, '.matching.pairs'),
    ];
    aliases.forEach((alias) => {
      if (!fieldErrors[alias]) {
        fieldErrors[alias] = message;
      }
    });
  });

  if (!globalErrors.length && !Object.keys(fieldErrors).length && fallbackMessage) {
    globalErrors.push(String(fallbackMessage));
  }

  return { globalErrors, fieldErrors };
};

const getFieldError = (fieldErrors, candidates) => {
  for (const key of candidates) {
    if (fieldErrors[key]) return fieldErrors[key];
  }
  const keys = Object.keys(fieldErrors || {});
  for (const candidate of candidates) {
    const matched = keys.find((k) => k.endsWith(candidate));
    if (matched && fieldErrors[matched]) return fieldErrors[matched];
  }
  return null;
};

const validateEditorState = (editorState, t) => {
  const globalErrors = [];
  const fieldErrors = {};

  const hasTitleInSomeLang = Object.values(editorState.testTranslations || {}).some(
    (tt) => String(tt?.title || '').trim() !== '',
  );
  if (!hasTitleInSomeLang) {
    globalErrors.push(t('editTest.validationTitleRequired'));
  }

  (editorState.questions || []).forEach((q, qIdx) => {
    const hasQuestionText = (q.question_translations || []).some(
      (qt) => String(qt?.content || '').trim() !== '',
    );
    if (!hasQuestionText) {
      fieldErrors[`questions.${qIdx}.question.content`] = t('editTest.validationQuestionRequired');
      globalErrors.push(t('editTest.validationQuestionRequired'));
    }

    if (q.question_type !== TYPE_TEXT) {
      const hasCorrect = (q.answers || []).some((a) => Boolean(a?.is_correct));
      if (!hasCorrect) {
        fieldErrors[`questions.${qIdx}.answers.correct`] = t('editTest.validationCorrectRequired');
        globalErrors.push(t('editTest.validationCorrectRequired'));
      }
    }

    if (q.question_type === TYPE_TEXT) {
      const hasTextAnswer = (q.answers || []).some((a) =>
        (a.answer_translations || []).some((at) => String(at?.content || '').trim() !== ''),
      );
      if (!hasTextAnswer) {
        fieldErrors[`questions.${qIdx}.answers.text`] = t('editTest.validationAnswerRequired');
        globalErrors.push(t('editTest.validationAnswerRequired'));
      }
    }

    if (q.question_type !== TYPE_TEXT) {
      (q.answers || []).forEach((a, aIdx) => {
        const hasAnswerText = (a.answer_translations || []).some(
          (at) => String(at?.content || '').trim() !== '',
        );
        if (!hasAnswerText) {
          fieldErrors[`questions.${qIdx}.answers.${aIdx}.content`] = t('editTest.validationAnswerRequired');
          globalErrors.push(t('editTest.validationAnswerRequired'));
        }
      });
    }

    if (q.question_type === TYPE_MATCHING) {
      const groups = {};
      (q.answers || []).forEach((a) => {
        const side = normalizeMatchSide(a?.match_side);
        const group = Number(a?.match_group);
        if (!side || !Number.isFinite(group) || group <= 0) {
          return;
        }
        if (!groups[group]) groups[group] = { left: 0, right: 0 };
        groups[group][side] += 1;
      });

      const validPairs = Object.values(groups).filter((g) => g.left === 1 && g.right === 1).length;
      if (validPairs < 3) {
        fieldErrors[`questions.${qIdx}.matching.pairs`] = t('editTest.validationMatchPairs');
        globalErrors.push(t('editTest.validationMatchPairs'));
      }
    }
  });

  return {
    globalErrors: [...new Set(globalErrors)],
    fieldErrors,
  };
};

export default function EditTestScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { testId } = route.params || {};
  const { t, language } = useLanguage();
  const { authFetch } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [validationErrors, setValidationErrors] = useState([]);
  const [fieldErrors, setFieldErrors] = useState({});

  // Active language for editing translations
  const [editLanguage, setEditLanguage] = useState(language || 'en');
  const activeLangKey = String(langCodeToId(editLanguage));

  const [metadata, setMetadata] = useState({ categories: [], difficulties: [] });

  const [form, setForm] = useState({
    categoryId: null,
    difficultyId: null,
    isPublic: true,
    testTranslations: {}, // keyed by language_id string
    questions: [],
  });

  // Load test data and metadata
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setErrorMessage(null);
      try {
        const [testData, metaPayload] = await Promise.all([
          getTestForEditDetailRequest({ authFetch, testId, language }),
          fetchCreatorTestMetadataRequest({ authFetch, language }),
        ]);

        if (cancelled) return;

        if (!testData) {
          setErrorMessage(t('editTest.loadError'));
          setLoading(false);
          return;
        }

        // Build testTranslations map keyed by language_id string
        const ttMap = {};
        (testData.test_translations || []).forEach((tt) => {
          ttMap[String(tt.language_id)] = {
            id: tt.id || null,
            title: tt.title || '',
            description: tt.description || '',
          };
        });

        setForm({
          categoryId: testData.category_id ?? null,
          difficultyId: testData.difficulty_id ?? null,
          isPublic: testData.is_public !== false,
          testTranslations: ttMap,
          questions: resequenceQuestions(
            (testData.questions || []).map((q) => apiQuestionToEditorState(q, langCodeToId(language || 'en'))),
          ),
        });

        setMetadata({
          categories: Array.isArray(metaPayload?.categories) ? metaPayload.categories : [],
          difficulties: Array.isArray(metaPayload?.difficulties) ? metaPayload.difficulties : [],
        });
      } catch (e) {
        if (!cancelled) {
          setErrorMessage(e?.data?.error?.message || e?.message || t('editTest.loadError'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [authFetch, language, t, testId]);

  // Helpers to update form immutably
  const updateForm = useCallback((updater) => {
    setForm((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      const updated = updater(next);
      updated.questions = resequenceQuestions(updated.questions || []);
      return updated;
    });
  }, []);

  const setTestTranslationField = useCallback((langKey, field, value) => {
    updateForm((next) => {
      if (!next.testTranslations[langKey]) {
        next.testTranslations[langKey] = { title: '', description: '' };
      }
      next.testTranslations[langKey][field] = value;
      return next;
    });
  }, [updateForm]);

  const setQuestionTranslationContent = useCallback((qIdx, langKey, field, value) => {
    updateForm((next) => {
      const q = next.questions[qIdx];
      if (!q) return next;
      const row = ensureQuestionTranslation(q, Number(langKey));
      row[field] = value;
      return next;
    });
  }, [updateForm]);

  const setAnswerTranslationContent = useCallback((qIdx, aIdx, langKey, value) => {
    updateForm((next) => {
      const q = next.questions[qIdx];
      const a = q?.answers?.[aIdx];
      if (!q || !a) return next;
      const row = ensureAnswerTranslation(q, a, Number(langKey));
      row.content = value;
      return next;
    });
  }, [updateForm]);

  const toggleAnswerCorrect = useCallback((qIdx, aIdx) => {
    updateForm((next) => {
      next.questions[qIdx].answers[aIdx].is_correct = !next.questions[qIdx].answers[aIdx].is_correct;
      return next;
    });
  }, [updateForm]);

  const addQuestion = useCallback(() => {
    updateForm((next) => {
      next.questions.push(newQuestion(TYPE_MULTIPLE_CHOICE, Number(activeLangKey)));
      return next;
    });
  }, [activeLangKey, updateForm]);

  const removeQuestion = useCallback((qIdx) => {
    updateForm((next) => {
      next.questions.splice(qIdx, 1);
      return next;
    });
  }, [updateForm]);

  const changeQuestionType = useCallback((qIdx, type) => {
    updateForm((next) => {
      const q = next.questions[qIdx];
      if (!q) return next;
      const existingQT = q.question_translations;
      const newQ = newQuestion(type, Number(activeLangKey));
      newQ.id = q.id;
      newQ.position = q.position;
      newQ.is_active = q.is_active !== false;
      newQ.question_translations = existingQT;
      // Preserve source_type from original question
      newQ.source_type = q.source_type;
      next.questions[qIdx] = newQ;
      return next;
    });
  }, [activeLangKey, updateForm]);

  const addAnswer = useCallback((qIdx) => {
    updateForm((next) => {
      const q = next.questions[qIdx];
      if (!q) return next;
      next.questions[qIdx].answers.push({
        is_correct: false,
        id: null,
        position: (q.answers?.length || 0) + 1,
        source_type: normalizeSourceType(q.source_type, SOURCE_HUMAN),
        match_side: null,
        match_group: null,
        answer_translations: [
          buildAnswerTranslationSkeleton(Number(activeLangKey), normalizeSourceType(q.source_type, SOURCE_HUMAN)),
        ],
      });
      return next;
    });
  }, [activeLangKey, updateForm]);

  const removeAnswer = useCallback((qIdx, aIdx) => {
    updateForm((next) => {
      next.questions[qIdx].answers.splice(aIdx, 1);
      return next;
    });
  }, [updateForm]);

  const addMatchPair = useCallback((qIdx) => {
    updateForm((next) => {
      const q = next.questions[qIdx];
      if (!q) return next;
      const answers = q.answers;
      const answerSourceType = normalizeSourceType(q.source_type, SOURCE_HUMAN);
      const maxGroup = answers.reduce((m, a) => Math.max(m, a.match_group || 0), 0);
      const newGroup = maxGroup + 1;
      answers.push({
        is_correct: true,
        id: null,
        position: answers.length + 1,
        source_type: answerSourceType,
        match_side: 'left',
        match_group: newGroup,
        answer_translations: [buildAnswerTranslationSkeleton(Number(activeLangKey), answerSourceType)],
      });
      answers.push({
        is_correct: true,
        id: null,
        position: answers.length + 1,
        source_type: answerSourceType,
        match_side: 'right',
        match_group: newGroup,
        answer_translations: [buildAnswerTranslationSkeleton(Number(activeLangKey), answerSourceType)],
      });
      return next;
    });
  }, [activeLangKey, updateForm]);

  const removeMatchPair = useCallback((qIdx, groupNum) => {
    updateForm((next) => {
      next.questions[qIdx].answers = next.questions[qIdx].answers.filter(
        (a) => a.match_group !== groupNum,
      );
      return next;
    });
  }, [updateForm]);

  const handleSave = useCallback(async () => {
    setValidationErrors([]);
    setFieldErrors({});
    const preflight = validateEditorState(form, t);
    if (preflight.globalErrors.length > 0 || Object.keys(preflight.fieldErrors).length > 0) {
      setValidationErrors(preflight.globalErrors);
      setFieldErrors(preflight.fieldErrors);
      return;
    }

    setSaving(true);
    setErrorMessage(null);
    try {
      const payload = buildTestUpdatePayload(form);
      if (__DEV__) {
        console.log('[edit-test] update payload (redacted)', redactPayloadForDebug(payload));
      }
      await patchTestRequest({ authFetch, testId, body: payload });
      navigation.goBack();
    } catch (e) {
      const apiCode = String(e?.data?.error?.code || '').toUpperCase();
      if (e?.status === 422 || apiCode === 'TEST_UPDATE_FAILED') {
        const parsed = parse422ErrorDetails(e, t('editTest.saveError'));
        setValidationErrors(parsed.globalErrors);
        setFieldErrors(parsed.fieldErrors);
      }

      if (__DEV__) {
        const rawDetails = e?.data?.error?.details ?? e?.data?.details ?? null;
        console.log('[edit-test] update error status/code', { status: e?.status, code: e?.data?.error?.code || null });
        console.log('[edit-test] update error details (redacted)', redactPayloadForDebug(rawDetails));
      }

      setErrorMessage(e?.data?.error?.message || e?.message || t('editTest.saveError'));
    } finally {
      setSaving(false);
    }
  }, [authFetch, form, navigation, t, testId]);

  const currentTitle = useMemo(
    () => form.testTranslations?.[activeLangKey]?.title || '',
    [activeLangKey, form.testTranslations],
  );

  const currentDescription = useMemo(
    () => form.testTranslations?.[activeLangKey]?.description || '',
    [activeLangKey, form.testTranslations],
  );

  const titleFieldError = useMemo(
    () => getFieldError(fieldErrors, [
      `test_translations.${activeLangKey}.title`,
      'test_translations.title',
      'title',
    ]),
    [activeLangKey, fieldErrors],
  );

  if (loading) {
    return (
      <View className="flex-1 bg-transparent">
        <SafeAreaView className="flex-1 items-center justify-center" edges={['top', 'left', 'right']}>
          <StatusBar style="light" />
          <ActivityIndicator size="large" color="#575ddb" />
          <Text className="text-mf-secondary font-solway mt-4">{t('editTest.loading')}</Text>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-transparent">
      <SafeAreaView className="flex-1 px-6" edges={['top', 'left', 'right']}>
        <StatusBar style="light" />

        {/* Header */}
        <View className="mt-3 flex-row items-center">
          <Pressable
            className="w-11 h-11 rounded-xl border border-mf-secondary/25 bg-mf-secondary/10 items-center justify-center"
            onPress={() => navigation.goBack()}
          >
            <Text className="text-mf-text font-solway-bold text-lg">&lt;</Text>
          </Pressable>
          <View className="flex-1 items-center">
            <Text className="text-mf-text font-solway-extrabold text-base tracking-widest">
              {t('editTest.title')}
            </Text>
          </View>
          <View className="w-11 h-11" />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 140 }}
        >

          {/* Error / Validation */}
          {errorMessage ? (
            <View className="mt-4 rounded-xl border border-red-500/35 bg-red-500/10 p-3">
              <Text className="text-red-200 font-solway">{errorMessage}</Text>
            </View>
          ) : null}

          {validationErrors.length > 0 ? (
            <View className="mt-4 rounded-xl border border-red-500/35 bg-red-500/10 p-3">
              {validationErrors.map((e, i) => (
                <Text key={`ve-${i}`} className="text-red-200 font-solway">{`• ${e}`}</Text>
              ))}
            </View>
          ) : null}

          {/* Language selector */}
          <View className="mt-5 rounded-2xl border border-mf-secondary/20 bg-mf-secondary/10 p-4">
            <Text className="text-mf-secondary text-xs uppercase tracking-widest font-solway-bold mb-2">
              {t('editTest.languageLabel')}
            </Text>
            <View className="flex-row rounded-xl border border-mf-secondary/30 bg-mf-bg/80 p-1">
              {['en', 'hu'].map((lang) => (
                <Pressable
                  key={lang}
                  className={`flex-1 rounded-lg py-2 items-center ${editLanguage === lang ? 'bg-mf-primary' : 'bg-transparent'}`}
                  onPress={() => setEditLanguage(lang)}
                >
                  <Text
                    className={`font-solway-bold text-xs uppercase tracking-widest ${editLanguage === lang ? 'text-mf-text' : 'text-mf-secondary'}`}
                  >
                    {lang.toUpperCase()}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Metadata section */}
          <View className="mt-4 rounded-2xl border border-mf-secondary/20 bg-mf-secondary/10 p-4">
            <Text className="text-mf-text font-solway-extrabold text-sm uppercase tracking-widest mb-3">
              {t('editTest.metadataSection')}
            </Text>

            <Text className="text-mf-secondary text-xs uppercase tracking-widest font-solway-bold mb-1">
              {t('editTest.titleLabel')}
            </Text>
            <TextInput
              className="w-full rounded-xl border border-mf-secondary/25 bg-mf-bg/60 px-3 py-2 text-mf-text font-solway"
              value={currentTitle}
              onChangeText={(v) => setTestTranslationField(activeLangKey, 'title', v)}
              placeholderTextColor="#8a89a2"
            />
            {titleFieldError ? <Text className="text-red-300 font-solway mt-2">{titleFieldError}</Text> : null}

            <Text className="text-mf-secondary text-xs uppercase tracking-widest font-solway-bold mt-3 mb-1">
              {t('editTest.descriptionLabel')}
            </Text>
            <TextInput
              className="w-full rounded-xl border border-mf-secondary/25 bg-mf-bg/60 px-3 py-2 text-mf-text font-solway"
              value={currentDescription}
              onChangeText={(v) => setTestTranslationField(activeLangKey, 'description', v)}
              multiline
              style={{ minHeight: 80 }}
              placeholderTextColor="#8a89a2"
            />

            <Text className="text-mf-secondary text-xs uppercase tracking-widest font-solway-bold mt-3 mb-2">
              {t('editTest.categoryLabel')}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 8 }}>
              {metadata.categories.map((cat) => {
                const isActive = Number(form.categoryId) === Number(cat.id);
                return (
                  <Pressable
                    key={`cat-${cat.id}`}
                    className={`mr-2 px-3 py-2 rounded-lg border ${isActive ? 'bg-mf-primary border-mf-primary' : 'bg-mf-secondary/10 border-mf-secondary/30'}`}
                    onPress={() => updateForm((n) => { n.categoryId = cat.id; return n; })}
                  >
                    <Text className={`font-solway-bold text-xs uppercase tracking-wider ${isActive ? 'text-mf-text' : 'text-mf-secondary'}`}>
                      {cat.name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <Text className="text-mf-secondary text-xs uppercase tracking-widest font-solway-bold mt-3 mb-2">
              {t('editTest.difficultyLabel')}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 8 }}>
              {metadata.difficulties.map((diff) => {
                const isActive = Number(form.difficultyId) === Number(diff.id);
                return (
                  <Pressable
                    key={`diff-${diff.id}`}
                    className={`mr-2 px-3 py-2 rounded-lg border ${isActive ? 'bg-mf-primary border-mf-primary' : 'bg-mf-secondary/10 border-mf-secondary/30'}`}
                    onPress={() => updateForm((n) => { n.difficultyId = diff.id; return n; })}
                  >
                    <Text className={`font-solway-bold text-xs uppercase tracking-wider ${isActive ? 'text-mf-text' : 'text-mf-secondary'}`}>
                      {diff.name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <View className="mt-4 flex-row items-center justify-between">
              <Text className="text-mf-text font-solway-bold">{t('editTest.publicLabel')}</Text>
              <Switch
                value={Boolean(form.isPublic)}
                onValueChange={(v) => updateForm((n) => { n.isPublic = v; return n; })}
                trackColor={{ false: '#4f4f60', true: '#575ddb' }}
                thumbColor="#eae9fc"
              />
            </View>
          </View>

          {/* Questions section */}
          <View className="mt-4">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-mf-text font-solway-extrabold text-sm uppercase tracking-widest">
                {t('editTest.questionsSection')}
              </Text>
              <Pressable
                className="px-4 py-2 rounded-xl border border-mf-primary/40 bg-mf-primary/10"
                onPress={addQuestion}
              >
                <Text className="text-mf-text font-solway-extrabold text-xs uppercase tracking-widest">
                  {t('editTest.addQuestion')}
                </Text>
              </Pressable>
            </View>

            {form.questions.map((q, qIdx) => (
              <QuestionEditor
                key={`q-${qIdx}-${q.id || 'new'}`}
                question={q}
                qIdx={qIdx}
                activeLangKey={activeLangKey}
                fieldErrors={fieldErrors}
                t={t}
                onRemove={() => removeQuestion(qIdx)}
                onChangeType={(type) => changeQuestionType(qIdx, type)}
                onChangeQuestionText={(field, value) => setQuestionTranslationContent(qIdx, activeLangKey, field, value)}
                onChangeAnswerText={(aIdx, value) => setAnswerTranslationContent(qIdx, aIdx, activeLangKey, value)}
                onToggleCorrect={(aIdx) => toggleAnswerCorrect(qIdx, aIdx)}
                onAddAnswer={() => addAnswer(qIdx)}
                onRemoveAnswer={(aIdx) => removeAnswer(qIdx, aIdx)}
                onAddMatchPair={() => addMatchPair(qIdx)}
                onRemoveMatchPair={(group) => removeMatchPair(qIdx, group)}
                onChangeAnswerSideText={(aIdx, value) => setAnswerTranslationContent(qIdx, aIdx, activeLangKey, value)}
              />
            ))}

            {form.questions.length === 0 ? (
              <View className="rounded-2xl border border-mf-secondary/20 bg-mf-secondary/5 p-6 items-center">
                <Text className="text-mf-secondary font-solway text-center">
                  No questions yet. Tap "Add Question" to start.
                </Text>
              </View>
            ) : null}
          </View>

          {/* Save button */}
          <Pressable
            className="mt-6 bg-mf-primary py-4 rounded-xl items-center shadow-lg shadow-mf-primary/30"
            onPress={handleSave}
            disabled={saving}
            style={{ opacity: saving ? 0.7 : 1 }}
          >
            {saving ? (
              <View className="flex-row items-center">
                <ActivityIndicator size="small" color="#eae9fc" />
                <Text className="text-mf-text font-solway-bold text-base ml-3">{t('editTest.saving')}</Text>
              </View>
            ) : (
              <Text className="text-mf-text font-solway-bold text-base">{t('editTest.saveButton')}</Text>
            )}
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────

function QuestionEditor({
  question,
  qIdx,
  activeLangKey,
  fieldErrors,
  t,
  onRemove,
  onChangeType,
  onChangeQuestionText,
  onChangeAnswerText,
  onToggleCorrect,
  onAddAnswer,
  onRemoveAnswer,
  onAddMatchPair,
  onRemoveMatchPair,
  onChangeAnswerSideText,
}) {
  const qType = question.question_type;
  const qTranslation = getQuestionTranslation(question, Number(activeLangKey));
  const qText = qTranslation?.content || '';
  const qTextError = getFieldError(fieldErrors, [
    `questions.${qIdx}.question.${activeLangKey}.content`,
    `questions.${qIdx}.question_translations.${activeLangKey}.content`,
    `questions.${qIdx}.question.content`,
  ]);
  const matchingError = getFieldError(fieldErrors, [
    `questions.${qIdx}.matching.pairs`,
    `questions.${qIdx}.answers.matching`,
  ]);

  return (
    <View className="mb-4 rounded-2xl border border-mf-secondary/20 bg-mf-bg/30 p-4">
      {/* Question header */}
      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-mf-text font-solway-extrabold">{`Q${qIdx + 1}`}</Text>
        <Pressable
          className="px-3 py-2 rounded-xl border border-red-500/30 bg-red-500/10"
          onPress={onRemove}
        >
          <Text className="text-red-300 font-solway-bold text-xs uppercase tracking-widest">
            {t('editTest.removeQuestion')}
          </Text>
        </Pressable>
      </View>

      {/* Type selector */}
      <Text className="text-mf-secondary text-xs uppercase tracking-widest font-solway-bold mb-2">
        {t('editTest.questionTypeLabel')}
      </Text>
      <View className="flex-row mb-3">
        {ALL_TYPES.map((tp) => (
          <Pressable
            key={tp}
            className={`mr-2 px-3 py-2 rounded-xl border ${qType === tp ? 'bg-mf-primary border-mf-primary' : 'bg-mf-secondary/10 border-mf-secondary/30'}`}
            onPress={() => onChangeType(tp)}
          >
            <Text className={`font-solway-bold text-xs uppercase tracking-widest ${qType === tp ? 'text-mf-text' : 'text-mf-secondary'}`}>
              {TYPE_LABELS[tp]}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Question text */}
      <Text className="text-mf-secondary text-xs uppercase tracking-widest font-solway-bold mb-1">
        {t('editTest.questionContentLabel')}
      </Text>
      <TextInput
        className="w-full rounded-xl border border-mf-secondary/25 bg-mf-bg/60 px-3 py-2 text-mf-text font-solway mb-3"
        value={qText}
        onChangeText={(v) => onChangeQuestionText('content', v)}
        placeholderTextColor="#8a89a2"
        multiline
      />
      {qTextError ? <Text className="text-red-300 font-solway mb-2">{qTextError}</Text> : null}

      {/* Explanation */}
      <Text className="text-mf-secondary text-xs uppercase tracking-widest font-solway-bold mb-1">
        {t('editTest.explanationLabel')}
      </Text>
      <TextInput
        className="w-full rounded-xl border border-mf-secondary/25 bg-mf-bg/60 px-3 py-2 text-mf-text font-solway mb-3"
        value={qTranslation?.explanation || ''}
        onChangeText={(v) => onChangeQuestionText('explanation', v)}
        placeholderTextColor="#8a89a2"
        multiline
      />
      {matchingError && qType === TYPE_MATCHING ? (
        <Text className="text-red-300 font-solway mb-2">{matchingError}</Text>
      ) : null}

      {/* Answers */}
      {qType === TYPE_MATCHING ? (
        <MatchingEditor
          question={question}
          qIdx={qIdx}
          activeLangKey={activeLangKey}
          fieldErrors={fieldErrors}
          t={t}
          onAddMatchPair={onAddMatchPair}
          onRemoveMatchPair={onRemoveMatchPair}
          onChangeAnswerSideText={onChangeAnswerSideText}
        />
      ) : (
        <AnswerList
          question={question}
          qIdx={qIdx}
          qType={qType}
          activeLangKey={activeLangKey}
          fieldErrors={fieldErrors}
          t={t}
          onChangeAnswerText={onChangeAnswerText}
          onToggleCorrect={onToggleCorrect}
          onAddAnswer={onAddAnswer}
          onRemoveAnswer={onRemoveAnswer}
        />
      )}
    </View>
  );
}

function AnswerList({
  question,
  qIdx,
  qType,
  activeLangKey,
  fieldErrors,
  t,
  onChangeAnswerText,
  onToggleCorrect,
  onAddAnswer,
  onRemoveAnswer,
}) {
  const correctError = getFieldError(fieldErrors, [`questions.${qIdx}.answers.correct`]);
  const textAnswerError = getFieldError(fieldErrors, [`questions.${qIdx}.answers.text`]);

  return (
    <View>
      {correctError && qType !== TYPE_TEXT ? (
        <Text className="text-red-300 font-solway mb-2">{correctError}</Text>
      ) : null}
      {textAnswerError && qType === TYPE_TEXT ? (
        <Text className="text-red-300 font-solway mb-2">{textAnswerError}</Text>
      ) : null}
      {(question.answers || []).map((a, aIdx) => {
        const aText = getAnswerTranslation(a, Number(activeLangKey))?.content || '';
        const isCorrect = Boolean(a.is_correct);
        const isFixed = qType === TYPE_TRUE_FALSE || qType === TYPE_TEXT;
        const answerError = getFieldError(fieldErrors, [
          `questions.${qIdx}.answers.${aIdx}.${activeLangKey}.content`,
          `questions.${qIdx}.answers.${aIdx}.content`,
        ]);

        return (
          <View key={`a-${aIdx}`} className="mb-3 rounded-xl border border-mf-secondary/20 bg-mf-bg/50 p-3">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-mf-secondary font-solway text-xs uppercase tracking-widest">
                {`A${aIdx + 1}`}
              </Text>
              <View className="flex-row items-center">
                {qType !== TYPE_TEXT ? (
                  <Pressable
                    className={`mr-2 px-3 py-1 rounded-xl border ${isCorrect ? 'bg-green-500/15 border-green-500/35' : 'bg-mf-secondary/10 border-mf-secondary/25'}`}
                    onPress={() => !isFixed && onToggleCorrect(aIdx)}
                    disabled={isFixed}
                  >
                    <Text className={`${isCorrect ? 'text-green-200' : 'text-mf-secondary'} font-solway-bold text-xs uppercase tracking-widest`}>
                      {t('editTest.correct')}
                    </Text>
                  </Pressable>
                ) : null}
                {!isFixed ? (
                  <Pressable
                    className="px-2 py-1 rounded-xl border border-red-500/30 bg-red-500/10"
                    onPress={() => onRemoveAnswer(aIdx)}
                  >
                    <Text className="text-red-300 font-solway-bold text-xs uppercase tracking-widest">
                      {t('editTest.removeAnswer')}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </View>

            <TextInput
              className="w-full bg-transparent text-mf-text font-solway"
              value={aText}
              onChangeText={(v) => onChangeAnswerText(aIdx, v)}
              placeholderTextColor="#8a89a2"
              editable={!isFixed || qType === TYPE_TEXT}
            />
            {answerError ? <Text className="text-red-300 font-solway mt-2">{answerError}</Text> : null}
          </View>
        );
      })}

      {(qType === TYPE_MULTIPLE_CHOICE || qType === TYPE_TEXT) ? (
        <Pressable
          className="mt-1 px-4 py-2 rounded-xl border border-mf-primary/30 bg-mf-primary/10 self-start"
          onPress={onAddAnswer}
        >
          <Text className="text-mf-text font-solway-extrabold text-xs uppercase tracking-widest">
            {t('editTest.addAnswer')}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function MatchingEditor({
  question,
  qIdx,
  activeLangKey,
  fieldErrors,
  t,
  onAddMatchPair,
  onRemoveMatchPair,
  onChangeAnswerSideText,
}) {
  const answers = question.answers || [];

  // Group by match_group
  const groups = {};
  answers.forEach((a, idx) => {
    const g = a.match_group;
    if (!g) return;
    if (!groups[g]) groups[g] = [];
    groups[g].push({ ...a, _idx: idx });
  });
  const groupKeys = Object.keys(groups).map(Number).sort((a, b) => a - b);

  return (
    <View>
      {groupKeys.map((groupNum) => {
        const pair = groups[groupNum];
        const leftItem = pair.find((a) => a.match_side === 'left');
        const rightItem = pair.find((a) => a.match_side === 'right');
        const leftError = leftItem
          ? getFieldError(fieldErrors, [
            `questions.${qIdx}.answers.${leftItem._idx}.${activeLangKey}.content`,
            `questions.${qIdx}.answers.${leftItem._idx}.content`,
          ])
          : null;
        const rightError = rightItem
          ? getFieldError(fieldErrors, [
            `questions.${qIdx}.answers.${rightItem._idx}.${activeLangKey}.content`,
            `questions.${qIdx}.answers.${rightItem._idx}.content`,
          ])
          : null;

        return (
          <View key={`group-${groupNum}`} className="mb-3 rounded-xl border border-mf-secondary/20 bg-mf-bg/50 p-3">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-mf-secondary font-solway-bold text-xs uppercase tracking-widest">
                {t('editTest.matchPairLabel').replace('{{n}}', groupNum)}
              </Text>
              {groupKeys.length > 3 ? (
                <Pressable
                  className="px-2 py-1 rounded-xl border border-red-500/30 bg-red-500/10"
                  onPress={() => onRemoveMatchPair(groupNum)}
                >
                  <Text className="text-red-300 font-solway-bold text-xs uppercase tracking-widest">
                    {t('editTest.removeAnswer')}
                  </Text>
                </Pressable>
              ) : null}
            </View>

            <View className="flex-row">
              <View className="flex-1 mr-2">
                <Text className="text-mf-secondary text-xs font-solway-bold mb-1">{t('editTest.left')}</Text>
                <TextInput
                  className="rounded-xl border border-mf-secondary/25 bg-mf-bg/60 px-2 py-2 text-mf-text font-solway"
                  value={leftItem ? (getAnswerTranslation(leftItem, Number(activeLangKey))?.content || '') : ''}
                  onChangeText={(v) => leftItem && onChangeAnswerSideText(leftItem._idx, v)}
                  placeholderTextColor="#8a89a2"
                />
                {leftError ? <Text className="text-red-300 font-solway mt-1">{leftError}</Text> : null}
              </View>
              <View className="flex-1 ml-2">
                <Text className="text-mf-secondary text-xs font-solway-bold mb-1">{t('editTest.right')}</Text>
                <TextInput
                  className="rounded-xl border border-mf-secondary/25 bg-mf-bg/60 px-2 py-2 text-mf-text font-solway"
                  value={rightItem ? (getAnswerTranslation(rightItem, Number(activeLangKey))?.content || '') : ''}
                  onChangeText={(v) => rightItem && onChangeAnswerSideText(rightItem._idx, v)}
                  placeholderTextColor="#8a89a2"
                />
                {rightError ? <Text className="text-red-300 font-solway mt-1">{rightError}</Text> : null}
              </View>
            </View>
          </View>
        );
      })}

      <Pressable
        className="mt-1 px-4 py-2 rounded-xl border border-mf-primary/30 bg-mf-primary/10 self-start"
        onPress={onAddMatchPair}
      >
        <Text className="text-mf-text font-solway-extrabold text-xs uppercase tracking-widest">
          {t('editTest.addMatchPair')}
        </Text>
      </Pressable>
    </View>
  );
}
