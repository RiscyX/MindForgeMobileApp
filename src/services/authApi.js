import { apiRequest } from './httpClient';

export const loginRequest = async ({ email, password, deviceName = 'MindForge Mobile App' }) => {
  return apiRequest('/auth/login', {
    method: 'POST',
    body: {
      email: email.trim().toLowerCase(),
      password,
      device_name: deviceName,
    },
  });
};

export const registerRequest = async ({ email, password, passwordConfirm, lang = 'en', deviceName = 'MindForge Mobile App' }) => {
  return apiRequest('/auth/register', {
    method: 'POST',
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
    body: {
      refresh_token: refreshToken,
    },
  });
};

export const logoutRequest = async ({ accessToken, refreshToken }) => {
  return apiRequest('/auth/logout', {
    method: 'POST',
    accessToken,
    body: refreshToken ? { refresh_token: refreshToken } : undefined,
  });
};

export const meRequest = async ({ accessToken }) => {
  return apiRequest('/auth/me', {
    method: 'GET',
    accessToken,
  });
};
