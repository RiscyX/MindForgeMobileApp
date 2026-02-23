const resolveTestsArray = (payload) => {
  if (Array.isArray(payload?.tests)) return payload.tests;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data?.tests)) return payload.data.tests;
  if (Array.isArray(payload?.data?.items)) return payload.data.items;
  return [];
};

const resolvePagination = (payload, { page, limit, count }) => {
  const meta = payload?.pagination || payload?.meta?.pagination || payload?.meta || {};
  const currentPage = Number(meta.current_page ?? meta.page ?? page);
  const totalPages = Number(meta.total_pages ?? meta.last_page ?? 0);
  const explicitNextPage = Number(meta.next_page ?? meta.nextPage ?? 0);

  if (Number.isFinite(explicitNextPage) && explicitNextPage > 0) {
    return { hasMore: true, nextPage: explicitNextPage };
  }

  if (Number.isFinite(currentPage) && Number.isFinite(totalPages) && totalPages > 0) {
    const hasMore = currentPage < totalPages;
    return { hasMore, nextPage: hasMore ? currentPage + 1 : null };
  }

  const hasMoreByCount = count >= limit;
  return { hasMore: hasMoreByCount, nextPage: hasMoreByCount ? page + 1 : null };
};

export const listTestsForManagementRequest = async ({
  authFetch,
  language,
  page = 1,
  limit = 20,
  mineOnly = false,
}) => {
  const params = [];
  if (language) params.push(`lang=${encodeURIComponent(String(language))}`);
  params.push(`page=${encodeURIComponent(String(page))}`);
  params.push(`limit=${encodeURIComponent(String(limit))}`);
  if (mineOnly) params.push('mine=1');

  const query = params.length ? `?${params.join('&')}` : '';
  const payload = await authFetch(`/tests${query}`, { method: 'GET', timeoutMs: 30000 });
  const tests = resolveTestsArray(payload);
  const pagination = resolvePagination(payload, { page, limit, count: tests.length });

  return {
    tests,
    hasMore: pagination.hasMore,
    nextPage: pagination.nextPage,
  };
};

export const getTestForEditDetailRequest = async ({ authFetch, testId, language }) => {
  const qs = language ? `?lang=${encodeURIComponent(String(language))}` : '';
  const payload = await authFetch(`/tests/${encodeURIComponent(String(testId))}/edit-detail${qs}`, {
    method: 'GET',
    timeoutMs: 30000,
  });
  return payload?.test || null;
};

export const getTestForEditRequest = async ({ authFetch, testId, language }) => {
  const qs = language ? `?lang=${encodeURIComponent(String(language))}` : '';
  const payload = await authFetch(`/tests/${encodeURIComponent(String(testId))}${qs}`, {
    method: 'GET',
    timeoutMs: 30000,
  });
  return payload?.test || null;
};

export const patchTestRequest = async ({ authFetch, testId, language, body }) => {
  const qs = language ? `?lang=${encodeURIComponent(String(language))}` : '';
  return authFetch(`/tests/${encodeURIComponent(String(testId))}${qs}`, {
    method: 'PATCH',
    body,
    timeoutMs: 30000,
  });
};

export const putTestRequest = async ({ authFetch, testId, language, body }) => {
  const qs = language ? `?lang=${encodeURIComponent(String(language))}` : '';
  return authFetch(`/tests/${encodeURIComponent(String(testId))}${qs}`, {
    method: 'PUT',
    body,
    timeoutMs: 30000,
  });
};
