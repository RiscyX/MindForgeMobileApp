export const createAiTestGenerationRequest = async ({
  authFetch,
  prompt,
  images = [],
  language,
  categoryId,
  difficultyId,
  questionCount,
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
