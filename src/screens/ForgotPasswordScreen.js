import { useState } from 'react';
import { ActivityIndicator, Text, TextInput, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { useLanguage } from '../hooks/useLanguage';
import { forgotPasswordRequest, resetPasswordRequest } from '../services/authApi';

export default function ForgotPasswordScreen() {
  const navigation = useNavigation();
  const { t, language } = useLanguage();
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [isSubmittingEmail, setIsSubmittingEmail] = useState(false);
  const [isSubmittingReset, setIsSubmittingReset] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSendEmail = async () => {
    if (!email.trim()) {
      setError(t('passwordReset.emailRequired'));
      return;
    }

    setError('');
    setSuccess('');
    setIsSubmittingEmail(true);
    try {
      await forgotPasswordRequest({ email: email.trim(), lang: language });
      setSuccess(t('passwordReset.emailSent'));
    } catch (e) {
      setError(e?.message || t('passwordReset.requestFailed'));
    } finally {
      setIsSubmittingEmail(false);
    }
  };

  const handleReset = async () => {
    if (!token.trim()) {
      setError(t('passwordReset.tokenRequired'));
      return;
    }
    if (!password || !passwordConfirm) {
      setError(t('passwordReset.passwordRequired'));
      return;
    }
    if (password.length < 8) {
      setError(t('passwordReset.passwordMin'));
      return;
    }
    if (password !== passwordConfirm) {
      setError(t('passwordReset.passwordMismatch'));
      return;
    }

    setError('');
    setSuccess('');
    setIsSubmittingReset(true);
    try {
      await resetPasswordRequest({ token: token.trim(), password, passwordConfirm });
      setSuccess(t('passwordReset.resetSuccess'));
      setToken('');
      setPassword('');
      setPasswordConfirm('');
    } catch (e) {
      setError(e?.message || t('passwordReset.resetFailed'));
    } finally {
      setIsSubmittingReset(false);
    }
  };

  return (
    <View className="flex-1 bg-transparent">
      <SafeAreaView className="flex-1 px-6" edges={['top', 'left', 'right']}>
        <StatusBar style="light" />

        <View className="mt-8">
          <Text className="text-mf-text text-2xl font-solway-extrabold tracking-wide">{t('passwordReset.title')}</Text>
          <Text className="text-mf-secondary text-sm font-solway mt-2">{t('passwordReset.subtitle')}</Text>
        </View>

        <View className="mt-6 rounded-2xl border border-mf-secondary/20 bg-mf-secondary/10 p-5">
          <Text className="text-mf-secondary mb-2 text-sm font-solway-bold uppercase">{t('passwordReset.email')}</Text>
          <TextInput
            className="w-full bg-mf-secondary/10 text-mf-text p-4 rounded-xl border border-mf-secondary/20 font-solway"
            placeholder="you@example.com"
            placeholderTextColor="#5b5b6b"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            value={email}
            onChangeText={setEmail}
            editable={!isSubmittingEmail}
          />
          <Pressable
            className="mt-4 bg-mf-primary py-4 rounded-xl items-center"
            onPress={handleSendEmail}
            disabled={isSubmittingEmail}
          >
            {isSubmittingEmail ? (
              <ActivityIndicator size="small" color="#eae9fc" />
            ) : (
              <Text className="text-mf-text font-solway-bold">{t('passwordReset.sendResetLink')}</Text>
            )}
          </Pressable>
        </View>

        <View className="mt-5 rounded-2xl border border-mf-secondary/20 bg-mf-secondary/10 p-5">
          <Text className="text-mf-secondary mb-2 text-sm font-solway-bold uppercase">{t('passwordReset.token')}</Text>
          <TextInput
            className="w-full bg-mf-secondary/10 text-mf-text p-4 rounded-xl border border-mf-secondary/20 font-solway"
            placeholder={t('passwordReset.tokenPlaceholder')}
            placeholderTextColor="#5b5b6b"
            autoCapitalize="none"
            autoCorrect={false}
            value={token}
            onChangeText={setToken}
            editable={!isSubmittingReset}
          />

          <Text className="text-mf-secondary mb-2 mt-4 text-sm font-solway-bold uppercase">{t('passwordReset.newPassword')}</Text>
          <TextInput
            className="w-full bg-mf-secondary/10 text-mf-text p-4 rounded-xl border border-mf-secondary/20 font-solway"
            placeholder="********"
            placeholderTextColor="#5b5b6b"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            editable={!isSubmittingReset}
          />

          <Text className="text-mf-secondary mb-2 mt-4 text-sm font-solway-bold uppercase">{t('passwordReset.confirmPassword')}</Text>
          <TextInput
            className="w-full bg-mf-secondary/10 text-mf-text p-4 rounded-xl border border-mf-secondary/20 font-solway"
            placeholder="********"
            placeholderTextColor="#5b5b6b"
            secureTextEntry
            value={passwordConfirm}
            onChangeText={setPasswordConfirm}
            editable={!isSubmittingReset}
          />

          <Pressable
            className="mt-4 bg-mf-primary py-4 rounded-xl items-center"
            onPress={handleReset}
            disabled={isSubmittingReset}
          >
            {isSubmittingReset ? (
              <ActivityIndicator size="small" color="#eae9fc" />
            ) : (
              <Text className="text-mf-text font-solway-bold">{t('passwordReset.resetPassword')}</Text>
            )}
          </Pressable>
        </View>

        {error ? <Text className="text-red-300 text-sm font-solway mt-4">{error}</Text> : null}
        {success ? <Text className="text-green-300 text-sm font-solway mt-4">{success}</Text> : null}

        <Pressable
          className="mt-5 bg-mf-secondary/10 py-4 rounded-xl items-center border border-mf-secondary/20"
          onPress={() => navigation.goBack()}
        >
          <Text className="text-mf-secondary font-solway-bold text-lg">{t('common.cancel')}</Text>
        </Pressable>
      </SafeAreaView>
    </View>
  );
}
