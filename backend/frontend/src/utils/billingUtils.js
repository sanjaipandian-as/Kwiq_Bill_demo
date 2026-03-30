export const calculateTotals = (cart, billDiscount = 0, additionalCharges = 0, loyaltyPointsDiscount = 0, taxType = 'Intra-State', settings = {}) => {
    let aggGross = 0; // Usage: Sum of (Price * Qty) - before discount
    let aggItemDisc = 0;
    let aggTaxable = 0; // Sum of Taxable Values
    let aggTax = 0;
    let aggCgst = 0;
    let aggSgst = 0;
    let aggIgst = 0;

    // GST Summary Aggregation
    const gstSummary = {};

    // Settings check
    const isInclusive = settings.tax?.defaultType === 'Inclusive' || settings.tax?.priceMode === 'Inclusive';

    // Helper: Round to 2 decimals properly
    const round2 = (num) => Math.round((num + Number.EPSILON) * 100) / 100;

    // 1. Calculate per-item tax details
    const enrichedCart = cart.map(item => {
        const price = parseFloat(item.price || item.sellingPrice || 0);
        const qty = parseFloat(item.quantity || 0);
        const discount = parseFloat(item.discount || 0);
        const taxRate = parseFloat(item.taxRate || 0);

        const baseTotal = price * qty; // Gross for line
        const effectiveAmount = Math.max(0, baseTotal - discount); // Amount after discount

        let taxableValue = 0;
        let taxAmount = 0;

        // D-Mart Style: Strictly GST Inclusive
        if (isInclusive) {
            // Formula: Taxable = Total / (1 + Rate%)
            // Rule: Round Taxable to 2 decimals per item
            taxableValue = round2(effectiveAmount / (1 + (taxRate / 100)));

            // Rule: Tax = Total - Taxable (Prevents rounding drift)
            taxAmount = round2(effectiveAmount - taxableValue);
        } else {
            // Exclusive logic (fallback)
            taxableValue = round2(effectiveAmount);
            taxAmount = round2(taxableValue * (taxRate / 100));
        }

        const totalLine = taxableValue + taxAmount; // Should equal effectiveAmount (for inclusive) (accounting for minor float variance, but strictly sums match)

        // Split Tax
        let cgst = 0, sgst = 0, igst = 0;
        let cgstRate = 0, sgstRate = 0, igstRate = 0;

        if (taxType === 'Inter-State') {
            igst = taxAmount;
            igstRate = taxRate;
        } else {
            // Split tax evenly
            cgst = round2(taxAmount / 2);
            sgst = round2(taxAmount - cgst); // Ensure sum equals taxAmount exactly

            cgstRate = taxRate / 2;
            sgstRate = taxRate / 2;
        }

        // Aggregate to GST Summary (Grouping by Rate)
        if (!gstSummary[taxRate]) {
            gstSummary[taxRate] = { taxable: 0, cgst: 0, sgst: 0, igst: 0, tax: 0 };
        }
        gstSummary[taxRate].taxable += taxableValue;
        gstSummary[taxRate].cgst += cgst;
        gstSummary[taxRate].sgst += sgst;
        gstSummary[taxRate].igst += igst;
        gstSummary[taxRate].tax += taxAmount;

        // Update aggregates
        aggGross += baseTotal;
        aggItemDisc += discount;
        aggTaxable += taxableValue;
        aggTax += taxAmount;
        aggCgst += cgst;
        aggSgst += sgst;
        aggIgst += igst;

        return {
            ...item,
            // STORE ROUNDED SNAPSHOTS
            taxableValue,
            cgst,
            sgst,
            igst,
            totalTax: taxAmount,
            total: effectiveAmount + (isInclusive ? 0 : taxAmount), // If exclusive, total increases. If inclusive, remains effectiveAmount

            // Store Rates for Print usage
            cgstRate,
            sgstRate,
            igstRate,
            isInclusive, // Metadata
            variantId: item.variantId // Preserve variantId
        };
    });

    // Final Calculations
    const totalBeforeDiscounts = aggTaxable + aggTax + additionalCharges;
    // Note: totalBeforeDiscounts essentially equals (aggGross - aggItemDisc) + additionalCharges if inclusive.

    // Calculate Final Total
    // Taxable Subtotal + Total Tax + Additional - Bill Disc
    let total = Math.max(0, (aggTaxable + aggTax + additionalCharges) - billDiscount - loyaltyPointsDiscount);

    // Calculate Round Off
    const roundedTotal = Math.round(total);
    const roundOff = roundedTotal - total;
    total = roundedTotal;

    return {
        totals: {
            grossTotal: aggGross,
            itemDiscount: aggItemDisc,
            subtotal: aggTaxable, // RENAMED CONCEPT: This is now Taxable Value
            tax: aggTax,
            cgst: aggCgst,
            sgst: aggSgst,
            igst: aggIgst,
            discount: billDiscount + loyaltyPointsDiscount,
            additionalCharges,
            total,
            roundOff
        },
        gstSummary, // Pass summarized map for UI/Print
        enrichedCart
    };
};
