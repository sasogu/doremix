import { browser } from '$app/environment';
import { writable } from 'svelte/store';

export type PhraseEvent = {
  beat: number;
  type: 'noteon' | 'noteoff';
  note: number;
  velocity?: number;
};

export type Phrase = {
  id: string;
  name: string;
  bpm?: number;
  events: PhraseEvent[];
};

export type PhrasePack = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  phrases: Phrase[];
};

type StorageBackend = {
  list(): Promise<PhrasePack[]>;
  save(pack: PhrasePack): Promise<void>;
  delete(packId: string): Promise<void>;
  get(packId: string): Promise<PhrasePack | undefined>;
};

const packsStore = writable<PhrasePack[]>([]);
export const phrasePacks = packsStore;

let initPromise: Promise<void> | null = null;
let backendPromise: Promise<StorageBackend> | null = null;

export function initPhrasePackStore() {
  if (!browser) return Promise.resolve();
  if (!initPromise) {
    initPromise = (async () => {
      const backend = await getBackend();
      const packs = await backend.list();
      packsStore.set(sortPacks(packs));
    })();
  }
  return initPromise;
}

export async function saveNewPack(params: {
  name: string;
  phrases: Phrase[];
}) {
  await initPhrasePackStore();
  const backend = await getBackend();
  const now = Date.now();
  const pack: PhrasePack = {
    id: crypto.randomUUID(),
    name: params.name.trim() || 'Pack sin nombre',
    createdAt: now,
    updatedAt: now,
    phrases: params.phrases
  };
  await backend.save(pack);
  await refreshFromBackend();
  return pack;
}

export async function addPhraseToPack(
  packId: string,
  phrase: Phrase,
  options: { updateName?: string } = {}
) {
  await initPhrasePackStore();
  const backend = await getBackend();
  const pack = await backend.get(packId);
  if (!pack) throw new Error('Pack no encontrado');
  const updated: PhrasePack = {
    ...pack,
    name: options.updateName?.trim() || pack.name,
    updatedAt: Date.now(),
    phrases: [...pack.phrases, phrase]
  };
  await backend.save(updated);
  await refreshFromBackend();
  return updated;
}

export async function overwritePack(pack: PhrasePack) {
  await initPhrasePackStore();
  const backend = await getBackend();
  await backend.save({ ...pack, updatedAt: Date.now() });
  await refreshFromBackend();
}

export async function deletePack(packId: string) {
  await initPhrasePackStore();
  const backend = await getBackend();
  await backend.delete(packId);
  await refreshFromBackend();
}

export async function getPhrase(
  packId: string,
  phraseId: string
): Promise<Phrase | undefined> {
  await initPhrasePackStore();
  const backend = await getBackend();
  const pack = await backend.get(packId);
  if (!pack) return undefined;
  return pack.phrases.find((p) => p.id === phraseId);
}

async function refreshFromBackend() {
  const backend = await getBackend();
  const packs = await backend.list();
  packsStore.set(sortPacks(packs));
}

function sortPacks(packs: PhrasePack[]) {
  return [...packs].sort((a, b) => b.updatedAt - a.updatedAt);
}

async function getBackend(): Promise<StorageBackend> {
  if (!browser) throw new Error('Storage backend solo disponible en el cliente');
  if (!backendPromise) {
    backendPromise = (async () => {
      const opfs = await maybeCreateOpfsBackend();
      if (opfs) return opfs;
      return createIndexedDBBackend();
    })();
  }
  return backendPromise;
}

async function maybeCreateOpfsBackend(): Promise<StorageBackend | null> {
  const storageAny: any = browser ? (navigator.storage as any) : null;
  if (!storageAny?.getDirectory) return null;
  try {
    const root: FileSystemDirectoryHandle = await storageAny.getDirectory();
    const packsDir = await root.getDirectoryHandle('phrase-packs', {
      create: true
    });
    return {
      list: async () => {
        const packs: PhrasePack[] = [];
        for await (const entry of packsDir.entries()) {
          const [name, handle] = entry;
          if (!name.endsWith('.json')) continue;
          const fileHandle = handle as FileSystemFileHandle;
          const file = await fileHandle.getFile();
          const text = await file.text();
          packs.push(JSON.parse(text));
        }
        return packs;
      },
      save: async (pack) => {
        const fileHandle = await packsDir.getFileHandle(`${pack.id}.json`, {
          create: true
        });
        const writable = await fileHandle.createWritable();
        await writable.write(JSON.stringify(pack));
        await writable.close();
      },
      delete: async (packId) => {
        try {
          await packsDir.removeEntry(`${packId}.json`);
        } catch (err: any) {
          if (err?.name !== 'NotFoundError') throw err;
        }
      },
      get: async (packId) => {
        try {
          const fileHandle = await packsDir.getFileHandle(`${packId}.json`);
          const file = await fileHandle.getFile();
          return JSON.parse(await file.text());
        } catch (err: any) {
          if (err?.name === 'NotFoundError') return undefined;
          throw err;
        }
      }
    };
  } catch (err) {
    console.info('OPFS no disponible, usando IndexedDB (esperado en entornos con sandbox)', err);
    return null;
  }
}

function createIndexedDBBackend(): Promise<StorageBackend> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('doremix', 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('phrasePacks')) {
        db.createObjectStore('phrasePacks', { keyPath: 'id' });
      }
    };
    request.onerror = () => {
      reject(request.error ?? new Error('Error al abrir IndexedDB'));
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
      };
      const backend: StorageBackend = {
        list: () =>
          new Promise((res, rej) => {
            const tx = db.transaction('phrasePacks', 'readonly');
            const store = tx.objectStore('phrasePacks');
            const getAll = store.getAll();
            getAll.onsuccess = () => res(getAll.result as PhrasePack[]);
            getAll.onerror = () => rej(getAll.error);
          }),
        save: (pack) =>
          new Promise((res, rej) => {
            const tx = db.transaction('phrasePacks', 'readwrite');
            tx.oncomplete = () => res();
            tx.onerror = () => rej(tx.error);
            tx.objectStore('phrasePacks').put(pack);
          }),
        delete: (packId) =>
          new Promise((res, rej) => {
            const tx = db.transaction('phrasePacks', 'readwrite');
            tx.oncomplete = () => res();
            tx.onerror = () => rej(tx.error);
            tx.objectStore('phrasePacks').delete(packId);
          }),
        get: (packId) =>
          new Promise((res, rej) => {
            const tx = db.transaction('phrasePacks', 'readonly');
            const req = tx.objectStore('phrasePacks').get(packId);
            req.onsuccess = () => res(req.result as PhrasePack | undefined);
            req.onerror = () => rej(req.error);
          })
      };
      resolve(backend);
    };
  });
}

export function duplicatePhrase(phrase: Phrase, overrides: Partial<Phrase> = {}) {
  return {
    ...phrase,
    ...overrides,
    id: overrides.id ?? crypto.randomUUID(),
    events: overrides.events ?? phrase.events.map((ev) => ({ ...ev }))
  };
}
