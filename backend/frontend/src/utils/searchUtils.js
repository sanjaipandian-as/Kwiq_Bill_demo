/**
 * Normalizes text for search comparison.
 * - Converts to lowercase.
 * - Removes all non-alphanumeric characters (spaces, punctuation, symbols).
 *
 * Example: " T-Shirt (Cotton) " -> "tshirtcotton"
 *
 * @param {string} text - The text to normalize.
 * @returns {string} - The normalized text.
 */
export const normalizeSearchText = (text) => {
    if (!text) return '';
    return String(text).toLowerCase().replace(/[^a-z0-9]/g, '');
};

/**
 * Checks if the source text contains the query text using normalization.
 *
 * @param {string} source - The text to search within.
 * @param {string} query - The search query.
 * @returns {boolean} - True if match found, false otherwise.
 */
export const isSearchMatch = (source, query) => {
    if (!query) return true;
    if (!source) return false;
    return normalizeSearchText(source).includes(normalizeSearchText(query));
};
