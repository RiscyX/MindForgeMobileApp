import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { useLanguage } from '../hooks/useLanguage';
import { useAuth } from '../hooks/useAuth';
import AppBottomNav from '../components/AppBottomNav';
import { fetchProfileRequest, updateProfileRequest } from '../services/profileApi';
import { API_BASE_URL, ApiError } from '../services/httpClient';

export default function ProfileScreen({ user, onLogout, onGoTests, onGoStats, onGoProfile }) {
  const { t, language, setLanguage } = useLanguage();
  const { authFetch, setUserProfile } = useAuth();

  const [profile, setProfile] = useState(null);
  const [username, setUsername] = useState('');
  const [pickedAvatarAsset, setPickedAvatarAsset] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const fallbackUserRef = useRef(user);

  useEffect(() => {
    fallbackUserRef.current = user;
  }, [user]);

  const normalizeProfile = useCallback((payload) => {
    const fallbackUser = fallbackUserRef.current || {};
    const roleName = payload?.role?.name || payload?.role_name || (payload?.role_id ? String(payload.role_id) : t('profile.notAvailable'));

    return {
      id: payload?.id || fallbackUser?.id || null,
      email: payload?.email || fallbackUser?.email || '',
      username: payload?.username || fallbackUser?.username || '',
      avatar_url: payload?.avatar_url || fallbackUser?.avatar_url || '',
      role_id: payload?.role_id ?? fallbackUser?.role_id,
      role_name: roleName,
      created_at: payload?.created_at || fallbackUser?.created_at || null,
      last_login_at: payload?.last_login_at || fallbackUser?.last_login_at || null,
      is_active: payload?.is_active ?? fallbackUser?.is_active,
      is_blocked: payload?.is_blocked ?? fallbackUser?.is_blocked,
    };
  }, [t]);

  const isSameProfile = useCallback((a, b) => {
    if (!a || !b) {
      return false;
    }

    return a.id === b.id
      && a.email === b.email
      && a.username === b.username
      && a.avatar_url === b.avatar_url
      && a.role_id === b.role_id
      && a.role_name === b.role_name
      && a.created_at === b.created_at
      && a.last_login_at === b.last_login_at
      && a.is_active === b.is_active
      && a.is_blocked === b.is_blocked;
  }, []);

  useEffect(() => {
    const loadProfile = async () => {
      setIsLoading(true);
      setError('');

      try {
        const serverProfile = await fetchProfileRequest(authFetch);
        const normalized = normalizeProfile(serverProfile);
        setProfile(normalized);
        setUsername(normalized.username || '');
        setPickedAvatarAsset(null);
        if (!isSameProfile(fallbackUserRef.current, normalized)) {
          await setUserProfile(normalized);
        }
      } catch (loadError) {
        const fallback = normalizeProfile(fallbackUserRef.current || {});
        setProfile(fallback);
        setUsername(fallback.username || '');
        setPickedAvatarAsset(null);

        if (loadError instanceof ApiError && loadError.status === 404) {
          setError(t('profile.endpointMissing'));
        } else {
          setError(t('profile.loadError'));
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadProfile();
  }, [authFetch, isSameProfile, normalizeProfile, setUserProfile, t]);

  const initials = useMemo(() => {
    const source = (username || profile?.email || 'M').trim();
    return source ? source[0].toUpperCase() : 'M';
  }, [profile?.email, username]);

  const resolvedAvatarUrl = useMemo(() => {
    if (pickedAvatarAsset?.uri) {
      return pickedAvatarAsset.uri;
    }

    const raw = profile?.avatar_url;
    if (!raw) {
      return null;
    }

    if (raw.startsWith('http://') || raw.startsWith('https://')) {
      return raw;
    }

    const base = API_BASE_URL.replace(/\/api\/v1\/?$/, '');
    return `${base}/img/${String(raw).replace(/^\/+/, '')}`;
  }, [pickedAvatarAsset, profile?.avatar_url]);

  const formatDateValue = useCallback((value) => {
    if (!value) {
      return t('profile.notAvailable');
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return String(value);
    }

    return date.toLocaleString();
  }, [t]);

  const normalizePickedAssetToFile = useCallback(async (asset) => {
    if (!asset?.uri) {
      return null;
    }

    const uri = String(asset.uri);
    const isAlreadyFile = uri.startsWith('file://');
    if (isAlreadyFile) {
      return asset;
    }

    const guessExt = () => {
      const name = String(asset.fileName || uri);
      const ext = name.split('.').pop()?.toLowerCase();
      if (ext === 'png' || ext === 'gif' || ext === 'webp' || ext === 'jpg' || ext === 'jpeg') {
        return ext === 'jpeg' ? 'jpg' : ext;
      }
      return 'jpg';
    };

    const ext = guessExt();
    const stamp = Date.now();
    const dest = `${FileSystem.cacheDirectory}mf-avatar-${stamp}.${ext}`;

    await FileSystem.copyAsync({ from: uri, to: dest });

    const mimeType = ext === 'png'
      ? 'image/png'
      : ext === 'gif'
        ? 'image/gif'
        : ext === 'webp'
          ? 'image/webp'
          : 'image/jpeg';

    return {
      ...asset,
      uri: dest,
      fileName: `mf-avatar-${stamp}.${ext}`,
      mimeType,
    };
  }, []);

  const handlePickAvatar = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError(t('profile.saveError'));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });

    if (!result.canceled && result.assets?.[0]) {
      try {
        const normalized = await normalizePickedAssetToFile(result.assets[0]);
        setPickedAvatarAsset(normalized);
      } catch {
        setError(t('profile.avatarPrepareFailed'));
      }
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSuccess('');
    setError('');

    try {
      const payload = {
        username,
        avatarAsset: pickedAvatarAsset,
      };

      const updated = await updateProfileRequest(authFetch, payload);
      const normalized = normalizeProfile({
        ...profile,
        ...updated,
      });

      setProfile(normalized);
      setUsername(normalized.username || '');
      setPickedAvatarAsset(null);
      await setUserProfile(normalized);
      setSuccess(t('profile.saveSuccess'));
    } catch (saveError) {
      if (saveError instanceof ApiError && saveError.status === 404) {
        setError(t('profile.endpointMissing'));
      } else if (saveError instanceof ApiError && saveError.data?.error?.message) {
        setError(saveError.data.error.message);
      } else if (saveError instanceof Error && saveError.message) {
        setError(saveError.message);
      } else {
        setError(t('profile.saveError'));
      }
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <View className="flex-1 bg-transparent">
        <SafeAreaView className="flex-1 px-6 justify-center items-center" edges={['top', 'left', 'right']}>
          <StatusBar style="light" />
          <ActivityIndicator size="large" color="#575ddb" />
          <Text className="text-mf-secondary font-solway mt-4">{t('profile.loading')}</Text>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-transparent">
      <SafeAreaView className="flex-1 px-6" edges={['top', 'left', 'right']}>
        <StatusBar style="light" />

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 140 }}>
          <View className="mt-6">
            <Text className="text-mf-text text-2xl font-solway-extrabold tracking-wide">{t('profile.title')}</Text>
            <Text className="text-mf-secondary text-sm font-solway mt-2">{t('profile.subtitle')}</Text>
          </View>

          <View className="mt-5 rounded-2xl border border-mf-secondary/25 bg-mf-secondary/10 p-3">
            <Text className="text-mf-secondary text-sm font-solway-bold mb-2">{t('profile.appLanguage')}</Text>
            <View className="w-full rounded-xl border border-mf-secondary/25 bg-mf-bg/70 p-1.5 flex-row">
              <TouchableOpacity
                className={`flex-1 rounded-lg py-2.5 items-center ${language === 'en' ? 'bg-mf-primary' : 'bg-transparent'}`}
                onPress={() => setLanguage('en')}
              >
                <Text className={`font-solway-bold text-sm ${language === 'en' ? 'text-mf-text' : 'text-mf-secondary'}`}>
                  {t('common.english')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                className={`flex-1 rounded-lg py-2.5 items-center ${language === 'hu' ? 'bg-mf-primary' : 'bg-transparent'}`}
                onPress={() => setLanguage('hu')}
              >
                <Text className={`font-solway-bold text-sm ${language === 'hu' ? 'text-mf-text' : 'text-mf-secondary'}`}>
                  {t('common.hungarian')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View className="mt-8 items-center">
            {resolvedAvatarUrl ? (
              <Image
                source={{ uri: resolvedAvatarUrl }}
                className="w-28 h-28 rounded-full border border-mf-secondary/30"
                resizeMode="cover"
              />
            ) : (
              <View className="w-28 h-28 rounded-full bg-mf-secondary/30 border border-mf-secondary/30 items-center justify-center">
                <Text className="text-mf-text text-3xl font-solway-bold">{initials}</Text>
              </View>
            )}
            <TouchableOpacity
              className="mt-4 px-4 py-2 rounded-lg border border-mf-secondary/30 bg-mf-secondary/10"
              onPress={handlePickAvatar}
            >
              <Text className="text-mf-secondary font-solway-bold text-xs uppercase tracking-widest">{t('profile.changeAvatar')}</Text>
            </TouchableOpacity>
          </View>

          <View className="mt-6 rounded-2xl border border-mf-secondary/20 bg-mf-secondary/10 p-5">
            <Text className="text-mf-secondary text-xs uppercase tracking-widest font-solway-bold mb-2">{t('profile.username')}</Text>
            <TextInput
              className="w-full bg-mf-bg/60 text-mf-text p-3 rounded-xl border border-mf-secondary/25 font-solway"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
            />

            <Text className="text-mf-secondary text-xs uppercase tracking-widest font-solway-bold mt-4 mb-2">{t('profile.email')}</Text>
            <TextInput
              className="w-full bg-mf-bg/50 text-mf-secondary p-3 rounded-xl border border-mf-secondary/20 font-solway"
              value={profile?.email || t('profile.notAvailable')}
              editable={false}
            />
            <Text className="text-mf-secondary text-xs font-solway mt-2">{t('profile.emailReadonly')}</Text>

            <View className="mt-4 flex-row justify-between">
              <View>
                <Text className="text-mf-secondary text-xs uppercase tracking-widest font-solway-bold">{t('profile.joined')}</Text>
                <Text className="text-mf-text font-solway mt-1">{formatDateValue(profile?.created_at)}</Text>
              </View>
            </View>

            <View className="mt-4">
              <Text className="text-mf-secondary text-xs uppercase tracking-widest font-solway-bold">{t('profile.role')}</Text>
              <Text className="text-mf-text font-solway mt-1">{profile?.role_name || t('profile.notAvailable')}</Text>
            </View>

          </View>

          {error ? <Text className="text-red-300 font-solway text-sm mt-4">{error}</Text> : null}
          {success ? <Text className="text-green-300 font-solway text-sm mt-4">{success}</Text> : null}

          <TouchableOpacity
            className="mt-6 bg-mf-primary py-4 rounded-xl items-center shadow-lg shadow-mf-primary/30 active:bg-mf-primary/80"
            onPress={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#eae9fc" />
            ) : (
              <Text className="text-mf-text font-solway-bold text-lg">{t('profile.saveChanges')}</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            className="mt-3 bg-mf-secondary/10 py-4 rounded-xl items-center border border-mf-secondary/20 active:bg-mf-secondary/20"
            onPress={onLogout}
          >
            <Text className="text-mf-secondary font-solway-bold text-lg">{t('common.logout')}</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>

      <AppBottomNav
        active="profile"
        onTestsPress={onGoTests}
        onStatsPress={onGoStats}
        onProfilePress={onGoProfile}
      />
    </View>
  );
}
