import { Algorithm, type SessionBindingDto } from './fetch-client.js';

const activeKeyId = 'active';
const databaseName = 'tabliodb-session-binding';
const databaseVersion = 1;
const keyStoreName = 'keys';
const pendingKeyId = 'pending';
const sessionBindingAlgorithm = Algorithm.EcdsaP256Sha256;

type StoredSessionBindingKey = {
  algorithm: typeof sessionBindingAlgorithm;
  fingerprint: string;
  id: string;
  privateKey: CryptoKey;
  publicKey: SessionBindingDto['publicKey'];
};

export async function prepareSessionBinding(): Promise<SessionBindingDto | undefined> {
  if (!isSessionBindingSupported()) {
    return undefined;
  }

  try {
    const keyPair = await globalThis.crypto.subtle.generateKey(
      {
        name: 'ECDSA',
        namedCurve: 'P-256',
      },
      false,
      ['sign', 'verify'],
    );
    const exportedPublicKey = await globalThis.crypto.subtle.exportKey('jwk', keyPair.publicKey);
    const publicKey = normalizePublicKey(exportedPublicKey);
    const fingerprint = await createSessionBindingFingerprint(sessionBindingAlgorithm, publicKey);

    await putStoredKey({
      algorithm: sessionBindingAlgorithm,
      fingerprint,
      id: pendingKeyId,
      // The private key is persisted as a non-extractable CryptoKey, so JavaScript can sign with it but cannot export it.
      privateKey: keyPair.privateKey,
      publicKey,
    });

    return {
      algorithm: sessionBindingAlgorithm,
      publicKey,
    };
  } catch {
    return undefined;
  }
}

export async function activatePreparedSessionBinding(): Promise<void> {
  if (!isSessionBindingSupported()) {
    return;
  }

  const pendingKey = await getStoredKey(pendingKeyId);

  if (!pendingKey) {
    return;
  }

  // Activation happens only after the server accepts login/setup/invite, preventing failed attempts from replacing the live key.
  await putStoredKey({
    ...pendingKey,
    id: activeKeyId,
  });
  await deleteStoredKey(pendingKeyId);
}

export async function clearSessionBinding(): Promise<void> {
  if (!isSessionBindingSupported()) {
    return;
  }

  await Promise.all([deleteStoredKey(activeKeyId), deleteStoredKey(pendingKeyId)]);
}

export async function createSessionProofHeaders(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Record<string, string>> {
  if (!isSessionBindingSupported()) {
    return {};
  }

  const storedKey = await getStoredKey(activeKeyId);

  if (!storedKey) {
    return {};
  }

  const method = (init.method ?? (isRequest(input) ? input.method : 'GET')).toUpperCase();
  const nonce = createNonce();
  const path = getRequestPath(input);
  const timestamp = Date.now().toString();
  const payload = createSessionProofPayload({
    method,
    nonce,
    path,
    timestamp,
  });
  const signature = await globalThis.crypto.subtle.sign(
    {
      name: 'ECDSA',
      hash: 'SHA-256',
    },
    storedKey.privateKey,
    new TextEncoder().encode(payload),
  );

  return {
    'x-tabliodb-session-proof-alg': storedKey.algorithm,
    'x-tabliodb-session-proof-key': storedKey.fingerprint,
    'x-tabliodb-session-proof-nonce': nonce,
    'x-tabliodb-session-proof-signature': encodeBase64Url(signature),
    'x-tabliodb-session-proof-timestamp': timestamp,
  };
}

function isSessionBindingSupported(): boolean {
  return (
    typeof globalThis.crypto !== 'undefined' &&
    typeof globalThis.crypto.subtle !== 'undefined' &&
    typeof globalThis.indexedDB !== 'undefined'
  );
}

async function createSessionBindingFingerprint(
  algorithm: typeof sessionBindingAlgorithm,
  publicKey: SessionBindingDto['publicKey'],
): Promise<string> {
  const payload = `${algorithm}\n${stableJson(publicKey)}`;
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload));

  return encodeBase64Url(digest);
}

function createSessionProofPayload(input: { method: string; nonce: string; path: string; timestamp: string }): string {
  return [input.method.toUpperCase(), input.path, input.timestamp, input.nonce].join('\n');
}

function createNonce(): string {
  if (typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  const bytes = new Uint8Array(24);
  globalThis.crypto.getRandomValues(bytes);

  return encodeBase64Url(bytes);
}

function normalizePublicKey(publicKey: JsonWebKey): SessionBindingDto['publicKey'] {
  if (!publicKey.crv || !publicKey.kty || !publicKey.x || !publicKey.y) {
    throw new Error('The browser did not export a complete session binding public key.');
  }

  const normalized: SessionBindingDto['publicKey'] = {
    crv: publicKey.crv as SessionBindingDto['publicKey']['crv'],
    kty: publicKey.kty as SessionBindingDto['publicKey']['kty'],
    x: publicKey.x,
    y: publicKey.y,
  };

  if (typeof publicKey.ext === 'boolean') {
    normalized.ext = publicKey.ext;
  }

  if (Array.isArray(publicKey.key_ops)) {
    // Only generated DTO fields are kept so the client fingerprint matches the server-side canonical JWK.
    normalized.key_ops = publicKey.key_ops.filter((operation): operation is string => typeof operation === 'string');
  }

  return normalized;
}

function getRequestPath(input: RequestInfo | URL): string {
  const requestUrl = isRequest(input) ? input.url : input instanceof URL ? input.href : input.toString();
  const baseUrl = typeof window === 'undefined' ? 'http://tabliodb.local' : window.location.origin;
  const parsedUrl = new URL(requestUrl, baseUrl);

  // The server signs Express originalUrl, so path + query must be preserved exactly from the browser request.
  return `${parsedUrl.pathname}${parsedUrl.search}`;
}

function isRequest(input: RequestInfo | URL): input is Request {
  return typeof Request !== 'undefined' && input instanceof Request;
}

function encodeBase64Url(input: ArrayBuffer | Uint8Array): string {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  let binary = '';

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableJson(item)).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const entries = Object.keys(record)
      .filter((key) => record[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`);

    return `{${entries.join(',')}}`;
  }

  return JSON.stringify(value);
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = globalThis.indexedDB.open(databaseName, databaseVersion);

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(keyStoreName)) {
        database.createObjectStore(keyStoreName, {
          keyPath: 'id',
        });
      }
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

async function getStoredKey(id: string): Promise<StoredSessionBindingKey | undefined> {
  const database = await openDatabase();

  try {
    return await runObjectStoreRequest<StoredSessionBindingKey | undefined>(
      database,
      'readonly',
      (store) => store.get(id) as IDBRequest<StoredSessionBindingKey | undefined>,
    );
  } finally {
    database.close();
  }
}

async function putStoredKey(key: StoredSessionBindingKey): Promise<void> {
  const database = await openDatabase();

  try {
    await runObjectStoreRequest<IDBValidKey>(database, 'readwrite', (store) => store.put(key));
  } finally {
    database.close();
  }
}

async function deleteStoredKey(id: string): Promise<void> {
  const database = await openDatabase();

  try {
    await runObjectStoreRequest<undefined>(database, 'readwrite', (store) => store.delete(id) as IDBRequest<undefined>);
  } finally {
    database.close();
  }
}

function runObjectStoreRequest<T>(
  database: IDBDatabase,
  mode: IDBTransactionMode,
  createRequest: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(keyStoreName, mode);
    const request = createRequest(transaction.objectStore(keyStoreName));

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    transaction.onerror = () => reject(transaction.error);
  });
}
