const resolveTestsArray = (payload) => {
  if (Array.isArray(payload?.tests)) return payload.tests;
  if (Array.isArray(payload?.favorites)) return payload.favorites;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data?.tests)) return payload.data.tests;
  if (Array.isArray(payload?.data?.favorites)) return payload.data.favorites;
  return [];
};

const getTestId = (item) => {
  return item?.test_id || item?.test?.id || item?.id || null;
};

export const listFavoriteTestsRequest = async ({ authFetch, language, page = 1, limit = 100 }) => {
  const params = [];
  if (language) params.push(`lang=${encodeURIComponent(String(language))}`);
  if (page) params.push(`page=${encodeURIComponent(String(page))}`);
  if (limit) params.push(`limit=${encodeURIComponent(String(limit))}`);
  const query = params.length ? `?${params.join('&')}` : '';

  const payload = await authFetch(`/me/favorites/tests${query}`, {
    method: 'GET',
    timeoutMs: 30000,
  });

  const tests = resolveTestsArray(payload);
  const ids = tests
    .map((item) => getTestId(item))
    .filter((id) => id !== null && id !== undefined)
    .map((id) => String(id));

  return {
    payload,
    tests,
    favoriteIds: ids,
  };
};

export const addFavoriteTestRequest = async ({ authFetch, testId }) => {
  return authFetch(`/me/favorites/tests/${encodeURIComponent(String(testId))}`, {
    method: 'POST',
    timeoutMs: 30000,
  });
};

export const removeFavoriteTestRequest = async ({ authFetch, testId }) => {
  return authFetch(`/me/favorites/tests/${encodeURIComponent(String(testId))}`, {
    method: 'DELETE',
    timeoutMs: 30000,
  });
};
