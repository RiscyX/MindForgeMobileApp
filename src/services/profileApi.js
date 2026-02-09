import { ApiError } from './httpClient';

const shouldTryNextEndpoint = (error) => {
  return error instanceof ApiError && (error.status === 404 || error.status === 405);
};

export const fetchProfileRequest = async (authFetch) => {
  const candidates = [{ endpoint: '/auth/me', method: 'GET' }];

  for (const candidate of candidates) {
    try {
      const data = await authFetch(candidate.endpoint, { method: candidate.method });
      return data?.user || data?.profile || data;
    } catch (error) {
      if (shouldTryNextEndpoint(error)) {
        continue;
      }
      throw error;
    }
  }

  throw new ApiError('Profile endpoint is not available', 404, null);
};

export const updateProfileRequest = async (authFetch, payload) => {
  const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
  const body = new FormData();
  const normalizedUsername = payload.username?.trim();
  if (normalizedUsername) {
    body.append('username', normalizedUsername);
  }

  if (payload.avatarAsset?.uri) {
    const inferredName = payload.avatarAsset.fileName || payload.avatarAsset.uri.split('/').pop() || `avatar-${Date.now()}.jpg`;
    const extension = String(inferredName).split('.').pop()?.toLowerCase();
    const mimeFromExt = extension === 'png'
      ? 'image/png'
      : extension === 'gif'
        ? 'image/gif'
        : extension === 'webp'
          ? 'image/webp'
          : 'image/jpeg';
    const rawMimeType = (payload.avatarAsset.mimeType || '').toLowerCase();
    const mimeType = allowedMimeTypes.has(rawMimeType) ? rawMimeType : mimeFromExt;
    const safeName = inferredName.includes('.') ? inferredName : `${inferredName}.jpg`;

    body.append('avatar_file', {
      uri: payload.avatarAsset.uri,
      name: safeName,
      type: mimeType,
    });
  }

  const candidates = [{ endpoint: '/auth/me', method: 'POST' }];

  for (const candidate of candidates) {
    try {
      const data = await authFetch(candidate.endpoint, {
        method: candidate.method,
        body,
        timeoutMs: 60000,
      });
      return data?.user || data?.profile || data;
    } catch (error) {
      if (shouldTryNextEndpoint(error)) {
        continue;
      }
      throw error;
    }
  }

  throw new ApiError('Profile update endpoint is not available', 404, null);
};
