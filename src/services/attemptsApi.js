export const startAttemptRequest = async ({ authFetch, testId, language }) => {
  const body = language ? { lang: language } : undefined;
  const data = await authFetch(`/tests/${encodeURIComponent(String(testId))}/start`, {
    method: 'POST',
    body,
    headers: { 'X-Requested-With': 'XMLHttpRequest' },
    timeoutMs: 30000,
  });
  return data?.attempt || null;
};

export const getAttemptRequest = async ({ authFetch, attemptId, language }) => {
  const lang = language ? `?lang=${encodeURIComponent(String(language))}` : '';
  const data = await authFetch(`/attempts/${encodeURIComponent(String(attemptId))}${lang}`, {
    method: 'GET',
    timeoutMs: 30000,
  });
  return data;
};

export const submitAttemptRequest = async ({ authFetch, attemptId, answers }) => {
  const data = await authFetch(`/attempts/${encodeURIComponent(String(attemptId))}/submit`, {
    method: 'POST',
    body: { answers },
    timeoutMs: 45000,
  });
  return data;
};

export const reviewAttemptRequest = async ({ authFetch, attemptId, language }) => {
  const lang = language ? `?lang=${encodeURIComponent(String(language))}` : '';
  const data = await authFetch(`/attempts/${encodeURIComponent(String(attemptId))}/review${lang}`, {
    method: 'GET',
    timeoutMs: 30000,
  });
  return data;
};
