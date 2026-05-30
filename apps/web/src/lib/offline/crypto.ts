/**
 * AES-GCM encryption utilities for OPFS data-at-rest protection (D-8).
 *
 * Uses SubtleCrypto with non-exportable CryptoKey stored in IndexedDB.
 * If the device is lost/reset and the key is gone, encrypted local data
 * is unreadable — but the canonical copy lives on the server after sync.
 *
 * @module offline/crypto
 */

const DB_NAME = 'rakkyo-crypto-keys';
const STORE_NAME = 'keys';
const KEY_ALGORITHM: AesKeyGenParams = { name: 'AES-GCM', length: 256 };
const IV_BYTE_LENGTH = 12;

/**
 * Open (or create) the IndexedDB database used for CryptoKey storage.
 */
function openKeyDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Generate a fresh AES-GCM-256 CryptoKey that cannot be exported.
 */
async function generateKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(KEY_ALGORITHM, false, [
    'encrypt',
    'decrypt',
  ]);
}

/**
 * Persist a CryptoKey in IndexedDB under a user-scoped key name.
 * @param keyName - Logical name (e.g. `enc_<userId>`)
 * @param key - The CryptoKey to store
 */
async function storeKey(keyName: string, key: CryptoKey): Promise<void> {
  const db = await openKeyDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(key, keyName);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Retrieve a CryptoKey from IndexedDB.
 * @param keyName - Logical key name
 * @returns The CryptoKey, or null if not found
 */
async function loadKey(keyName: string): Promise<CryptoKey | null> {
  const db = await openKeyDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(keyName);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Delete a CryptoKey from IndexedDB (used during RTBF / logout).
 * @param keyName - Logical key name
 */
export async function deleteKey(keyName: string): Promise<void> {
  const db = await openKeyDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(keyName);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Get or create the encryption key for a given user.
 * On first call for a userId, generates a new key and persists it.
 * @param userId - The user's ID
 * @returns The user's AES-GCM CryptoKey
 */
export async function getOrCreateUserKey(
  userId: string
): Promise<CryptoKey> {
  const keyName = `enc_${userId}`;
  const existing = await loadKey(keyName);
  if (existing) {
    return existing;
  }
  const newKey = await generateKey();
  await storeKey(keyName, newKey);
  return newKey;
}

/**
 * Retrieve the user's encryption key without creating it if it is missing (P2-7).
 * @param userId - The user ID
 * @returns The CryptoKey, or null if missing
 */
export async function getUserKey(userId: string): Promise<CryptoKey | null> {
  const keyName = `enc_${userId}`;
  return loadKey(keyName);
}

/**
 * Encrypt plaintext using the user's AES-GCM key.
 * Returns a base64-encoded string of `iv + ciphertext`.
 * @param plaintext - The string to encrypt
 * @param key - The user's CryptoKey
 * @returns Base64-encoded encrypted payload
 */
export async function encrypt(
  plaintext: string,
  key: CryptoKey
): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTE_LENGTH));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded
  );
  // Concatenate iv + ciphertext into a single buffer
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypt a base64-encoded AES-GCM payload.
 * @param payload - Base64-encoded `iv + ciphertext`
 * @param key - The user's CryptoKey
 * @returns The decrypted plaintext string
 */
export async function decrypt(
  payload: string,
  key: CryptoKey
): Promise<string> {
  const combined = Uint8Array.from(atob(payload), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, IV_BYTE_LENGTH);
  const ciphertext = combined.slice(IV_BYTE_LENGTH);
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );
  return new TextDecoder().decode(decrypted);
}
