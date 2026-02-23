import { createContext, useContext, useEffect, useState } from 'react';
import { getOnlineStatus, subscribeOnlineStatus } from '../services/networkStatus';

const NetworkContext = createContext(true);

export function NetworkProvider({ children }) {
  const [isOnline, setIsOnline] = useState(getOnlineStatus());

  useEffect(() => {
    // Sync in case status changed between render and effect.
    setIsOnline(getOnlineStatus());
    const unsub = subscribeOnlineStatus(setIsOnline);
    return unsub;
  }, []);

  return (
    <NetworkContext.Provider value={isOnline}>
      {children}
    </NetworkContext.Provider>
  );
}

export function useNetworkStatus() {
  return useContext(NetworkContext);
}
