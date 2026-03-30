/**
 * Converts a number to Indian Rupee text format.
 * Handles up to Crores.
 * 
 * @param {number} amount - The amount to convert.
 * @returns {string} - The amount in words (e.g., "One Thousand Rupees Only").
 */
export const numberToWords = (amount) => {
    if (amount === 0) return 'Zero Rupees Only';

    const single = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
    const double = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    const convert = (num) => {
        if (num === 0) return '';
        if (num < 10) return single[num];
        if (num < 20) return double[num - 10];
        if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 !== 0 ? ' ' + single[num % 10] : '');
        if (num < 1000) return single[Math.floor(num / 100)] + ' Hundred' + (num % 100 !== 0 ? ' ' + convert(num % 100) : '');
        return '';
    };

    let words = '';
    const whole = Math.floor(amount);
    let paise = Math.round((amount - whole) * 100);

    if (whole > 0) {
        let num = whole;

        // Crores
        if (num >= 10000000) {
            words += convert(Math.floor(num / 10000000)) + ' Crore ';
            num %= 10000000;
        }

        // Lakhs
        if (num >= 100000) {
            words += convert(Math.floor(num / 100000)) + ' Lakh ';
            num %= 100000;
        }

        // Thousands
        if (num >= 1000) {
            words += convert(Math.floor(num / 1000)) + ' Thousand ';
            num %= 1000;
        }

        // Hundreds (and below)
        if (num > 0) {
            words += convert(num);
        }

        words += ' Rupees';
    }

    if (paise > 0) {
        words += (whole > 0 ? ' and ' : '') + convert(paise) + ' Paise';
    }

    return (words + ' Only').trim();
};
