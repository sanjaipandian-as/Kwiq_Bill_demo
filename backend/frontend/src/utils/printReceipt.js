import { numberToWords } from './numberToWords';

export const printReceipt = (invoice, format = '80mm', settings = {}, options = {}) => {
    if (!invoice) return '';

    // --- 1. Setup & Defaults ---
    const store = settings.store || {};
    const invoiceSettings = settings.invoice || {};
    const taxSettings = settings.tax || {};

    // Ensure format is a string to prevent TypeError if mistakenly passed an Event object
    const safeFormat = typeof format === 'string' ? format : '80mm';
    const isThermal = safeFormat.includes('Thermal') || invoiceSettings.paperSize?.includes('Thermal');
    // Broad thermal detection — catches "Thermal", "Thermal-3inch", "80mm", "Thermal-80mm", "58mm" etc.
    const isThermalPrinter =
        safeFormat.toLowerCase().includes('thermal') ||
        safeFormat.includes('80') || safeFormat.includes('58') ||
        invoiceSettings.paperSize?.toLowerCase().includes('thermal') ||
        invoiceSettings.paperSize?.includes('80') ||
        invoiceSettings.paperSize?.includes('58');

    // GST Enabled Check - if disabled, hide all GST details
    const gstEnabled = taxSettings.gstEnabled !== false; // Default to true if not explicitly false

    // Tax Type Handling
    const taxType = invoice.taxType || invoice.tax_type || 'Intra-State';
    const isInterState = taxType === 'Inter-State';

    // --- 2. Helpers ---

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits: 2
        }).format(amount || 0);
    };

    const getAddressStr = (addr) => {
        if (!addr) return '';
        if (typeof addr === 'string') return addr;
        const parts = [addr.street, addr.area, addr.city, addr.state, addr.pincode].filter(Boolean);
        return parts.join(', ');
    };

    const getItemTaxDetails = (item) => {
        // LOCK 2 & 8: STRICT READ-ONLY. NO RECALCULATION.
        // We rely entirely on the snapshot stored during billing.
        const taxableValue = item.taxableValue || 0;
        const taxRate = parseFloat(item.taxRate || 0);

        // Standardize output
        return {
            taxableValue,
            cgstRate: item.cgstRate || (item.taxRate / 2), // Helper for display only
            sgstRate: item.sgstRate || (item.taxRate / 2),
            igstRate: item.igstRate || item.taxRate,
            cgstAmt: item.cgst || 0,
            sgstAmt: item.sgst || 0,
            igstAmt: item.igst || 0,
            totalTax: item.totalTax || 0
        };
    };

    // --- 3. Shared Components ---

    const amountInWords = numberToWords(Math.round(invoice.total));
    const bankDetails = store.bankDetails;
    const signatoryLabel = store.signatoryLabel || store.name || 'Authorized Signatory';
    const isInvoiceInclusive = invoice.items && invoice.items.length > 0 && invoice.items.some(i => i.isInclusive);

    const renderBankDetails = () => {
        if (!invoiceSettings.showBankDetails || !bankDetails || !bankDetails.bankName) return '';
        return `
            <div style="margin-top: 10px; font-size: 10px; border: 1px dashed #aaa; padding: 5px;">
                <div style="font-weight: bold; font-size: 11px; margin-bottom: 2px;">Bank Details</div>
                <div>Bank: <b>${bankDetails.bankName}</b></div>
                <div>A/c No: <b>${bankDetails.accountNumber}</b></div>
                <div>IFSC: <b>${bankDetails.ifscCode}</b> &nbsp; Branch: <b>${bankDetails.branch}</b></div>
            </div>
        `;
    };

    const renderInclusiveNote = () => {
        if (!gstEnabled) return '';
        const note = isInvoiceInclusive
            ? 'All prices are inclusive of GST. Taxable value is back-calculated.'
            : 'All prices are exclusive of GST. Tax is added separately.';
        return `<div style="font-size: 9px; margin-top: 5px; font-style: italic;">* Note: ${note}</div>`;
    };

    const generateGstSummaryHTML = () => {
        if (!gstEnabled) return '';

        const summary = {};
        invoice.items.forEach(item => {
            const taxRate = parseFloat(item.taxRate || 0);
            if (!summary[taxRate]) {
                summary[taxRate] = { taxable: 0, cgst: 0, sgst: 0, igst: 0, totalTax: 0 };
            }
            summary[taxRate].taxable += (item.taxableValue || 0);
            summary[taxRate].cgst += (item.cgst || 0);
            summary[taxRate].sgst += (item.sgst || 0);
            summary[taxRate].igst += (item.igst || 0);
            summary[taxRate].totalTax += (item.totalTax || 0);
        });

        const sortedRates = Object.keys(summary).filter(r => parseFloat(r) > 0).sort((a, b) => parseFloat(a) - parseFloat(b));
        if (sortedRates.length === 0) return '';

        // For Express/Streamlined templates, use proper tables for perfect preview scaling
        if (invoiceSettings.template === 'Express' || invoiceSettings.template === 'Streamlined') {
            return `
                <div class="divider"></div>
                <div class="bold" style="margin-top: 5px;">GST Summary:</div>
                <div class="divider" style="margin-bottom: 2px;"></div>
                <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
                    <thead>
                        ${isInterState
                    ? `<tr><th style="text-align:left;">Rate</th><th class="text-right">Taxable</th><th class="text-right">IGST</th><th class="text-right">Total</th></tr>`
                    : `<tr><th style="text-align:left;">Rate</th><th class="text-right">Taxable</th><th class="text-right">CGST</th><th class="text-right">SGST</th><th class="text-right">Total</th></tr>`
                }
                    </thead>
                    <tbody>
                        <tr><td colspan="5" style="border-top:1px dashed #000; height: 1px;"></td></tr>
                        ${sortedRates.map(rate => {
                    const row = summary[rate];
                    if (isInterState) {
                        return `<tr><td>${rate}%</td><td class="text-right">${formatCurrency(row.taxable).replace('₹', '')}</td><td class="text-right">${formatCurrency(row.igst).replace('₹', '')}</td><td class="text-right">${formatCurrency(row.taxable + row.igst).replace('₹', '')}</td></tr>`;
                    } else {
                        return `<tr><td>${rate}%</td><td class="text-right">${formatCurrency(row.taxable).replace('₹', '')}</td><td class="text-right">${formatCurrency(row.cgst).replace('₹', '')}</td><td class="text-right">${formatCurrency(row.sgst).replace('₹', '')}</td><td class="text-right">${formatCurrency(row.cgst + row.sgst).replace('₹', '')}</td></tr>`;
                    }
                }).join('')}
                    </tbody>
                </table>
                <div class="divider"></div>
            `;
        }

        // Default HTML table for A4/other templates
        const tableStyle = `width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 10px;`;
        const thStyle = `border: 1px dashed #aaa; padding: 2px 4px; text-align: right; background: #f9f9f9; font-weight: bold;`;
        const tdStyle = `border: 1px dashed #aaa; padding: 2px 4px; text-align: right;`;

        return `
            <div style="margin-top: 10px; border-top: 1px dotted #ddd; padding-top: 5px;">
                <div style="font-weight: bold; font-size: 11px; margin-bottom: 5px;">GST DETAILS</div>
                <table style="${tableStyle}">
                    <thead>
                        <tr>
                            <th style="${thStyle} text-align:center;">Rate</th>
                            <th style="${thStyle}">Taxable</th>
                            ${isInterState
                ? `<th style="${thStyle}">IGST</th>`
                : `<th style="${thStyle}">CGST</th><th style="${thStyle}">SGST</th>`
            }
                        </tr>
                    </thead>
                    <tbody>
                        ${sortedRates.map(rate => {
                const row = summary[rate];
                return `
                                <tr>
                                    <td style="${tdStyle} text-align:center;">${rate}%</td>
                                    <td style="${tdStyle}">${formatCurrency(row.taxable)}</td>
                                    ${isInterState
                        ? `<td style="${tdStyle}">${formatCurrency(row.igst)}</td>`
                        : `<td style="${tdStyle}">${formatCurrency(row.cgst)}</td><td style="${tdStyle}">${formatCurrency(row.sgst)}</td>`
                    }
                                </tr>
                            `;
            }).join('')}
                    </tbody>
                </table>
            </div>
        `;
    };

    // --- 4. Templates ---

    // === EXPRESS RECEIPT — monospace layout matching thermalPrinter.js ===
    // Column layout: SN(3) | ITEM(19) | QTY(4) | RATE(8) | AMT(8) = 42
    const MAX_COLS = 42;
    const COL_SN = 3;
    const COL_ITEM = 19;
    const COL_QTY = 4;
    const COL_RATE = 8;
    const COL_AMT = 8;

    const padR42 = (s, w) => { s = String(s); return s.length > w ? s.slice(0, w) : s.padEnd(w); };
    const padL42 = (s, w) => { s = String(s); return s.length > w ? s.slice(0, w) : s.padStart(w); };
    const fmt42 = (n) => parseFloat(n || 0).toFixed(2);
    const divLine = (c = '-') => c.repeat(MAX_COLS);

    const wrapWord42 = (str, width) => {
        const words = String(str || '').split(' ');
        const lines = [];
        let cur = '';
        for (const w of words) {
            if ((cur + (cur ? ' ' : '') + w).length <= width) {
                cur = cur ? cur + ' ' + w : w;
            } else {
                if (cur) lines.push(cur);
                let rem = w;
                while (rem.length > width) { lines.push(rem.slice(0, width)); rem = rem.slice(width); }
                cur = rem;
            }
        }
        if (cur) lines.push(cur);
        return lines.length ? lines : [''];
    };

    const getExpressStyles = () => `
        * { box-sizing: border-box; }
        body { margin: 0; padding: 15px; background: #f8fafc; font-family: 'Courier New', Courier, monospace; }
        .receipt-container {
            background: #fff;
            padding: 25px 20px;
            margin: 0 auto;
            width: max-content;
            min-width: ${MAX_COLS}ch;
            box-shadow: 0 10px 30px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1);
            position: relative;
            border: 1px solid #e2e8f0;
        }
        .receipt-container::after {
            content: "";
            position: absolute;
            bottom: -10px;
            left: 0;
            right: 0;
            height: 10px;
            background: linear-gradient(-45deg, transparent 5px, white 5px), linear-gradient(45deg, transparent 5px, white 5px);
            background-size: 10px 10px;
            background-position: left bottom;
        }
        pre {
            margin: 0;
            font-size: 13px;
            line-height: 1.5;
            white-space: pre;
            color: #1e293b;
        }
        b { font-weight: 700; color: #000; }
        .receipt-wrap { display: flex; justify-content: center; padding: 20px 0; }
    `;

    const generateExpressHTML = () => {
        const isInc = isInvoiceInclusive;
        const rateLbl = isInc ? 'Rate(G)' : 'Rate';
        const billNo = invoice.bill_number !== undefined ? invoice.bill_number
            : (invoice.billNumber !== undefined ? invoice.billNumber
                : '#' + String(invoice.id || '').slice(-6).toUpperCase());
        const dateStr = new Date(invoice.date).toLocaleDateString();
        const timeStr = new Date(invoice.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const custStr = (invoice.customerName || 'Walk-in Customer').slice(0, 18);
        const modeStr = (invoice.payments && invoice.payments.length > 1) ? 'Split' : String(invoice.paymentMethod || invoice.payment_method || 'Cash').slice(0, 10);
        const invoiceTitle = gstEnabled ? (invoiceSettings.invoiceTitle || 'TAX INVOICE') : 'INVOICE';

        const lines = [];

        // Header
        const storeName = (store.name || 'STORE NAME').toUpperCase();
        lines.push(`<b>${storeName.padStart(Math.floor((MAX_COLS + storeName.length) / 2)).padEnd(MAX_COLS)}</b>`);

        if (invoiceSettings.showStoreAddress && store.address) {
            wrapWord42(getAddressStr(store.address), MAX_COLS).forEach(l => lines.push(l.padStart(Math.floor((MAX_COLS + l.length) / 2)).padEnd(MAX_COLS)));
        }
        if (store.contact) lines.push(('Ph: ' + store.contact).padStart(Math.floor((MAX_COLS + ('Ph: ' + store.contact).length) / 2)).padEnd(MAX_COLS));
        if (gstEnabled && store.gstin) lines.push(('GSTIN: ' + store.gstin).padStart(Math.floor((MAX_COLS + ('GSTIN: ' + store.gstin).length) / 2)).padEnd(MAX_COLS));
        lines.push(divLine('-'));
        lines.push(`<b>${invoiceTitle.padStart(Math.floor((MAX_COLS + invoiceTitle.length) / 2)).padEnd(MAX_COLS)}</b>`);
        lines.push(divLine('-'));

        // Meta
        const META_L = 24; const META_R = MAX_COLS - META_L;
        // In the preview, we use <b> tags which don't take up horizontal space in terms of character count for the pre tag BUT the string length is longer.
        // We handle this by calculating padding based on content length excluding tags.
        const metaLine1 = 'Bill No: <b>' + billNo + '</b>';
        lines.push(metaLine1.padEnd(META_L + 7)); // +7 for <b></b>

        lines.push(padR42('Date: ' + dateStr, META_L) + padL42('Time: ' + timeStr, META_R));

        const modeLabel = 'Mode: <b>' + modeStr + '</b>';
        lines.push(padR42('Cust: ' + custStr, META_L) + modeLabel.padStart(META_R + 7));
        lines.push(divLine('-'));

        // Table header
        lines.push(
            padR42('SN', COL_SN) +
            padR42('ITEM', COL_ITEM) +
            padL42('QTY', COL_QTY) +
            padL42(rateLbl, COL_RATE) +
            padL42('AMT', COL_AMT)
        );
        lines.push(divLine('-'));

        // Items
        const taxGroups = {};
        let totalQty = 0, totalSavings = 0, sNo = 1;

        invoice.items.forEach(item => {
            const mrp = item.mrp || 0;
            if (mrp > item.price) totalSavings += (mrp - item.price) * item.quantity;
            totalQty += Number(item.quantity || 0);

            if (gstEnabled) {
                const r = parseFloat(item.taxRate || 0);
                if (!taxGroups[r]) taxGroups[r] = {
                    rate: r, items: [],
                    igstRate: parseFloat(item.igstRate || r) || 0,
                    cgstRate: parseFloat(item.cgstRate || r / 2) || 0,
                    sgstRate: parseFloat(item.sgstRate || r / 2) || 0,
                };
                taxGroups[r].items.push(item);
            }
        });

        const printItems = (items) => {
            items.forEach(item => {
                const nameLines = wrapWord42(item.name || '', COL_ITEM);
                lines.push(
                    padR42(String(sNo++), COL_SN) +
                    padR42(nameLines[0], COL_ITEM) +
                    padL42(String(item.quantity), COL_QTY) +
                    padL42(fmt42(item.price), COL_RATE) +
                    padL42(fmt42(item.total), COL_AMT)
                );
                for (let i = 1; i < nameLines.length; i++) {
                    lines.push(' '.repeat(COL_SN) + padR42(nameLines[i], COL_ITEM));
                }
                if (item.hsnCode) lines.push(' '.repeat(COL_SN) + 'HSN: ' + item.hsnCode);
            });
        };

        if (gstEnabled) {
            Object.keys(taxGroups).sort((a, b) => parseFloat(a) - parseFloat(b)).forEach(r => {
                const g = taxGroups[r];
                if (invoiceSettings.showTaxGroupHeaders !== false) {
                    const lbl = isInterState
                        ? `-- IGST @ ${g.igstRate}% --`
                        : `-- CGST ${g.cgstRate}%  SGST ${g.sgstRate}% --`;
                    lines.push('<b>' + lbl.padStart(Math.floor((MAX_COLS + lbl.length) / 2)).padEnd(MAX_COLS) + '</b>');
                }
                printItems(g.items);
            });
        } else {
            printItems(invoice.items || []);
        }

        lines.push(divLine('-'));

        // Summary
        const sumRow = (lbl, val, bold = false) => {
            const v = padL42(String(val), 10);
            const line = padR42(lbl, MAX_COLS - v.length) + v;
            return bold ? `<b>${line}</b>` : line;
        };
        lines.push(sumRow(`Items: ${invoice.items.length}  Qty: ${totalQty}`, fmt42(invoice.total), true));

        const billDiscount = Number(invoice.billDiscount || invoice.bill_discount || 0);
        const loyalty = Number(invoice.loyaltyPointsDiscount || invoice.loyalty_points_discount || 0);
        const addlCharges = Number(invoice.additionalCharges || invoice.additional_charges || 0);
        const discountAmt = Number(invoice.discount || 0);
        const roundOff = parseFloat(invoice.roundOff || invoice.round_off || 0);

        if (billDiscount > 0) lines.push(sumRow('Bill Discount', '-' + fmt42(billDiscount)));
        if (loyalty > 0) lines.push(sumRow('Loyalty Points', '-' + fmt42(loyalty)));
        if (addlCharges > 0) lines.push(sumRow('Additional Charges', '+' + fmt42(addlCharges)));
        if (discountAmt > 0) lines.push(sumRow('Total Discount', '-' + fmt42(discountAmt)));
        if (roundOff !== 0) lines.push(sumRow('Round Off', (roundOff > 0 ? '+' : '') + roundOff.toFixed(2)));

        // GST Summary table (Express)
        if (gstEnabled && invoice.items?.length > 0) {
            const gstSummary = {};
            invoice.items.forEach(item => {
                const r = parseFloat(item.taxRate || 0);
                if (!gstSummary[r]) gstSummary[r] = { taxable: 0, cgst: 0, sgst: 0, igst: 0 };
                gstSummary[r].taxable += (item.taxableValue || 0);
                gstSummary[r].cgst += (item.cgst || 0);
                gstSummary[r].sgst += (item.sgst || 0);
                gstSummary[r].igst += (item.igst || 0);
            });
            const taxRates = Object.keys(gstSummary).filter(r => parseFloat(r) > 0);
            if (taxRates.length > 0) {
                lines.push('');
                lines.push('<b>GST Summary:</b>');
                lines.push(divLine('-'));
                if (isInterState) {
                    lines.push(padR42('Rate', 5) + '|' + padL42('Taxable', 11) + '|' + padL42('IGST', 11) + '|' + padL42('Total', 12));
                    lines.push(divLine('-'));
                    taxRates.sort((a, b) => parseFloat(a) - parseFloat(b)).forEach(r => {
                        const row = gstSummary[r];
                        lines.push(padR42(r + '%', 5) + '|' + padL42(fmt42(row.taxable), 11) + '|' + padL42(fmt42(row.igst), 11) + '|' + padL42(fmt42(row.taxable + row.igst), 12));
                    });
                } else {
                    lines.push(padR42('Rate', 5) + '|' + padL42('Taxable', 9) + '|' + padL42('CGST', 7) + '|' + padL42('SGST', 7) + '|' + padL42('Total', 10));
                    lines.push(divLine('-'));
                    taxRates.sort((a, b) => parseFloat(a) - parseFloat(b)).forEach(r => {
                        const row = gstSummary[r];
                        lines.push(padR42(r + '%', 5) + '|' + padL42(fmt42(row.taxable), 9) + '|' + padL42(fmt42(row.cgst), 7) + '|' + padL42(fmt42(row.sgst), 7) + '|' + padL42(fmt42(row.cgst + row.sgst), 10));
                    });
                }
                lines.push(divLine('-'));
            }
        }

        lines.push(divLine('='));

        // Payment
        const payments = invoice.payments || [];
        const amtRcvd = Number(invoice.amountReceived || invoice.amount_received || 0);

        if (payments.length > 1) {
            lines.push('');
            lines.push('<b>Payments:</b>');
            lines.push(divLine('-'));
            payments.forEach(p => {
                lines.push(sumRow(`  ${p.method}`, fmt42(p.amount)));
            });
            lines.push(divLine('-'));
        }

        if (amtRcvd > 0 && payments.length <= 1 && (payments[0]?.method === 'Cash' || invoice.paymentMethod === 'Cash')) {
            lines.push(sumRow('Amt Received', fmt42(amtRcvd)));
            if (amtRcvd > invoice.total) lines.push(sumRow('Change Return', fmt42(amtRcvd - invoice.total)));
        }

        if (invoice.status !== 'Paid' && invoice.total > amtRcvd) {
            lines.push(sumRow('Balance Due', fmt42(invoice.total - invoice.amountPaid || amtRcvd), true));
        }

        // Savings
        if (totalSavings > 0) {
            lines.push('');
            lines.push(divLine('='));
            const savLbl = `** You saved ${fmt42(totalSavings)} on MRP **`;
            lines.push(`<b>${savLbl.padStart(Math.floor((MAX_COLS + savLbl.length) / 2)).padEnd(MAX_COLS)}</b>`);
            lines.push(divLine('='));
        }

        // Remarks
        if (invoice.remarks) {
            lines.push('');
            lines.push('<b>Remarks:</b>');
            wrapWord42(invoice.remarks, MAX_COLS).forEach(l => lines.push(l));
        }

        // Footer
        lines.push('');
        const ty = 'Thank You! Visit Again.';
        lines.push(`<b>${ty.padStart(Math.floor((MAX_COLS + ty.length) / 2)).padEnd(MAX_COLS)}</b>`);
        if (store.website) lines.push(store.website.padStart(Math.floor((MAX_COLS + store.website.length) / 2)).padEnd(MAX_COLS));
        if (invoiceSettings.footerNote) wrapWord42(invoiceSettings.footerNote, MAX_COLS).forEach(l => lines.push(l));
        if (isInc) lines.push('(G) Price inclusive of GST');

        // Safe HTML function for monospace with bold support
        const safeHtml = s => s.replace(/&/g, '&amp;')
            .replace(/<(?!\/?b>)/g, '&lt;')
            .replace(/(?<!<b|<\/b)>/g, '&gt;');

        const bodyLines = lines.map(l => safeHtml(l)).join('\n');

        return `
            <div class="receipt-wrap">
                <div class="receipt-container">
                    <pre>${bodyLines}</pre>
                </div>
            </div>
        `;
    };

    // === STREAMLINED RECEIPT — monospace layout matching thermalPrinter.js ===
    const getStreamlinedStyles = () => `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; }
        body { 
            margin: 0; 
            padding: 10px; 
            background: #f8fafc; 
            font-family: 'Inter', -apple-system, sans-serif; 
            color: #111;
        }
        .streamlined-receipt {
            background: #fff;
            max-width: 420px;
            margin: 0 auto;
            padding: 20px 15px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            border: 1px solid #e5e7eb;
        }
        .header { text-align: center; margin-bottom: 12px; }
        .store-name { font-weight: 800; font-size: 24px; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 1px; }
        .store-details { 
            font-size: 9px; 
            color: #111; 
            font-weight: 700;
            line-height: 1.2; 
            margin-bottom: 1px;
        }

        .meta-section { border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 5px 0; margin-bottom: 10px; }
        .meta-row { display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 4px; }
        .meta-row:last-child { margin-bottom: 0; }
        .meta-label { font-weight: 500; }
        .meta-val { font-weight: 500; }

        .items-table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
        .items-table th { border-bottom: 1px solid #000; padding: 4px 0; font-size: 11px; font-weight: 500; text-align: left; }
        .items-table td { padding: 4px 0; font-size: 11px; color: #111; vertical-align: top; }
        .text-right { text-align: right; }
        .text-center { text-align: center; }

        .totals-section { border-top: 1px solid #000; padding-top: 10px; }
        .total-row { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 6px; }
        .grand-total-row { 
            margin-top: 10px; 
            padding-top: 10px; 
            border-top: 2px solid #111; 
            border-bottom: 2px solid #111;
            padding-bottom: 10px;
            font-weight: 700; 
            font-size: 18px; 
            text-transform: uppercase;
        }

        .footer { text-align: center; margin-top: 25px; border-top: 1.5px solid #000; padding-top: 15px; }
        .ty-msg { font-size: 12px; margin-bottom: 10px; }
        .inclusive-note { font-size: 10px; font-style: italic; color: #555; }
    `;

    const generateStreamlinedHTML = () => {
        const billNo = invoice.bill_number !== undefined ? invoice.bill_number : (invoice.billNumber !== undefined ? invoice.billNumber : '#' + String(invoice.id || '').slice(-6).toUpperCase());
        const dateStr = new Date(invoice.date).toLocaleDateString('en-GB');
        const timeStr = new Date(invoice.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const custName = invoice.customerName || 'Walk-in Customer';
        const modeStr = (invoice.payments && invoice.payments.length > 1) ? 'Split Payment' : String(invoice.paymentMethod || invoice.payment_method || 'Cash');

        const subtotal = invoice.subtotal || (parseFloat(invoice.total || 0) - parseFloat(invoice.tax || 0));
        const taxAmt = parseFloat(invoice.tax || 0);
        const grandTotal = parseFloat(invoice.total || 0);

        return `
            <div class="streamlined-receipt">
                <div class="header">
                    <div class="store-name">${store.name || 'STORE NAME'}</div>
                    <div class="store-details">${getAddressStr(store.address)}</div>
                    <div class="store-details">
                        ${store.contact ? `Ph: ${store.contact}` : ''} 
                        ${gstEnabled && store.gstin ? ` | GSTIN: ${store.gstin}` : ''}
                    </div>
                </div>
                
                <div class="meta-section">
                    <div class="meta-row">
                        <span>Bill: <b>${billNo}</b></span>
                        <span>${dateStr} ${timeStr}</span>
                    </div>
                    <div class="meta-row">
                        <span>${custName}</span>
                        <span>${modeStr}</span>
                    </div>
                </div>

                <table class="items-table">
                    <thead>
                        <tr>
                            <th style="width: 8%;">#</th>
                            <th style="width: 47%;">Item</th>
                            <th style="width: 10%;" class="text-right">Qty</th>
                            <th style="width: 17%;" class="text-right">Rate</th>
                            <th style="width: 18%;" class="text-right">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${(invoice.items || []).map((item, idx) => `
                            <tr>
                                <td>${idx + 1}</td>
                                <td>${item.name}</td>
                                <td class="text-right">${item.quantity}</td>
                                <td class="text-right">${fmt42(item.price)}</td>
                                <td class="text-right">${fmt42(item.total)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>

                <div class="totals-section">
                    <div class="total-row">
                        <span>Subtotal</span>
                        <span>${formatCurrency(subtotal)}</span>
                    </div>
                    ${gstEnabled && taxAmt > 0 ? `
                        <div class="total-row">
                            <span>Tax</span>
                            <span>${formatCurrency(taxAmt)}</span>
                        </div>
                    ` : ''}
                    ${invoice.discount > 0 ? `
                        <div class="total-row" style="color: #059669;">
                            <span>Discount</span>
                            <span>-${formatCurrency(invoice.discount)}</span>
                        </div>
                    ` : ''}
                    
                    <div class="total-row grand-total-row">
                        <span>TOTAL</span>
                        <span>${formatCurrency(grandTotal)}</span>
                    </div>
                </div>

                ${invoice.payments && invoice.payments.length > 1 ? `
                <div class="meta-section" style="margin-top: 15px;">
                    <div style="font-weight: 700; font-size: 11px; margin-bottom: 6px;">Payment Breakdown:</div>
                    ${invoice.payments.map(p => `
                        <div class="meta-row">
                            <span>- ${p.method}</span>
                            <span>${formatCurrency(p.amount)}</span>
                        </div>
                    `).join('')}
                </div>
                ` : ''}

                <div class="footer">
                    <div class="ty-msg">Thank you! Visit again.</div>
                    ${renderInclusiveNote() ? `<div class="inclusive-note">${renderInclusiveNote()}</div>` : ''}
                    ${invoiceSettings.footerNote ? `<div style="margin-top: 10px; font-size: 11px;">${invoiceSettings.footerNote}</div>` : ''}
                </div>
            </div>
        `;
    };

    // === CLASSIC (A4) - REFINED ===
    const getClassicStyles = () => `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        body { font-family: 'Inter', sans-serif; margin: 0; padding: 0; width: 794px; color: #333; background: white; font-size: 11px; line-height: 1.5; }
        .classic-header { display: flex; justify-content: space-between; align-items: flex-start; padding: 30px 40px; }
        .logo-area { width: 120px; height: 120px; display: flex; align-items: center; justify-content: flex-start; }
        .logo-img { max-width: 100%; max-height: 100%; object-fit: contain; }
        .company-info { text-align: right; flex: 1; margin-left: 20px; }
        .invoice-title-text { font-size: 14px; font-weight: 700; color: #888; margin-bottom: 5px; text-transform: uppercase; letter-spacing: 0.5px; }
        .company-name { font-size: 24px; font-weight: 800; color: #111; margin-bottom: 6px; text-transform: uppercase; }
        .addr-line { font-size: 12px; color: #555; margin-bottom: 2px; }
        
        .main-content { padding: 0 40px; border-top: 1px solid #f3f4f6; padding-top: 25px; }
        .meta-grid { display: flex; justify-content: space-between; margin-bottom: 30px; }
        .bill-to { flex: 1; }
        .invoice-details { text-align: right; }
        .label { font-size: 10px; text-transform: uppercase; color: #888; font-weight: 700; margin-bottom: 8px; letter-spacing: 0.5px; }
        .bill-to-name { font-size: 14px; font-weight: 700; color: #111; margin-bottom: 6px; }
        .value-row { display: flex; justify-content: flex-end; gap: 6px; margin-bottom: 4px; font-size: 12px; }
        .value-label { color: #555; }
        .value-data { font-weight: 700; color: #111; }

        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th { background-color: #f9fafb; color: #4b5563; text-transform: uppercase; padding: 12px 10px; text-align: left; font-size: 10px; font-weight: 700; border-top: 1px solid #eee; border-bottom: 1px solid #eee; }
        td { border-bottom: 1px solid #f3f4f6; padding: 12px 10px; vertical-align: middle; color: #374151; font-size: 12px; }
        .th-right, .td-right { text-align: right; }
        .th-center, .td-center { text-align: center; }
        
        .totals-container { display: flex; justify-content: space-between; margin-top: 30px; page-break-inside: avoid; }
        .left-notes { flex: 1; padding-right: 50px; }
        .amount-words-val { font-weight: 700; font-style: italic; font-size: 12px; color: #111; margin-bottom: 25px; }
        .bank-details-box { border: 1px dashed #cbd5e1; padding: 12px; border-radius: 4px; margin-bottom: 20px; background: #fafafa; }
        .bank-details-box .label { margin-bottom: 4px; color: #333; }
        
        .right-totals { width: 320px; }
        .total-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 12px; color: #4b5563; }
        .grand-total { border-top: 2px solid #111; border-bottom: 1px solid #e5e7eb; padding: 12px 0; margin-top: 5px; margin-bottom: 5px; font-weight: 800; font-size: 16px; color: #111; text-transform: uppercase; }
        .balance-due { font-weight: 700; color: #dc2626; }
        
        .footer { margin-top: 50px; padding: 20px 40px; display: flex; justify-content: center; align-items: center; border-top: 1px solid #f3f4f6; }
        .sign-box { text-align: center; display: none; } /* Hidden by default to match image unless signatory needed */
        .classic-footer-text { font-size: 10px; color: #888; }
        
        /* Utility */
        .text-right { text-align: right; }
        .text-center { text-align: center; }
        .text-uppercase { text-transform: uppercase; }
        .font-bold { font-weight: bold; }
        .pb-2 { padding-bottom: 8px; }
`;

    const generateClassicHTML = () => {
        const custName = invoice.customerName || invoice.customer || 'Walk-in Customer';
        // Determine invoice title based on GST enabled
        const invoiceTitle = gstEnabled ? (invoiceSettings.invoiceTitle || 'TAX INVOICE') : 'INVOICE';

        // Use a consistent date format
        const dateStr = new Date(invoice.date).toLocaleDateString('en-GB');

        return `
    <div class="classic-header">
        <div class="logo-area">
            ${invoiceSettings.showLogo && store.logo ? `<img src="${store.logo}" class="logo-img" />` : ''}
        </div>
        <div class="company-info">
            <div class="invoice-title-text">${invoiceTitle}</div>
            <div class="company-name">${store.name || 'Company Name'}</div>
            ${invoiceSettings.showStoreAddress ? `
                <div class="addr-line">${getAddressStr(store.address)}</div>
                <div class="addr-line">Phone: ${store.contact || '-'}</div>
            ` : ''}
            ${gstEnabled && store.gstin ? `<div class="addr-line">GSTIN: <span class="font-bold">${store.gstin}</span></div>` : ''}
        </div>
    </div>

    <div class="main-content">
        <div class="meta-grid">
            <div class="bill-to">
                <div class="label">Bill To</div>
                <div class="bill-to-name">${custName}</div>
                <div class="addr-line">${invoice.customerAddress || ''}</div>
                ${invoice.customerPhone ? `<div class="addr-line">Ph: ${invoice.customerPhone}</div>` : ''}
                ${gstEnabled && invoice.customerGstin ? `<div class="addr-line">GSTIN: ${invoice.customerGstin}</div>` : ''}
            </div>
            <div class="invoice-details">
                <div class="label">Invoice Details</div>
                <div class="value-row"><span class="value-label">Inv No:</span><span class="value-data">${invoice.bill_number || invoice.billNumber || '#' + invoice.id}</span></div>
                <div class="value-row"><span class="value-label">Date:</span><span class="value-data">${dateStr}</span></div>
                ${gstEnabled ? `<div class="value-row"><span class="value-label">POS:</span><span class="value-data">${isInterState ? 'Inter-State' : 'State'}</span></div>` : ''}
                <div class="value-row"><span class="value-label">Pay Mode:</span><span class="value-data">${invoice.payments && invoice.payments.length > 1 ? 'Split' : (invoice.paymentMethod || 'Cash')}</span></div>
            </div>
        </div>

        <table>
            <thead>
                <tr>
                    <th style="width: 5%;">#</th>
                    <th style="width: ${invoiceSettings.showHsn ? '35%' : '45%'}%;">Item Description</th>
                    ${invoiceSettings.showHsn ? '<th class="text-center">HSN</th>' : ''}
                    <th class="th-center">Qty</th>
                    <th class="th-right">${isInvoiceInclusive ? 'Rate (Incl.)' : 'Price'}</th>
                    ${invoiceSettings.showMrp ? '<th class="th-right">MRP</th>' : ''}
                    ${invoiceSettings.showDiscount ? '<th class="th-right">Disc</th>' : ''}
                    <th class="th-right">Total</th>
                </tr>
            </thead>
            <tbody>
                ${invoice.items.map((item, i) => `
                    <tr>
                        <td>${i + 1}</td>
                        <td>
                            <div style="font-weight: 500;">${item.name}</div>
                        </td>
                        ${invoiceSettings.showHsn ? `<td class="td-center" style="color: #666;">${item.hsnCode || '-'}</td>` : ''}
                        <td class="td-center">${item.quantity}</td>
                        <td class="td-right">${formatCurrency(item.price)}</td>
                        ${invoiceSettings.showMrp ? `<td class="td-right">${formatCurrency(item.mrp || 0)}</td>` : ''}
                        ${invoiceSettings.showDiscount ? `<td class="td-right">${formatCurrency(item.discount || 0)}</td>` : ''}
                        <td class="td-right" style="font-weight: 600;">${formatCurrency(item.total)}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>

        <div class="totals-container">
            <div class="left-notes">
                <div class="label">Amount in Words</div>
                <div class="amount-words-val">${amountInWords}</div>

                ${invoiceSettings.showBankDetails && bankDetails && bankDetails.bankName ? `
                <div class="bank-details-box">
                    <div class="label font-bold">Bank Details</div>
                    <div style="font-size: 11px; color: #444;">
                        <div class="pb-2">Bank: <b>${bankDetails.bankName}</b></div>
                        <div class="pb-2">A/c No: <b>${bankDetails.accountNumber}</b></div>
                        <div>IFSC: <b>${bankDetails.ifscCode}</b> &nbsp;&nbsp; Branch: <b>${bankDetails.branch}</b></div>
                    </div>
                </div>
                ` : ''}

                ${invoiceSettings.termsAndConditions ? `
                    <div class="label" style="margin-top: 25px;">Terms & Conditions</div>
                    <div style="font-size: 11px; color: #555; white-space: pre-line; line-height: 1.6;">${invoiceSettings.termsAndConditions}</div>
                ` : ''}

                ${renderInclusiveNote()}
            </div>

            <div class="right-totals">
                <div class="total-row"><span>Subtotal</span><span>${formatCurrency(invoice.subtotal)}</span></div>
                ${invoice.billDiscount > 0 ? `<div class="total-row" style="color: #059669;"><span>Bill Discount</span><span>-${formatCurrency(invoice.billDiscount || invoice.bill_discount)}</span></div>` : ''}
                ${invoice.loyaltyPointsDiscount > 0 || invoice.loyalty_points_discount > 0 ? `<div class="total-row" style="color: #16a34a;"><span>Loyalty Points</span><span>-${formatCurrency(invoice.loyaltyPointsDiscount || invoice.loyalty_points_discount)}</span></div>` : ''}
                ${invoice.additionalCharges > 0 || invoice.additional_charges > 0 ? `<div class="total-row"><span>Additional Charges</span><span>+${formatCurrency(invoice.additionalCharges || invoice.additional_charges)}</span></div>` : ''}
                ${invoice.discount > 0 ? `<div class="total-row" style="color: #059669;"><span>Total Discount</span><span>-${formatCurrency(invoice.discount)}</span></div>` : ''}

                ${gstEnabled && invoice.tax > 0 ? `<div class="total-row"><span>Total Tax</span><span>${formatCurrency(invoice.tax)}</span></div>` : ''}

                ${invoice.roundOff ? `<div class="total-row"><span>Round Off</span><span>${parseFloat(invoice.roundOff).toFixed(2)}</span></div>` : ''}

                <div class="total-row grand-total">
                    <span>GRAND TOTAL</span>
                    <span>${formatCurrency(invoice.total)}</span>
                </div>

                <div class="total-row" style="margin-top: 8px;">
                    <span>Amount Paid</span>
                    <span>${formatCurrency(invoice.amountPaid || 0)}</span>
                </div>
                ${invoice.payments && invoice.payments.length > 1 ? `
                    <div style="font-size: 10px; color: #555; padding-left: 10px; margin-bottom: 8px;">
                        ${invoice.payments.map(p => `
                            <div style="display: flex; justify-content: space-between;">
                                <span>- ${p.method}</span>
                                <span>${formatCurrency(p.amount)}</span>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
                <div class="total-row balance-due">
                    <span>Balance Due</span>
                    <span>${formatCurrency(invoice.balance != null ? invoice.balance : Math.max(0, (invoice.total || 0) - (invoice.amountPaid || 0)))}</span>
                </div>

                ${(invoice.paymentMethod === 'Cash' || !invoice.paymentMethod) && (invoice.amountReceived > invoice.total) ? `
                    <div class="total-row" style="margin-top: 10px; border-top: 1px dashed #e5e7eb; padding-top: 10px;">
                        <span>Cash Received</span>
                        <span>${formatCurrency(invoice.amountReceived)}</span>
                    </div>
                    <div class="total-row" style="font-weight: 700;">
                        <span>Change Return</span>
                        <span>${formatCurrency(invoice.amountReceived - invoice.total)}</span>
                    </div>
                ` : ''}

                ${isInterState === false ? `
                    <div style="margin-top: 12px; font-size: 11px; color: #6b7280; text-align: right;">
                        (CGST: ${formatCurrency(invoice.cgst || 0)} | SGST: ${formatCurrency(invoice.sgst || 0)})
                    </div>
                ` : ''}

                ${invoice.remarks ? `
                    <div style="margin-top: 15px; padding: 12px; background: #f8fafc; border-left: 3px solid #94a3b8; font-size: 11px;">
                        <div style="font-weight: 700; margin-bottom: 4px; color: #475569;">Remarks:</div>
                        <div style="color: #334155;">${invoice.remarks}</div>
                    </div>
                ` : ''}
            </div>
        </div>

        <div class="footer">
            <div class="classic-footer-text">
                Generated by KwiqBill
            </div>
            ${invoiceSettings.showSignature ? `
            <div class="sign-box" style="display: block; margin-left: auto;">
                <div class="sign-space" style="height: 40px;"></div>
                <div style="font-weight: 600; font-size: 12px;">${signatoryLabel}</div>
            </div>
            ` : ''}
        </div>
    </div>
`;
    };

    // === GST DETAILED (A4) - REFINED ===
    const getGstDetailedStyles = () => `
@import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Roboto', Arial, sans-serif; font-size: 10px; line-height: 1.5; color: #000; background: white; padding: 0; }
        .invoice-container { border: 2px solid #000; width: 100%; max-width: 794px; margin: 0 auto; background: white; }
        
        /* Header Section */
        .header-section { display: flex; border-bottom: 2px solid #000; min-height: 120px; }
        .logo-section { width: 23%; border-right: 2px solid #000; padding: 10px; display: flex; align-items: center; justify-content: center; overflow: hidden; }
        .logo-section img { max-width: 100%; max-height: 100%; object-fit: contain; }
        
        .company-section { flex: 1; padding: 15px; text-align: center; display: flex; flex-direction: column; justify-content: center; }
        .company-name { font-size: 22px; font-weight: 700; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px; }
        .company-details { font-size: 11px; margin-bottom: 3px; color: #333; }
        .company-gstin { font-size: 12px; font-weight: 700; margin-top: 6px; }

        /* Title */
        .invoice-title { text-align: center; padding: 8px; border-bottom: 1px solid #000; font-weight: 700; font-size: 16px; letter-spacing: 2px; }
        .rule-reference { text-align: center; padding: 4px; border-bottom: 2px solid #000; font-size: 9px; font-style: italic; }

        /* Top Info Section */
        .top-info-section { display: flex; border-bottom: 2px solid #000; }
        .info-left, .info-right { flex: 1; padding: 10px 15px; }
        .info-left { border-right: 1px solid #000; }
        .info-row { display: flex; margin-bottom: 6px; font-size: 11px; }
        .info-label { font-weight: 700; min-width: 140px; }
        .info-val { font-weight: 400; }

        /* Billing and Consignee Section */
        .details-section { display: flex; border-bottom: 2px solid #000; }
        .detail-box { flex: 1; padding: 12px 15px; }
        .detail-box:first-child { border-right: 1px solid #000; }
        .detail-header { font-weight: 700; margin-bottom: 8px; font-size: 11px; text-transform: uppercase; }
        .detail-content { font-size: 11px; line-height: 1.6; }
        .detail-content-row { display: flex; margin-bottom: 3px; }
        .d-label { font-weight: 700; min-width: 60px; }

        /* Items Table */
        .items-table { width: 100%; border-collapse: collapse; }
        .items-table th { border: 1px solid #000; border-top: none; padding: 8px 4px; font-weight: 700; font-size: 10px; text-align: center; vertical-align: middle; }
        .items-table th:first-child { border-left: none; }
        .items-table th:last-child { border-right: none; }
        
        .items-table td { border: 1px solid #000; padding: 8px 6px; font-size: 10px; vertical-align: middle; }
        .items-table td:first-child { border-left: none; }
        .items-table td:last-child { border-right: none; }
        
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .font-bold { font-weight: 700; }
        
        .total-row td { font-weight: 700; border-bottom: 2px solid #000; border-top: 2px solid #000; padding: 10px 6px; }

        /* Footer Section */
        .footer-section { display: flex; border-bottom: 1px solid #000; }
        .amount-words-section { flex: 1; padding: 15px; border-right: 2px solid #000; }
        .amount-words-label { font-weight: 700; margin-bottom: 8px; font-size: 11px; }
        .amount-words-value { font-style: italic; font-size: 11px; font-weight: 500; }
        
        .tax-summary-section { width: 35%; padding: 0; display: flex; flex-direction: column; }
        .tax-row { display: flex; justify-content: space-between; padding: 8px 12px; border-bottom: 1px solid #000; font-size: 11px; }
        .tax-row:last-child { border-bottom: none; }
        
        .tax-row.sub-total-row { background: #f9f9f9; }
        .tax-row.grand-total-row { background: #f5f5f5; font-weight: 700; border-top: 1px solid #000; border-bottom: 1px solid #000; }
        
        .balance-row { font-weight: 700; color: #dc2626; }

        /* Bottom Section - Bank & Terms */
        .bottom-section { display: flex; }
        .bank-terms-section { flex: 1; padding: 15px; border-right: 1px solid #000; }
        .bt-header { font-weight: 700; margin-bottom: 4px; font-size: 11px; text-transform: uppercase; }
        .bt-content { font-size: 10px; margin-bottom: 15px; line-height: 1.5; }
        
        .signature-section { width: 35%; padding: 15px; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; }
        .sig-text { font-size: 10px; text-align: center; margin-bottom: 40px; }
        .sig-line { width: 80%; border-bottom: 1px solid #000; margin-bottom: 5px; }
        .sig-label { font-weight: 700; font-size: 11px; }
`;

    const generateGstDetailedHTML = () => {
        // Calculate totals
        let subtotal = 0;
        let totalCGST = 0;
        let totalSGST = 0;
        let totalIGST = 0;
        let totalTax = 0;

        invoice.items.forEach(item => {
            const tax = getItemTaxDetails(item);
            subtotal += tax.taxableValue;
            totalCGST += tax.cgstAmt;
            totalSGST += tax.sgstAmt;
            totalIGST += tax.igstAmt;
            totalTax += tax.totalTax;
        });

        const grandTotal = invoice.total || 0;
        const invoiceTitle = gstEnabled ? (invoiceSettings.invoiceTitle || 'TAX INVOICE') : 'INVOICE';
        const dateStr = new Date(invoice.date).toLocaleDateString('en-GB');

        // Customer details helper
        const custName = invoice.customerName || invoice.customer || 'Cash Customer';

        return `
    <div class="invoice-container">
        <!-- Header Section -->
        <div class="header-section">
            <div class="logo-section">
                ${invoiceSettings.showLogo && store.logo ? `<img src="${store.logo}" />` : `<div style="font-size: 18px; font-weight: bold; text-align: center;">${store.name || 'LOGO'}</div>`}
            </div>
            <div class="company-section">
                <div class="company-name">${store.name || 'Company Name'}</div>
                ${invoiceSettings.showStoreAddress ? `
                    <div class="company-details">${getAddressStr(store.address).toUpperCase()}</div>
                    <div class="company-details">Tel: ${store.contact || '-'}</div>
                ` : ''}
                ${gstEnabled && store.gstin ? `<div class="company-gstin">GSTIN: <span class="font-bold">${store.gstin}</span></div>` : ''}
            </div>
        </div>
        
        <!-- Title -->
        <div class="invoice-title">${invoiceTitle}</div>
        
        ${gstEnabled ? `<div class="rule-reference">(See rule 7 for a tax invoice referred to in section 31)</div>` : ''}
        
        <!-- Top Info Section -->
        <div class="top-info-section">
            <div class="info-left">
                <div class="info-row">
                    <span class="info-label">Invoice No:</span>
                    <span class="info-val">${invoice.bill_number || invoice.billNumber || invoice.invoiceNumber || '#' + invoice.id}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Invoice Date:</span>
                    <span class="info-val">${dateStr}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Reverse Charge (Y/N):</span>
                    <span class="info-val">No</span>
                </div>
                <div class="info-row">
                    <span class="info-label">State:</span>
                    <span class="info-val" style="text-transform: uppercase;">${store.address?.state || '-'}</span>
                </div>
            </div>
            <div class="info-right">
                <div class="info-row">
                    <span class="info-label">Transport Mode:</span>
                    <span class="info-val">${invoice?.transportMode || settings.invoice?.transportMode || '-'}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Vehicle Number:</span>
                    <span class="info-val">${invoice?.vehicleNumber || settings.invoice?.vehicleNumber || '-'}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Date of Supply:</span>
                    <span class="info-val">${dateStr}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Place of Supply:</span>
                    <span class="info-val">${invoice?.placeOfSupply || settings.invoice?.placeOfSupply || 'Local'}</span>
                </div>
            </div>
        </div>
        
        <!-- Billing and Consignee Section -->
        <div class="details-section">
            <div class="detail-box">
                <div class="detail-header">Detail of Receiver (Billed to)</div>
                <div class="detail-content">
                    <div class="detail-content-row"><span class="d-label">Name:</span> <span>${custName}</span></div>
                    <div class="detail-content-row"><span class="d-label">Address:</span> <span>${invoice.customerAddress || '-'}</span></div>
                    ${gstEnabled ? `<div class="detail-content-row"><span class="d-label">GSTIN:</span> <span>${invoice.customerGstin || '-'}</span></div>` : ''}
                    <div class="detail-content-row"><span class="d-label">Phone:</span> <span>${invoice.customerPhone || invoice.customerMobile || '-'}</span></div>
                    <div class="detail-content-row"><span class="d-label">State:</span> <span>${invoice.customerState || '-'}</span></div>
                </div>
            </div>
            <div class="detail-box">
                <div class="detail-header">Detail of Consignee (Shipped to)</div>
                <div class="detail-content">
                    <div class="detail-content-row"><span class="d-label">Name:</span> <span>${custName}</span></div>
                    <div class="detail-content-row"><span class="d-label">Address:</span> <span>${invoice.customerAddress || '-'}</span></div>
                    ${gstEnabled ? `<div class="detail-content-row"><span class="d-label">GSTIN:</span> <span>${invoice.customerGstin || '-'}</span></div>` : ''}
                    <div class="detail-content-row"><span class="d-label">State:</span> <span>${invoice.customerState || '-'}</span></div>
                </div>
            </div>
        </div>
        
        <!-- Items Table -->
        <table class="items-table">
            <thead>
                <tr>
                    <th rowspan="2" style="width: 4%;">S.No</th>
                    <th rowspan="2" style="width: 32%;">Product Description</th>
                    ${invoiceSettings.showHsn ? '<th rowspan="2" style="width: 10%;">HSN/SAC</th>' : ''}
                    <th rowspan="2" style="width: 6%;">Qty</th>
                    <th rowspan="2" style="width: 10%;">Rate</th>
                    <th rowspan="2" style="width: 12%;">Taxable Value</th>
                    ${invoiceSettings.showTaxBreakup && gstEnabled ? (isInterState
                ? '<th colspan="2" style="width: 14%;">IGST</th>'
                : '<th colspan="2" style="width: 12%;">CGST</th><th colspan="2" style="width: 12%;">SGST</th>'
            ) : ''}
                    <th rowspan="2" style="width: 12%;">Total</th>
                </tr>
                ${invoiceSettings.showTaxBreakup && gstEnabled ? `
                <tr>
                    ${isInterState
                    ? '<th>Rate</th><th>Amt</th>'
                    : '<th>Rate</th><th>Amt</th><th>Rate</th><th>Amt</th>'
                }
                </tr>
                ` : ''}
            </thead>
            <tbody>
                ${invoice.items.map((item, index) => {
                    const tax = getItemTaxDetails(item);
                    return `
                        <tr>
                            <td class="text-center">${index + 1}</td>
                            <td>${item.name}</td>
                            ${invoiceSettings.showHsn ? `<td class="text-center">${item.hsnCode || item.hsn || '-'}</td>` : ''}
                            <td class="text-center">${item.quantity}</td>
                            <td class="text-right">${formatCurrency(item.price)}</td>
                            <td class="text-right">${formatCurrency(tax.taxableValue)}</td>
                            ${invoiceSettings.showTaxBreakup && gstEnabled ? (isInterState
                            ? `<td class="text-center">${tax.igstRate}%</td><td class="text-right">${formatCurrency(tax.igstAmt)}</td>`
                            : `<td class="text-center">${tax.cgstRate}%</td><td class="text-right">${formatCurrency(tax.cgstAmt)}</td><td class="text-center">${tax.sgstRate}%</td><td class="text-right">${formatCurrency(tax.sgstAmt)}</td>`
                        ) : ''}
                            <td class="text-right font-bold">${formatCurrency(item.total)}</td>
                        </tr>
                    `;
                }).join('')}
                
                <!-- Total Row -->
                <tr class="total-row">
                    <td colspan="${invoiceSettings.showHsn ? 5 : 4}" class="text-right">Total</td>
                    <td class="text-right">${formatCurrency(subtotal)}</td>
                    ${invoiceSettings.showTaxBreakup && gstEnabled ? (isInterState
                ? `<td></td><td class="text-right">${formatCurrency(totalIGST)}</td>`
                : `<td></td><td class="text-right">${formatCurrency(totalCGST)}</td><td></td><td class="text-right">${formatCurrency(totalSGST)}</td>`
            ) : ''}
                    <td class="text-right">${formatCurrency(grandTotal)}</td>
                </tr>
            </tbody>
        </table>
        
        <!-- Footer Section -->
        <div class="footer-section">
            <div class="amount-words-section">
                <div class="amount-words-label">Total Invoice Amount in Words:</div>
                <div class="amount-words-value">${amountInWords}</div>
            </div>
            <div class="tax-summary-section">
                <div class="tax-row sub-total-row">
                    <span>Total Amount before Tax:</span>
                    <span>${formatCurrency(subtotal)}</span>
                </div>
                ${gstEnabled ? (isInterState
                ? `<div class="tax-row">
                            <span>Add: IGST</span>
                            <span>${formatCurrency(totalIGST)}</span>
                        </div>`
                : `<div class="tax-row">
                            <span>Add: CGST</span>
                            <span>${formatCurrency(totalCGST)}</span>
                        </div>
                        <div class="tax-row">
                            <span>Add: SGST</span>
                            <span>${formatCurrency(totalSGST)}</span>
                        </div>`
            ) : ''}
                
                ${invoice.discount > 0 ? `
                    <div class="tax-row">
                        <span>Less: Discount</span>
                        <span>-${formatCurrency(invoice.discount)}</span>
                    </div>
                ` : ''}
                
                ${gstEnabled ? `
                <div class="tax-row">
                    <span>Total Tax Amount:</span>
                    <span>${formatCurrency(totalTax)}</span>
                </div>
                ` : ''}
                
                <div class="tax-row grand-total-row">
                    <span>Total Amount after Tax:</span>
                    <span>${formatCurrency(grandTotal)}</span>
                </div>
                
                <div class="tax-row">
                    <span>Amount Paid:</span>
                    <span>${formatCurrency(invoice.amountPaid || 0)}</span>
                </div>
                ${invoice.payments && invoice.payments.length > 1 ? `
                    <div style="font-size: 10px; color: #555; padding: 4px 12px; border-bottom: 1px solid #eee;">
                        ${invoice.payments.map(p => `
                            <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
                                <span>- ${p.method}</span>
                                <span>${formatCurrency(p.amount)}</span>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
                <div class="tax-row balance-row">
                    <span>Balance Due:</span>
                    <span>${formatCurrency(invoice.balance != null ? invoice.balance : Math.max(0, (invoice.total || 0) - (invoice.amountPaid || 0)))}</span>
                </div>

                ${(invoice.paymentMethod === 'Cash' || !invoice.paymentMethod) && (invoice.amountReceived > invoice.total) ? `
                    <div class="tax-row" style="border-top: 1px dashed #ccc; padding-top: 8px;">
                        <span>Cash Received:</span>
                        <span>${formatCurrency(invoice.amountReceived)}</span>
                    </div>
                    <div class="tax-row balance-row" style="border-bottom: 0;">
                        <span>Change Return:</span>
                        <span>${formatCurrency(invoice.amountReceived - invoice.total)}</span>
                    </div>
                ` : ''}
            </div>
        </div>
        
        <!-- Bank and Signature Section -->
        <div class="bottom-section" style="${!invoiceSettings.showSignature ? 'border-bottom: 2px solid #000;' : ''}">
            <div class="bank-terms-section">
                ${invoiceSettings.showBankDetails && bankDetails && bankDetails.bankName ? `
                    <div class="bt-header">Bank Details</div>
                    <div class="bt-content">
                        <div>Bank: <strong>${bankDetails.bankName}</strong></div>
                        <div>A/c No: <strong>${bankDetails.accountNumber}</strong></div>
                        <div>IFSC: <strong>${bankDetails.ifscCode}</strong> &nbsp; Branch: <strong>${bankDetails.branch}</strong></div>
                    </div>
                ` : ''}
                <div class="bt-header">Terms & Conditions:</div>
                <div class="bt-content" style="white-space: pre-line;">
                    ${invoiceSettings.termsAndConditions || '1. Goods once sold will not be taken back.\n2. Interest @18% pa will be charged if not paid within due date.'}
                </div>
                ${renderInclusiveNote()}
            </div>
            
            ${invoiceSettings.showSignature ? `
            <div class="signature-section">
                <div class="sig-line"></div>
                <div class="sig-label">Authorised Signatory</div>
                <div style="font-size: 9px; margin-top: 5px;">For ${store.name || 'Company Name'}</div>
            </div>
            ` : ''}
        </div>
    </div>
`;
    };

    // --- 5. Selection & Render ---
    let selectedStyles = getClassicStyles();
    let selectedHTML = generateClassicHTML();

    // === COMPACT / PROFESSIONAL (TEAL) ===
    const getProfessionalStyles = () => `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        body { font-family: 'Inter', sans-serif; margin: 0; padding: 0; width: 794px; color: #333; background: white; font-size: 11px; line-height: 1.5; }

        /* Header block - Dark Teal */
        .prof-header { background-color: #0f766e; color: white; padding: 35px 40px; display: flex; justify-content: space-between; align-items: flex-start; }
        .prof-title { font-size: 42px; font-weight: 800; margin-bottom: 5px; line-height: 1; letter-spacing: -0.5px; }
        .prof-inv-no { font-size: 13px; opacity: 0.9; font-weight: 500; font-family: monospace; }
        
        .prof-company { text-align: right; }
        .prof-company-name { font-size: 22px; font-weight: 700; margin-bottom: 5px; text-transform: uppercase; letter-spacing: 0.5px; }
        .prof-company-addr { font-size: 11px; opacity: 0.9; max-width: 250px; margin-left: auto; line-height: 1.5; }

        /* Meta Grid */
        .prof-meta { padding: 35px 40px 25px; display: flex; justify-content: space-between; align-items: flex-start; }
        .prof-bill-to-label { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #888; font-weight: 700; margin-bottom: 12px; }
        .prof-customer-name { font-size: 16px; font-weight: 700; color: #111; margin-bottom: 6px; }
        .prof-customer-details { font-size: 12px; color: #555; line-height: 1.6; }
        
        .prof-dates { text-align: right; margin-top: 25px; }
        .prof-date-row { display: flex; justify-content: flex-end; gap: 20px; margin-bottom: 8px; font-size: 12px; }
        .prof-date-label { text-transform: uppercase; color: #888; font-weight: 600; font-size: 10px; padding-top: 2px; letter-spacing: 0.5px; }
        .prof-date-val { font-weight: 700; color: #111; width: 85px; text-align: right; }

        /* Table */
        .prof-table-container { padding: 0 40px; margin-bottom: 30px; }
        table { width: 100%; border-collapse: collapse; }
        th { text-align: left; padding: 12px 0; color: #888; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e5e7eb; border-top: 1px solid #f3f4f6; }
        td { padding: 16px 0; border-bottom: 1px solid #f9fafb; color: #1f2937; font-size: 12px; font-weight: 500; }
        .th-right, .td-right { text-align: right; }
        .th-center, .td-center { text-align: center; }

        /* GST Summary */
        .gst-summary-table { margin-top: 30px; margin-bottom: 20px; }
        .gst-summary-title { font-size: 10px; font-weight: 700; color: #555; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
        
        /* Footer & Totals */
        .prof-footer { display: flex; justify-content: space-between; padding: 20px 40px 40px; page-break-inside: avoid; }
        
        /* Notes section matching image styling (light teal background w/ teal left border) */
        .prof-notes { flex: 1; padding-right: 60px; display: flex; flex-direction: column; justify-content: flex-end; }
        .prof-notes-box { background-color: #f0fdf4; padding: 16px 20px; border-radius: 4px; border-left: 3px solid #0f766e; margin-bottom: 25px; }
        .prof-notes-title { color: #0f766e; font-weight: 700; font-size: 10px; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px; }
        .prof-notes-text { font-size: 11px; color: #374151; line-height: 1.5; }
        .prof-terms { font-size: 10px; color: #666; line-height: 1.5; }
        
        .prof-totals { width: 320px; border-top: 1px solid #f3f4f6; padding-top: 10px; }
        .prof-total-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 12px; color: #4b5563; }
        .prof-total-label { font-weight: 500; }
        .prof-total-val { font-weight: 700; color: #111; }
        
        .prof-grand-total { border-top: 1px solid #e5e7eb; padding-top: 12px; margin-top: 4px; display: flex; justify-content: space-between; align-items: center; }
        .prof-grand-label { font-weight: 700; font-size: 12px; text-transform: uppercase; color: #4b5563;}
        .prof-grand-val { font-size: 16px; font-weight: 800; color: #111; }
`;

    const generateProfessionalHTML = () => {
        const custName = invoice.customerName || invoice.customer || 'Walk-in Customer';
        const dateStr = new Date(invoice.date).toLocaleDateString('en-GB');

        // Calculate GST Summary
        const summary = {};
        invoice.items.forEach(item => {
            const taxRate = parseFloat(item.taxRate || 0);
            if (!summary[taxRate]) {
                summary[taxRate] = { taxable: 0, cgst: 0, sgst: 0, igst: 0, totalTax: 0 };
            }
            summary[taxRate].taxable += (item.taxableValue || 0);
            summary[taxRate].cgst += (item.cgst || 0);
            summary[taxRate].sgst += (item.sgst || 0);
            summary[taxRate].igst += (item.igst || 0);
            summary[taxRate].totalTax += (item.totalTax || 0);
        });
        const sortedRates = Object.keys(summary).sort((a, b) => parseFloat(a) - parseFloat(b));

        const gstHtml = sortedRates.length > 0 ? `
            <div class="gst-summary-table">
                <div class="gst-summary-title">GST Summary</div>
                <table>
                    <thead>
                        <tr>
                            <th style="padding: 10px 0;">RATE</th>
                            <th style="padding: 10px 0; text-align: right;">TAXABLE VALUE</th>
                            ${isInterState
                ? `<th style="padding: 10px 0; text-align: right;">IGST</th>`
                : `<th style="padding: 10px 0; text-align: right;">CGST</th><th style="padding: 10px 0; text-align: right;">SGST</th>`
            }
                        </tr>
                    </thead>
                    <tbody>
                        ${sortedRates.map(rate => {
                const row = summary[rate];
                return `
                                <tr>
                                    <td style="padding: 12px 0; color: #374151;">${rate}%</td>
                                    <td style="padding: 12px 0; color: #374151; text-align: right;">${formatCurrency(row.taxable)}</td>
                                    ${isInterState
                        ? `<td style="padding: 12px 0; color: #374151; text-align: right;">${formatCurrency(row.igst)}</td>`
                        : `<td style="padding: 12px 0; color: #374151; text-align: right;">${formatCurrency(row.cgst)}</td><td style="padding: 12px 0; color: #374151; text-align: right;">${formatCurrency(row.sgst)}</td>`
                    }
                                </tr>
                            `;
            }).join('')}
                    </tbody>
                </table>
            </div>
    ` : '';

        return `
    <div class="prof-header">
        <div>
            <div class="prof-title">Invoice</div>
            <div class="prof-inv-no">Bill no:${invoice.bill_number || invoice.billNumber || '#' + invoice.id}</div>
        </div>
        <div class="prof-company">
            <div class="prof-company-name">${store.name || 'Company Name'}</div>
            <div class="prof-company-addr">
                ${store.address ? getAddressStr(store.address).replace(/, /g, ',<br/>') : ''}
                ${store.contact ? `<br/>Phone: ${store.contact}` : ''}
                ${gstEnabled && store.gstin ? `<br/>GSTIN: ${store.gstin}` : ''}
            </div>
        </div>
    </div>

    <div class="prof-meta">
        <div>
            <div class="prof-bill-to-label">BILL TO</div>
            <div class="prof-customer-name">${custName}</div>
            <div class="prof-customer-details">
                ${invoice.customerGstin ? `<div>GSTIN: ${invoice.customerGstin}</div>` : ''}
                ${invoice.customerPhone ? `<div>Ph: ${invoice.customerPhone}</div>` : ''}
                <div style="max-width: 250px; margin-top: 4px;">${invoice.customerAddress || ''}</div>
            </div>
        </div>
        <div class="prof-dates">
            <div class="prof-date-row">
                <div class="prof-date-label">INVOICE DATE</div>
                <div class="prof-date-val">${dateStr}</div>
            </div>
            <div class="prof-date-row">
                <div class="prof-date-label">DUE DATE</div>
                <div class="prof-date-val">${dateStr}</div>
            </div>
        </div>
    </div>

    <div class="prof-table-container">
        <table>
            <thead>
                <tr>
                    <th width="50%">ITEM DESCRIPTION</th>
                    <th width="12%" class="th-center">QTY</th>
                    <th width="15%" class="th-right">PRICE</th>
                    <th width="8%" class="th-right">TAX</th>
                    <th width="15%" class="th-right">AMOUNT</th>
                </tr>
            </thead>
            <tbody>
                ${invoice.items.map(item => `
                    <tr>
                        <td>
                            <div style="color: #111; font-weight: 500;">${item.name}</div>
                        </td>
                        <td class="td-center">${item.quantity}</td>
                        <td class="td-right">${formatCurrency(item.price)}</td>
                        <td class="td-right">${item.taxRate || 0}%</td>
                        <td class="td-right" style="font-weight: 600;">${formatCurrency(item.total)}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>

        ${gstHtml}
    </div>

    <div class="prof-footer">
        <div class="prof-notes">
            <div class="prof-notes-box">
                <div class="prof-notes-title">NOTES</div>
                <div class="prof-notes-text">${invoiceSettings.footerNote || 'Thank you for your business!'}</div>
            </div>

            ${invoiceSettings.termsAndConditions ? `
                <div style="font-weight: 700; font-size: 10px; color: #4b5563; margin-bottom: 4px; text-transform: uppercase;">Terms:</div>
                <div class="prof-terms" style="white-space: pre-line;">${invoiceSettings.termsAndConditions}</div>
            ` : ''}
        </div>

        <div class="prof-totals">
            <div class="prof-total-row">
                <span class="prof-total-label">Subtotal</span>
                <span class="prof-total-val">${formatCurrency(invoice.subtotal)}</span>
            </div>
            ${invoice.loyaltyPointsDiscount > 0 || invoice.loyalty_points_discount > 0 ? `
                <div class="prof-total-row">
                    <span class="prof-total-label">Loyalty Points</span>
                    <span class="prof-total-val" style="color: #059669;">-${formatCurrency(invoice.loyaltyPointsDiscount || invoice.loyalty_points_discount)}</span>
                </div>
            ` : ''}
            ${invoice.additionalCharges > 0 || invoice.additional_charges > 0 ? `
                <div class="prof-total-row">
                    <span class="prof-total-label">Additional Charges</span>
                    <span class="prof-total-val">+${formatCurrency(invoice.additionalCharges || invoice.additional_charges)}</span>
                </div>
            ` : ''}
            ${invoice.discount > 0 ? `
                <div class="prof-total-row">
                    <span class="prof-total-label">Discount</span>
                    <span class="prof-total-val" style="color: #059669;">-${formatCurrency(invoice.discount)}</span>
                </div>
            ` : ''}
            ${gstEnabled && invoice.tax > 0 ? `
                <div class="prof-total-row">
                    <span class="prof-total-label">Tax (GST)</span>
                    <span class="prof-total-val">${formatCurrency(invoice.tax)}</span>
                </div>
            ` : ''}
            ${invoice.roundOff ? `
                <div class="prof-total-row">
                    <span class="prof-total-label">Round Off</span>
                    <span class="prof-total-val">${parseFloat(invoice.roundOff).toFixed(2)}</span>
                </div>
            ` : ''}

            <div class="prof-grand-total">
                <span class="prof-grand-label">TOTAL</span>
                <span class="prof-grand-val">${formatCurrency(invoice.total)}</span>
            </div>
            
            ${(invoice.amountPaid || 0) > 0 || (invoice.paymentMethod === 'Cash' || !invoice.paymentMethod) && (invoice.amountReceived > invoice.total) ? `
                <div style="margin-top: 15px; border-top: 1px dashed #e5e7eb; padding-top: 10px;">
                    <div class="prof-total-row">
                        <span class="prof-total-label">Amount Paid</span>
                        <span class="prof-total-val">${formatCurrency(invoice.amountPaid || 0)}</span>
                    </div>

                    ${invoice.payments && invoice.payments.length > 1 ? `
                        <div style="font-size: 10px; color: #555; padding-left: 10px; margin-bottom: 8px;">
                            ${invoice.payments.map(p => `
                                <div style="display: flex; justify-content: space-between;">
                                    <span>- ${p.method}</span>
                                    <span>${formatCurrency(p.amount)}</span>
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                    
                    ${(invoice.payments && invoice.payments.length <= 1) && (invoice.paymentMethod === 'Cash' || !invoice.paymentMethod) && (invoice.amountReceived > invoice.total) ? `
                        <div class="prof-total-row">
                            <span class="prof-total-label">Cash Received</span>
                            <span class="prof-total-val">${formatCurrency(invoice.amountReceived)}</span>
                        </div>
                        <div class="prof-total-row">
                            <span class="prof-total-label">Change Return</span>
                            <span class="prof-total-val">${formatCurrency(invoice.amountReceived - invoice.total)}</span>
                        </div>
                    ` : ''}
                    
                    <div class="prof-total-row" style="margin-top: 4px;">
                        <span class="prof-total-label" style="color: #dc2626;">Balance Due</span>
                        <span class="prof-total-val" style="color: #dc2626;">${formatCurrency(invoice.balance != null ? invoice.balance : Math.max(0, (invoice.total || 0) - (invoice.amountPaid || 0)))}</span>
                    </div>
                </div>
            ` : ''}
        </div>
    </div>
`;
    };

    // Map templates
    // Use options.template if provided (for preview mode), otherwise use settings
    const templateName = options.template || invoiceSettings.template || 'Classic';
    if (templateName === 'Express' || templateName === 'Modern') {
        // Support both Express and Modern for backward compatibility
        selectedStyles = getExpressStyles();
        selectedHTML = generateExpressHTML();
    } else if (templateName === 'Streamlined' || templateName === 'Minimal') {
        // Support both Streamlined and Minimal for backward compatibility
        selectedStyles = getStreamlinedStyles();
        selectedHTML = generateStreamlinedHTML();
    } else if (templateName === 'GST-Detailed') {
        selectedStyles = getGstDetailedStyles();
        selectedHTML = generateGstDetailedHTML();
    } else if (templateName === 'Compact') { // Professional
        selectedStyles = getProfessionalStyles();
        selectedHTML = generateProfessionalHTML();
    }

    // --- Dynamic Page Settings ---
    const printSettings = settings.print || {};
    const margins = printSettings.margins || { top: 0, right: 0, bottom: 0, left: 0 };
    const orientation = printSettings.orientation || 'portrait';
    const scale = printSettings.scale || 100;

    // Map internal paper size names to CSS size values
    const paperSizeMap = {
        'A4': 'A4',
        'A5': 'A5',
        'Thermal-3inch': '80mm auto', // approx 
        'Thermal-2inch': '58mm auto'
    };
    const cssSize = paperSizeMap[invoiceSettings.paperSize] || 'auto';

    const pageRules = isThermalPrinter ? `
@page {
    size: 80mm;
    margin: 0;
}
html, body {
    width: ${options.preview ? 'auto' : '76mm'};
    max-width: ${options.preview ? '100%' : '76mm'};
    margin: 0;
    padding: ${options.preview ? '0' : '2mm'};
    font-family: "Courier New", monospace;
    font-size: 12px;
    line-height: 1.3;
    transform: none !important;
    overflow: ${options.preview ? 'visible' : 'hidden'};
}
        table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
}
td, th {
    overflow: hidden;
    text-overflow: ellipsis;
}
        td {
    white-space: nowrap;
}
td:first-child {
    white-space: normal;
}
        * {
    page-break-inside: avoid;
        }
` : `
@page {
    size: ${cssSize} ${orientation};
    margin: ${margins.top}mm ${margins.right}mm ${margins.bottom}mm ${margins.left}mm;
}
        body {
    transform: scale(${scale / 100});
    transform-origin: top left;
    width: ${scale !== 100 ? `${(100 * 100 / scale)}%` : 'auto'};
    overflow: hidden;
        }
`;

    const htmlContent = `
        <html>
            <head>
                <title>Print</title>
                <style>
                    ${selectedStyles}
                    ${pageRules}
                    @media print {body {-webkit - print - color - adjust: exact; } }
                </style>
            </head>
            <body>
                ${selectedHTML}
                <script>
                window.onload = () => {window.print(); }
                </script>
            </body>
        </html>
`;

    // If preview mode, return HTML without opening window
    if (options.preview) {
        return htmlContent;
    }

    // --- Debug Routing Logs ---
    console.log("[PRINT ROUTER] Paper Size:", invoiceSettings.paperSize);
    console.log("[PRINT ROUTER] Thermal Detected:", isThermalPrinter);
    console.log("[PRINT ROUTER] ESC/POS bridge available:", !!window.electron?.printThermal);

    // --- HTML Fallback: used when ESC/POS is unavailable or fails ---
    function fallbackHTMLPrint() {
        if (!window.electron || !window.electron.printReceipt) return;

        // GUARD: If silent print is on but no printer is selected, "Print to PDF" (default)
        // will trigger a save dialog. Skip to avoid unexpected save dialogs.
        if ((settings.print?.silentPrint ?? true) && !settings.print?.printerName) {
            console.warn("[PRINT ROUTER] Silent Print skipped: No printer selected. (Avoids 'Save As' dialog)");
            return;
        }

        const printOptions = {
            printerName: settings.print?.printerName,
            silent: settings.print?.silentPrint ?? true
        };

        if (isThermalPrinter) {
            printOptions.silent = true;
            printOptions.printBackground = true;
            printOptions.margins = { marginType: "none" };
            printOptions.pageSize = { width: 80000, height: 200000 };
        }

        console.log("[PRINT ROUTER] Attempting HTML print with options:", printOptions);
        window.electron.printReceipt(htmlContent, printOptions)
            .then(() => console.log("[PRINT ROUTER] HTML print initiated successfully"))
            .catch(err => console.error("[PRINT ROUTER] HTML print failed", err));
    }

    // --- ESC/POS THERMAL PATH (Priority 1) — bypasses HTML rendering entirely ---
    // Only use ESC/POS for compatible templates (Express, Streamlined, Modern, Minimal)
    const thermalTemplates = ['Express', 'Streamlined', 'Modern', 'Minimal'];
    const isThermalTemplate = thermalTemplates.includes(templateName);

    if (isThermalTemplate && window.electron?.printThermal) {
        console.log("[PRINT ROUTER] Using ESC/POS pipeline for template: ", templateName);

        window.electron.printThermal(invoice, settings)
            .then(result => {
                if (!result?.success) {
                    console.warn("[PRINT ROUTER] ESC/POS failed.", result?.message);
                    alert(`ESC/POS Print Failed: ${result?.message || 'Unknown error'}`);
                } else {
                    console.log("[PRINT ROUTER] ESC/POS print succeeded:", result.message);
                }
            })
            .catch(err => {
                console.error("[PRINT ROUTER] ESC/POS error:", err);
                alert(`ESC/POS Print Error: ${err.message || 'Unknown error'}`);
            });

        return; // Do NOT fall through — ESC/POS takes over
    }

    // --- HTML PRINTING PATH (A4 / non-thermal / no ESC/POS bridge) ---
    if (window.electron && window.electron.printReceipt) {
        fallbackHTMLPrint();
        return;
    }

    // Fallback for Web Mode (iframe method)
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    // Write content to iframe
    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(htmlContent);
    doc.close();

    // specific handler for iframe printing
    iframe.onload = () => {
        try {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
        } catch (e) {
            console.error('Printing failed', e);
        } finally {
            // Remove iframe after sufficient time
            setTimeout(() => {
                document.body.removeChild(iframe);
            }, 60000);
        }
    };
};
