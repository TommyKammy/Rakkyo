/**
 * User isolation for OPFS databases (D-3, D-4, D-8).
 *
 * OPFS is shared per origin. Without isolation, switching accounts
 * on a shared iPad would expose sibling's learning data.
 * Each user gets a separate DB file (`rakkyo_user_${userId}.db`).
 *
 * @module offline/user-isolation
 */

import { openUserDb, unmountUserDb, deleteUserOpfsDb } from './db';
import { deleteKey } from './crypto';

/** Key in localStorage that tracks the currently mounted offline user. */
const MOUNTED_USER_KEY = 'rakkyo_offline_userId';

/**
 * Get the currently mounted offline user ID.
 * @returns The userId of the currently active offline DB, or null
 */
export function getMountedUserId(): string | null {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem(MOUNTED_USER_KEY);
}

/**
 * Mount (open) the offline database for a user.
 * If a different user's DB is currently mounted, unmount it first (D-3).
 *
 * @param userId - The user ID to mount
 * @returns The OfflineDb handle
 */
export async function mountUserDb(userId: string) {
  const currentUserId = getMountedUserId();

  // Auto-unmount previous user if switching accounts (D-3)
  if (currentUserId && currentUserId !== userId) {
    unmountUserDb(currentUserId);
  }

  const db = await openUserDb(userId);
  localStorage.setItem(MOUNTED_USER_KEY, userId);
  return db;
}

/**
 * Handle logout: delete OPFS data for the user (RTBF local, D-3/D-8).
 * Also removes the encryption key from IndexedDB.
 *
 * @param userId - The user ID to wipe local data for
 */
export async function handleLogout(userId: string): Promise<void> {
  // 1. Close and delete the OPFS database file
  await deleteUserOpfsDb(userId);

  // 2. Delete the encryption key (D-8)
  await deleteKey(`enc_${userId}`);

  // 3. Clear the mounted user marker and session storage (P1)
  localStorage.removeItem(MOUNTED_USER_KEY);
  localStorage.removeItem('rakkyo_token');
  localStorage.removeItem('rakkyo_user');
}

/**
 * Handle account switch with safety check (D-4).
 *
 * If the new user is different from the previously mounted user,
 * the old user's DB is unmounted (but NOT deleted — they may
 * log back in and need their unsynced data).
 *
 * If the old user has pending unsynced data and is logging out
 * explicitly, use `handleLogout()` instead.
 *
 * @param newUserId - The new user ID
 * @param oldUserId - The previously logged-in user ID (if known)
 * @returns Object indicating if a switch occurred and if data was at risk
 */
export async function handleAccountSwitch(
  newUserId: string,
  oldUserId: string | null
): Promise<{
  switched: boolean;
  previousUserHadData: boolean;
}> {
  if (!oldUserId || oldUserId === newUserId) {
    await mountUserDb(newUserId);
    return { switched: false, previousUserHadData: false };
  }

  // D-4: Different user detected — unmount old DB (but don't delete)
  unmountUserDb(oldUserId);

  // Mount new user's DB
  await mountUserDb(newUserId);

  return { switched: true, previousUserHadData: true };
}
