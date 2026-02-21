const DEFAULT_API_BASE_URL = 'https://undefined.stud.vts.su.ac.rs/api/v1';
const EXPECTED_API_ORIGIN = 'https://undefined.stud.vts.su.ac.rs';

const trimTrailingSlash = (value) => String(value || '').replace(/\/+$/, '');

const normalizeApiBaseUrl = (value) => {
  const base = trimTrailingSlash(value);
  if (!base) {
    return DEFAULT_API_BASE_URL;
  }

  let normalized = base;

  if (base.endsWith('/api')) {
    normalized = `${base}/v1`;
  }

  if (!normalized.endsWith('/api/v1')) {
    return DEFAULT_API_BASE_URL;
  }

  try {
    const origin = new URL(normalized).origin;
    if (origin !== EXPECTED_API_ORIGIN) {
      if (__DEV__) {
        console.warn('[httpClient] Ignoring unsupported API origin:', origin);
      }
      return DEFAULT_API_BASE_URL;
    }
  } catch {
    return DEFAULT_API_BASE_URL;
  }

  return normalized;
};

const resolveApiBaseUrl = () => {
  const envBase = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (typeof envBase === 'string' && envBase.trim()) {
    return normalizeApiBaseUrl(envBase.trim());
  }

  return normalizeApiBaseUrl(DEFAULT_API_BASE_URL);
};

const API_BASE_URL = resolveApiBaseUrl();

if (__DEV__) {
  console.log('[httpClient] API_BASE_URL:', API_BASE_URL);
}

class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

const extractHtmlTitle = (html) => {
  if (!html) {
    return null;
  }

  const match = String(html).match(/<title>\s*([\s\S]*?)\s*<\/title>/i);
  if (!match) {
    return null;
  }

  return match[1]
    .replace(/\s+/g, ' ')
    .replace(/^Error:\s*/i, '')
    .trim();
};

const readResponseBody = async (response) => {
  const text = await response.text();
  const contentType = (response.headers.get('content-type') || '').toLowerCase();
  const looksJson = contentType.includes('application/json') || contentType.includes('+json');

  if (!text) {
    return { data: null, text: '', looksJson, contentType };
  }

  if (!looksJson) {
    return { data: null, text, looksJson, contentType };
  }

  try {
    return { data: JSON.parse(text), text, looksJson, contentType };
  } catch {
    // Content-Type says JSON but body isn't.
    return { data: null, text, looksJson, contentType };
  }
};

export const apiRequest = async (endpoint, options = {}) => {
  const {
    method = 'GET',
    body,
    headers = {},
    accessToken,
    timeoutMs = 15000,
  } = options;

  const normalizedAccessToken = typeof accessToken === 'string'
    ? accessToken.trim().replace(/^bearer\s+/i, '')
    : accessToken;
  const sentAuth = Boolean(normalizedAccessToken);

  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const requestHeaders = {
      Accept: 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      ...(body && !isFormData ? { 'Content-Type': 'application/json' } : {}),
      ...(normalizedAccessToken ? { Authorization: `Bearer ${normalizedAccessToken}` } : {}),
      ...headers,
    };

    if (__DEV__ && endpoint.includes('/tests/') && endpoint.endsWith('/start')) {
      const authLen = requestHeaders.Authorization ? String(requestHeaders.Authorization).length : 0;
      console.log('[apiRequest]', method, endpoint, 'authHeader=', Boolean(requestHeaders.Authorization), 'authLen=', authLen);
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method,
      headers: requestHeaders,
      body: body ? (isFormData ? body : JSON.stringify(body)) : undefined,
      signal: controller.signal,
    });

    const responseMeta = {
      endpoint,
      sentAuth,
      status: response.status,
      redirected: Boolean(response.redirected),
      url: response.url || null,
    };

    const { data, text, looksJson, contentType } = await readResponseBody(response);

    if (response.ok && !looksJson) {
      const snippet = (text || '').slice(0, 220);
      throw new ApiError(`Expected JSON but got ${contentType || 'unknown content-type'}`, 502, {
        contentType,
        bodySnippet: snippet,
        _meta: responseMeta,
      });
    }

    if (response.ok && looksJson && data === null) {
      const snippet = (text || '').slice(0, 220);
      throw new ApiError('Invalid JSON response from server', 502, {
        contentType,
        bodySnippet: snippet,
        _meta: responseMeta,
      });
    }

    // Some backends incorrectly return 200 with an error payload.
    if (response.ok && data && typeof data === 'object' && data.error) {
      const message = data?.error?.message || 'Request failed.';
      const code = data?.error?.code;
      throw new ApiError(code ? `${message} (${code})` : message, 400, data);
    }

    if (!response.ok) {
      const htmlTitle = !looksJson ? extractHtmlTitle(text) : null;
      const message = data?.error?.message || data?.message || htmlTitle || `Request failed with ${response.status}`;
      const snippet = (text || '').slice(0, 500);
      const raw = {
        contentType,
        looksJson,
        bodySnippet: snippet,
      };

      const errorData = (data && typeof data === 'object')
        ? { ...data, _meta: responseMeta, _raw: raw }
        : { data, _meta: responseMeta, _raw: raw };
      throw new ApiError(message, response.status, errorData);
    }

    return data;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new ApiError('Request timed out', 408, null);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

export { API_BASE_URL, ApiError };
