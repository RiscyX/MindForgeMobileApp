import { loadSyncQueue, markSynced, removeSynced } from './offlineCache';

/**
 * Syncs all pending (unsynced) offline attempts to the backend.
 *
 * Each item in the queue is posted to POST /me/attempts/offline-sync.
 * Successfully synced items are marked and pruned from the queue.
 *
 * @param {{ authFetch: Function }} options
 * @returns {{ synced: number, failed: number }}
 */
export const syncPendingResults = async ({ authFetch }) => {
  const queue = await loadSyncQueue();
  const pending = queue.filter((item) => !item.synced);

  if (pending.length === 0) {
    return { synced: 0, failed: 0 };
  }

  let synced = 0;
  let failed = 0;

  for (const item of pending) {
    try {
      await authFetch('/me/attempts/offline-sync', {
        method: 'POST',
        body: {
          test_id: item.testId,
          answers: item.answers,
          completed_at: item.completedAt,
          local_id: item.id,
        },
      });
      await markSynced(item.id);
      synced++;
    } catch (e) {
      if (__DEV__) {
        console.warn('[offlineSyncQueue] Failed to sync item:', item.id, e?.message);
      }
      failed++;
    }
  }

  // Clean up successfully synced items.
  if (synced > 0) {
    await removeSynced();
  }

  if (__DEV__) {
    console.log(`[offlineSyncQueue] Sync complete: ${synced} synced, ${failed} failed`);
  }

  return { synced, failed };
};
