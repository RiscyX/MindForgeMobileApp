import { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError, apiRequest } from '../services/httpClient';
import { loginRequest, logoutRequest, meRequest, refreshRequest, registerRequest } from '../services/authApi';
import { tokenStorage } from '../services/secureStorage';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [refreshToken, setRefreshToken] = useState(null);
  const [tokenType, setTokenType] = useState('Bearer');
  const [expiresIn, setExpiresIn] = useState(null);
  const [refreshExpiresIn, setRefreshExpiresIn] = useState(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const refreshInFlightRef = useRef(null);
  const sessionGenerationRef = useRef(0);
  const accessTokenRef = useRef(null);
  const refreshTokenRef = useRef(null);
  const tokenTypeRef = useRef('Bearer');
  const expiresInRef = useRef(null);
  const refreshExpiresInRef = useRef(null);
  const userRef = useRef(null);

  const persistSession = useCallback(async ({
    nextAccessToken,
    nextRefreshToken,
    nextTokenType,
    nextExpiresIn,
    nextRefreshExpiresIn,
    nextUser,
  }) => {
    setAccessToken(nextAccessToken);
    setRefreshToken(nextRefreshToken);
    setTokenType(nextTokenType || 'Bearer');
    setExpiresIn(nextExpiresIn ?? null);
    setRefreshExpiresIn(nextRefreshExpiresIn ?? null);
    setUser(nextUser);
    accessTokenRef.current = nextAccessToken;
    refreshTokenRef.current = nextRefreshToken;
    tokenTypeRef.current = nextTokenType || 'Bearer';
    expiresInRef.current = nextExpiresIn ?? null;
    refreshExpiresInRef.current = nextRefreshExpiresIn ?? null;
    userRef.current = nextUser;

    await tokenStorage.saveSession({
      accessToken: nextAccessToken,
      refreshToken: nextRefreshToken,
      tokenType: nextTokenType || 'Bearer',
      expiresIn: nextExpiresIn ?? null,
      refreshExpiresIn: nextRefreshExpiresIn ?? null,
      user: nextUser,
    });
  }, []);

  const extractSessionFromAuthResponse = useCallback((response) => {
    const root = response || {};
    const tokens = root.tokens || root.data?.tokens || null;

    const nextAccessTokenRaw = root.access_token
      || root.accessToken
      || root.data?.access_token
      || root.data?.accessToken
      || tokens?.access_token
      || tokens?.accessToken
      || null;
    const nextRefreshTokenRaw = root.refresh_token
      || root.refreshToken
      || root.data?.refresh_token
      || root.data?.refreshToken
      || tokens?.refresh_token
      || tokens?.refreshToken
      || null;

    const nextTokenTypeRaw = root.token_type
      || root.tokenType
      || root.data?.token_type
      || root.data?.tokenType
      || tokens?.token_type
      || tokens?.tokenType
      || 'Bearer';
    const nextExpiresInRaw = root.expires_in
      || root.expiresIn
      || root.data?.expires_in
      || root.data?.expiresIn
      || tokens?.expires_in
      || tokens?.expiresIn
      || null;
    const nextRefreshExpiresInRaw = root.refresh_expires_in
      || root.refreshExpiresIn
      || root.data?.refresh_expires_in
      || root.data?.refreshExpiresIn
      || tokens?.refresh_expires_in
      || tokens?.refreshExpiresIn
      || null;

    const nextAccessToken = typeof nextAccessTokenRaw === 'string' ? nextAccessTokenRaw.trim() : nextAccessTokenRaw;
    const nextRefreshToken = typeof nextRefreshTokenRaw === 'string' ? nextRefreshTokenRaw.trim() : nextRefreshTokenRaw;
    const nextTokenType = typeof nextTokenTypeRaw === 'string' && nextTokenTypeRaw.trim() ? nextTokenTypeRaw.trim() : 'Bearer';
    const parsedExpiresIn = Number(nextExpiresInRaw);
    const parsedRefreshExpiresIn = Number(nextRefreshExpiresInRaw);
    const nextUser = root.user || root.data?.user || null;

    return {
      nextAccessToken,
      nextRefreshToken,
      nextTokenType,
      nextExpiresIn: Number.isFinite(parsedExpiresIn) ? parsedExpiresIn : null,
      nextRefreshExpiresIn: Number.isFinite(parsedRefreshExpiresIn) ? parsedRefreshExpiresIn : null,
      nextUser,
    };
  }, []);

  const clearSession = useCallback(async () => {
    setAccessToken(null);
    setRefreshToken(null);
    setTokenType('Bearer');
    setExpiresIn(null);
    setRefreshExpiresIn(null);
    setUser(null);
    accessTokenRef.current = null;
    refreshTokenRef.current = null;
    tokenTypeRef.current = 'Bearer';
    expiresInRef.current = null;
    refreshExpiresInRef.current = null;
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
      const nextTokenType = extracted.nextTokenType || tokenTypeRef.current || 'Bearer';
      const nextExpiresIn = extracted.nextExpiresIn;
      const nextRefreshExpiresIn = extracted.nextRefreshExpiresIn;
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
        nextTokenType,
        nextExpiresIn,
        nextRefreshExpiresIn,
        nextUser,
      });

      return {
        accessToken: nextAccessToken,
        refreshToken: nextRefreshToken,
        tokenType: nextTokenType,
        expiresIn: nextExpiresIn,
        refreshExpiresIn: nextRefreshExpiresIn,
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
        setTokenType(stored.tokenType || 'Bearer');
        setExpiresIn(stored.expiresIn ?? null);
        setRefreshExpiresIn(stored.refreshExpiresIn ?? null);
        userRef.current = stored.user || null;
        accessTokenRef.current = stored.accessToken || null;
        refreshTokenRef.current = stored.refreshToken || null;
        tokenTypeRef.current = stored.tokenType || 'Bearer';
        expiresInRef.current = stored.expiresIn ?? null;
        refreshExpiresInRef.current = stored.refreshExpiresIn ?? null;

        const refreshed = await refresh(stored.refreshToken);
        if (refreshed?.accessToken) {
          try {
            const me = await meRequest({ accessToken: refreshed.accessToken });
            const meUser = me?.user || refreshed.user || stored.user || null;
            if (meUser) {
              await persistSession({
                nextAccessToken: refreshed.accessToken,
                nextRefreshToken: refreshed.refreshToken,
                nextTokenType: refreshed.tokenType,
                nextExpiresIn: refreshed.expiresIn,
                nextRefreshExpiresIn: refreshed.refreshExpiresIn,
                nextUser: meUser,
              });
            }
          } catch (error) {
            console.warn('[auth/bootstrap] /auth/me failed:', error?.message || error);
          }
        }
      } catch (error) {
        console.warn('[auth/bootstrap] session restore failed:', error?.message || error);
        await clearSession();
      } finally {
        setIsBootstrapping(false);
      }
    };

    bootstrap();
  }, [clearSession, persistSession, refresh]);

  const login = useCallback(async ({ email, password }) => {
    const response = await loginRequest({ email, password });

    const extracted = extractSessionFromAuthResponse(response);
    const nextAccessToken = extracted.nextAccessToken;
    const nextRefreshToken = extracted.nextRefreshToken;
    const nextTokenType = extracted.nextTokenType;
    const nextExpiresIn = extracted.nextExpiresIn;
    const nextRefreshExpiresIn = extracted.nextRefreshExpiresIn;
    const nextUser = extracted.nextUser;

    if (!nextAccessToken || !nextRefreshToken) {
      const keys = response && typeof response === 'object' ? Object.keys(response) : [];
      throw new ApiError(`Invalid login response (missing tokens). Keys: ${keys.join(', ')}`, 401, response);
    }

    await persistSession({
      nextAccessToken,
      nextRefreshToken,
      nextTokenType,
      nextExpiresIn,
      nextRefreshExpiresIn,
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
    } catch (error) {
      console.warn('[auth/logout] backend logout failed:', error?.message || error);
    }
  }, [accessToken, clearSession, refreshToken]);

  const authFetch = useCallback(async (endpoint, options = {}) => {
    const stateToken = typeof accessToken === 'string' ? accessToken.trim() : '';
    const normalizedStateToken = stateToken.replace(/^bearer\s+/i, '');
    const stored = !normalizedStateToken ? await tokenStorage.loadSession() : null;
    const fallbackToken = typeof stored?.accessToken === 'string' ? stored.accessToken.trim().replace(/^bearer\s+/i, '') : '';
    const tokenForRequest = normalizedStateToken || fallbackToken;

    if (!tokenForRequest) {
      await clearSession();
      throw new ApiError('Missing access token. Please log in again.', 401, null);
    }

    const makeRequest = (token) => apiRequest(endpoint, {
      ...options,
      accessToken: token,
    });

    try {
      return await makeRequest(tokenForRequest);
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401) {
        throw error;
      }

      try {
        const refreshed = await refresh();
        return await makeRequest(refreshed.accessToken);
      } catch (refreshError) {
        await clearSession();
        throw new ApiError(
          refreshError?.message || 'Session expired. Please log in again.',
          refreshError?.status || 401,
          refreshError?.data || null,
        );
      }
    }
  }, [accessToken, clearSession, refresh]);

  const setUserProfile = useCallback(async (nextUser) => {
    const mergedUser = {
      ...(userRef.current || {}),
      ...(nextUser || {}),
    };

    setUser(mergedUser);
    userRef.current = mergedUser;

    await tokenStorage.saveSession({
      accessToken: accessTokenRef.current,
      refreshToken: refreshTokenRef.current,
      tokenType: tokenTypeRef.current,
      expiresIn: expiresInRef.current,
      refreshExpiresIn: refreshExpiresInRef.current,
      user: mergedUser,
    });
  }, []);

  const value = useMemo(() => ({
    user,
    accessToken,
    tokenType,
    expiresIn,
    refreshExpiresIn,
    isAuthenticated: Boolean(accessToken),
    isBootstrapping,
    login,
    register,
    logout,
    refresh,
    authFetch,
    setUserProfile,
  }), [
    accessToken,
    authFetch,
    expiresIn,
    isBootstrapping,
    login,
    logout,
    refresh,
    refreshExpiresIn,
    register,
    setUserProfile,
    tokenType,
    user,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
