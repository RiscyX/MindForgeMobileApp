import { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError, apiRequest } from '../services/httpClient';
import { loginRequest, logoutRequest, meRequest, refreshRequest, registerRequest } from '../services/authApi';
import { tokenStorage } from '../services/secureStorage';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [refreshToken, setRefreshToken] = useState(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const refreshInFlightRef = useRef(null);
  const sessionGenerationRef = useRef(0);
  const refreshTokenRef = useRef(null);
  const userRef = useRef(null);

  const persistSession = useCallback(async ({ nextAccessToken, nextRefreshToken, nextUser }) => {
    setAccessToken(nextAccessToken);
    setRefreshToken(nextRefreshToken);
    setUser(nextUser);
    refreshTokenRef.current = nextRefreshToken;
    userRef.current = nextUser;

    await tokenStorage.saveSession({
      accessToken: nextAccessToken,
      refreshToken: nextRefreshToken,
      user: nextUser,
    });
  }, []);

  const extractSessionFromAuthResponse = useCallback((response) => {
    const root = response || {};
    const tokens = root.tokens || root.data?.tokens || null;

    const nextAccessTokenRaw = root.access_token || tokens?.access_token || tokens?.accessToken || null;
    const nextRefreshTokenRaw = root.refresh_token || tokens?.refresh_token || tokens?.refreshToken || null;

    const nextAccessToken = typeof nextAccessTokenRaw === 'string' ? nextAccessTokenRaw.trim() : nextAccessTokenRaw;
    const nextRefreshToken = typeof nextRefreshTokenRaw === 'string' ? nextRefreshTokenRaw.trim() : nextRefreshTokenRaw;
    const nextUser = root.user || root.data?.user || null;

    return {
      nextAccessToken,
      nextRefreshToken,
      nextUser,
    };
  }, []);

  const clearSession = useCallback(async () => {
    setAccessToken(null);
    setRefreshToken(null);
    setUser(null);
    refreshTokenRef.current = null;
    userRef.current = null;
    await tokenStorage.clearSession();
  }, []);

  const refresh = useCallback(async (providedRefreshToken = null) => {
    const generation = sessionGenerationRef.current;
    const token = providedRefreshToken || refreshTokenRef.current;
    if (!token) {
      throw new ApiError('Missing refresh token', 401, null);
    }

    if (refreshInFlightRef.current) {
      return refreshInFlightRef.current;
    }

    refreshInFlightRef.current = (async () => {
      const response = await refreshRequest({ refreshToken: token });
      const extracted = extractSessionFromAuthResponse(response);
      const nextAccessToken = extracted.nextAccessToken;
      const nextRefreshToken = extracted.nextRefreshToken || token;
      const nextUser = extracted.nextUser || userRef.current;

      if (!nextAccessToken) {
        throw new ApiError('Invalid refresh response', 401, response);
      }

      if (generation !== sessionGenerationRef.current) {
        throw new ApiError('Session changed', 401, null);
      }

      await persistSession({
        nextAccessToken,
        nextRefreshToken,
        nextUser,
      });

      return {
        accessToken: nextAccessToken,
        refreshToken: nextRefreshToken,
        user: nextUser,
      };
    })();

    try {
      return await refreshInFlightRef.current;
    } finally {
      refreshInFlightRef.current = null;
    }
  }, [extractSessionFromAuthResponse, persistSession]);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const stored = await tokenStorage.loadSession();

        if (!stored.refreshToken) {
          return;
        }

        setUser(stored.user || null);
        setAccessToken(stored.accessToken || null);
        setRefreshToken(stored.refreshToken || null);
        userRef.current = stored.user || null;
        refreshTokenRef.current = stored.refreshToken || null;

        const refreshed = await refresh(stored.refreshToken);
        if (refreshed?.accessToken) {
          try {
            const me = await meRequest({ accessToken: refreshed.accessToken });
            const meUser = me?.user || refreshed.user || stored.user || null;
            if (meUser) {
              await persistSession({
                nextAccessToken: refreshed.accessToken,
                nextRefreshToken: refreshed.refreshToken,
                nextUser: meUser,
              });
            }
          } catch {
            // Me endpoint can lag behind during backend rollout.
          }
        }
      } catch {
        await clearSession();
      } finally {
        setIsBootstrapping(false);
      }
    };

    bootstrap();
  }, [clearSession, persistSession, refresh]);

  const login = useCallback(async ({ email, password, deviceName }) => {
    const response = await loginRequest({ email, password, deviceName });

    const extracted = extractSessionFromAuthResponse(response);
    const nextAccessToken = extracted.nextAccessToken;
    const nextRefreshToken = extracted.nextRefreshToken;
    const nextUser = extracted.nextUser;

    if (!nextAccessToken || !nextRefreshToken) {
      const keys = response && typeof response === 'object' ? Object.keys(response) : [];
      throw new ApiError(`Invalid login response (missing tokens). Keys: ${keys.join(', ')}`, 401, response);
    }

    await persistSession({
      nextAccessToken,
      nextRefreshToken,
      nextUser,
    });

    return response;
  }, [extractSessionFromAuthResponse, persistSession]);

  const register = useCallback(async ({ email, password, passwordConfirm, lang, deviceName }) => {
    return registerRequest({ email, password, passwordConfirm, lang, deviceName });
  }, []);

  const logout = useCallback(async () => {
    sessionGenerationRef.current += 1;

    const tokenSnapshot = {
      accessToken,
      refreshToken,
    };

    await clearSession();

    try {
      if (tokenSnapshot.accessToken || tokenSnapshot.refreshToken) {
        await logoutRequest(tokenSnapshot);
      }
    } catch {
      // Local logout already completed.
    }
  }, [accessToken, clearSession, refreshToken]);

  const authFetch = useCallback(async (endpoint, options = {}) => {
    const makeRequest = (token) => apiRequest(endpoint, { ...options, accessToken: token });

    try {
      return await makeRequest(accessToken);
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401) {
        throw error;
      }

      const refreshed = await refresh();
      return makeRequest(refreshed.accessToken);
    }
  }, [accessToken, refresh]);

  const setUserProfile = useCallback(async (nextUser) => {
    const mergedUser = {
      ...(userRef.current || {}),
      ...(nextUser || {}),
    };

    setUser(mergedUser);
    userRef.current = mergedUser;

    await tokenStorage.saveSession({
      accessToken,
      refreshToken: refreshTokenRef.current,
      user: mergedUser,
    });
  }, [accessToken]);

  const value = useMemo(() => ({
    user,
    accessToken,
    isAuthenticated: Boolean(accessToken),
    isBootstrapping,
    login,
    register,
    logout,
    refresh,
    authFetch,
    setUserProfile,
  }), [accessToken, authFetch, isBootstrapping, login, logout, refresh, register, setUserProfile, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
