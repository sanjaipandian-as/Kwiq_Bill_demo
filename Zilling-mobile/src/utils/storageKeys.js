import AsyncStorage from '@react-native-async-storage/async-storage';

export const SETTINGS_KEY = 'app_settings';

/**
 * Returns a user-specific key for AsyncStorage.
 * Format: baseKey_email_hash
 */
export const getUserSpecificKey = (baseKey, email) => {
    if (!email) return baseKey;
    return `${baseKey}_${email.replace(/[@.]/g, '_')}`;
};

/**
 * Helper to get the current user from AsyncStorage and return the specific key.
 */
export const getActiveSettingsKey = async () => {
    try {
        const userStr = await AsyncStorage.getItem('user');
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
