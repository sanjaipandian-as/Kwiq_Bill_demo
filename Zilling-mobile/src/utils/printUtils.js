import * as Print from 'expo-print';
import { shareAsync } from 'expo-sharing';
import { Alert } from 'react-native';
import { exportToDeviceFolders } from '../services/backupservices';
import { fetchAllTableData } from '../services/database';

/**
 * Utility to convert numbers to words (e.g., for GST invoices)
 */
export const numberToWords = (num) => {
    if (num === 0) return 'Zero Only';
    const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    const inWords = (n) => {
        if ((n = n.toString()).length > 9) return 'overflow';
        let n_arr = ('000000000' + n).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
        if (!n_arr) return '';
        let str = '';
        str += n_arr[1] != 0 ? (a[Number(n_arr[1])] || b[n_arr[1][0]] + ' ' + a[n_arr[1][1]]) + 'Crore ' : '';
        str += n_arr[2] != 0 ? (a[Number(n_arr[2])] || b[n_arr[2][0]] + ' ' + a[n_arr[2][1]]) + 'Lakh ' : '';
        str += n_arr[3] != 0 ? (a[Number(n_arr[3])] || b[n_arr[3][0]] + ' ' + a[n_arr[3][1]]) + 'Thousand ' : '';
        str += n_arr[4] != 0 ? a[Number(n_arr[4])] + 'Hundred ' : '';
        str += n_arr[5] != 0 ? ((str != '') ? 'and ' : '') + (a[Number(n_arr[5])] || b[n_arr[5][0]] + ' ' + a[n_arr[5][1]]) : '';
        return str;
    };

    const normalizedNum = Number(num || 0);
    const [integerPart, decimalPart] = normalizedNum.toFixed(2).split('.');
    let words = inWords(integerPart) + 'Rupees ';
    if (decimalPart && decimalPart !== '00') {
        words += 'and ' + inWords(decimalPart) + 'Paise ';
    }
    return words + 'Only';
};

const generateThermalReceiptHTML = (bill, settings, mode = 'invoice') => {
    const paperSize = settings?.invoice?.paperSize || '80mm';
    // ... (rest of logic) ...
    // Title Logic
    const title = mode === 'customer' ? 'BILL' : 'TAX INVOICE';

    const width = paperSize === '58mm' ? '100%' : '100%';
    const storeName = settings?.store?.name || 'Store Name';
    const storeAddressObj = settings?.store?.address || {};
    const storeAddress = `${storeAddressObj.street || ''}, ${storeAddressObj.city || ''} ${storeAddressObj.zip || ''}`;
    const storePhone = settings?.store?.contact || settings?.store?.phone || '';
    const storeGstin = settings?.store?.gstin || '';

    const items = bill.cart || bill.items || [];
    const customer = bill.customer || {};
    const customerName = bill.customerName || customer.fullName || customer.name || 'Walk-in Customer';
    const date = new Date(bill.date || Date.now());
    const dateStr = date.toLocaleDateString('en-GB'); // DD/MM/YYYY
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Calculate Totals
    const totalQty = items.reduce((acc, item) => acc + (parseFloat(item.quantity) || 0), 0);
    const subtotal = bill.totals?.subtotal || bill.subtotal || 0;
    const totalForRound = bill.totals?.total || bill.total || 0;

    // Exact rounding logic to match "Round Off: +0.18" style if needed, 
    // or just display what's in DB if stored.
    const roundOff = bill.totals?.roundOff || 0;

    // Tax Summary
    const taxSummary = {};
    items.forEach(item => {
        const rate = parseFloat(item.taxRate || 0);
        const price = parseFloat(item.price || item.sellingPrice || 0);
        const qty = parseFloat(item.quantity || 0);
        const taxable = price * qty;
        const taxVal = taxable * (rate / 100);

        if (!taxSummary[rate]) taxSummary[rate] = { taxable: 0, tax: 0 };
        taxSummary[rate].taxable += taxable;
        taxSummary[rate].tax += taxVal;
    });

    const paymentMode = (bill.payments && bill.payments.length > 0) ? bill.payments[0].method : (bill.paymentType || 'Cash');

    const styles = `
        body { font-family: 'Courier New', monospace; font-size: 12px; margin: 0; padding: 5px; color: #000; }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .text-left { text-align: left; }
        .bold { font-weight: bold; }
        .dashed { border-bottom: 1px dashed #000; margin: 5px 0; display: block; }
        .header { margin-bottom: 5px; }
        .store-name { font-size: 16px; font-weight: 800; text-transform: uppercase; }
        .meta-table { width: 100%; font-size: 12px; }
        .item-table { width: 100%; border-collapse: collapse; }
        .item-table th { text-align: right; font-weight: normal; border-bottom: 1px dashed #000; padding: 2px 0; }
        .item-table th:first-child, .item-table th:nth-child(2) { text-align: left; }
        
        .item-row td { vertical-align: top; padding-top: 4px; }
        .item-details-row { font-size: 11px; }
        .gst-table { width: 100%; border-collapse: collapse; margin-top: 5px; border: 1px dashed #000; }
        .gst-table th, .gst-table td { border: 1px dashed #000; padding: 3px; text-align: right; font-size: 10px; }
        .gst-table th:first-child, .gst-table td:first-child { text-align: center; }
        
        .footer { margin-top: 10px; text-align: center; font-size: 12px; }
        .big-total { font-size: 12px; font-weight: 00; } /* Matches visual weight */
        .saved-msg { margin: 10px 0; font-weight: bold; font-size: 12px; }
    `;

    return `
    <html>
        <head><style>${styles}</style></head>
        <body>
            <div class="header text-center">
                <div class="store-name">${storeName}</div>
                <div>${storeAddress}</div>
                <div>Phone: ${storePhone}</div>
                ${storeGstin ? `<div>GSTIN: ${storeGstin}</div>` : ''}
            </div>
            
            <div class="dashed"></div>
            <div class="text-center bold">${title}</div>
            <div class="dashed"></div>
            
            <table class="meta-table">
                <tr>
                    <td class="text-left">Bill No: ${bill.id || '-'}</td>
                    <td class="text-right">Inv No: ${(bill.invoiceNumber || bill.id || '').slice(-6)}</td>
                </tr>
                <tr>
                    <td class="text-left">Bill Dt: ${dateStr}</td>
                    <td class="text-right">Time: ${timeStr}</td>
                </tr>
                <tr>
                    <td class="text-left">Customer: ${customerName.split(' ')[0]}</td>
                    <td class="text-right">Mode: ${paymentMode}</td>
                </tr>
                <tr>
                    <td class="text-left">Status: <span class="bold">${(bill.status || 'Paid').toUpperCase()}</span></td>
                    <td class="text-right"></td>
                </tr>
            </table>
            
            <div class="dashed"></div>
            
            <table class="item-table">
                <thead>
                    <tr>
                        <th width="30">S.NO</th>
                        <th>Item</th>
                        <th width="30">Qty</th>
                        <th width="50">Rate</th>
                        <th width="60">Amt</th>
                    </tr>
                </thead>
                <tbody>
    ${items.map((item, i) => {
        const tr = parseFloat(item.taxRate || 0);
        const isInter = bill.taxType === 'inter';
        const taxLabel = isInter ? `IGST @ ${tr}%` : `CGST @ ${tr / 2}% SGST @ ${tr / 2}%`;
        return `
                        <tr>
                            <td colspan="5" style="padding-top: 4px; font-size: 11px;">${i + 1}) ${taxLabel}</td>
                        </tr>
                        <tr>
                            <td colspan="5" style="padding-left: 15px;">${item.name} ${item.variantName ? `(${item.variantName})` : ''}</td>
                        </tr>
                        <tr>
                            <td></td>
                            <td></td>
                            <td class="text-center">${item.quantity}</td>
                            <td class="text-right">${parseFloat(item.price || item.sellingPrice).toFixed(2)}</td>
                            <td class="text-right">${parseFloat(item.total).toFixed(2)}</td>
                        </tr>
                        `;
    }).join('')}
                </tbody>
            </table>
            
                <div style="display: flex; justify-content: space-between;">
                    <span>Subtotal (Taxable):</span> <span>₹${subtotal.toFixed(2)}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span>Total Tax:</span> <span>₹${(bill.totals?.tax || bill.tax || 0).toFixed(2)}</span>
                </div>
                ${(bill.additionalCharges || bill.totals?.additionalCharges) ? `
                <div style="display: flex; justify-content: space-between;">
                    <span>Extra Charges:</span> <span>₹${parseFloat(bill.additionalCharges || bill.totals?.additionalCharges).toFixed(2)}</span>
                </div>
                ` : ''}
                ${(bill.discount || bill.totals?.discount) ? `
                <div style="display: flex; justify-content: space-between;">
                    <span>Bill Discount:</span> <span>-₹${parseFloat(bill.discount || bill.totals?.discount).toFixed(2)}</span>
                </div>
                ` : ''}
                ${(bill.loyaltyPointsDiscount || bill.totals?.loyaltyPointsDiscount) ? `
                <div style="display: flex; justify-content: space-between; color: #10b981;">
                    <span>Loyalty Disc:</span> <span>-₹${parseFloat(bill.loyaltyPointsDiscount || bill.totals?.loyaltyPointsDiscount).toFixed(2)}</span>
                </div>
                ` : ''}
                <div style="display: flex; justify-content: space-between;">
                    <span>Round Off:</span> <span>${roundOff > 0 ? '+' : ''}${roundOff.toFixed(2)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-top: 4px; border-top: 1px dashed #000; padding-top: 4px;">
                    <span>Amount Received:</span> <span>₹${(bill.amountReceived || 0).toFixed(2)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-weight: bold; color: ${totalForRound > (bill.amountReceived || 0) ? '#ef4444' : '#000'};">
                    <span>Balance Due:</span> <span>₹${Math.max(0, totalForRound - (bill.amountReceived || 0)).toFixed(2)}</span>
                </div>
            </div>
            
            <div class="dashed"></div>
            
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 2px 0;">
                <div>Items: ${items.length}</div>
                <div>Qty: ${totalQty}</div>
                <div style="text-align: right; font-size: 16px; font-weight: bold;">₹${totalForRound.toFixed(2)}</div>
            </div>
            
            <div class="dashed"></div>
            
            <div style="font-weight: bold; margin-bottom: 2px;">GST SUMMARY</div>
            <table class="gst-table">
                <thead>
                    <tr>
                        <th>GST%</th>
                        <th>Taxable</th>
                        ${bill.taxType === 'inter' ? '<th>IGST</th>' : '<th>CGST</th><th>SGST</th>'}
                    </tr>
                </thead>
                <tbody>
                    ${Object.keys(taxSummary).length > 0 ? Object.keys(taxSummary).map(rate => (
        `<tr>
                            <td>${rate}%</td>
                            <td>${taxSummary[rate].taxable.toFixed(2)}</td>
                            ${bill.taxType === 'inter'
            ? `<td>${taxSummary[rate].tax.toFixed(2)}</td>`
            : `<td>${(taxSummary[rate].tax / 2).toFixed(2)}</td><td>${(taxSummary[rate].tax / 2).toFixed(2)}</td>`
        }
                        </tr>`
    )).join('') : '<tr><td colspan="4" class="text-center">No Tax Details</td></tr>'}
                </tbody>
            </table>
            
           <div class="dashed"></div>
           
           <div style="display: flex; justify-content: space-between; font-weight: bold;">
               <div>${paymentMode}: ₹${totalForRound.toFixed(2)}</div>
               <!-- <div>Balance: ₹0.00</div> --> 
           </div>
           
           <!-- Calculate Savings -->
           ${items.some(i => i.mrp && i.mrp > i.price) ? `
               <div class="dashed"></div>
               <div class="text-center saved-msg">** Saved ₹${items.reduce((acc, i) => acc + ((i.mrp || i.price) - i.price) * i.quantity, 0).toFixed(2)} on MRP **</div>
           ` : ''}
           
           <div class="dashed"></div>
           
           <div class="footer">
               ${bill.internalNotes ? `<div style="text-align: left; background: #eee; padding: 5px; margin-bottom: 5px; font-size: 10px;">REMARKS: ${bill.internalNotes}</div>` : ''}
               Thank You! Visit Again.<br/>
           </div>
        </body>
    </html>
    `;
};

export const generateReceiptHTML = (bill, settings = {}, mode = 'invoice') => {
    // If Thermal Paper, use the new thermal template
    const paperSize = settings?.invoice?.paperSize || '80mm';
    if (paperSize === '80mm' || paperSize === '58mm') {
        return generateThermalReceiptHTML(bill, settings, mode);
    }

    // ... Existing A4 Logic ...
    const isBW = mode === 'customer' || mode === 'bw';
    const template = (isBW && settings?.invoice?.billTemplate) ? settings.invoice.billTemplate : (settings?.invoice?.template || 'Classic');
    const storeName = settings?.store?.name || 'Kwiq Billing';
    const storeAddressObj = settings?.store?.address || {};
    const storeAddress = `${storeAddressObj.street || ''}, ${storeAddressObj.city || ''}`;
    const storePhone = settings?.store?.contact || settings?.store?.phone || '';
    const storeEmail = settings?.store?.email || '';
    const storeGstin = settings?.store?.gstin || '';
    const currency = settings?.defaults?.currency || '₹';

    const items = bill.cart || bill.items || [];
    const customer = bill.customer || {};

    const customerName = bill.customerName || customer.fullName || customer.name || 'Walk-in Customer';

    // Ensure totals exist (handle flat DB structure vs nested Billing structure)
    // This fixes the issue where history invoices show 0 because they are flat objects
    if (!bill.totals) {
        bill.totals = {
            total: bill.total || 0,
            subtotal: bill.subtotal || 0,
            tax: bill.tax || 0,
            discount: bill.discount || 0,
            grossTotal: bill.grossTotal || 0,
            amountReceived: bill.amountReceived || 0,
            roundOff: bill.roundOff || 0
        };
    }

    // Theme selection
    const isCompact = template === 'Compact';
    const isGST = template === 'Detailed' || template === 'GST';
    const isMinimal = template === 'Minimal';
    const isClassic = template === 'Classic';

    const docTitle = isBW ? 'BILL' : 'INVOICE';

    // Toggle Settings
    const {
        showLogo = true,
        showTaxBreakup = true,
        showHsn = true,
        showQrcode = true,
        showTerms = true,
        showStoreAddress = true
    } = settings?.invoice || {};

    // B&W overrides for customer bill
    let colors = isBW ? {
        primary: '#000000',
        border: '#333333',
        bg: '#ffffff',
        text: '#000000',
        lightText: '#666666'
    } : (isGST ? {
        primary: '#334155',
        border: '#94a3b8',
        bg: '#f1f5f9',
        text: '#1e293b'
    } : isCompact ? {
        primary: '#8B5E3C', // Gold/Brown for Compact
        bg: '#FEF9EF',      // Light Tan background
        text: '#475569',
        border: '#92400E'   // Darker gold for borders
    } : isMinimal ? {
        primary: '#137A6E', // Teal for Minimal
        bg: '#f0f9f9',      // Light Teal for Notes
        text: '#374151',
        light: '#9ca3af'
    } : {
        primary: '#003594', // Corporate Blue for Classic
        text: '#334155',
        lightText: '#64748b',
        border: '#e2e8f0'
    });

    const invoiceDate = bill.date ? new Date(bill.date).toLocaleDateString() : new Date().toLocaleDateString();

    let styles = `
        body { font-family: Arial, sans-serif; color:#111; margin:0; padding:10px; }
        table { width:100%; border-collapse:collapse; margin-top:10px; }
        th, td { padding:8px; font-size:12px; border-bottom:1px solid #e5e7eb; }
        th { border-bottom:2px solid ${colors.primary}; text-align: left; }
        .text-right { text-align:right; }
        .text-center { text-align:center; }
        .bold { font-weight:700; }
    `;

    if (isGST) {
        styles += `
            .tax-invoice-banner { background: #f2f2f2; text-align: center; border-bottom: 1.5px solid #000; padding: 5px; font-weight: 800; font-size: 16px; }
            .tax-subtitle { font-size: 10px; font-style: italic; border-bottom: 1.5px solid #000; text-align: center; padding: 2px; }
            .meta-grid { display: flex; border-bottom: 1.5px solid #000; }
            .meta-col { flex: 1; border-right: 1.5px solid #000; }
            .meta-col:last-child { border-right: none; }
            .meta-cell { padding: 5px 10px; border-bottom: 1px solid #ddd; font-size: 11px; }
            .meta-cell:last-child { border-bottom: none; }
            .m-label { font-weight: 800; margin-right: 5px; }
            .addr-grid { display: flex; border-bottom: 1.5px solid #000; background: #fdfdfd; }
            .addr-label-bar { background: #f2f2f2; font-weight: 800; font-size: 10px; text-align: center; padding: 3px; border-bottom: 1px solid #000; }
            .summary-split { display: flex; border: 1.5px solid #000; border-top: none; }
            .sum-left { flex: 1.5; padding: 10px; border-right: 1.5px solid #000; }
            .sum-right { flex: 1; }
            .sum-row { display: flex; justify-content: space-between; padding: 4px 10px; border-bottom: 1px solid #eee; font-size: 11px; }
            .final-total { background: #f2f2f2; font-weight: 800; font-size: 13px; border-top: 1.5px solid #000; }
            .footer-gst { display: flex; border-top: 1px solid #000; margin-top: 10px; border-bottom: 1.5px solid #000; }
            .f-bank { flex: 1; padding: 10px; border-right: 1px solid #000; font-size: 10px; }
            .f-sig { flex: 1; padding: 10px; text-align: right; }
        `;
    } else if (isMinimal) {
        styles += `
            .header-teal { background-color: ${colors.primary}; color: white; padding: 40px; display: flex; justify-content: space-between; align-items: flex-start; }
            .header-teal .title-grp { text-align: left; }
            .header-teal h1 { font-size: 48px; margin: 0; font-weight: 800; }
            .header-teal .inv-id { font-size: 16px; opacity: 0.9; margin-top: 10px; font-weight: 600; }
            .header-teal .biz-grp { text-align: right; max-width: 400px; }
            .header-teal .biz-name { font-size: 24px; font-weight: 800; margin-bottom: 8px; display: block; }
            .header-teal .biz-addr { font-size: 12px; line-height: 1.6; opacity: 0.9; display: block; }
            .meta-minimal { display: flex; justify-content: space-between; padding: 40px; margin-top: 20px; }
            .label-tiny { font-size: 10px; font-weight: 800; color: ${colors.light || '#94a3b8'}; text-transform: uppercase; margin-bottom: 8px; letter-spacing: 1.5px; }
            .val-bold { font-size: 20px; font-weight: 900; color: #111827; }
            .date-row { display: flex; justify-content: flex-end; gap: 40px; font-size: 13px; margin-bottom: 8px; }
            .date-row span:first-child { color: ${colors.light || '#6b7280'}; font-weight: 700; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px; }
            .date-row span:last-child { font-weight: 600; color: #111827; min-width: 100px; text-align: right; }
            .items-table { margin: 20px 40px; width: calc(100% - 80px); }
            .items-table th { text-transform: uppercase; letter-spacing: 1px; color: #374151; font-weight: 800; }
            .footer-minimal { display: flex; justify-content: space-between; padding: 20px 40px; margin-top: 40px; align-items: flex-start; }
            .notes-box { background: ${colors.bg}; padding: 20px; border-radius: 8px; width: 45%; }
            .total-container { width: 42%; text-align: right; }
            .gross-box { background: ${colors.primary}; padding: 15px 20px; color: white; display: flex; justify-content: space-between; align-items: center; border-radius: 8px; }
            .gross-val { font-size: 24px; font-weight: 900; }
        `;
    } else if (isCompact) {
        styles += `
            .header-compact { text-align: center; padding: 30px 40px; }
            .biz-name { font-size: 24px; font-weight: 800; color: ${colors.primary}; margin-bottom: 5px; }
            .info-bar { background-color: ${colors.bg}; margin: 20px 40px; padding: 12px 20px; border-top: 2px solid ${colors.primary}; border-bottom: 2px solid ${colors.primary}; display: flex; justify-content: space-between; align-items: center; }
            .address-box { display: flex; justify-content: space-between; padding: 0 40px; margin-top: 20px; }
            .addr-label { font-weight: 800; color: ${colors.primary}; text-transform: uppercase; font-size: 12px; border-bottom: 1.5px solid ${colors.primary}; margin-bottom: 10px; padding-bottom: 4px; width: 80%; }
            .footer-container { display: flex; margin: 20px 40px; border: 1px solid ${colors.primary}; }
            .footer-left { flex: 1.5; padding: 15px; border-right: 1px solid ${colors.primary}; }
            .footer-right { flex: 1; }
            .grand-total-box { background-color: ${colors.bg}; display: flex; justify-content: space-between; padding: 15px; color: ${colors.primary}; font-weight: 800; font-size: 16px; border-bottom: 1px solid ${colors.primary}; }
        `;
    } else {
        styles += `
            .header-blue { background-color: ${colors.primary}; padding: 30px 40px; color: white; display: flex; align-items: center; justify-content: space-between; }
            .logo-circle { width: 80px; height: 80px; background: white; border-radius: 40px; display: flex; align-items: center; justify-content: center; color: ${colors.primary}; font-weight: bold; font-size: 14px; text-transform: uppercase; }
            .meta-section { padding: 20px 40px; display: flex; flex-direction: column; align-items: flex-end; }
            .address-box { display: flex; justify-content: space-between; padding: 20px 40px; margin-top: 20px; border-bottom: 1px solid #eee; }
            .company-name { font-weight: 800; font-size: 18px; margin-bottom: 5px; display: block; }
            .balance-box { background-color: ${colors.primary}; width: 350px; padding: 12px 20px; color: white; display: flex; justify-content: space-between; align-items: center; }
            .footer-container { display: flex; margin: 20px 40px; border: 1.5px solid #eee; margin-top: 30px; }
            .footer-left { flex: 1.5; padding: 15px; border-right: 1.5px solid #eee; }
            .footer-right { flex: 1; }
            .summ-row { display: flex; justify-content: space-between; padding: 6px 15px; border-bottom: 1px solid #f8fafc; font-size: 12px; }
            .grand-total-box { background-color: ${colors.bg}; display: flex; justify-content: space-between; padding: 15px; color: ${colors.primary}; font-weight: 800; font-size: 18px; border-top: 2.5px solid ${colors.primary}; }
            .thanks-msg { font-size: 24px; font-weight: 800; font-style: italic; color: ${colors.text}; margin-top: 40px; padding: 0 40px; }
            .signature-container { display: flex; flex-direction: column; align-items: flex-end; padding: 40px; }
            .sig-line { width: 200px; border-top: 1.5px solid #333; margin-bottom: 8px; }
        `;
    }

    // No need to append 80mm styles here as we handle it above with a dedicated template


    // Calculate Tax Summary Breakdown
    const taxSummary = {};
    const isInter = bill.taxType === 'inter'; // Helper

    items.forEach(item => {
        const rate = parseFloat(item.taxRate || 0);
        const price = parseFloat(item.price || item.sellingPrice || 0);
        const qty = parseFloat(item.quantity || 0);
        const taxable = price * qty;
        const taxVal = taxable * rate / 100;

        if (!taxSummary[rate]) {
            taxSummary[rate] = { taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0 };
        }
        taxSummary[rate].taxable += taxable;
        if (isInter) {
            taxSummary[rate].igst += taxVal;
        } else {
            taxSummary[rate].cgst += taxVal / 2;
            taxSummary[rate].sgst += taxVal / 2;
        }
        taxSummary[rate].total += taxVal;
    });

    const taxTableRows = Object.keys(taxSummary).filter(rate => parseFloat(rate) > 0).map(rate => {
        const data = taxSummary[rate];
        return `
            <tr>
                <td style="text-align: center; border: 1px solid #ddd; padding: 4px;">${rate}%</td>
                <td style="text-align: right; border: 1px solid #ddd; padding: 4px;">${data.taxable.toFixed(2)}</td>
                ${isInter ? `
                <td style="text-align: right; border: 1px solid #ddd; padding: 4px;">${data.igst.toFixed(2)}</td>
                ` : `
                <td style="text-align: right; border: 1px solid #ddd; padding: 4px;">${data.cgst.toFixed(2)}</td>
                <td style="text-align: right; border: 1px solid #ddd; padding: 4px;">${data.sgst.toFixed(2)}</td>
                `}
                <td style="text-align: right; border: 1px solid #ddd; padding: 4px;">${data.total.toFixed(2)}</td>
            </tr>
        `;
    }).join('');

    const taxSummaryTable = showTaxBreakup ? `
    <div style="margin-top: 15px; margin-bottom: 10px;">
        <div style="font-size: 10px; font-weight: 800; margin-bottom: 4px; border-bottom: 1px solid #000; display: inline-block;">TAX BREAKUP SUMMARY</div>
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #ddd;">
            <thead>
                <tr style="background: #f8fafc;">
                    <th style="font-size: 9px; border: 1px solid #ddd; padding: 4px;">Rate</th>
                    <th style="font-size: 9px; border: 1px solid #ddd; padding: 4px; text-align: right;">Taxable</th>
                    ${isInter ? `
                        <th style="font-size: 9px; border: 1px solid #ddd; padding: 4px; text-align: right;">IGST</th>
                        ` : `
                        <th style="font-size: 9px; border: 1px solid #ddd; padding: 4px; text-align: right;">CGST</th>
                        <th style="font-size: 9px; border: 1px solid #ddd; padding: 4px; text-align: right;">SGST</th>
                        `}
                    <th style="font-size: 9px; border: 1px solid #ddd; padding: 4px; text-align: right;">Total Tax</th>
                </tr>
            </thead>
            <tbody>
                ${taxTableRows}
            </tbody>
        </table>
    </div>
    ` : '';

    const itemsHTML = items.map((item, idx) => {
        const qty = parseFloat(item.quantity || 0);
        const rate = parseFloat(item.price || item.sellingPrice || 0);
        const taxable = qty * rate;
        const taxRate = parseFloat(item.taxRate || 0);
        const cgst = (taxable * (taxRate / 2) / 100).toFixed(2);
        const sgst = (taxable * (taxRate / 2) / 100).toFixed(2);
        const igst = (taxable * (taxRate) / 100).toFixed(2);
        const total = (taxable + (isInter ? parseFloat(igst) : (parseFloat(cgst) + parseFloat(sgst)))).toFixed(2);

        if (isGST) {
            return `
        <tr>
                    <td class="text-center">${idx + 1}</td>
                    <td>${item.name}</td>
                    ${showHsn ? `<td class="text-center">${item.hsn || '-'}</td>` : ''}
                    <td class="text-center">${qty}</td>
                    <td class="text-right">${rate.toFixed(2)}</td>
                    <td class="text-right">${taxable.toFixed(2)}</td>
                    ${showTaxBreakup ? (isInter ? `
                    <td class="text-center" colspan="2">${taxRate}%</td>
                    <td class="text-right" colspan="2">${igst}</td>
                    ` : `
                    <td class="text-center">${taxRate / 2}%</td>
                    <td class="text-right">${cgst}</td>
                    <td class="text-center">${taxRate / 2}%</td>
                    <td class="text-right">${sgst}</td>
                    `) : ''
                }
    <td class="text-right">${total}</td>
                </tr>
    `;
        } else if (isMinimal) {
            const taxDetail = taxRate > 0 ? (isInter ? `${taxRate}% IGST` : `${taxRate / 2}% CGST<br/>${taxRate / 2}% SGST`) : '-';
            return `
    <tr>
    <td>${item.name}</td>
                    ${showHsn ? `<td class="text-center">${item.hsn || '-'}</td>` : ''}
                    <td class="text-center">${qty}</td>
                    <td class="text-right">${rate.toFixed(2)}</td>
                    ${showTaxBreakup ? `<td class="text-center" style="font-size: 11px;">${taxDetail}</td>` : ''}
<td class="text-right">${total}</td>
                </tr>
    `;
        } else if (isClassic) {
            return `
    <tr>
                    <td>
                        <div style="font-weight: 600;">${item.name}</div>
                        <div style="font-size: 9px; color: #666;">
                            Rate: ${currency} ${rate.toFixed(2)}
                            ${showTaxBreakup ? (isInter ? ` | IGST: ${taxRate}%` : ` | CGST: ${taxRate / 2}% | SGST: ${taxRate / 2}%`) : ''}
                            ${showHsn && item.hsn ? ` | HSN: ${item.hsn}` : ''}
                        </div>
                    </td>
                    <td class="text-center">${qty}</td>
                    <td class="text-right">${showTaxBreakup ? currency + ' ' + (isInter ? parseFloat(igst).toFixed(2) : (parseFloat(cgst) + parseFloat(sgst)).toFixed(2)) : currency + ' ' + rate.toFixed(2)}</td>
                    <td class="text-right">${currency} ${total}</td>
                </tr>
    `;
        }
        return `
    <tr>
                <td>
                    <div style="font-weight: 600;">${item.name}</div>
                    ${item.variant ? `<div style="font-size: 10px; color: #666;">${item.variant}</div>` : ''}
                    ${(showHsn && item.hsn) ? `<div style="font-size: 9px; color: #94a3b8;">HSN: ${item.hsn}</div>` : ''}
                </td>
                <td class="text-center">${item.quantity}</td>
                <td class="text-right">${currency}${rate.toFixed(2)}</td>
                <td class="text-right">${currency}${itemTotal}</td>
            </tr>
    `;
    }).join('');

    if (isMinimal) {
        return `
    <html>
            <head><style>${styles}</style></head>
            <body>
                <div class="page">
                    <div class="header-teal">
                        <div class="title-grp">
                            <h1 style="text-transform: uppercase; letter-spacing: 2px;">${isBW ? 'Bill' : 'Invoice'}</h1>
                            <div class="inv-id">No: ${bill.weekly_sequence || '1'}</div>
                            <div style="font-size: 10px; opacity: 0.7; margin-top: 5px;">Ref: #${bill.id}</div>
                        </div>
                        <div class="biz-grp">
                            <span class="biz-name" style="text-transform: uppercase;">${storeName}</span>
                            <span class="biz-addr">${storeAddress}</span>
                            <span class="biz-addr">${storePhone} | ${storeEmail}</span>
                            ${storeGstin ? `<span class="biz-addr">GSTIN: ${storeGstin}</span>` : ''}
                        </div>
                    </div>

                    <div class="meta-minimal">
                        <div class="bill-grp">
                            <div class="label-tiny">Bill To</div>
                            <div class="val-bold">${customerName}</div>
                            <div style="font-size: 14px; margin-top: 4px; color: #4b5563;">${customer.mobile || ''}</div>
                        </div>
                        <div class="dates-grp">
                            <div class="date-row"><span>Date</span> <span>${invoiceDate}</span></div>
                            <div class="date-row"><span>Status</span> <span style="color: ${(bill.status === 'Unpaid' || bill.status === 'Partially Paid') ? '#ef4444' : '#059669'}; font-weight: 800;">${(bill.status || 'Paid').toUpperCase()}</span></div>
                            ${bill.paymentMethod ? `<div class="date-row"><span>Method</span> <span style="font-weight: 600;">${bill.paymentMethod}</span></div>` : ''}
                        </div>
                    </div>

                    <table class="items-table">
                        <thead>
                            <tr style="border-bottom: 2px solid #000;">
                                <th style="padding: 12px 5px;">Description</th>
                                ${showHsn ? `<th class="text-center" width="60">HSN</th>` : ''}
                                <th class="text-center" width="60">Qty</th>
                                <th class="text-right" width="100">Price</th>
                                ${showTaxBreakup ? `<th class="text-center" width="100">Tax</th>` : ''}
                                <th class="text-right" width="100">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${itemsHTML}
                        </tbody>
                    </table>

                    <div style="padding: 0 40px;">${taxSummaryTable}</div>

                    <div class="footer-minimal">
                        <div class="notes-box">
                            <div class="label-tiny" style="margin-bottom: 10px;">Notes</div>
                            <div style="font-size: 13px; color: #4b5563; line-height: 1.5;">
                                ${bill.internalNotes ? `<b>Remarks:</b> ${bill.internalNotes}<br/><br/>` : ''}
                                Thank you for your business!<br/>
                                Please Visit Again.
                            </div>
                        </div>
                        <div class="total-container">
                            <div style="display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #f3f4f6;">
                                <span style="font-weight:600; color:#6b7280; font-size: 13px;">Subtotal</span>
                                <span style="font-weight:700; color: #111;">${currency} ${Number(bill.totals?.subtotal || 0).toFixed(2)}</span>
                            </div>
                            ${bill.totals?.tax > 0 ? (bill.taxType === 'inter' ? `
                                <div style="display: flex; justify-content: space-between; padding: 5px 0;">
                                    <span style="font-weight:600; color:#6b7280; font-size: 13px;">IGST</span>
                                    <span style="font-weight:700; color: #111;">${currency} ${Number(bill.totals.tax).toFixed(2)}</span>
                                </div>
                            ` : `
                                <div style="display: flex; justify-content: space-between; padding: 5px 0;">
                                    <span style="font-weight:600; color:#6b7280; font-size: 13px;">CGST</span>
                                    <span style="font-weight:700; color: #111;">${currency} ${Number(bill.totals.tax / 2).toFixed(2)}</span>
                                </div>
                                <div style="display: flex; justify-content: space-between; padding: 5px 0;">
                                    <span style="font-weight:600; color:#6b7280; font-size: 13px;">SGST</span>
                                    <span style="font-weight:700; color: #111;">${currency} ${Number(bill.totals.tax / 2).toFixed(2)}</span>
                                </div>
                            `) : ''}
                            ${bill.totals?.additionalCharges > 0 ? `
                                <div style="display: flex; justify-content: space-between; padding: 5px 0; color: #000;">
                                    <span style="font-weight:600; font-size: 13px;">Extra Charges</span>
                                    <span style="font-weight:700;">+${currency} ${Number(bill.totals.additionalCharges).toFixed(2)}</span>
                                </div>
                            ` : ''}
                            ${bill.totals?.discount > 0 ? `
                                <div style="display: flex; justify-content: space-between; padding: 5px 0; color: #ef4444;">
                                    <span style="font-weight:600; font-size: 13px;">Discount</span>
                                    <span style="font-weight:700;">-${currency} ${Number(bill.totals.discount).toFixed(2)}</span>
                                </div>
                            ` : ''}
                            ${bill.totals?.loyaltyPointsDiscount > 0 ? `
                                <div style="display: flex; justify-content: space-between; padding: 5px 0; color: #10b981;">
                                    <span style="font-weight:600; font-size: 13px;">Loyalty Disc</span>
                                    <span style="font-weight:700;">-${currency} ${Number(bill.totals.loyaltyPointsDiscount).toFixed(2)}</span>
                                </div>
                            ` : ''}
                            <div style="display: flex; justify-content: space-between; padding: 5px 0; color: #6b7280;">
                                <span style="font-weight:600; font-size: 13px;">Round Off</span>
                                <span style="font-weight:700;">${(bill.totals?.roundOff || 0) > 0 ? '+' : ''}${(bill.totals?.roundOff || 0).toFixed(2)}</span>
                            </div>
                            <div class="gross-box" style="margin-top: 15px;">
                                <span style="font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Grand Total</span>
                                <span class="gross-val">${currency} ${Number(bill.totals?.total || 0).toFixed(2)}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div style="margin: 40px 40px 0 40px; border-top: 1px solid #f3f4f6; padding-top: 20px; font-size: 11px; color: #9ca3af; text-align: center;">
                        This is a computer generated invoice. No signature required.
                    </div>
                </div>
            </body>
        </html> `;
    }

    if (isGST) {
        const subtotal = Number(bill.totals?.subtotal || 0);
        const tax = Number(bill.totals?.tax || 0);
        const total = Number(bill.totals?.total || 0);

        return `
    <html>
            <head><style>${styles}</style></head>
            <body>
                <div class="gst-container">
                    <div class="header-top">
                        ${showLogo ? `<div class="logo-box">LOGO</div>` : ''}
                        <div class="biz-header">
                            <h2 style="margin:0; text-transform: uppercase; letter-spacing: 1px;">${storeName}</h2>
                            ${showStoreAddress ? `
                            <div style="font-size:11px; margin: 4px 0; color: #4b5563;">${storeAddress}</div>
                            <div style="font-size:11px; color: #4b5563;">Contact: ${storePhone}</div>
                            ` : ''}
                            <div style="font-size:12px; font-weight:800; margin-top: 4px;">GSTIN: ${storeGstin}</div>
                        </div>
                        <div class="copy-indicator">
                            <div class="copy-row">Original for Recipient <div class="checkbox checked"></div></div>
                            <div class="copy-row">Duplicate for Transporter <div class="checkbox"></div></div>
                            <div class="copy-row">Triplicate for Supplier <div class="checkbox"></div></div>
                        </div>
                    </div>

                    <div class="tax-invoice-banner">
                        ${isBW ? 'BILL' : 'TAX INVOICE'} 
                        ${bill.status ? `<span style="font-size: 10px; background: rgba(0,0,0,0.1); padding: 2px 8px; border-radius: 4px; vertical-align: middle; margin-left: 10px; border: 1px solid #000;">${bill.status.toUpperCase()}</span>` : ''}
                    </div>
                    <div class="tax-subtitle">Invoice of goods under Section 31 of CGST Act</div>

                    <div class="meta-grid">
                        <div class="meta-col">
                            <div class="meta-cell"><span class="m-label">Invoice No:</span> <b>${bill.weekly_sequence || '1'}</b></div>
                            <div class="meta-cell"><span class="m-label">Invoice Date:</span> ${invoiceDate}</div>
                            <div class="meta-cell"><span class="m-label">State:</span> ${storeAddressObj.state || '-'}</div>
                        </div>
                        <div class="meta-col">
                            <div class="meta-cell"><span class="m-label">Transportation:</span> - </div>
                            <div class="meta-cell"><span class="m-label">Vehicle No:</span> - </div>
                            <div class="meta-cell"><span class="m-label">Place of Supply:</span> Local</div>
                        </div>
                    </div>
                    <div class="addr-grid">
                        <div class="meta-col">
                            <div class="addr-label-bar">Bill To (Recipient)</div>
                            <div style="padding:10px; font-size:12px; line-height: 1.6;">
                                <b>Name:</b> ${customerName}<br/>
                                <b>Contact:</b> ${customer.mobile || '-'}<br/>
                                <b>Address:</b> -
                            </div>
                        </div>
                    </div>
                    <table style="border: 1px solid #000; border-top: none;">
                        <thead>
                            <tr style="background: #f2f2f2;">
                                <th rowspan="2" align="center" style="border: 1px solid #000; width: 30px;">S.N</th>
                                <th rowspan="2" style="border: 1px solid #000;">Product Description</th>
                                ${showHsn ? `<th rowspan="2" align="center" style="border: 1px solid #000; width: 50px;">HSN</th>` : ''}
                                <th rowspan="2" align="center" style="border: 1px solid #000; width: 30px;">Qty</th>
                                <th rowspan="2" align="right" style="border: 1px solid #000; width: 70px;">Rate</th>
                                <th rowspan="2" align="right" style="border: 1px solid #000; width: 80px;">Taxable</th>
                                ${showTaxBreakup ? (isInter ? `
                                <th colspan="4" style="border: 1px solid #000;">IGST</th>
                                ` : `
                                <th colspan="2" style="border: 1px solid #000;">CGST</th>
                                <th colspan="2" style="border: 1px solid #000;">SGST</th>
                                `) : ''}
                                <th rowspan="2" align="right" style="border: 1px solid #000; width: 90px;">Total</th>
                            </tr>
                            <tr style="background: #f2f2f2;">
                                ${showTaxBreakup ? (isInter ? `
                                <th width="70" style="border: 1px solid #000;">Rate</th>
                                <th width="100" style="border: 1px solid #000;">Amount</th>
                                ` : `
                                <th width="35" style="border: 1px solid #000;">Rate</th>
                                <th width="50" style="border: 1px solid #000;">Amt</th>
                                <th width="35" style="border: 1px solid #000;">Rate</th>
                                <th width="50" style="border: 1px solid #000;">Amt</th>
                                `) : ''}
                            </tr>
                        </thead>
                        <tbody>
                            ${itemsHTML}
                            <tr style="font-weight:800; background:#f9f9f9;">
                                <td colspan="${showHsn ? 5 : 4}" class="text-right">Total</td>
                                <td class="text-right">${subtotal.toFixed(2)}</td>
                                ${showTaxBreakup ? (isInter
                ? `<td colspan="4" class="text-right" style="border: 1px solid #000;">${tax.toFixed(2)}</td>`
                : `<td colspan="2" class="text-right" style="border: 1px solid #000;">${(tax / 2).toFixed(2)}</td><td colspan="2" class="text-right" style="border: 1px solid #000;">${(tax / 2).toFixed(2)}</td>`)
                : ''}
                                <td class="text-right">${total.toFixed(2)}</td>
                            </tr>
                        </tbody>
                    </table>
                    
                    ${taxSummaryTable}

                    <div class="summary-split">
                        <div class="sum-left">
                            <div style="font-weight:800; font-size:11px;">Amount in Words:</div>
                            <div style="font-style:italic; font-size:12px; margin-top:5px; color: ${colors.primary};">${numberToWords(total)}</div>
                        </div>
                        <div class="sum-right">
                            <div class="sum-row"><span>Total Amount before Tax:</span> <span>${subtotal.toFixed(2)}</span></div>
                            ${showTaxBreakup ? (isInter ? `
                            <div class="sum-row"><span>Add: IGST:</span> <span>${tax.toFixed(2)}</span></div>
                            ` : `
                            <div class="sum-row"><span>Add: CGST:</span> <span>${(tax / 2).toFixed(2)}</span></div>
                            <div class="sum-row"><span>Add: SGST:</span> <span>${(tax / 2).toFixed(2)}</span></div>
                            `) : ''}
                            ${bill.totals?.additionalCharges > 0 ? `
                            <div class="sum-row"><span>Add: Extra Charges:</span> <span>${Number(bill.totals.additionalCharges).toFixed(2)}</span></div>
                            ` : ''}
                            ${(bill.totals?.discount > 0) ? `
                            <div class="sum-row" style="color: #ef4444;"><span>Add: Bill Discount:</span> <span>-${Number(bill.totals.discount).toFixed(2)}</span></div>
                            ` : ''}
                            ${(bill.totals?.loyaltyPointsDiscount > 0) ? `
                            <div class="sum-row" style="color: #10b981;"><span>Add: Loyalty Discount:</span> <span>-${Number(bill.totals.loyaltyPointsDiscount).toFixed(2)}</span></div>
                            ` : ''}
                            <div class="sum-row"><span>Round Off:</span> <span>${(bill.totals?.roundOff || 0) > 0 ? '+' : ''}${(bill.totals?.roundOff || 0).toFixed(2)}</span></div>
                            <div class="sum-row final-total"><span>Total Amount after Tax:</span> <span>${total.toFixed(2)}</span></div>
                            <div style="font-size:9px; text-align:center; padding:2px;">GST on Reverse Charge: No</div>
                        </div>
                    </div>

                    <div class="footer-gst">
                        <div class="f-bank">
                            ${bill.internalNotes ? `<b>REMARKS:</b> ${bill.internalNotes}<br/><br/>` : ''}
                            <b>Terms & Conditions:</b><br/>
                            1. Goods once sold will not be taken back.<br/>
                            2. 24% interest will be charged if not paid within 15 days.<br/>
                            3. Subject to local jurisdiction.
                        </div>
                        <div class="f-sig">
                             ${showQrcode ? `<div style="text-align:center; margin-bottom:10px;"><img src="https://api.qrserver.com/v1/create-qr-code/?size=60x60&data=UPI://pay?pa=store@upi&pn=${encodeURIComponent(storeName)}" width="60" /></div>` : ''}
                            <div class="thanks-msg" style="font-size:14px; font-weight:800; text-align:center; margin-bottom:10px;">Visit Again!</div>
                             ${showTerms ? `
                            <div style="font-weight:800; margin:5px 0;">For ${storeName}</div>
                            <div style="margin-top:40px; font-size:11px; font-weight:700; border-top: 1px solid #000; display: inline-block; padding-top: 4px;">Authorised Signatory</div>
                            ` : ''}
                        </div>
                    </div>
                </div>
            </body>
            </html>
    `;
    }

    // Default return (Classic/Centered)
    return `
    <html>
        <head><style>${styles}</style></head>
        <body>
            <div class="page">
                <div class="header-blue">
                    <div class="header-title">
                        ${docTitle}<br/>
                        <span style="font-size: 14px; opacity: 0.9;">No: ${bill.weekly_sequence || '1'}</span>
                        ${(bill.status && bill.status !== 'Paid') ? `<div style="font-size: 12px; margin-top: 5px; background: rgba(255,255,255,0.2); padding: 2px 8px; border-radius: 4px; display: inline-block;">${bill.status.toUpperCase()}</div>` : ''}
                    </div>
                    <div style="text-align: right">
                        <div style="font-size: 22px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px;">${storeName}</div>
                        <div style="font-size: 13px; margin-top: 5px; color: rgba(255,255,255,0.9);">${storeAddress}</div>
                        <div style="font-size: 11px; margin-top: 2px; opacity: 0.8;">Ref: #${bill.id}</div>
                    </div>
                </div>

                <div class="addr-box">
                    <div>
                        <div class="bold" style="text-transform: uppercase; font-size: 10px; color: #64748b; margin-bottom: 5px;">Bill To:</div>
                        <div style="font-size: 16px; font-weight: 800;">${customerName}</div>
                        <div style="font-size: 13px; color: #475569; margin-top: 4px;">${customer.mobile || ''}</div>
                    </div>

                    <div style="width: 100%;">${taxSummaryTable}</div>

                    <div class="footer-container">
                        <div class="footer-left">
                            <div class="footer-ttl">Terms & Instructions</div>
                            <div class="footer-txt">
                                1. Goods once sold will not be taken back.<br/>
                                2. Thank you for your business!
                            </div>
                            ${bill.internalNotes ? `<div style="margin-top:15px; font-weight:700; font-size:12px; border: 1px dashed #cbd5e1; padding:8px; border-radius:4px;">REMARKS: ${bill.internalNotes}</div>` : ''}
                            <div style="font-weight:900; font-size:18px; margin-top:20px; color:#000;">Thank you, Visit Again!</div>
                        </div>
                        <div class="footer-right">
                            <div class="summ-row"><span>SUBTOTAL</span><span>${currency}${(bill.totals?.subtotal || 0).toFixed(2)}</span></div>
                            
                            ${(bill.totals?.tax > 0) ? (isInter ? `
                                <div class="summ-row"><span>IGST</span><span>${currency}${(bill.totals.tax).toFixed(2)}</span></div>
                            ` : `
                                <div class="summ-row"><span>CGST</span><span>${currency}${(bill.totals.tax / 2).toFixed(2)}</span></div>
                                <div class="summ-row"><span>SGST</span><span>${currency}${(bill.totals.tax / 2).toFixed(2)}</span></div>
                            `) : ''}

                            ${(bill.totals?.discount > 0) ? `
                                <div class="summ-row" style="color: #ef4444;"><span>DISCOUNT</span><span>-${currency}${(bill.totals.discount).toFixed(2)}</span></div>
                            ` : ''}
                            ${(bill.totals?.loyaltyPointsDiscount > 0) ? `
                                <div class="summ-row" style="color: #10b981;"><span>LOYALTY DISC</span><span>-${currency}${(bill.totals.loyaltyPointsDiscount).toFixed(2)}</span></div>
                            ` : ''}
                            <div class="summ-row"><span>ROUND OFF</span><span>${(bill.totals?.roundOff || 0) > 0 ? '+' : ''}${(bill.totals?.roundOff || 0).toFixed(2)}</span></div>

                            <div class="summ-row"><span>RECEIVED BALANCE</span><span>${currency}${(bill.amountReceived || 0).toFixed(2)}</span></div>
                            <div class="summ-row"><span>BALANCE DUE</span><span>${currency}${Math.max(0, (bill.totals?.total || 0) - (bill.amountReceived || 0)).toFixed(2)}</span></div>
                            <div class="grand-total-box"><span>GRAND TOTAL</span><span>${currency}${(bill.totals?.total || 0).toFixed(2)}</span></div>
                        </div>
                    </div>
                </div>

                <div style="padding: 0 40px;">
                    <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
                        <thead>
                            <tr style="background: #f8fafc;">
                                <th style="padding: 12px; border-bottom: 2px solid ${colors.primary};">Description</th>
                                <th class="text-center" style="padding: 12px; border-bottom: 2px solid ${colors.primary};">Qty</th>
                                <th class="text-right" style="padding: 12px; border-bottom: 2px solid ${colors.primary};">Price</th>
                                <th class="text-right" style="padding: 12px; border-bottom: 2px solid ${colors.primary};">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${itemsHTML}
                        </tbody>
                    </table>

                    <div style="margin-top: 20px;">
                        ${isGST ? '' : taxSummaryTable}
                    </div>

                    <div class="footer-container">
                        <div class="footer-left">
                            <div style="font-weight: 800; font-size: 12px; color: #000; margin-bottom: 8px;">Terms & Instructions</div>
                            <div style="font-size: 11px; line-height: 1.6; color: #475569;">
                                1. Goods once sold will not be taken back.<br/>
                                2. Interest will be charged @ 18% if not paid on time.<br/>
                                3. Thank you for your business!
                            </div>
                            ${bill.internalNotes ? `<div style="margin-top:15px; font-weight:700; font-size:12px; border: 1px dashed #cbd5e1; padding:10px; border-radius:6px; background:#f8fafc;">REMARKS: ${bill.internalNotes}</div>` : ''}
                            <div style="font-weight: 900; font-size: 20px; margin-top: 20px; color: ${colors.primary};">Thank you, Visit Again!</div>
                        </div>
                        <div class="footer-right">
                            <div class="summ-row"><span>SUBTOTAL</span><span>${currency} ${Number(bill.totals?.subtotal || 0).toFixed(2)}</span></div>
                            
                            ${(Number(bill.totals?.tax || 0) > 0) ? (isInter ? `
                                <div class="summ-row"><span>IGST</span><span>${currency} ${Number(bill.totals.tax).toFixed(2)}</span></div>
                            ` : `
                                <div class="summ-row"><span>CGST</span><span>${currency} ${Number(bill.totals.tax / 2).toFixed(2)}</span></div>
                                <div class="summ-row"><span>SGST</span><span>${currency} ${Number(bill.totals.tax / 2).toFixed(2)}</span></div>
                            `) : ''}

                            ${(Number(bill.totals?.additionalCharges || 0) > 0) ? `
                                <div class="summ-row" style="color: #000;"><span>EXTRA CHARGES</span><span>+${currency} ${Number(bill.totals.additionalCharges).toFixed(2)}</span></div>
                            ` : ''}
                            ${(Number(bill.totals?.discount || 0) > 0) ? `
                                <div class="summ-row" style="color: #ef4444;"><span>DISCOUNT</span><span>-${currency} ${Number(bill.totals.discount).toFixed(2)}</span></div>
                            ` : ''}
                            ${(Number(bill.totals?.loyaltyPointsDiscount || 0) > 0) ? `
                                <div class="summ-row" style="color: #10b981;"><span>LOYALTY DISCOUNT</span><span>-${currency} ${Number(bill.totals.loyaltyPointsDiscount).toFixed(2)}</span></div>
                            ` : ''}

                            <div class="summ-row"><span>ROUND OFF</span><span>${(bill.totals?.roundOff || 0) > 0 ? '+' : ''}${(bill.totals?.roundOff || 0).toFixed(2)}</span></div>
                            <div class="summ-row"><span>RECEIVED TOTAL</span><span>${currency} ${Number(bill.amountReceived || 0).toFixed(2)}</span></div>
                            <div class="summ-row"><span>BALANCE DUE</span><span>${currency} ${Math.max(0, Number(bill.totals?.total || 0) - Number(bill.amountReceived || 0)).toFixed(2)}</span></div>
                            <div class="grand-total-box"><span>GRAND TOTAL</span><span>${currency} ${Number(bill.totals?.total || 0).toFixed(2)}</span></div>
                        </div>
                    </div>
                </div>
                <div class="signature-container">
                    <div class="sig-line"></div>
                    <div style="font-size: 12px; font-weight: 800;">Authorized Signatory</div>
                </div>
            </div>
        </body>
        </html>
    `;
};

/**
 * Generates HTML for Business Analytics Reports (Modern Template)
 */
export const generateBusinessReportHTML = (data, period = 'This Week') => {
    const {
        comparison = {},
        topProducts = [],
        paymentMethods = []
    } = data;

    const dateStr = new Date().toLocaleDateString();
    const timeStr = new Date().toLocaleTimeString();

    const calculateChange = (current, previous) => {
        if (previous === 0) return current > 0 ? '100.0%' : '0.0%';
        const change = ((current - previous) / previous) * 100;
        return (change > 0 ? '+' : '') + change.toFixed(1) + '%';
    };

    const executiveMetrics = [
        { label: 'Total Revenue', key: 'sales', prefix: 'Rs. ' },
        { label: 'Net Profit', key: 'profit', prefix: 'Rs. ' },
        { label: 'Total Expenses', key: 'expenses', prefix: 'Rs. ' },
        { label: 'Total Orders', key: 'orders', prefix: '' }
    ];

    return `
    <html>
      <head>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; color: #334155; margin: 0; padding: 0; background: #fff; }
          .top-banner { background: #584ced; color: white; padding: 30px 40px; }
          .top-banner h1 { margin: 0; font-size: 28px; font-weight: 500; }
          
          .content { padding: 30px 40px; }
          .meta-info { color: #64748b; font-size: 14px; margin-bottom: 30px; line-height: 1.6; }
          
          .section-title { font-size: 18px; font-weight: 600; color: #1e293b; margin: 35px 0 15px 0; }
          
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th { text-align: left; padding: 12px 15px; font-size: 13px; font-weight: 600; color: white; }
          td { padding: 12px 15px; font-size: 14px; border-bottom: 1px solid #e2e8f0; color: #475569; }
          tr:last-child td { border-bottom: none; }

          /* Executive Table */
          .exec-table th { background: #584ced; border-right: 1px solid rgba(255,255,255,0.1); }
          .exec-table td { border-right: 1px solid #e2e8f0; }
          .exec-table td:last-child { border-right: none; }
          
          /* Payment Table */
          .pay-table th { background: #334155; }
          .pay-table tr:nth-child(even) { background: #f8fafc; }
          
          /* Product Table */
          .prod-table th { background: #10b981; }
          .prod-table tr:nth-child(even) { background: #f8fafc; }

          .text-right { text-align: right; }
          .bold { font-weight: 600; }
        </style>
      </head>
      <body>
        <div class="top-banner">
          <h1>Business Analytics Report</h1>
        </div>

        <div class="content">
          <div class="meta-info">
            Period: ${period}<br/>
            Generated: ${dateStr}, ${timeStr}
          </div>

          <div class="section-title">Executive Summary</div>
          <table class="exec-table">
            <thead>
              <tr>
                <th width="30%">Metric</th>
                <th width="25%">Value</th>
                <th width="25%">Previous</th>
                <th width="20%">Change</th>
              </tr>
            </thead>
            <tbody>
              ${executiveMetrics.map(m => {
        const curr = comparison[m.key]?.current || 0;
        const prev = comparison[m.key]?.previous || 0;
        return `
                  <tr>
                    <td>${m.label}</td>
                    <td>${m.prefix}${curr.toLocaleString()}</td>
                    <td>${m.prefix}${prev.toLocaleString()}</td>
                    <td class="bold">${calculateChange(curr, prev)}</td>
                  </tr>
                `;
    }).join('')}
            </tbody>
          </table>

          <div class="section-title">Payment Methods Breakdown</div>
          <table class="pay-table">
            <thead>
              <tr>
                <th width="40%">Method</th>
                <th width="35%">Revenue</th>
                <th width="25%">Share</th>
              </tr>
            </thead>
            <tbody>
              ${paymentMethods.map(m => `
                <tr>
                  <td>${m.name}</td>
                  <td>Rs. ${m.revenue.toLocaleString()}</td>
                  <td>${m.percentage}.0%</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="section-title">Top Performing Products</div>
          <table class="prod-table">
            <thead>
              <tr>
                <th width="40%">Product Name</th>
                <th width="20%">Sold</th>
                <th width="20%">Revenue</th>
                <th width="20%">Margin</th>
              </tr>
            </thead>
            <tbody>
              ${topProducts.map(p => `
                <tr>
                  <td>${p.name}</td>
                  <td>${p.sales}</td>
                  <td>Rs. ${p.total.toLocaleString()}</td>
                  <td>${p.margin}%</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </body>
    </html>
    `;
};

export const printReceipt = async (bill, arg2, arg3, arg4) => {
    let settings = {};
    let mode = 'invoice';
    let format = '80mm';

    // Handle flexible arguments: (bill, format, settings) or (bill, settings, mode)
    if (typeof arg2 === 'string') {
        // Called as (bill, format, settings, mode?)
        format = arg2;
        settings = arg3 || {};
        mode = arg4 || 'invoice';
    } else {
        // Called as (bill, settings, mode)
        settings = arg2 || {};
        mode = arg3 || 'invoice';
        format = settings?.invoice?.paperSize || '80mm';
    }

    // Ensure format is in settings for downstream calls
    if (!settings.invoice) settings.invoice = {};
    settings.invoice.paperSize = format;

    try {
        const html = generateReceiptHTML(bill, settings, mode);
        const paperSize = format; // settings.invoice.paperSize is now synced

        // Define width based on paper size
        let width = 302; // Default for 80mm
        if (paperSize === '58mm') width = 219;
        else if (paperSize === 'A4') width = 595;
        else if (paperSize === 'A5') width = 420;

        await Print.printAsync({
            html,
            width,
            orientation: Print.Orientation.portrait,
            printerUrl: settings?.invoice?.selectedPrinter?.url || settings?.invoice?.selectedPrinter?.id,
        });

        // Auto backup after print
        try {
            const allData = await fetchAllTableData();
            await exportToDeviceFolders(allData);
        } catch (e) {
            console.warn('Auto-backup failed:', e);
        }
    } catch (error) {
        console.error('Print error:', error);
    }
};

export const shareReceiptPDF = async (bill, settings = {}) => {
    try {
        const html = generateReceiptHTML(bill, settings);
        const { uri } = await Print.printToFileAsync({ html });
        await shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
    } catch (error) {
        console.error('Share error:', error);
        Alert.alert('Error', 'Failed to share receipt');
    }
};

/**
 * Bulk Print/Share Logic
 */
export const shareBulkReceiptsPDF = async (bills, settings = {}) => {
    try {
        if (!bills || bills.length === 0) return;

        // Generate HTML for each bill
        const htmls = bills.map(bill => generateReceiptHTML(bill, settings));

        // Combine HTMLs
        // We need to strip the outer <html>, <head>, <body> tags to merge them cleanly
        // or just rely on the fact that we can concatenate them with page breaks 
        // and modern webview (webkit) often handles it 'okay'. 
        // But for correctness, let's extract styles and body.

        // Simple extraction strategy:
        // 1. Extract all content between <style> and </style> -> Global CSS
        // 2. Extract all content between <body> and </body> -> Pages

        let combinedStyles = "";
        let combinedBody = "";

        htmls.forEach((html, index) => {
            const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/);
            const bodyMatch = html.match(/<body>([\s\S]*?)<\/body>/);

            if (styleMatch) combinedStyles += styleMatch[1] + "\n";
            if (bodyMatch) {
                // Add page break for all except the last one
                const pageBreak = (index < htmls.length - 1) ? '<div style="page-break-after: always; height: 0; overflow: hidden;"></div>' : '';
                combinedBody += `<div class="invoice-page">${bodyMatch[1]}</div>${pageBreak}`;
            }
        });

        const finalHTML = `
    <html>
                <head>
                    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
                    <style>
                        ${combinedStyles}
                        /* Ensure distinct pages */
                        .invoice-page { position: relative; width: 100%; }
                        @media print {
                            .invoice-page { page-break-inside: avoid; }
                        }
                    </style>
                </head>
                <body>
                    ${combinedBody}
                </body>
            </html>
    `;

        const { uri } = await Print.printToFileAsync({ html: finalHTML });
        await shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });

    } catch (error) {
        console.error('Bulk Share error:', error);
        Alert.alert('Error', 'Failed to generate bulk PDF');
    }
};
