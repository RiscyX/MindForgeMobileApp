import { API_BASE_URL, ApiError, apiRequest } from './httpClient';

const AUTH_JSON_HEADERS = {
  Accept: 'application/json',
  'Content-Type': 'application/json',
};

const buildLoginError = (error) => {
  const status = error instanceof ApiError ? error.status : null;
  const responseBody = error instanceof ApiError ? error.data : null;
  const networkMessage = error?.message || 'Unknown network error';

  if (__DEV__) {
    console.error('[auth/login] failed', {
      requestUrl: `${API_BASE_URL}/auth/login`,
      statusCode: status,
      responseBody: responseBody ? JSON.stringify(responseBody) : null,
      networkError: networkMessage,
    });
  }

  if (error instanceof ApiError) {
    return new ApiError(error.message || 'Login failed', error.status, error.data);
  }

  return new ApiError(networkMessage, 0, null);
};

export const loginRequest = async ({ email, password, lang = 'en' }) => {
  try {
    return await apiRequest('/auth/login', {
      method: 'POST',
      headers: AUTH_JSON_HEADERS,
      body: {
        email: email.trim().toLowerCase(),
        password,
        lang,
      },
    });
  } catch (error) {
    throw buildLoginError(error);
  }
};

export const registerRequest = async ({ email, password, passwordConfirm, lang = 'en', deviceName = 'MindForge' }) => {
  return apiRequest('/auth/register', {
    method: 'POST',
    headers: AUTH_JSON_HEADERS,
    body: {
      email: email.trim().toLowerCase(),
      password,
      password_confirm: passwordConfirm,
      lang,
      device_name: deviceName,
    },
  });
};

export const refreshRequest = async ({ refreshToken }) => {
  return apiRequest('/auth/refresh', {
    method: 'POST',
    headers: AUTH_JSON_HEADERS,
    body: {
      refresh_token: refreshToken,
    },
  });
};

export const logoutRequest = async ({ accessToken, refreshToken }) => {
  return apiRequest('/auth/logout', {
    method: 'POST',
    accessToken,
    headers: AUTH_JSON_HEADERS,
    body: refreshToken ? { refresh_token: refreshToken } : undefined,
  });
};

export const meRequest = async ({ accessToken }) => {
  return apiRequest('/auth/me', {
    method: 'GET',
    accessToken,
    headers: AUTH_JSON_HEADERS,
  });
};

export const forgotPasswordRequest = async ({ email, lang = 'en' }) => {
  return apiRequest('/auth/forgot-password', {
    method: 'POST',
    headers: AUTH_JSON_HEADERS,
    body: {
      email: email.trim().toLowerCase(),
      lang,
    },
  });
};

export const resetPasswordRequest = async ({ token, password, passwordConfirm }) => {
  return apiRequest('/auth/reset-password', {
    method: 'POST',
    headers: AUTH_JSON_HEADERS,
    body: {
      token,
      password,
      password_confirm: passwordConfirm,
    },
  });
};
