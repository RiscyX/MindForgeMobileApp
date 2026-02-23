import { Text, View } from 'react-native';
import { useNetworkStatus } from '../context/NetworkContext';
import { useLanguage } from '../hooks/useLanguage';

export default function OfflineBanner() {
  const isOnline = useNetworkStatus();
  const { t } = useLanguage();

  if (isOnline) {
    return null;
  }

  return (
    <View
      style={{
        backgroundColor: 'rgba(217, 119, 6, 0.92)',
        paddingVertical: 8,
        paddingHorizontal: 16,
        alignItems: 'center',
      }}
    >
      <Text
        style={{
          color: '#fff',
          fontFamily: 'Solway_700Bold',
          fontSize: 13,
          textAlign: 'center',
          letterSpacing: 0.3,
        }}
      >
        {t('offline.banner')}
      </Text>
    </View>
  );
}
