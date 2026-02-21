import { Text, TouchableOpacity, View } from 'react-native';
import { useLanguage } from '../hooks/useLanguage';

export default function AuthBottomNav({ active = 'login', onLoginPress, onRegisterPress }) {
  const { t } = useLanguage();

  return (
    <View className="w-full px-6 pb-6">
      <View className="w-full rounded-2xl border border-mf-secondary/30 bg-mf-bg/80 p-2 flex-row shadow-2xl">
        <TouchableOpacity
          className={`flex-1 rounded-xl py-3 items-center ${active === 'login' ? 'bg-mf-primary' : 'bg-transparent'}`}
          onPress={onLoginPress}
        >
          <Text className={`font-solway-bold text-sm ${active === 'login' ? 'text-mf-text' : 'text-mf-secondary'}`}>
            {t('common.login')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          className={`flex-1 rounded-xl py-3 items-center ${active === 'register' ? 'bg-mf-primary' : 'bg-transparent'}`}
          onPress={onRegisterPress}
        >
          <Text className={`font-solway-bold text-sm ${active === 'register' ? 'text-mf-text' : 'text-mf-secondary'}`}>
            {t('common.register')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
