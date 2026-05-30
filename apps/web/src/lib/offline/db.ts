/**
 * SQLite WASM + OPFS local database engine for offline-first learning (P16D-001).
 *
 * Each user gets an isolated DB file: `rakkyo_user_${userId}.db`
 * stored in the Origin Private File System (OPFS) for persistence
 * across browser cache clears.
 *
 * @module offline/db
 */

// NOTE: @sqlite.org/sqlite-wasm is loaded dynamically to support
// environments where WASM is not available (SSR, test runners).
// The OPFS VFS requires SharedArrayBuffer → Cross-Origin-Isolation headers.

/** Current local DB schema version — bump when table structure changes (D-6). */
const LOCAL_SCHEMA_VERSION = 2;

/** Marker for the meta table key that stores schema version. */
const META_KEY_SCHEMA_VERSION = 'schemaVersion';
const META_KEY_LAST_SYNC = 'lastSyncAt';

/** SQL statements for initial schema migration. */
const MIGRATION_V1 = `
  CREATE TABLE IF NOT EXISTS offline_attempts (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    clientEventId   TEXT    NOT NULL UNIQUE,
    userId          TEXT    NOT NULL,
    questionId      TEXT    NOT NULL,
    isCorrect       INTEGER NOT NULL,
    hintsUsed       INTEGER NOT NULL DEFAULT 0,
    answerSubmitted TEXT    NOT NULL,
    durationSeconds INTEGER,
    errorType       TEXT,
    createdAt       TEXT    NOT NULL,
    syncStatus      TEXT    NOT NULL DEFAULT 'PENDING',
    isReview        INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS offline_hint_cache (
    lessonId    TEXT NOT NULL,
    questionId  TEXT NOT NULL,
    hints_json  TEXT NOT NULL,
    fetchedAt   TEXT NOT NULL,
    PRIMARY KEY (lessonId, questionId)
  );

  CREATE TABLE IF NOT EXISTS offline_ai_cache (
    questionId    TEXT PRIMARY KEY,
    diagnosis_json TEXT NOT NULL,
    generatedAt   TEXT NOT NULL,
    sizeBytes     INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS meta (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`;

/**
 * V2 (P2): Re-scope the AI diagnosis cache by lesson. The original table was
 * keyed by `questionId` alone, but prompt-fallback IDs collide across lessons
 * (the static math curriculum has no question id), so a diagnosis cached for
 * one lesson could be returned for another. The cache is fully regenerable via
 * prefetch, so we simply drop and recreate it with a composite
 * (lessonId, questionId) primary key — matching offline_hint_cache.
 */
const MIGRATION_V2 = `
  DROP TABLE IF EXISTS offline_ai_cache;

  CREATE TABLE offline_ai_cache (
    lessonId       TEXT NOT NULL,
    questionId     TEXT NOT NULL,
    diagnosis_json TEXT NOT NULL,
    generatedAt    TEXT NOT NULL,
    sizeBytes      INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (lessonId, questionId)
  );
`;

/**
 * Lightweight wrapper around an opened SQLite-over-OPFS instance.
 * All heavy operations run inside the OPFS SAH pool worker.
 */
export interface OfflineDb {
  /** Execute a SQL statement (DDL / DML). */
  exec(sql: string, params?: unknown[]): void;
  /** Query rows and return as array of objects. */
  selectAll<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[]
  ): T[];
  /** Query a single row. */
  selectOne<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[]
  ): T | undefined;
  /** Close the database connection and release OPFS lock. */
  close(): void;
}

/** Active DB instance per userId (module-level singleton map). */
const activeInstances = new Map<string, OfflineDb>();

/**
 * In-flight open() promises per userId.
 *
 * P2: `openUserDb()` does async work (dynamic import + OPFS constructor)
 * before it can populate `activeInstances`. Without this guard, two
 * concurrent callers (e.g. OfflineProvider init + lesson prefetch) both
 * miss the cache check, both await the WASM import, and both call
 * `new sqlite3.oo1.OpfsDb(filename)` on the same file — which OPFS treats
 * as a duplicate handle and can surface as a lock/open failure. Storing
 * the in-flight Promise here makes subsequent concurrent callers await
 * the same load.
 */
const pendingOpens = new Map<string, Promise<OfflineDb>>();

/**
 * Check if OPFS + SharedArrayBuffer are available in this browser.
 * @returns true if the full OPFS VFS can be used
 */
export function isOpfsAvailable(): boolean {
  return (
    typeof globalThis.SharedArrayBuffer !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    'storage' in navigator &&
    'getDirectory' in (navigator.storage ?? {})
  );
}

/**
 * Open (or return cached) the offline SQLite database for a user.
 * Each user's data is fully isolated in `rakkyo_user_${userId}.db` (D-3).
 *
 * @param userId - The authenticated user's ID
 * @returns An OfflineDb handle
 * @throws If OPFS is not available or WASM fails to load
 */
export async function openUserDb(userId: string): Promise<OfflineDb> {
  const cached = activeInstances.get(userId);
  if (cached) {
    return cached;
  }

  // P2: De-duplicate concurrent opens — return the same in-flight promise.
  const inFlight = pendingOpens.get(userId);
  if (inFlight) {
    return inFlight;
  }

  const openPromise = (async (): Promise<OfflineDb> => {
    if (!isOpfsAvailable()) {
      // Fallback: in-memory SQLite (data lost on reload, but learning continues)
      return openInMemoryDb(userId);
    }

    // Dynamic import — only loads WASM on first call
    const sqlite3Module = await import('@sqlite.org/sqlite-wasm');
    const sqlite3 = await sqlite3Module.default();

    const filename = `rakkyo_user_${userId}.db`;
    const db = new sqlite3.oo1.OpfsDb(filename);

    const wrapper = createDbWrapper(db, sqlite3);
    activeInstances.set(userId, wrapper);

    // Run migrations
    applyMigrations(wrapper);

    return wrapper;
  })();

  pendingOpens.set(userId, openPromise);
  try {
    return await openPromise;
  } finally {
    // Always clear the in-flight entry so retries after a failure can
    // attempt fresh; on success the cached instance in activeInstances
    // already short-circuits future callers.
    pendingOpens.delete(userId);
  }
}

/**
 * Fallback in-memory database for environments without OPFS.
 * Data is volatile but the app remains functional offline within a session.
 */
async function openInMemoryDb(userId: string): Promise<OfflineDb> {
  const sqlite3Module = await import('@sqlite.org/sqlite-wasm');
  const sqlite3 = await sqlite3Module.default();

  const db = new sqlite3.oo1.DB(':memory:');
  const wrapper = createDbWrapper(db, sqlite3);
  activeInstances.set(userId, wrapper);
  applyMigrations(wrapper);
  return wrapper;
}

/**
 * Create the OfflineDb wrapper around a raw sqlite3 DB handle.
 */
function createDbWrapper(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rawDb: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _sqlite3: any
): OfflineDb {
  return {
    exec(sql: string, params?: unknown[]): void {
      rawDb.exec({ sql, bind: params });
    },
    selectAll<T = Record<string, unknown>>(
      sql: string,
      params?: unknown[]
    ): T[] {
      const rows: T[] = [];
      rawDb.exec({
        sql,
        bind: params,
        rowMode: 'object',
        callback: (row: T) => {
          rows.push(row);
        },
      });
      return rows;
    },
    selectOne<T = Record<string, unknown>>(
      sql: string,
      params?: unknown[]
    ): T | undefined {
      return this.selectAll<T>(sql, params)[0];
    },
    close(): void {
      rawDb.close();
    },
  };
}

/**
 * Apply schema migrations up to LOCAL_SCHEMA_VERSION.
 */
function applyMigrations(db: OfflineDb): void {
  // Ensure meta table exists first
  db.exec(`
    CREATE TABLE IF NOT EXISTS meta (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  const row = db.selectOne<{ value: string }>(
    `SELECT value FROM meta WHERE key = ?`,
    [META_KEY_SCHEMA_VERSION]
  );
  const currentVersion = row ? parseInt(row.value, 10) : 0;

  const setVersion = (v: number) =>
    db.exec(`INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)`, [
      META_KEY_SCHEMA_VERSION,
      String(v),
    ]);

  // Apply migrations sequentially, recording each version as it completes so
  // a brand-new DB (version 0) runs every step and an upgrading DB resumes
  // from where it left off.
  if (currentVersion < 1) {
    db.exec(MIGRATION_V1);
    setVersion(1);
  }
  if (currentVersion < 2) {
    db.exec(MIGRATION_V2);
    setVersion(2);
  }
}

/**
 * Close and remove the active DB instance for a user.
 * Called during account switch or logout (D-3).
 * @param userId - The user whose DB to unmount
 */
export function unmountUserDb(userId: string): void {
  const instance = activeInstances.get(userId);
  if (instance) {
    instance.close();
    activeInstances.delete(userId);
  }
}

/**
 * Delete a user's OPFS database file completely (RTBF local, D-3/D-8).
 * @param userId - The user whose local data to wipe
 */
export async function deleteUserOpfsDb(userId: string): Promise<void> {
  // P2: Finish any in-flight open BEFORE wiping. If a background openUserDb()
  // (e.g. lesson prefetch) is still in `pendingOpens`, there is no cached
  // instance for unmountUserDb to close, and the open could otherwise resolve
  // *after* we remove the file — re-creating and re-caching the user's OPFS DB
  // on a wiped/shared device. Awaiting it (then unmounting the now-cached
  // instance) closes that race.
  const pending = pendingOpens.get(userId);
  if (pending) {
    try {
      await pending;
    } catch {
      // An open that failed leaves nothing to clean up.
    }
  }

  unmountUserDb(userId);

  if (!isOpfsAvailable()) {
    return; // In-memory DB already gone after unmount
  }

  const root = await navigator.storage.getDirectory();
  const filename = `rakkyo_user_${userId}.db`;
  try {
    await root.removeEntry(filename);
  } catch {
    // File may not exist — that's fine
  }
}

/**
 * Get the current schema version stored in the local DB.
 * @param db - The OfflineDb instance
 * @returns The schema version number, or 0 if not set
 */
export function getLocalSchemaVersion(db: OfflineDb): number {
  const row = db.selectOne<{ value: string }>(
    `SELECT value FROM meta WHERE key = ?`,
    [META_KEY_SCHEMA_VERSION]
  );
  return row ? parseInt(row.value, 10) : 0;
}

/**
 * Update the last sync timestamp in the meta table.
 * @param db - The OfflineDb instance
 * @param timestamp - ISO timestamp of the last successful sync
 */
export function setLastSyncTimestamp(
  db: OfflineDb,
  timestamp: string
): void {
  db.exec(`INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)`, [
    META_KEY_LAST_SYNC,
    timestamp,
  ]);
}

/**
 * Get the last sync timestamp from the meta table.
 * @param db - The OfflineDb instance
 * @returns ISO timestamp string, or null if never synced
 */
export function getLastSyncTimestamp(db: OfflineDb): string | null {
  const row = db.selectOne<{ value: string }>(
    `SELECT value FROM meta WHERE key = ?`,
    [META_KEY_LAST_SYNC]
  );
  return row?.value ?? null;
}
