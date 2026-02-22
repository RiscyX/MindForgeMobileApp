import { useState } from 'react';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useLanguage } from '../hooks/useLanguage';
import AuthBottomNav from '../components/AuthBottomNav';

export default function RegisterScreen({ onBack, onGoLogin, onGoRegister, onRegister }) {
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRegisterPress = async () => {
    if (!email.trim() || !password || !confirmPassword) {
      setError(t('login.missingCredentials'));
      return;
    }

    if (password.length < 8) {
      setError(t('register.passwordMin'));
      return;
    }

    if (password !== confirmPassword) {
      setError(t('register.passwordMatch'));
      return;
    }

    setError('');
    setSuccess('');
    setIsSubmitting(true);

    try {
      const response = await onRegister({
        email: email.trim(),
        password,
        passwordConfirm: confirmPassword,
      });
      setSuccess(response?.message || t('register.success'));
      setPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        onGoLogin();
      }, 3000);
    } catch (registerError) {
      if (registerError?.status === 404) {
        setError(t('register.unavailable'));
      } else {
        setError(registerError?.message || t('register.unavailable'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View className="flex-1 bg-transparent">
      <SafeAreaView className="flex-1 justify-center px-6">
        <StatusBar style="light" />

        <View className="items-center mb-10">
          <View className="w-20 h-20 bg-mf-primary rounded-full items-center justify-center mb-4 shadow-lg shadow-mf-primary/50">
            <Text className="text-3xl font-solway-bold text-mf-text">M</Text>
          </View>
          <Text className="text-3xl font-solway-extrabold text-mf-text tracking-widest text-center">
            {t('register.title')}
          </Text>
          <Text className="text-mf-secondary font-solway text-sm mt-2 text-center">
            {t('register.subtitle')}
          </Text>
        </View>

        <View className="space-y-4 w-full">
          <View>
            <Text className="text-mf-secondary mb-2 ml-1 text-sm font-solway-bold uppercase">{t('register.email')}</Text>
            <TextInput
              className="w-full bg-mf-secondary/10 text-mf-text p-4 rounded-xl border border-mf-secondary/20 font-solway"
              placeholder="you@example.com"
              placeholderTextColor="#5b5b6b"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              value={email}
              onChangeText={setEmail}
              editable={!isSubmitting}
            />
          </View>

          <View>
            <Text className="text-mf-secondary mb-2 ml-1 text-sm font-solway-bold uppercase">{t('register.password')}</Text>
            <TextInput
              className="w-full bg-mf-secondary/10 text-mf-text p-4 rounded-xl border border-mf-secondary/20 font-solway"
              placeholder="********"
              placeholderTextColor="#5b5b6b"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              editable={!isSubmitting}
            />
          </View>

          <View className="mb-6">
            <Text className="text-mf-secondary mb-2 ml-1 text-sm font-solway-bold uppercase">{t('register.confirmPassword')}</Text>
            <TextInput
              className="w-full bg-mf-secondary/10 text-mf-text p-4 rounded-xl border border-mf-secondary/20 font-solway"
              placeholder="********"
              placeholderTextColor="#5b5b6b"
              secureTextEntry
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              editable={!isSubmitting}
            />
          </View>

          {error ? <Text className="text-red-300 text-sm font-solway mb-3">{error}</Text> : null}
          {success ? <Text className="text-green-300 text-sm font-solway mb-3">{success}</Text> : null}

          <TouchableOpacity
            className="w-full bg-mf-primary py-4 rounded-xl items-center shadow-lg shadow-mf-primary/30 active:bg-mf-primary/80"
            onPress={handleRegisterPress}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#eae9fc" />
            ) : (
              <Text className="text-mf-text font-solway-bold text-lg">{t('register.cta')}</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            className="w-full bg-mf-secondary/10 py-4 rounded-xl items-center border border-mf-secondary/20 active:bg-mf-secondary/20 mt-2"
            onPress={onBack}
            disabled={isSubmitting}
          >
            <Text className="text-mf-secondary font-solway-bold text-lg">{t('common.cancel')}</Text>
          </TouchableOpacity>

          <View className="mt-6 flex-row justify-center">
            <Text className="text-mf-secondary font-solway">{t('register.hasAccount')} </Text>
            <TouchableOpacity onPress={onGoLogin}>
              <Text className="text-mf-primary font-solway-bold">{t('common.login')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      <AuthBottomNav
        active="register"
        onLoginPress={onGoLogin}
        onRegisterPress={onGoRegister}
      />
    </View>
  );
}
