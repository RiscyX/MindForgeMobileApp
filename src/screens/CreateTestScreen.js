import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import Svg, { Path } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import { useLanguage } from '../hooks/useLanguage';
import { useAuth } from '../hooks/useAuth';
import {
  applyAiRequest,
  createAiTestGenerationRequest,
  fetchCreatorTestMetadataRequest,
  getAiRequestStatus,
} from '../services/creatorAiApi';

export default function CreateTestScreen() {
  const navigation = useNavigation();
  const { t, language } = useLanguage();
  const { authFetch, isAuthenticated, logout } = useAuth();
  const [imageAssets, setImageAssets] = useState([]);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');
  const [customPromptTouched, setCustomPromptTouched] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [selectedDifficultyId, setSelectedDifficultyId] = useState(null);
  const [categoryQuery, setCategoryQuery] = useState('');
  const [difficultyQuery, setDifficultyQuery] = useState('');
  const [isCategoryListOpen, setIsCategoryListOpen] = useState(false);
  const [isDifficultyListOpen, setIsDifficultyListOpen] = useState(false);
  const [metadataTouched, setMetadataTouched] = useState(false);
  const [metadataState, setMetadataState] = useState({
    loading: false,
    errorMessage: null,
    categories: [],
    difficulties: [],
  });

  const isCustomPromptValid = customPrompt.trim().length > 0;
  const isMetadataSelectionValid = Boolean(selectedCategoryId) && Boolean(selectedDifficultyId);

  const [generation, setGeneration] = useState({
    stage: 'idle', // idle | creating | polling | applying | failed
    requestId: null,
    requestStatus: null,
    errorMessage: null,
  });

  const [draft, setDraft] = useState(null);
  const [editLanguage, setEditLanguage] = useState(language || 'en');

  const pollActiveRef = useRef(false);
  const generationRunRef = useRef(0);

  const statusLabel = useMemo(() => {
    const s = String(generation.requestStatus || '').toLowerCase();
    if (s === 'pending') return t('createTest.statusPending');
    if (s === 'processing') return t('createTest.statusProcessing');
    if (s === 'success') return t('createTest.statusSuccess');
    if (s === 'failed') return t('createTest.statusFailed');
    return generation.requestStatus ? String(generation.requestStatus) : null;
  }, [generation.requestStatus, t]);

  const selectedCategory = useMemo(
    () => metadataState.categories.find((item) => Number(item.id) === Number(selectedCategoryId)) || null,
    [metadataState.categories, selectedCategoryId],
  );

  const selectedDifficulty = useMemo(
    () => metadataState.difficulties.find((item) => Number(item.id) === Number(selectedDifficultyId)) || null,
    [metadataState.difficulties, selectedDifficultyId],
  );

  const matchingCategories = useMemo(() => {
    const query = categoryQuery.trim().toLowerCase();
    if (!query) {
      return metadataState.categories;
    }
    return metadataState.categories.filter((item) => String(item.name || '').toLowerCase().includes(query));
  }, [categoryQuery, metadataState.categories]);

  const matchingDifficulties = useMemo(() => {
    const query = difficultyQuery.trim().toLowerCase();
    if (!query) {
      return metadataState.difficulties;
    }
    return metadataState.difficulties.filter((item) => String(item.name || '').toLowerCase().includes(query));
  }, [difficultyQuery, metadataState.difficulties]);

  const mapApiErrorMessage = useCallback((error, fallbackMessage) => {
    const apiCode = String(error?.data?.error?.code || '').toUpperCase();
    if (apiCode === 'CATEGORY_REQUIRED') return t('createTest.errorCategoryRequired');
    if (apiCode === 'DIFFICULTY_REQUIRED') return t('createTest.errorDifficultyRequired');
    if (apiCode === 'CATEGORY_INVALID') return t('createTest.errorInvalidCategory');
    if (apiCode === 'DIFFICULTY_INVALID') return t('createTest.errorInvalidDifficulty');

    const apiMessage = error?.data?.error?.message || error?.data?.message;
    return apiMessage || error?.message || fallbackMessage;
  }, [t]);

  useEffect(() => {
    if (language) {
      setEditLanguage(language);
    }
    return () => {
      pollActiveRef.current = false;
    };
  }, [language]);

  const loadMetadata = useCallback(async () => {
    if (!isAuthenticated) {
      return;
    }

    setMetadataState((prev) => ({ ...prev, loading: true, errorMessage: null }));
    try {
      const payload = await fetchCreatorTestMetadataRequest({ authFetch, language });
      const categories = Array.isArray(payload?.categories) ? payload.categories : [];
      const difficulties = Array.isArray(payload?.difficulties) ? payload.difficulties : [];

      if (!categories.length || !difficulties.length) {
        throw new Error(t('createTest.metadataLoadFailed'));
      }

      setMetadataState({ loading: false, errorMessage: null, categories, difficulties });
    } catch (error) {
      setMetadataState((prev) => ({
        ...prev,
        loading: false,
        errorMessage: mapApiErrorMessage(error, t('createTest.metadataLoadFailed')),
      }));
    }
  }, [authFetch, isAuthenticated, language, mapApiErrorMessage, t]);

  useEffect(() => {
    loadMetadata();
  }, [loadMetadata]);

  useEffect(() => {
    if (selectedCategory) {
      setCategoryQuery(String(selectedCategory.name));
      return;
    }
    if (selectedCategoryId !== null) {
      setSelectedCategoryId(null);
      setCategoryQuery('');
    }
  }, [selectedCategory, selectedCategoryId]);

  useEffect(() => {
    if (selectedDifficulty) {
      setDifficultyQuery(String(selectedDifficulty.name));
      return;
    }
    if (selectedDifficultyId !== null) {
      setSelectedDifficultyId(null);
      setDifficultyQuery('');
    }
  }, [selectedDifficulty, selectedDifficultyId]);

  const handleCategoryInputChange = useCallback((text) => {
    const value = String(text || '');
    setCategoryQuery(value);
    setIsCategoryListOpen(true);

    if (!selectedCategory) {
      return;
    }

    const sameAsSelected = value.trim().toLowerCase() === String(selectedCategory.name || '').trim().toLowerCase();
    if (!sameAsSelected) {
      setSelectedCategoryId(null);
    }
  }, [selectedCategory]);

  const handleDifficultyInputChange = useCallback((text) => {
    const value = String(text || '');
    setDifficultyQuery(value);
    setIsDifficultyListOpen(true);

    if (!selectedDifficulty) {
      return;
    }

    const sameAsSelected = value.trim().toLowerCase() === String(selectedDifficulty.name || '').trim().toLowerCase();
    if (!sameAsSelected) {
      setSelectedDifficultyId(null);
    }
  }, [selectedDifficulty]);

  const handleCategoryPick = useCallback((item) => {
    setSelectedCategoryId(Number(item.id));
    setCategoryQuery(String(item.name || ''));
    setIsCategoryListOpen(false);
    setMetadataTouched(true);
  }, []);

  const handleDifficultyPick = useCallback((item) => {
    setSelectedDifficultyId(Number(item.id));
    setDifficultyQuery(String(item.name || ''));
    setIsDifficultyListOpen(false);
    setMetadataTouched(true);
  }, []);

  const resolveDraftLangKey = useCallback((d, langCode) => {
    if (!d || typeof d !== 'object') return null;
    const translations = d.translations;
    if (!translations || typeof translations !== 'object') return null;

    // NOTE: In this backend, language IDs are currently reversed vs what we'd expect:
    // 1 => HU, 2 => EN (user confirmed). Prefer accordingly.
    const prefer = String(langCode || '').toLowerCase().startsWith('hu') ? '1' : '2';
    if (translations[prefer]) return prefer;

    const keys = Object.keys(translations);
    return keys.length ? keys[0] : null;
  }, []);

  const activeLangKey = useMemo(() => resolveDraftLangKey(draft, editLanguage), [draft, editLanguage, resolveDraftLangKey]);

  const updateDraftAt = useCallback((path, value) => {
    setDraft((prev) => {
      if (!prev || typeof prev !== 'object') return prev;
      const next = JSON.parse(JSON.stringify(prev));
      let cur = next;
      for (let i = 0; i < path.length - 1; i += 1) {
        const k = path[i];
        if (cur[k] === undefined || cur[k] === null) {
          cur[k] = typeof path[i + 1] === 'number' ? [] : {};
        }
        cur = cur[k];
      }
      cur[path[path.length - 1]] = value;
      return next;
    });
  }, []);

  const ensureQuestionAnswersForType = useCallback((qIndex, type) => {
    setDraft((prev) => {
      if (!prev || typeof prev !== 'object') return prev;
      const next = JSON.parse(JSON.stringify(prev));
      if (!Array.isArray(next.questions) || !next.questions[qIndex]) return next;

      const q = next.questions[qIndex];
      q.type = type;

      if (type === 'text') {
        q.answers = [];
        return next;
      }

      if (type === 'true_false') {
        const lk = activeLangKey || Object.keys(q.translations || {})[0] || '1';
        const trueText = String(editLanguage || '').toLowerCase().startsWith('hu') ? 'Igaz' : 'True';
        const falseText = String(editLanguage || '').toLowerCase().startsWith('hu') ? 'Hamis' : 'False';

        q.answers = [
          {
            is_correct: true,
            translations: { ...(q.answers?.[0]?.translations || {}), [lk]: trueText },
          },
          {
            is_correct: false,
            translations: { ...(q.answers?.[1]?.translations || {}), [lk]: falseText },
          },
        ];
        return next;
      }

      // multiple_choice
      if (!Array.isArray(q.answers)) {
        q.answers = [];
      }
      if (q.answers.length < 2) {
        for (let i = q.answers.length; i < 2; i += 1) {
          q.answers.push({ is_correct: i === 0, translations: {} });
        }
      }
      return next;
    });
  }, [activeLangKey, editLanguage]);

  const IconTrash = ({ size = 16, color = '#eae9fc' }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M9 3h6m-8 4h10m-1 0-.8 13a2 2 0 0 1-2 2H10.8a2 2 0 0 1-2-2L8 7"
        stroke={color}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M10 11v7" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
      <Path d="M14 11v7" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
  );

  const normalizePickedAssetToFile = useCallback(async (asset) => {
    if (!asset?.uri) {
      return null;
    }

    const uri = String(asset.uri);
    if (uri.startsWith('file://')) {
      return asset;
    }

    const guessExt = () => {
      const name = String(asset.fileName || uri);
      const ext = name.split('.').pop()?.toLowerCase();
      if (ext === 'png' || ext === 'gif' || ext === 'webp' || ext === 'jpg' || ext === 'jpeg') {
        return ext === 'jpeg' ? 'jpg' : ext;
      }
      return 'jpg';
    };

    const ext = guessExt();
    const stamp = Date.now();
    const dest = `${FileSystem.cacheDirectory}mf-test-cover-${stamp}.${ext}`;
    await FileSystem.copyAsync({ from: uri, to: dest });

    const mimeType = ext === 'png'
      ? 'image/png'
      : ext === 'gif'
        ? 'image/gif'
        : ext === 'webp'
          ? 'image/webp'
          : 'image/jpeg';

    return {
      ...asset,
      uri: dest,
      fileName: `mf-test-cover-${stamp}.${ext}`,
      mimeType,
    };
  }, []);

  const pickFromLibrary = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setIsPickerOpen(false);
      Alert.alert(t('createTest.mediaPermissionDenied'));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: 12,
      allowsEditing: false,
      quality: 1,
    });

    if (!result.canceled && result.assets?.length) {
      const normalizedAssets = [];
      for (const asset of result.assets) {
        // eslint-disable-next-line no-await-in-loop
        const normalized = await normalizePickedAssetToFile(asset);
        if (normalized?.uri) {
          // eslint-disable-next-line no-await-in-loop
          const compressed = await compressAndResize(normalized.uri);
          normalizedAssets.push({ ...normalized, uri: compressed.uri, mimeType: 'image/jpeg' });
        }
      }

      setImageAssets((prev) => {
        const next = [...prev];
        for (const a of normalizedAssets) {
          if (!next.some((x) => x?.uri === a.uri)) {
            next.push(a);
          }
        }
        return next;
      });
    }

    setIsPickerOpen(false);
  }, [compressAndResize, normalizePickedAssetToFile, t]);

  const takePhoto = useCallback(async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      setIsPickerOpen(false);
      Alert.alert(t('createTest.cameraPermissionDenied'));
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 1,
    });

    if (!result.canceled && result.assets?.[0]) {
      const normalized = await normalizePickedAssetToFile(result.assets[0]);
      if (normalized?.uri) {
        const compressed = await compressAndResize(normalized.uri);
        const final = { ...normalized, uri: compressed.uri, mimeType: 'image/jpeg' };
        setImageAssets((prev) => (prev.some((x) => x?.uri === final.uri) ? prev : [...prev, final]));
      }
    }

    setIsPickerOpen(false);
  }, [compressAndResize, normalizePickedAssetToFile, t]);

  const handleAddImagePress = useCallback(() => {
    setIsPickerOpen(true);
  }, []);

  const handleRemoveImage = useCallback((uri) => {
    if (!uri) {
      return;
    }
    setImageAssets((prev) => prev.filter((x) => x?.uri !== uri));
  }, []);

  const handleRemoveAllImages = useCallback(() => {
    setImageAssets([]);
  }, []);

  // Compress and resize an image URI to max 1280px wide, JPEG 75% quality.
  // Falls back to the original URI on any error so the flow is never blocked.
  const compressAndResize = useCallback(async (uri) => {
    try {
      const result = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 1280 } }],
        { compress: 0.75, format: ImageManipulator.SaveFormat.JPEG },
      );
      return result;
    } catch {
      return { uri };
    }
  }, []);

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const handleGenerate = useCallback(async () => {
    setCustomPromptTouched(true);
    setMetadataTouched(true);
    setIsCategoryListOpen(false);
    setIsDifficultyListOpen(false);
    if (!isCustomPromptValid) {
      return;
    }
    if (!isMetadataSelectionValid) {
      return;
    }

    if (!isAuthenticated) {
      alert(t('createTest.authRequired'));
      return;
    }

    pollActiveRef.current = false;
    generationRunRef.current += 1;
    const runId = generationRunRef.current;
    setGeneration({ stage: 'creating', requestId: null, requestStatus: null, errorMessage: null });
    setDraft(null);

    try {
      const created = await createAiTestGenerationRequest({
        authFetch,
        prompt: customPrompt,
        images: imageAssets,
        language,
        categoryId: selectedCategoryId,
        difficultyId: selectedDifficultyId,
        isPublic: true,
      });

      const requestId = created?.ai_request?.id;
      if (!requestId) {
        throw new Error('Invalid AI request response (missing id).');
      }

      setGeneration({ stage: 'polling', requestId, requestStatus: created?.ai_request?.status || 'pending', errorMessage: null });

      pollActiveRef.current = true;
      while (pollActiveRef.current) {
        // eslint-disable-next-line no-await-in-loop
        await sleep(2000);

        if (!pollActiveRef.current || generationRunRef.current !== runId) {
          break;
        }

        // eslint-disable-next-line no-await-in-loop
        const statusPayload = await getAiRequestStatus({ authFetch, requestId });
        const status = statusPayload?.ai_request?.status || null;

        if (!pollActiveRef.current || generationRunRef.current !== runId) {
          break;
        }

        setGeneration((prev) => ({ ...prev, stage: 'polling', requestStatus: status }));

        if (status === 'failed') {
          pollActiveRef.current = false;
          const msg = statusPayload?.ai_request?.error_message || 'AI generation failed.';
          setGeneration((prev) => ({ ...prev, stage: 'failed', errorMessage: msg }));
          return;
        }

        if (status === 'success') {
          pollActiveRef.current = false;
          const draftPayload = statusPayload?.draft || null;
          if (draftPayload) {
            setDraft(draftPayload);
          }
          setGeneration((prev) => ({ ...prev, stage: 'idle', requestStatus: status, errorMessage: null }));
          return;
        }
      }
    } catch (e) {
      const status = e?.status;
      const apiCode = e?.data?.error?.code;
      const message = mapApiErrorMessage(e, 'Request failed.');

      if (status === 401) {
        try {
          await logout();
        } catch {
          // ignore
        }
      }

      setGeneration({ stage: 'failed', requestId: null, requestStatus: null, errorMessage: apiCode ? `${message} (${apiCode})` : message });
    }
  }, [
    authFetch,
    customPrompt,
    imageAssets,
    isAuthenticated,
    isCustomPromptValid,
    isMetadataSelectionValid,
    language,
    logout,
    mapApiErrorMessage,
    selectedCategoryId,
    selectedDifficultyId,
    t,
  ]);

  const handleApplyDraft = useCallback(async () => {
    if (!generation.requestId) {
      return;
    }
    if (!draft) {
      return;
    }

    setGeneration((prev) => ({ ...prev, stage: 'applying', errorMessage: null }));
    try {
      const applied = await applyAiRequest({ authFetch, requestId: generation.requestId, draft });
      const testId = applied?.test_id;
      if (!testId) {
        throw new Error('Apply succeeded but missing test_id.');
      }
      navigation.replace('TestDetails', { testId, fromCreate: true });
    } catch (e) {
      const apiCode = e?.data?.error?.code;
      const message = mapApiErrorMessage(e, 'Apply failed.');
      setGeneration((prev) => ({ ...prev, stage: 'failed', errorMessage: apiCode ? `${message} (${apiCode})` : message }));
    }
  }, [authFetch, draft, generation.requestId, mapApiErrorMessage, navigation]);

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
            <Text className="text-mf-text font-solway-extrabold text-base tracking-widest">{t('createTest.title')}</Text>
          </View>
          <View className="w-11 h-11" />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 140 }}
        >
          <View className="mt-8 rounded-2xl border border-mf-secondary/20 bg-mf-secondary/10 p-5">
            <Text className="text-mf-text font-solway-extrabold text-sm uppercase tracking-widest">
              {t('createTest.customPromptLabel')}
            </Text>
            <Text className="text-mf-secondary font-solway mt-2">
              {t('createTest.customPromptHint')}
            </Text>

            <View
              className={`mt-4 rounded-2xl border bg-mf-bg/60 px-3 py-2 ${customPromptTouched && !isCustomPromptValid ? 'border-red-500/40' : 'border-mf-secondary/25'}`}
            >
              <TextInput
                className="w-full text-mf-text font-solway"
                value={customPrompt}
                onChangeText={setCustomPrompt}
                onBlur={() => setCustomPromptTouched(true)}
                placeholder={t('createTest.customPromptPlaceholder')}
                placeholderTextColor="#8a89a2"
                multiline
                scrollEnabled
                textAlignVertical="top"
                style={{ minHeight: 160 }}
                accessibilityLabel={t('createTest.customPromptLabel')}
              />
            </View>

            {customPromptTouched && !isCustomPromptValid ? (
              <Text className="text-red-300 font-solway mt-2">{t('createTest.customPromptRequired')}</Text>
            ) : null}
          </View>

          <View className="mt-6 rounded-2xl border border-mf-secondary/20 bg-mf-secondary/10 p-5">
            <Text className="text-mf-secondary text-xs uppercase tracking-widest font-solway-bold mb-2">
              {t('createTest.categoryLabel')}
            </Text>
            <View className="w-full rounded-2xl border border-mf-secondary/30 bg-mf-bg/80 px-3 py-2">
              <TextInput
                className="w-full text-mf-text font-solway"
                value={categoryQuery}
                onChangeText={handleCategoryInputChange}
                onFocus={() => {
                  setIsCategoryListOpen(true);
                  setIsDifficultyListOpen(false);
                }}
                placeholder={t('createTest.categorySearchPlaceholder')}
                placeholderTextColor="#8a89a2"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {isCategoryListOpen ? (
              <View className="mt-2 rounded-xl border border-mf-secondary/30 bg-mf-bg/95 p-2 max-h-44">
                <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
                  {matchingCategories.length > 0 ? (
                    matchingCategories.map((category) => (
                      <Pressable
                        key={`cat-option-${category.id}`}
                        className={`mb-2 px-3 py-2 rounded-lg border ${selectedCategoryId === category.id ? 'bg-mf-primary border-mf-primary' : 'bg-mf-secondary/10 border-mf-secondary/30'}`}
                        onPress={() => handleCategoryPick(category)}
                      >
                        <Text className={`font-solway-bold text-xs uppercase tracking-wider ${selectedCategoryId === category.id ? 'text-mf-text' : 'text-mf-secondary'}`}>
                          {category.name}
                        </Text>
                      </Pressable>
                    ))
                  ) : (
                    <Text className="text-mf-secondary font-solway text-sm px-2 py-2">{t('createTest.noCategoryMatches')}</Text>
                  )}
                </ScrollView>
              </View>
            ) : null}

            {metadataTouched && !selectedCategoryId ? (
              <Text className="text-red-300 font-solway mt-2">{t('createTest.categoryRequired')}</Text>
            ) : null}

            <Text className="text-mf-secondary text-xs uppercase tracking-widest font-solway-bold mt-4 mb-2">
              {t('createTest.difficultyLabel')}
            </Text>
            <View className="w-full rounded-2xl border border-mf-secondary/30 bg-mf-bg/80 px-3 py-2">
              <TextInput
                className="w-full text-mf-text font-solway"
                value={difficultyQuery}
                onChangeText={handleDifficultyInputChange}
                onFocus={() => {
                  setIsDifficultyListOpen(true);
                  setIsCategoryListOpen(false);
                }}
                placeholder={t('createTest.difficultySearchPlaceholder')}
                placeholderTextColor="#8a89a2"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {isDifficultyListOpen ? (
              <View className="mt-2 rounded-xl border border-mf-secondary/30 bg-mf-bg/95 p-2 max-h-44">
                <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
                  {matchingDifficulties.length > 0 ? (
                    matchingDifficulties.map((difficulty) => (
                      <Pressable
                        key={`diff-option-${difficulty.id}`}
                        className={`mb-2 px-3 py-2 rounded-lg border ${selectedDifficultyId === difficulty.id ? 'bg-mf-primary border-mf-primary' : 'bg-mf-secondary/10 border-mf-secondary/30'}`}
                        onPress={() => handleDifficultyPick(difficulty)}
                      >
                        <Text className={`font-solway-bold text-xs uppercase tracking-wider ${selectedDifficultyId === difficulty.id ? 'text-mf-text' : 'text-mf-secondary'}`}>
                          {difficulty.name}
                        </Text>
                      </Pressable>
                    ))
                  ) : (
                    <Text className="text-mf-secondary font-solway text-sm px-2 py-2">{t('createTest.noDifficultyMatches')}</Text>
                  )}
                </ScrollView>
              </View>
            ) : null}

            {metadataTouched && !selectedDifficultyId ? (
              <Text className="text-red-300 font-solway mt-2">{t('createTest.difficultyRequired')}</Text>
            ) : null}

            {metadataState.loading ? (
              <Text className="text-mf-secondary font-solway mt-3">{t('createTest.metadataLoading')}</Text>
            ) : null}

            {metadataState.errorMessage ? (
              <>
                <Text className="text-red-300 font-solway mt-3">{metadataState.errorMessage}</Text>
                <Pressable
                  className="mt-3 bg-mf-secondary/10 py-3 rounded-xl items-center border border-mf-secondary/30"
                  onPress={loadMetadata}
                >
                  <Text className="text-mf-text font-solway-bold text-xs uppercase tracking-widest">{t('createTest.retryMetadataLoad')}</Text>
                </Pressable>
              </>
            ) : null}
          </View>

          <View className="mt-6 rounded-2xl border border-mf-secondary/20 bg-mf-secondary/10 p-5">
            <View className="flex-row items-center justify-between">
              <Text className="text-mf-text font-solway-extrabold">{t('createTest.images')}</Text>
              <Pressable
                className="px-4 py-3 rounded-2xl border border-mf-primary/30 bg-mf-primary/10"
                onPress={handleAddImagePress}
              >
                <Text className="text-mf-text font-solway-extrabold text-xs uppercase tracking-widest">{t('createTest.addImage')}</Text>
              </Pressable>
            </View>

            {imageAssets.length > 0 ? (
              <>
                <ScrollView
                  className="mt-4"
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingRight: 8 }}
                >
                  {imageAssets.map((asset) => (
                    <View
                      key={asset.uri}
                      className="mr-3 overflow-hidden rounded-2xl border border-mf-secondary/20"
                      style={{ width: 240, height: 140 }}
                    >
                      <Image
                        source={{ uri: asset.uri }}
                        style={{ width: '100%', height: '100%' }}
                        resizeMode="cover"
                      />

                      <Pressable
                        onPress={() => handleRemoveImage(asset.uri)}
                        className="absolute top-3 right-3 w-9 h-9 rounded-xl items-center justify-center"
                        style={{
                          backgroundColor: 'rgba(220,53,69,0.88)',
                          borderWidth: 1,
                          borderColor: 'rgba(234,233,252,0.22)',
                          shadowColor: '#000',
                          shadowOpacity: 0.35,
                          shadowRadius: 10,
                          shadowOffset: { width: 0, height: 6 },
                          elevation: 6,
                        }}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <IconTrash />
                      </Pressable>
                    </View>
                  ))}
                </ScrollView>

                <Pressable
                  className="mt-4 bg-red-500/10 py-3 rounded-2xl items-center border border-red-500/30"
                  onPress={handleRemoveAllImages}
                >
                  <Text className="text-red-300 font-solway-bold text-sm uppercase tracking-widest">{t('createTest.removeAllImages')}</Text>
                </Pressable>
              </>
            ) : (
              <View className="mt-4 rounded-2xl border border-mf-secondary/20 bg-mf-bg/40 p-4">
                <Text className="text-mf-secondary font-solway">{t('createTest.comingSoon')}</Text>
              </View>
            )}
          </View>

          <View className="mt-6 rounded-2xl border border-mf-secondary/20 bg-mf-secondary/10 p-5">
            <Pressable
              className="bg-mf-primary py-4 rounded-xl items-center shadow-lg shadow-mf-primary/30"
              onPress={handleGenerate}
              disabled={generation.stage === 'creating' || generation.stage === 'polling' || generation.stage === 'applying' || metadataState.loading}
              style={{ opacity: generation.stage === 'creating' || generation.stage === 'polling' || generation.stage === 'applying' || metadataState.loading ? 0.7 : 1 }}
            >
              {generation.stage === 'creating' || generation.stage === 'polling' || generation.stage === 'applying' ? (
                <View className="flex-row items-center">
                  <ActivityIndicator size="small" color="#eae9fc" />
                  <Text className="text-mf-text font-solway-bold text-lg ml-3">
                    {generation.stage === 'creating'
                      ? t('createTest.generating')
                      : generation.stage === 'applying'
                        ? t('createTest.applying')
                        : t('createTest.polling')}
                  </Text>
                </View>
              ) : (
                <Text className="text-mf-text font-solway-bold text-lg">{t('createTest.generateButton')}</Text>
              )}
            </Pressable>

            {statusLabel ? (
              <Text className="text-mf-secondary font-solway mt-3">
                {`${t('createTest.statusPrefix')}: ${statusLabel}`}
              </Text>
            ) : null}

            {generation.errorMessage ? (
              <Text className="text-red-300 font-solway mt-2">{generation.errorMessage}</Text>
            ) : null}
          </View>

          {draft && activeLangKey ? (
            <View className="mt-6 rounded-2xl border border-mf-secondary/20 bg-mf-secondary/10 p-5">
              <Text className="text-mf-text font-solway-extrabold text-base tracking-wide">{t('createTest.editorTitle')}</Text>
              <Text className="text-mf-secondary font-solway mt-2">{t('createTest.editorHint')}</Text>

              <View className="mt-4">
                <Text className="text-mf-secondary text-xs uppercase tracking-widest font-solway-bold mb-2">
                  {t('createTest.languageLabel')}
                </Text>
                <View className="w-full rounded-2xl border border-mf-secondary/30 bg-mf-bg/80 p-2 flex-row">
                  <Pressable
                    className={`flex-1 rounded-xl py-3 items-center ${editLanguage === 'en' ? 'bg-mf-primary' : 'bg-transparent'}`}
                    onPress={() => setEditLanguage('en')}
                  >
                    <Text className={`font-solway-bold text-xs uppercase tracking-widest ${editLanguage === 'en' ? 'text-mf-text' : 'text-mf-secondary'}`}>
                      EN
                    </Text>
                  </Pressable>
                  <Pressable
                    className={`flex-1 rounded-xl py-3 items-center ${editLanguage === 'hu' ? 'bg-mf-primary' : 'bg-transparent'}`}
                    onPress={() => setEditLanguage('hu')}
                  >
                    <Text className={`font-solway-bold text-xs uppercase tracking-widest ${editLanguage === 'hu' ? 'text-mf-text' : 'text-mf-secondary'}`}>
                      HU
                    </Text>
                  </Pressable>
                </View>
              </View>

              <View className="mt-5">
                <Text className="text-mf-secondary text-xs uppercase tracking-widest font-solway-bold mb-2">
                  {t('createTest.titleLabel')}
                </Text>
                <TextInput
                  className="w-full bg-mf-bg/60 text-mf-text p-3 rounded-xl border border-mf-secondary/25 font-solway"
                  value={String(draft?.translations?.[activeLangKey]?.title || '')}
                  onChangeText={(v) => updateDraftAt(['translations', activeLangKey, 'title'], v)}
                />

                <Text className="text-mf-secondary text-xs uppercase tracking-widest font-solway-bold mt-4 mb-2">
                  {t('createTest.descriptionLabel')}
                </Text>
                <View className="rounded-2xl border border-mf-secondary/25 bg-mf-bg/60 px-3 py-2">
                  <TextInput
                    className="w-full text-mf-text font-solway"
                    value={String(draft?.translations?.[activeLangKey]?.description || '')}
                    onChangeText={(v) => updateDraftAt(['translations', activeLangKey, 'description'], v)}
                    multiline
                    scrollEnabled
                    textAlignVertical="top"
                    style={{ minHeight: 110 }}
                  />
                </View>
              </View>

              <View className="mt-6">
                <View className="flex-row items-center justify-between">
                  <Text className="text-mf-text font-solway-extrabold">{t('createTest.questionsLabel')}</Text>
                  <Pressable
                    className="px-4 py-3 rounded-2xl border border-mf-primary/30 bg-mf-primary/10"
                    onPress={() => {
                      setDraft((prev) => {
                        const next = prev ? JSON.parse(JSON.stringify(prev)) : { translations: {}, questions: [] };
                        if (!Array.isArray(next.questions)) next.questions = [];
                        next.questions.push({
                          type: 'multiple_choice',
                          translations: { [activeLangKey]: '' },
                          answers: [
                            { is_correct: true, translations: { [activeLangKey]: '' } },
                            { is_correct: false, translations: { [activeLangKey]: '' } },
                          ],
                        });
                        return next;
                      });
                    }}
                  >
                    <Text className="text-mf-text font-solway-extrabold text-xs uppercase tracking-widest">{t('createTest.addQuestion')}</Text>
                  </Pressable>
                </View>

                {(draft.questions || []).map((q, qIndex) => {
                  const qType = String(q?.type || 'multiple_choice');
                  const rawQTrans = q?.translations?.[activeLangKey];
                  const qText = rawQTrans !== null && typeof rawQTrans === 'object'
                    ? String(rawQTrans?.content || '')
                    : String(rawQTrans || '');
                  const answers = Array.isArray(q?.answers) ? q.answers : [];

                  return (
                    <View key={`q-${qIndex}`} className="mt-4 rounded-2xl border border-mf-secondary/20 bg-mf-bg/30 p-4">
                      <View className="flex-row items-center justify-between">
                        <Text className="text-mf-text font-solway-extrabold">{`#${qIndex + 1}`}</Text>
                        <Pressable
                          className="px-3 py-2 rounded-xl border border-red-500/30 bg-red-500/10"
                          onPress={() => {
                            setDraft((prev) => {
                              if (!prev) return prev;
                              const next = JSON.parse(JSON.stringify(prev));
                              next.questions = (next.questions || []).filter((_, i) => i !== qIndex);
                              return next;
                            });
                          }}
                        >
                          <Text className="text-red-300 font-solway-bold text-xs uppercase tracking-widest">{t('createTest.remove')}</Text>
                        </Pressable>
                      </View>

                      <Text className="text-mf-secondary text-xs uppercase tracking-widest font-solway-bold mt-4 mb-2">
                        {t('createTest.questionTypeLabel')}
                      </Text>
                      <View className="flex-row">
                        {['multiple_choice', 'true_false', 'text'].map((tp) => (
                          <Pressable
                            key={tp}
                            className={`mr-2 px-3 py-2 rounded-xl border ${qType === tp ? 'bg-mf-primary border-mf-primary' : 'bg-mf-secondary/10 border-mf-secondary/30'}`}
                            onPress={() => ensureQuestionAnswersForType(qIndex, tp)}
                          >
                            <Text className={`font-solway-bold text-xs uppercase tracking-widest ${qType === tp ? 'text-mf-text' : 'text-mf-secondary'}`}>
                              {tp === 'multiple_choice' ? 'MC' : tp === 'true_false' ? 'T/F' : 'TXT'}
                            </Text>
                          </Pressable>
                        ))}
                      </View>

                      <Text className="text-mf-secondary text-xs uppercase tracking-widest font-solway-bold mt-4 mb-2">
                        {t('createTest.questionsLabel')}
                      </Text>
                      <TextInput
                        className="w-full bg-mf-bg/60 text-mf-text p-3 rounded-xl border border-mf-secondary/25 font-solway"
                        value={qText}
                        onChangeText={(v) => {
                          const existing = draft?.questions?.[qIndex]?.translations?.[activeLangKey];
                          const updated = existing !== null && typeof existing === 'object'
                            ? { ...existing, content: v }
                            : v;
                          updateDraftAt(['questions', qIndex, 'translations', activeLangKey], updated);
                        }}
                      />

                      {qType === 'text' ? null : (
                        <View className="mt-4">
                          {answers.map((a, aIndex) => {
                            const aText = String(a?.translations?.[activeLangKey] || '');
                            const isCorrect = Boolean(a?.is_correct);
                            return (
                              <View key={`a-${qIndex}-${aIndex}`} className="mt-3 rounded-xl border border-mf-secondary/20 bg-mf-bg/50 p-3">
                                <View className="flex-row items-center justify-between">
                                  <Text className="text-mf-secondary font-solway text-xs uppercase tracking-widest">{`A${aIndex + 1}`}</Text>
                                  <Pressable
                                    className={`px-3 py-2 rounded-xl border ${isCorrect ? 'bg-green-500/15 border-green-500/35' : 'bg-mf-secondary/10 border-mf-secondary/25'}`}
                                    onPress={() => updateDraftAt(['questions', qIndex, 'answers', aIndex, 'is_correct'], !isCorrect)}
                                  >
                                    <Text className={`${isCorrect ? 'text-green-200' : 'text-mf-secondary'} font-solway-bold text-xs uppercase tracking-widest`}>{t('createTest.correct')}</Text>
                                  </Pressable>
                                </View>

                                <TextInput
                                  className="w-full bg-transparent text-mf-text font-solway mt-2"
                                  value={aText}
                                  onChangeText={(v) => updateDraftAt(['questions', qIndex, 'answers', aIndex, 'translations', activeLangKey], v)}
                                  placeholderTextColor="#8a89a2"
                                />

                                {qType === 'multiple_choice' ? (
                                  <Pressable
                                    className="mt-3 self-start px-3 py-2 rounded-xl border border-red-500/30 bg-red-500/10"
                                    onPress={() => {
                                      setDraft((prev) => {
                                        if (!prev) return prev;
                                        const next = JSON.parse(JSON.stringify(prev));
                                        const qn = next.questions?.[qIndex];
                                        if (!qn || !Array.isArray(qn.answers)) return next;
                                        qn.answers = qn.answers.filter((_, i) => i !== aIndex);
                                        return next;
                                      });
                                    }}
                                  >
                                    <Text className="text-red-300 font-solway-bold text-xs uppercase tracking-widest">{t('createTest.remove')}</Text>
                                  </Pressable>
                                ) : null}
                              </View>
                            );
                          })}

                          {qType === 'multiple_choice' ? (
                            <Pressable
                              className="mt-4 px-4 py-3 rounded-2xl border border-mf-primary/30 bg-mf-primary/10 self-start"
                              onPress={() => {
                                setDraft((prev) => {
                                  if (!prev) return prev;
                                  const next = JSON.parse(JSON.stringify(prev));
                                  const qn = next.questions?.[qIndex];
                                  if (!qn) return next;
                                  if (!Array.isArray(qn.answers)) qn.answers = [];
                                  qn.answers.push({ is_correct: false, translations: { [activeLangKey]: '' } });
                                  return next;
                                });
                              }}
                            >
                              <Text className="text-mf-text font-solway-extrabold text-xs uppercase tracking-widest">{t('createTest.addAnswer')}</Text>
                            </Pressable>
                          ) : null}
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>

              <Pressable
                className="mt-6 bg-mf-primary py-4 rounded-xl items-center shadow-lg shadow-mf-primary/30"
                onPress={handleApplyDraft}
                disabled={generation.stage === 'applying'}
                style={{ opacity: generation.stage === 'applying' ? 0.7 : 1 }}
              >
                {generation.stage === 'applying' ? (
                  <View className="flex-row items-center">
                    <ActivityIndicator size="small" color="#eae9fc" />
                    <Text className="text-mf-text font-solway-bold text-lg ml-3">{t('createTest.applying')}</Text>
                  </View>
                ) : (
                  <Text className="text-mf-text font-solway-bold text-lg">{t('createTest.applyButton')}</Text>
                )}
              </Pressable>
            </View>
          ) : null}
        </ScrollView>

        <Modal
          visible={isPickerOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setIsPickerOpen(false)}
        >
          <Pressable
            className="flex-1"
            style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
            onPress={() => setIsPickerOpen(false)}
          />

          <View className="absolute left-0 right-0 bottom-0 px-6 pb-6">
            <View
              className="rounded-3xl border border-mf-secondary/20 p-4"
              style={{
                backgroundColor: 'rgba(1,1,4,0.95)',
                shadowColor: '#000',
                shadowOpacity: 0.6,
                shadowRadius: 24,
                shadowOffset: { width: 0, height: 14 },
                elevation: 14,
              }}
            >
              <Text className="text-mf-text font-solway-extrabold text-base tracking-wide">{t('createTest.addImage')}</Text>
              <Text className="text-mf-secondary font-solway mt-2">{t('createTest.comingSoon')}</Text>

              <Pressable
                className="mt-4 bg-mf-primary py-4 rounded-2xl items-center border border-white/10"
                onPress={takePhoto}
              >
                <Text className="text-mf-text font-solway-bold text-base uppercase tracking-widest">{t('createTest.takePhoto')}</Text>
              </Pressable>

              <Pressable
                className="mt-3 bg-mf-secondary/10 py-4 rounded-2xl items-center border border-mf-secondary/20"
                onPress={pickFromLibrary}
              >
                <Text className="text-mf-text font-solway-bold text-base uppercase tracking-widest">{t('createTest.chooseFromLibrary')}</Text>
              </Pressable>

              {imageAssets.length > 0 ? (
                <Pressable
                  className="mt-3 bg-red-500/10 py-4 rounded-2xl items-center border border-red-500/30"
                  onPress={() => {
                    handleRemoveAllImages();
                    setIsPickerOpen(false);
                  }}
                >
                  <Text className="text-red-300 font-solway-bold text-base uppercase tracking-widest">{t('createTest.removeAllImages')}</Text>
                </Pressable>
              ) : null}

              <Pressable
                className="mt-3 py-3 items-center"
                onPress={() => setIsPickerOpen(false)}
              >
                <Text className="text-mf-secondary font-solway-bold text-sm uppercase tracking-widest">{t('common.cancel')}</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </View>
  );
}
