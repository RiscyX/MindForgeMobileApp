import * as FileSystem from 'expo-file-system';

const CACHE_DIR = `${FileSystem.documentDirectory}mf_cache/`;
const SNAPSHOT_PATH = `${CACHE_DIR}favorites_snapshot.json`;
const SYNC_QUEUE_PATH = `${CACHE_DIR}sync_queue.json`;

// ─── helpers ──────────────────────────────────────────────────────────────────

const ensureDir = async () => {
  const info = await FileSystem.getInfoAsync(CACHE_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
  }
};

const readJson = async (path) => {
  try {
    const info = await FileSystem.getInfoAsync(path);
    if (!info.exists) {
      return null;
    }
    const text = await FileSystem.readAsStringAsync(path, { encoding: FileSystem.EncodingType.UTF8 });
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const writeJson = async (path, data) => {
  await ensureDir();
  await FileSystem.writeAsStringAsync(path, JSON.stringify(data), {
    encoding: FileSystem.EncodingType.UTF8,
  });
};

// ─── favorites snapshot ───────────────────────────────────────────────────────

/**
 * Returns { cachedAt, tests } or null if no snapshot exists.
 */
export const loadFavoritesSnapshot = () => readJson(SNAPSHOT_PATH);

/**
 * Saves an array of fully-hydrated test objects (including questions).
 */
export const saveFavoritesSnapshot = async (tests) => {
  await writeJson(SNAPSHOT_PATH, {
    cachedAt: new Date().toISOString(),
    tests: Array.isArray(tests) ? tests : [],
  });
};

export const clearFavoritesSnapshot = async () => {
  try {
    const info = await FileSystem.getInfoAsync(SNAPSHOT_PATH);
    if (info.exists) {
      await FileSystem.deleteAsync(SNAPSHOT_PATH, { idempotent: true });
    }
  } catch {
    // Ignore.
  }
};

// ─── sync queue ───────────────────────────────────────────────────────────────

/**
 * Returns the current sync queue array (may be empty).
 */
export const loadSyncQueue = async () => {
  const data = await readJson(SYNC_QUEUE_PATH);
  return Array.isArray(data) ? data : [];
};

/**
 * Appends one pending attempt to the queue.
 * item shape: { id, testId, answers, completedAt, synced }
 */
export const appendToSyncQueue = async (item) => {
  const queue = await loadSyncQueue();
  queue.push({ ...item, synced: false });
  await writeJson(SYNC_QUEUE_PATH, queue);
};

/**
 * Marks a queue item as synced by its local id.
 */
export const markSynced = async (localId) => {
  const queue = await loadSyncQueue();
  const next = queue.map((item) =>
    item.id === localId ? { ...item, synced: true } : item
  );
  await writeJson(SYNC_QUEUE_PATH, next);
};

/**
 * Removes all synced items from the queue.
 */
export const removeSynced = async () => {
  const queue = await loadSyncQueue();
  const next = queue.filter((item) => !item.synced);
  await writeJson(SYNC_QUEUE_PATH, next);
};
