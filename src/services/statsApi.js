export const fetchQuizStatsRequest = async ({ authFetch, language }) => {
  const qs = language ? `?lang=${encodeURIComponent(String(language))}` : '';
  return authFetch(`/me/stats/quizzes${qs}`, {
    method: 'GET',
    timeoutMs: 30000,
  });
};
