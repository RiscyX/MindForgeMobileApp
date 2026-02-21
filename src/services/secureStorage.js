import * as SecureStore from 'expo-secure-store';

const KEYS = {
  accessToken: 'mf_access_token',
  refreshToken: 'mf_refresh_token',
  tokenType: 'mf_token_type',
  expiresIn: 'mf_expires_in',
  refreshExpiresIn: 'mf_refresh_expires_in',
  user: 'mf_user',
};

const setItem = async (key, value) => {
  if (value === null || value === undefined) {
    await SecureStore.deleteItemAsync(key);
    return;
  }

  await SecureStore.setItemAsync(key, typeof value === 'string' ? value : JSON.stringify(value));
};

const getJsonItem = async (key) => {
  const raw = await SecureStore.getItemAsync(key);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const tokenStorage = {
  async saveSession({ accessToken, refreshToken, tokenType, expiresIn, refreshExpiresIn, user }) {
    await Promise.all([
      setItem(KEYS.accessToken, accessToken),
      setItem(KEYS.refreshToken, refreshToken),
      setItem(KEYS.tokenType, tokenType),
      setItem(KEYS.expiresIn, expiresIn),
      setItem(KEYS.refreshExpiresIn, refreshExpiresIn),
      setItem(KEYS.user, user),
    ]);
  },

  async loadSession() {
    const [accessToken, refreshToken, tokenType, expiresInRaw, refreshExpiresInRaw, user] = await Promise.all([
      SecureStore.getItemAsync(KEYS.accessToken),
      SecureStore.getItemAsync(KEYS.refreshToken),
      SecureStore.getItemAsync(KEYS.tokenType),
      SecureStore.getItemAsync(KEYS.expiresIn),
      SecureStore.getItemAsync(KEYS.refreshExpiresIn),
      getJsonItem(KEYS.user),
    ]);

    const expiresIn = expiresInRaw !== null ? Number(expiresInRaw) : null;
    const refreshExpiresIn = refreshExpiresInRaw !== null ? Number(refreshExpiresInRaw) : null;

    return {
      accessToken,
      refreshToken,
      tokenType,
      expiresIn: Number.isFinite(expiresIn) ? expiresIn : null,
      refreshExpiresIn: Number.isFinite(refreshExpiresIn) ? refreshExpiresIn : null,
      user,
    };
  },

  async clearSession() {
    await Promise.all([
      SecureStore.deleteItemAsync(KEYS.accessToken),
      SecureStore.deleteItemAsync(KEYS.refreshToken),
      SecureStore.deleteItemAsync(KEYS.tokenType),
      SecureStore.deleteItemAsync(KEYS.expiresIn),
      SecureStore.deleteItemAsync(KEYS.refreshExpiresIn),
      SecureStore.deleteItemAsync(KEYS.user),
    ]);
  },
};
