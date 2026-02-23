import { useState } from 'react';
import { View, Text, Pressable, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { useLanguage } from '../hooks/useLanguage';
import { useAuth } from '../hooks/useAuth';
import { GradientButton, OutlineButton } from '../components/MFButton';

export default function LoginScreen() {
  const navigation = useNavigation();
  const { t } = useLanguage();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLoginPress = async () => {
    const normalizedEmail = email.trim();
    if (!normalizedEmail || !password) {
      setError(t('login.missingCredentials'));
      return;
    }

    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);
    if (!emailValid) {
      setError(t('login.invalidEmail'));
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      await login({ email: normalizedEmail, password });
      navigation.goBack();
    } catch (loginError) {
      setError(loginError?.message || t('login.loginFailed'));
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
            {t('login.title')}
          </Text>
          <Text className="text-mf-secondary font-solway text-sm mt-2">
            {t('login.subtitle')}
          </Text>
        </View>

        <View className="space-y-4 w-full">
          <View>
            <Text className="text-mf-secondary mb-2 ml-1 text-sm font-solway-bold uppercase">{t('login.email')}</Text>
            <TextInput 
              className="w-full bg-mf-secondary/10 text-mf-text p-4 rounded-xl border border-mf-secondary/20 focus:border-mf-primary font-solway"
              placeholder="ricsi@mindforge.app" 
              placeholderTextColor="#5b5b6b"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              value={email}
              onChangeText={setEmail}
              editable={!isSubmitting}
            />
          </View>

          <View className="mb-6">
            <Text className="text-mf-secondary mb-2 ml-1 text-sm font-solway-bold uppercase">{t('login.password')}</Text>
            <TextInput 
              className="w-full bg-mf-secondary/10 text-mf-text p-4 rounded-xl border border-mf-secondary/20 focus:border-mf-primary font-solway"
              placeholder="••••••••" 
              placeholderTextColor="#5b5b6b"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              editable={!isSubmitting}
            />
            <Pressable className="self-end mt-2" onPress={() => navigation.navigate('ForgotPassword')}>
              <Text className="text-mf-primary text-xs font-solway-bold">{t('login.forgotPassword')}</Text>
            </Pressable>
          </View>

          {error ? <Text className="text-red-300 text-sm font-solway mb-3">{error}</Text> : null}

          <GradientButton
            onPress={handleLoginPress}
            loading={isSubmitting}
            disabled={isSubmitting}
            label={t('login.logIn')}
            style={{ marginBottom: 8 }}
          />

          <OutlineButton
            onPress={() => navigation.goBack()}
            disabled={isSubmitting}
            label={t('common.cancel')}
          />
        </View>

        <View className="mt-10 flex-row justify-center">
          <Text className="text-mf-secondary font-solway">{t('login.noAccount')} </Text>
          <Pressable onPress={() => navigation.navigate('Register')}>
            <Text className="text-mf-primary font-solway-bold">{t('login.signUp')}</Text>
          </Pressable>
        </View>

      </SafeAreaView>
    </View>
  );
}
