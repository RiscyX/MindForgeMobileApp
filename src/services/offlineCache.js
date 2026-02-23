import { File, Directory, Paths } from 'expo-file-system';

// ─── path helpers ──────────────────────────────────────────────────────────────

const getCacheDir = () => new Directory(Paths.document, 'mf_cache');
const getSnapshotFile = () => new File(Paths.document, 'mf_cache', 'favorites_snapshot.json');
const getSyncQueueFile = () => new File(Paths.document, 'mf_cache', 'sync_queue.json');

// ─── internal helpers ──────────────────────────────────────────────────────────

const ensureDir = () => {
  const dir = getCacheDir();
  if (!dir.exists) {
    dir.create({ intermediates: true });
  }
};

const readJson = async (getFile) => {
  try {
    const file = getFile();
    if (!file.exists) return null;
    const text = await file.text();
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const writeJson = (getFile, data) => {
  ensureDir();
  const file = getFile();
  file.write(JSON.stringify(data));
};

// ─── favorites snapshot ───────────────────────────────────────────────────────

/**
 * Returns { cachedAt, tests } or null if no snapshot exists.
 */
export const loadFavoritesSnapshot = () => readJson(getSnapshotFile);

/**
 * Saves an array of fully-hydrated test objects (including questions).
 */
export const saveFavoritesSnapshot = async (tests) => {
  writeJson(getSnapshotFile, {
    cachedAt: new Date().toISOString(),
    tests: Array.isArray(tests) ? tests : [],
  });
};

export const clearFavoritesSnapshot = () => {
  try {
    const file = getSnapshotFile();
    if (file.exists) file.delete();
  } catch {
    // Ignore.
  }
};

// ─── sync queue ───────────────────────────────────────────────────────────────

/**
 * Returns the current sync queue array (may be empty).
 */
export const loadSyncQueue = async () => {
  const data = await readJson(getSyncQueueFile);
  return Array.isArray(data) ? data : [];
};

/**
 * Appends one pending attempt to the queue.
 * item shape: { id, testId, answers, completedAt, synced }
 */
export const appendToSyncQueue = async (item) => {
  const queue = await loadSyncQueue();
  queue.push({ ...item, synced: false });
  writeJson(getSyncQueueFile, queue);
};

/**
 * Marks a queue item as synced by its local id.
 */
export const markSynced = async (localId) => {
  const queue = await loadSyncQueue();
  const next = queue.map((item) =>
    item.id === localId ? { ...item, synced: true } : item
  );
  writeJson(getSyncQueueFile, next);
};

/**
 * Removes all synced items from the queue.
 */
export const removeSynced = async () => {
  const queue = await loadSyncQueue();
  const next = queue.filter((item) => !item.synced);
  writeJson(getSyncQueueFile, next);
};
