/**
 * A robust UUID generator that works in React Native even when native crypto might be unavailable or slow.
 */
export const generateUUID = () => {
    // JS Fallback (RFC 4122 compliant enough for local event IDs)
    // We use this as primary fallback if anything goes wrong
    const fallback = () => {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = (Math.random() * 16) | 0;
            const v = c === 'x' ? r : (r & 0x3) | 0x8;
            return v.toString(16);
        });
    }

    try {
        const Crypto = require('expo-crypto');
        if (Crypto && typeof Crypto.randomUUID === 'function') {
            try {
                return Crypto.randomUUID();
            } catch (e) {
                return fallback();
            }
        }
    } catch (e) {
        // ignore
    }
    return fallback();
};

/**
 * Aggressively polyfills global.crypto.getRandomValues.
 * This is designed to fix crashes in libraries like crypto-js.
 */
export const ensureCryptoPolyfill = () => {
    try {
        if (typeof global !== 'undefined') {
            let needsPolyfill = false;

            try {
                if (!global.crypto || !global.crypto.getRandomValues) {
                    needsPolyfill = true;
                } else {
                    // Test if it actually works
                    const testArray = new Uint8Array(1);
                    global.crypto.getRandomValues(testArray);
                }
            } catch (e) {
                console.log('[Crypto] Native getRandomValues is broken, applying polyfill...');
                needsPolyfill = true;
            }

            if (needsPolyfill) {
                // Completely overwrite to be sure
                const cryptoPolyfill = {
                    getRandomValues: (byteArray) => {
                        for (let i = 0; i < byteArray.length; i++) {
                            byteArray[i] = Math.floor(Math.random() * 256);
                        }
                        return byteArray;
                    }
                };

                // Define it non-configurably if possible to prevent other modules from breaking it
                Object.defineProperty(global, 'crypto', {
                    value: cryptoPolyfill,
                    writable: true,
                    configurable: true,
                });

                console.log('[Crypto] Global crypto polyfilled successfully.');
            }
        }
    } catch (e) {
        console.error('[Critical] Failed to apply crypto polyfill:', e);
    }
};

// Execute immediately upon import
ensureCryptoPolyfill();
