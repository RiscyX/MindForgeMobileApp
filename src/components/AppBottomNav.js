import { Text, TouchableOpacity, View } from 'react-native';
import { useLanguage } from '../hooks/useLanguage';

export default function AppBottomNav({ active = 'tests', onTestsPress, onStatsPress, onProfilePress }) {
  const { t } = useLanguage();

  const itemClass = (tab) => `flex-1 rounded-xl py-3 items-center ${active === tab ? 'bg-mf-primary' : 'bg-transparent'}`;
  const textClass = (tab) => `font-solway-bold text-sm ${active === tab ? 'text-mf-text' : 'text-mf-secondary'}`;

  return (
    <View className="w-full px-6 pb-6">
      <View className="w-full rounded-2xl border border-mf-secondary/30 bg-mf-bg/85 p-2 flex-row shadow-2xl">
        <TouchableOpacity className={itemClass('tests')} onPress={onTestsPress}>
          <Text className={textClass('tests')}>{t('nav.tests')}</Text>
        </TouchableOpacity>
        <TouchableOpacity className={itemClass('stats')} onPress={onStatsPress}>
          <Text className={textClass('stats')}>{t('nav.stats')}</Text>
        </TouchableOpacity>
        <TouchableOpacity className={itemClass('profile')} onPress={onProfilePress}>
          <Text className={textClass('profile')}>{t('nav.profile')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
