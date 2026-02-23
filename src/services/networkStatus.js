/**
 * Module-level network status tracker.
 *
 * This is intentionally a plain module (not a React context) so that
 * httpClient.js can call setOnlineStatus() without depending on React.
 *
 * UI components should use NetworkContext / useNetworkStatus instead.
 */

let _isOnline = true;
const _listeners = new Set();

export const getOnlineStatus = () => _isOnline;

export const setOnlineStatus = (online) => {
  const next = Boolean(online);
  if (next === _isOnline) {
    return;
  }
  _isOnline = next;
  _listeners.forEach((fn) => {
    try {
      fn(next);
    } catch {
      // Ignore listener errors.
    }
  });
};

/**
 * Subscribe to online-status changes.
 * Returns an unsubscribe function.
 */
export const subscribeOnlineStatus = (fn) => {
  _listeners.add(fn);
  return () => {
    _listeners.delete(fn);
  };
};
