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
  putTestRequest,
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

// Build a fresh question structure for a given type and language
const newQuestion = (type, langKey) => {
  const base = {
    question_type: type,
    is_active: true,
    source_type: 'human',
    question_translations: { [langKey]: { content: '', explanation: '' } },
  };

  if (type === TYPE_TRUE_FALSE) {
    base.answers = [
      { is_correct: true, answer_translations: { [langKey]: { content: 'True' } } },
      { is_correct: false, answer_translations: { [langKey]: { content: 'False' } } },
    ];
    return base;
  }

  if (type === TYPE_TEXT) {
    base.answers = [
      { is_correct: true, answer_translations: { [langKey]: { content: '' } } },
    ];
    return base;
  }

  if (type === TYPE_MATCHING) {
    base.answers = [
      { is_correct: true, match_side: 'left', match_group: 1, answer_translations: { [langKey]: { content: '' } } },
      { is_correct: true, match_side: 'right', match_group: 1, answer_translations: { [langKey]: { content: '' } } },
      { is_correct: true, match_side: 'left', match_group: 2, answer_translations: { [langKey]: { content: '' } } },
      { is_correct: true, match_side: 'right', match_group: 2, answer_translations: { [langKey]: { content: '' } } },
      { is_correct: true, match_side: 'left', match_group: 3, answer_translations: { [langKey]: { content: '' } } },
      { is_correct: true, match_side: 'right', match_group: 3, answer_translations: { [langKey]: { content: '' } } },
    ];
    return base;
  }

  // multiple_choice
  base.answers = [
    { is_correct: true, answer_translations: { [langKey]: { content: '' } } },
    { is_correct: false, answer_translations: { [langKey]: { content: '' } } },
  ];
  return base;
};

// Convert API question/answer data into internal editing format
const apiQuestionToForm = (q) => {
  // question_translations: array → object keyed by language_id
  const qtMap = {};
  (q.question_translations || []).forEach((qt) => {
    qtMap[String(qt.language_id)] = { id: qt.id, content: qt.content || '', explanation: qt.explanation || '' };
  });

  const answers = (q.answers || []).map((a) => {
    const atMap = {};
    (a.answer_translations || []).forEach((at) => {
      atMap[String(at.language_id)] = { id: at.id, content: at.content || '' };
    });
    return {
      id: a.id,
      is_correct: Boolean(a.is_correct),
      match_side: a.match_side || null,
      match_group: a.match_group != null ? Number(a.match_group) : null,
      answer_translations: atMap,
    };
  });

  return {
    id: q.id,
    question_type: q.question_type,
    position: q.position,
    is_active: q.is_active !== false,
    source_type: q.source_type || 'human',
    question_translations: qtMap,
    answers,
  };
};

// Convert internal form data to API payload format
const formToPayload = (form, languageId) => {
  const testTranslations = Object.entries(form.testTranslations || {}).map(([langId, tt]) => {
    const row = {
      language_id: Number(langId),
      title: tt.title || '',
      description: tt.description || '',
    };
    if (tt.id) row.id = tt.id;
    return row;
  });

  const questions = (form.questions || []).map((q, idx) => {
    const questionTranslations = Object.entries(q.question_translations || {}).map(([langId, qt]) => {
      const row = {
        language_id: Number(langId),
        content: qt.content || '',
        explanation: qt.explanation || '',
        source_type: q.source_type || 'human',
      };
      if (qt.id) row.id = qt.id;
      return row;
    });

    const answers = (q.answers || []).map((a) => {
      const answerTranslations = Object.entries(a.answer_translations || {}).map(([langId, at]) => {
        const row = {
          language_id: Number(langId),
          content: at.content || '',
          source_type: q.source_type || 'human',
        };
        if (at.id) row.id = at.id;
        return row;
      });

      const answerRow = {
        is_correct: Boolean(a.is_correct),
        source_type: q.source_type || 'human',
        answer_translations: answerTranslations,
      };
      if (a.id) answerRow.id = a.id;
      if (a.match_side) {
        answerRow.match_side = a.match_side;
        answerRow.match_group = a.match_group;
      }
      return answerRow;
    });

    const qRow = {
      question_type: q.question_type,
      is_active: q.is_active !== false,
      source_type: q.source_type || 'human',
      position: idx + 1,
      question_translations: questionTranslations,
      answers,
    };
    if (q.id) qRow.id = q.id;
    if (q.category_id) qRow.category_id = q.category_id;
    return qRow;
  });

  return {
    category_id: form.categoryId ? Number(form.categoryId) : null,
    difficulty_id: form.difficultyId ? Number(form.difficultyId) : null,
    is_public: Boolean(form.isPublic),
    test_translations: testTranslations,
    questions,
  };
};

// Validate the form data; returns array of error strings
const validate = (form, activeLangKey, t) => {
  const errors = [];

  // At least one translation with a title
  const hasTitleInSomeLang = Object.values(form.testTranslations || {}).some(
    (tt) => (tt.title || '').trim() !== '',
  );
  if (!hasTitleInSomeLang) {
    errors.push(t('editTest.validationTitleRequired'));
  }

  (form.questions || []).forEach((q) => {
    const qText = (q.question_translations?.[activeLangKey]?.content || '').trim();
    if (!qText) {
      errors.push(t('editTest.validationQuestionRequired'));
    }

    if (q.question_type === TYPE_MATCHING) {
      // Validate matching pairs: need ≥ 3 groups, each with exactly 1 left and 1 right
      const groups = {};
      (q.answers || []).forEach((a) => {
        const g = a.match_group;
        const s = a.match_side;
        if (!g || !s) return;
        if (!groups[g]) groups[g] = { left: 0, right: 0 };
        groups[g][s] = (groups[g][s] || 0) + 1;
      });
      const groupKeys = Object.keys(groups);
      const validPairs = groupKeys.filter(
        (g) => groups[g].left === 1 && groups[g].right === 1,
      );
      if (validPairs.length < 3) {
        errors.push(t('editTest.validationMatchPairs'));
      }
    } else if (q.question_type !== TYPE_TEXT) {
      const hasCorrect = (q.answers || []).some((a) => a.is_correct);
      if (!hasCorrect) {
        errors.push(t('editTest.validationCorrectRequired'));
      }
    }

    if (q.question_type !== TYPE_MATCHING) {
      (q.answers || []).forEach((a) => {
        const aText = (a.answer_translations?.[activeLangKey]?.content || '').trim();
        if (!aText) {
          errors.push(t('editTest.validationAnswerRequired'));
        }
      });
    } else {
      (q.answers || []).forEach((a) => {
        const aText = (a.answer_translations?.[activeLangKey]?.content || '').trim();
        if (!aText) {
          errors.push(t('editTest.validationAnswerRequired'));
        }
      });
    }
  });

  // Deduplicate
  return [...new Set(errors)];
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
          questions: (testData.questions || []).map(apiQuestionToForm),
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
      return updater(next);
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
      if (!next.questions[qIdx].question_translations[langKey]) {
        next.questions[qIdx].question_translations[langKey] = { content: '', explanation: '' };
      }
      next.questions[qIdx].question_translations[langKey][field] = value;
      return next;
    });
  }, [updateForm]);

  const setAnswerTranslationContent = useCallback((qIdx, aIdx, langKey, value) => {
    updateForm((next) => {
      if (!next.questions[qIdx].answers[aIdx].answer_translations[langKey]) {
        next.questions[qIdx].answers[aIdx].answer_translations[langKey] = { content: '' };
      }
      next.questions[qIdx].answers[aIdx].answer_translations[langKey].content = value;
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
      next.questions.push(newQuestion(TYPE_MULTIPLE_CHOICE, activeLangKey));
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
      const existingQT = q.question_translations;
      const newQ = newQuestion(type, activeLangKey);
      newQ.id = q.id;
      newQ.question_translations = existingQT;
      // Preserve source_type from original question
      newQ.source_type = q.source_type;
      next.questions[qIdx] = newQ;
      return next;
    });
  }, [activeLangKey, updateForm]);

  const addAnswer = useCallback((qIdx) => {
    updateForm((next) => {
      next.questions[qIdx].answers.push({
        is_correct: false,
        answer_translations: { [activeLangKey]: { content: '' } },
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
      const answers = next.questions[qIdx].answers;
      const maxGroup = answers.reduce((m, a) => Math.max(m, a.match_group || 0), 0);
      const newGroup = maxGroup + 1;
      answers.push({
        is_correct: true,
        match_side: 'left',
        match_group: newGroup,
        answer_translations: { [activeLangKey]: { content: '' } },
      });
      answers.push({
        is_correct: true,
        match_side: 'right',
        match_group: newGroup,
        answer_translations: { [activeLangKey]: { content: '' } },
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

  const setMatchAnswerField = useCallback((qIdx, aIdx, field, value) => {
    updateForm((next) => {
      next.questions[qIdx].answers[aIdx][field] = value;
      return next;
    });
  }, [updateForm]);

  const handleSave = useCallback(async () => {
    setValidationErrors([]);
    const errors = validate(form, activeLangKey, t);
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    setSaving(true);
    setErrorMessage(null);
    try {
      const langId = langCodeToId(editLanguage);
      const payload = formToPayload(form, langId);
      await putTestRequest({ authFetch, testId, language: editLanguage, body: payload });
      navigation.goBack();
    } catch (e) {
      setErrorMessage(e?.data?.error?.message || e?.message || t('editTest.saveError'));
    } finally {
      setSaving(false);
    }
  }, [authFetch, editLanguage, form, activeLangKey, navigation, t, testId]);

  const currentTitle = useMemo(
    () => form.testTranslations?.[activeLangKey]?.title || '',
    [activeLangKey, form.testTranslations],
  );

  const currentDescription = useMemo(
    () => form.testTranslations?.[activeLangKey]?.description || '',
    [activeLangKey, form.testTranslations],
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
                onMatchAnswerField={(aIdx, field, value) => setMatchAnswerField(qIdx, aIdx, field, value)}
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
  onMatchAnswerField,
  onChangeAnswerSideText,
}) {
  const qType = question.question_type;
  const qText = question.question_translations?.[activeLangKey]?.content || '';

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

      {/* Answers */}
      {qType === TYPE_MATCHING ? (
        <MatchingEditor
          question={question}
          activeLangKey={activeLangKey}
          t={t}
          onAddMatchPair={onAddMatchPair}
          onRemoveMatchPair={onRemoveMatchPair}
          onMatchAnswerField={onMatchAnswerField}
          onChangeAnswerSideText={onChangeAnswerSideText}
        />
      ) : (
        <AnswerList
          question={question}
          qType={qType}
          activeLangKey={activeLangKey}
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
  qType,
  activeLangKey,
  t,
  onChangeAnswerText,
  onToggleCorrect,
  onAddAnswer,
  onRemoveAnswer,
}) {
  return (
    <View>
      {(question.answers || []).map((a, aIdx) => {
        const aText = a.answer_translations?.[activeLangKey]?.content || '';
        const isCorrect = Boolean(a.is_correct);
        const isFixed = qType === TYPE_TRUE_FALSE || qType === TYPE_TEXT;

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
  activeLangKey,
  t,
  onAddMatchPair,
  onRemoveMatchPair,
  onMatchAnswerField,
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
                  value={leftItem ? (leftItem.answer_translations?.[activeLangKey]?.content || '') : ''}
                  onChangeText={(v) => leftItem && onChangeAnswerSideText(leftItem._idx, v)}
                  placeholderTextColor="#8a89a2"
                />
              </View>
              <View className="flex-1 ml-2">
                <Text className="text-mf-secondary text-xs font-solway-bold mb-1">{t('editTest.right')}</Text>
                <TextInput
                  className="rounded-xl border border-mf-secondary/25 bg-mf-bg/60 px-2 py-2 text-mf-text font-solway"
                  value={rightItem ? (rightItem.answer_translations?.[activeLangKey]?.content || '') : ''}
                  onChangeText={(v) => rightItem && onChangeAnswerSideText(rightItem._idx, v)}
                  placeholderTextColor="#8a89a2"
                />
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
