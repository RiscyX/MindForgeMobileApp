import * as SecureStore from 'expo-secure-store';

const KEYS = {
  accessToken: 'mf_access_token',
  refreshToken: 'mf_refresh_token',
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
  async saveSession({ accessToken, refreshToken, user }) {
    await Promise.all([
      setItem(KEYS.accessToken, accessToken),
      setItem(KEYS.refreshToken, refreshToken),
      setItem(KEYS.user, user),
    ]);
  },

  async loadSession() {
    const [accessToken, refreshToken, user] = await Promise.all([
      SecureStore.getItemAsync(KEYS.accessToken),
      SecureStore.getItemAsync(KEYS.refreshToken),
      getJsonItem(KEYS.user),
    ]);

    return { accessToken, refreshToken, user };
  },

  async clearSession() {
    await Promise.all([
      SecureStore.deleteItemAsync(KEYS.accessToken),
      SecureStore.deleteItemAsync(KEYS.refreshToken),
      SecureStore.deleteItemAsync(KEYS.user),
    ]);
  },
};
