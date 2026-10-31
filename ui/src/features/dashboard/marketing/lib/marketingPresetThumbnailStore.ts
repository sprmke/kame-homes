const DB_NAME = 'kame-marketing-thumbnails';
const DB_VERSION = 1;
const STORE_NAME = 'presets';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'));
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });

  return dbPromise;
}

export async function getPersistedPresetThumbnail(key: string): Promise<string | undefined> {
  if (typeof indexedDB === 'undefined') return undefined;
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(key);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const value = request.result;
        resolve(typeof value === 'string' ? value : undefined);
      };
    });
  } catch {
    return undefined;
  }
}

export async function getManyPersistedPresetThumbnails(
  keys: string[]
): Promise<Record<string, string>> {
  const entries = await Promise.all(
    keys.map(async (key) => {
      const value = await getPersistedPresetThumbnail(key);
      return value ? ([key, value] as const) : null;
    })
  );
  return Object.fromEntries(entries.filter((entry): entry is [string, string] => entry !== null));
}

export async function setPersistedPresetThumbnail(key: string, dataUrl: string): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.put(dataUrl, key);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch {
    // Ignore persistence failures — in-memory cache still works for the session.
  }
}
