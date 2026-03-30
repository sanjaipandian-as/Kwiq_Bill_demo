import AsyncStorage from '@react-native-async-storage/async-storage';

export const SETTINGS_KEY = 'app_settings';

// Session-specific keys that MUST be cleared on logout or switched per user
export const SESSION_KEYS = {
    USER: 'user',
    JUST_LOGGED_IN: 'just_logged_in',
    LAST_USER_REFRESH: 'last_user_refresh_ts',
    PROCESSED_EVENTS: 'processed_events_ids',
    PENDING_QUEUE: 'pending_upload_queue',
    LAST_SYNCED: 'last_synced_timestamp',
    SMART_SYNC_TS: 'last_smart_sync_timestamp',
    VAULT_CACHE: '@security_vault_cache',
    VAULT_META: '@security_vault_meta',
    VAULT_DIRTY: '@security_vault_dirty',
    LAST_ROTATION: 'kwiq.last_key_rotation'
};

/**
 * Sensitive, session-scoped data keys.
 * These hold store details and bank details which are considered session-scoped:
 *   - ALWAYS cleared on logout (so stale data never leaks between sessions)
 *   - ALWAYS re-fetched from the server right after login
 * NOTE: The actual key names are user-specific (built by getUserSpecificKey),
 *       so clearSensitiveStoreData() looks them up dynamically.
 */
export const SENSITIVE_STORE_CACHE_PREFIXES = [
    SETTINGS_KEY, // covers app_settings_<email> which holds store + bankDetails
];

/**
 * Clears session-scoped store and bank data for a given user email.
 * Call this during logout BEFORE navigating to the login screen.
 */
export const clearSensitiveStoreData = async (email) => {
    try {
        const keysToRemove = [];

        if (email) {
            // Clear the user-specific settings cache (contains store + bankDetails)
            const safeEmail = email.toLowerCase().replace(/[@.]/g, '_');
            SENSITIVE_STORE_CACHE_PREFIXES.forEach(prefix => {
                keysToRemove.push(`${prefix}_${safeEmail}`);
            });
            // Also clear the settings_dirty flag so next login re-fetches cleanly
            keysToRemove.push('settings_dirty');
        } else {
            // Fallback: clear the unscoped key as well
            keysToRemove.push(SETTINGS_KEY, 'settings_dirty');
        }

        await Promise.all(keysToRemove.map(k => AsyncStorage.removeItem(k).catch(() => {})));
        console.log('[StorageKeys] Sensitive store/bank cache cleared for:', email || 'unknown');
    } catch (e) {
        console.warn('[StorageKeys] clearSensitiveStoreData failed:', e.message);
    }
};

/**
 * Returns a user-specific key for AsyncStorage.
 * Format: baseKey_email_hash
 */
export const getUserSpecificKey = (baseKey, email) => {
    if (!email) return baseKey;
    // Normalize email to be safe for filenames/keys
    const safeEmail = email.toLowerCase().replace(/[@.]/g, '_');
    return `${baseKey}_${safeEmail}`;
};

/**
 * Helper to get the current user from AsyncStorage and return the specific key.
 */
export const getActiveSettingsKey = async () => {
    try {
        const userStr = await AsyncStorage.getItem(SESSION_KEYS.USER);
        if (userStr) {
            const user = JSON.parse(userStr);
            if (user && user.email) {
                return getUserSpecificKey(SETTINGS_KEY, user.email);
            }
        }
    } catch (e) {
        console.error('[StorageKeys] Failed to get active settings key:', e);
    }
    return SETTINGS_KEY;
};
