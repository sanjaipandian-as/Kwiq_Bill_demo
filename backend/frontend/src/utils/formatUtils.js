/**
 * Formats a value as a percentage, capping it at +/- 100%.
 * 
 * @param {number|string} value - The value to format.
 * @param {number} decimals - Number of decimal places (default 1).
 * @returns {string} - The formatted percentage string (e.g., "50.0%", "100%", "-100%").
 */
export const formatCappedPercentage = (value, decimals = 1) => {
    let num = parseFloat(value);
    if (isNaN(num)) return '0%';

    // Clamp value between -100 and 100
    if (num > 100) num = 100;
    if (num < -100) num = -100;

    return `${num.toFixed(decimals)}%`;
};
