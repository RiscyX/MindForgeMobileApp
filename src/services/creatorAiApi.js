export const createAiTestGenerationRequest = async ({
  authFetch,
  prompt,
  images = [],
  language,
  categoryId,
  difficultyId,
  questionCount,
  isPublic,
}) => {
  if (typeof authFetch !== 'function') {
    throw new Error('authFetch is required');
  }

  const normalizedPrompt = typeof prompt === 'string' ? prompt.trim() : '';
  if (!normalizedPrompt) {
    throw new Error('prompt is required');
  }

  const form = new FormData();
  form.append('prompt', normalizedPrompt);
  if (language) {
    form.append('lang', String(language));
  }
  if (categoryId) {
    form.append('category_id', String(categoryId));
  }
  if (difficultyId) {
    form.append('difficulty_id', String(difficultyId));
  }
  if (questionCount) {
    form.append('question_count', String(questionCount));
  }
  if (typeof isPublic === 'boolean') {
    form.append('is_public', isPublic ? '1' : '0');
  }

  if (Array.isArray(images)) {
    images.forEach((asset, idx) => {
      if (!asset?.uri) {
        return;
      }

      const name = asset.fileName || `image-${idx + 1}.jpg`;
      const type = asset.mimeType || 'image/jpeg';

      form.append('images[]', {
        uri: String(asset.uri),
        name: String(name),
        type: String(type),
      });
    });
  }

  const data = await authFetch('/creator/ai/test-generation', {
    method: 'POST',
    body: form,
    timeoutMs: 60000,
  });

  return data;
};

const normalizeOptions = (items, idKeys, nameKeys) => {
  if (!Array.isArray(items)) {
    return [];
  }

  const normalized = [];
  const seen = new Set();

  items.forEach((item) => {
    if (!item || typeof item !== 'object') {
      return;
    }

    let id = null;
    for (const key of idKeys) {
      if (item[key] !== undefined && item[key] !== null && Number(item[key]) > 0) {
        id = Number(item[key]);
        break;
      }
    }

    if (!id || seen.has(id)) {
      return;
    }

    let name = '';
    for (const key of nameKeys) {
      const value = item[key];
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        name = String(value).trim();
        break;
      }
    }

    if (!name) {
      return;
    }

    seen.add(id);
    normalized.push({ id, name });
  });

  return normalized;
};

export const fetchCreatorTestMetadataRequest = async ({ authFetch, language }) => {
  if (typeof authFetch !== 'function') {
    throw new Error('authFetch is required');
  }

  const lang = typeof language === 'string' && language.trim() ? language.trim() : null;
  const qs = lang ? `?lang=${encodeURIComponent(lang)}` : '';
  const candidateEndpoints = [
    `/creator/tests/metadata${qs}`,
    `/creator/metadata${qs}`,
    `/tests/metadata${qs}`,
  ];

  let lastError = null;

  for (const endpoint of candidateEndpoints) {
    try {
      const payload = await authFetch(endpoint, { method: 'GET', timeoutMs: 30000 });
      const categories = normalizeOptions(
        payload?.categories || payload?.data?.categories,
        ['id', 'category_id'],
        ['name', 'category'],
      );
      const difficulties = normalizeOptions(
        payload?.difficulties || payload?.data?.difficulties,
        ['id', 'difficulty_id'],
        ['name', 'difficulty'],
      );

      if (categories.length && difficulties.length) {
        return { categories, difficulties };
      }
    } catch (error) {
      if (error?.status !== 404) {
        lastError = error;
      }
    }
  }

  try {
    const list = await authFetch(`/tests${qs}`, { method: 'GET', timeoutMs: 30000 });
    const tests = Array.isArray(list?.tests) ? list.tests : [];

    const categoriesMap = new Map();
    const difficultiesMap = new Map();

    tests.forEach((item) => {
      const categoryId = Number(item?.category_id);
      const difficultyId = Number(item?.difficulty_id);
      const categoryName = String(item?.category || '').trim();
      const difficultyName = String(item?.difficulty || '').trim();

      if (categoryId > 0 && categoryName) {
        categoriesMap.set(categoryId, categoryName);
      }
      if (difficultyId > 0 && difficultyName) {
        difficultiesMap.set(difficultyId, difficultyName);
      }
    });

    return {
      categories: Array.from(categoriesMap.entries()).map(([id, name]) => ({ id, name })),
      difficulties: Array.from(difficultiesMap.entries()).map(([id, name]) => ({ id, name })),
    };
  } catch (error) {
    if (lastError) {
      throw lastError;
    }
    throw error;
  }
};

export const getAiRequestStatus = async ({ authFetch, requestId }) => {
  if (typeof authFetch !== 'function') {
    throw new Error('authFetch is required');
  }
  if (!requestId) {
    throw new Error('requestId is required');
  }

  return authFetch(`/creator/ai/requests/${encodeURIComponent(String(requestId))}`, {
    method: 'GET',
    timeoutMs: 30000,
  });
};

export const applyAiRequest = async ({ authFetch, requestId, draft }) => {
  if (typeof authFetch !== 'function') {
    throw new Error('authFetch is required');
  }
  if (!requestId) {
    throw new Error('requestId is required');
  }

  const body = draft && typeof draft === 'object' ? { draft } : undefined;

  return authFetch(`/creator/ai/requests/${encodeURIComponent(String(requestId))}/apply`, {
    method: 'POST',
    body,
    timeoutMs: 60000,
  });
};
