import { CID10Record, CID10Version } from '../types/cid10';
import { normalizeSearchText, scoreCIDMatch, toCleanCode } from './cid10Utils';
import { db } from './firebase';
import { collection, query, where, getDocs, setDoc, doc } from 'firebase/firestore';

const DB_NAME = 'lizacare_cid10_db';
const DB_VERSION = 1;
const STORE_RECORDS = 'records';
const STORE_VERSIONS = 'versions';

let memoryCache: CID10Record[] | null = null;
let activeVersionCache: CID10Version | null = null;
let initPromise: Promise<void> | null = null;

function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB não suportado no ambiente'));
      return;
    }

    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_RECORDS)) {
        const store = db.createObjectStore(STORE_RECORDS, { keyPath: 'code' });
        store.createIndex('codeClean', 'codeClean', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_VERSIONS)) {
        db.createObjectStore(STORE_VERSIONS, { keyPath: 'id' });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Salva registros em lote no IndexedDB
 */
export async function saveRecordsToIDB(records: CID10Record[], version: CID10Version): Promise<void> {
  const idb = await openIDB();
  
  return new Promise((resolve, reject) => {
    const tx = idb.transaction([STORE_RECORDS, STORE_VERSIONS], 'readwrite');
    const recStore = tx.objectStore(STORE_RECORDS);
    const verStore = tx.objectStore(STORE_VERSIONS);

    recStore.clear();
    for (const r of records) {
      recStore.put(r);
    }
    verStore.put(version);

    tx.oncomplete = () => {
      memoryCache = records;
      activeVersionCache = version;
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Carrega todos os registros do IndexedDB
 */
async function loadRecordsFromIDB(): Promise<{ records: CID10Record[]; version: CID10Version | null }> {
  try {
    const idb = await openIDB();
    return new Promise((resolve) => {
      const tx = idb.transaction([STORE_RECORDS, STORE_VERSIONS], 'readonly');
      const recStore = tx.objectStore(STORE_RECORDS);
      const verStore = tx.objectStore(STORE_VERSIONS);

      const reqRec = recStore.getAll();
      const reqVer = verStore.getAll();

      tx.oncomplete = () => {
        const records = (reqRec.result || []) as CID10Record[];
        const versions = (reqVer.result || []) as CID10Version[];
        const activeVer = versions.find(v => v.status === 'ATIVA') || versions[0] || null;
        resolve({ records, version: activeVer });
      };

      tx.onerror = () => {
        resolve({ records: [], version: null });
      };
    });
  } catch (err) {
    console.warn('Erro ao abrir IndexedDB:', err);
    return { records: [], version: null };
  }
}

/**
 * Inicializa a base CID-10 local a partir do cache ou do arquivo oficial pré-processado
 */
export async function ensureCID10Initialized(): Promise<void> {
  if (memoryCache && memoryCache.length > 0) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    // 1. Tenta carregar do IndexedDB
    const { records: idbRecords, version: idbVersion } = await loadRecordsFromIDB();
    if (idbRecords && idbRecords.length > 10000) {
      memoryCache = idbRecords;
      activeVersionCache = idbVersion;
      syncVersionWithFirestore(idbVersion);
      return;
    }

    // 2. Se não estiver no IndexedDB, carrega do arquivo estático oficial da aplicação
    try {
      const res = await fetch('/data/cid10.json');
      if (!res.ok) throw new Error('Não foi possível carregar a base oficial CID-10');
      const compactRecords: Array<{ code: string; description: string }> = await res.json();
      const records: CID10Record[] = compactRecords.map((record) => ({
        id: record.code,
        code: record.code,
        codeClean: toCleanCode(record.code),
        description: record.description,
        normalizedDescription: normalizeSearchText(record.description),
        active: true,
        source: 'CID-10 Brasil / DATASUS',
        version: '2008'
      }));

      const defaultVersion: CID10Version = {
        id: 'datasus-2008-v1',
        version: '2008 (DATASUS)',
        source: 'CID-10 Brasil / DATASUS',
        status: 'ATIVA',
        recordCount: records.length,
        lastImportDate: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        activatedAt: new Date().toISOString(),
        validationReport: {
          totalRead: records.length,
          validCount: records.length,
          encodingOk: true,
          hasPortugueseAccents: true,
          emptyCodes: 0,
          emptyDescriptions: 0,
          duplicateCount: 0
        }
      };

      await saveRecordsToIDB(records, defaultVersion);
      memoryCache = records;
      activeVersionCache = defaultVersion;
      syncVersionWithFirestore(defaultVersion);
    } catch (e) {
      console.error('Falha ao inicializar CID-10:', e);
      memoryCache = [];
    }
  })();

  return initPromise;
}

/**
 * Sincroniza a versão ativa no Firestore se ainda não existir
 */
async function syncVersionWithFirestore(version: CID10Version | null) {
  if (!version) return;
  try {
    const q = query(collection(db, 'cid10_versions'), where('status', '==', 'ATIVA'));
    const snap = await getDocs(q);
    if (snap.empty) {
      await setDoc(doc(db, 'cid10_versions', version.id), version);
    }
  } catch (err) {
    console.warn('Não foi possível sincronizar versão com Firestore (modo offline/regras):', err);
  }
}

/**
 * Retorna os metadados da versão CID-10 ativa
 */
export async function getActiveCID10Version(): Promise<CID10Version | null> {
  await ensureCID10Initialized();
  return activeVersionCache;
}

/**
 * Pesquisa diagnósticos na base oficial CID-10:
 * - Código completo (ex: M17.1)
 * - Código sem ponto (ex: M171)
 * - Código parcial (ex: M17)
 * - Descrição (ex: gonartrose)
 * - Parte da descrição (ex: artrose)
 * - Busca rápida com ranking ordenado e limite
 */
export async function searchCID10(queryText: string, limit = 20): Promise<CID10Record[]> {
  if (!queryText || queryText.trim().length < 1) return [];

  await ensureCID10Initialized();
  if (!memoryCache || memoryCache.length === 0) return [];

  const rawQ = queryText.trim();
  const scored: { record: CID10Record; score: number }[] = [];

  for (let i = 0; i < memoryCache.length; i++) {
    const record = memoryCache[i];
    const score = scoreCIDMatch(record, rawQ);
    if (score > 0) {
      scored.push({ record, score });
    }
  }

  // Ordenação por score decrescente, e em caso de empate pelo código alfabético
  scored.sort((a, b) => b.score - a.score || a.record.code.localeCompare(b.record.code));

  return scored.slice(0, limit).map(s => s.record);
}

/**
 * Busca registro específico por código canônico ou limpo
 */
export async function getCID10ByCode(code: string): Promise<CID10Record | null> {
  await ensureCID10Initialized();
  if (!memoryCache || !code) return null;
  const clean = code.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  return memoryCache.find(r => r.codeClean === clean || r.code.toUpperCase() === code.toUpperCase().trim()) || null;
}
