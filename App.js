import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import './globals.css';
import {
  useFonts,
  Solway_300Light,
  Solway_400Regular,
  Solway_500Medium,
  Solway_700Bold,
  Solway_800ExtraBold,
} from '@expo-google-fonts/solway';
import { AuthProvider } from './src/context/AuthContext';
import { LanguageProvider } from './src/context/LanguageContext';
import { NetworkProvider, useNetworkStatus } from './src/context/NetworkContext';
import { OfflineCacheProvider } from './src/context/OfflineCacheContext';
import { FavoritesProvider } from './src/context/FavoritesContext';
import AppBackground from './src/components/AppBackground';
import AppNavigator from './src/navigation/AppNavigator';
import OfflineBanner from './src/components/OfflineBanner';
import { useAuth } from './src/hooks/useAuth';
import { syncPendingResults } from './src/services/offlineSyncQueue';

/**
 * Watches for the app coming back online and syncs any pending offline
 * attempts automatically.
 */
function SyncOnReconnect() {
  const isOnline = useNetworkStatus();
  const { authFetch, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isOnline || !isAuthenticated) {
      return;
    }
    // Fire-and-forget — errors are caught inside syncPendingResults.
    syncPendingResults({ authFetch }).catch(() => {});
  }, [isOnline, isAuthenticated, authFetch]);

  return null;
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Solway_300Light,
    Solway_400Regular,
    Solway_500Medium,
    Solway_700Bold,
    Solway_800ExtraBold,
  });

  if (!fontsLoaded) {
    return (
      <AppBackground>
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#575ddb" />
        </View>
      </AppBackground>
    );
  }

  return (
    <AppBackground>
      <LanguageProvider>
        <AuthProvider>
          <NetworkProvider>
            <OfflineCacheProvider>
              <FavoritesProvider>
                <SyncOnReconnect />
                <OfflineBanner />
                <AppNavigator />
              </FavoritesProvider>
            </OfflineCacheProvider>
          </NetworkProvider>
        </AuthProvider>
      </LanguageProvider>
    </AppBackground>
  );
}
