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
    const paperSize = settings?.invoice?.billPaperSize || '80mm';
    const storeName = settings?.store?.name || 'Store Name';
    const storeAddressObj = settings?.store?.address || {};
    const storeAddress = `${storeAddressObj.street || ''}, ${storeAddressObj.city || ''}`;
    const storePhone = settings?.store?.contact || settings?.store?.phone || '';
    const storeGstin = settings?.store?.gstin || '';

    const items = bill.cart || bill.items || [];
    const customer = bill.customer || {};
    const customerName = bill.customerName || customer.fullName || customer.name || 'Walk-in Customer';

    // Date formatting
    const date = new Date(bill.date || Date.now());
    const dateStr = date.toLocaleDateString('en-GB');
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const totalQty = items.reduce((acc, item) => acc + (parseFloat(item.quantity) || 0), 0);
    const subtotal = bill.totals?.subtotal || bill.subtotal || 0;
    const totalTax = (bill.totals?.tax || bill.tax || 0);
    const totalAmount = bill.totals?.total || bill.total || 0;
    const roundOff = bill.totals?.roundOff || 0;
    const paymentMode = (bill.payments && bill.payments.length > 0) ? bill.payments[0].method : (bill.paymentType || 'Cash');

    // Tax Summary
    const taxSummary = {};
    const isInter = bill.taxType === 'inter';
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

    const styles = `
        body { 
            font-family: 'Courier New', Courier, monospace; 
            font-size: 11px; 
            margin: 0; 
            padding: ${paperSize === '58mm' ? '2px' : '5px'}; 
            color: #000; 
            width: 100%;
        }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .bold { font-weight: 900; }
        .dashed { border-bottom: 1px dashed #000; margin: 4px 0; }
        .store-name { font-size: 14px; font-weight: 900; text-transform: uppercase; margin-bottom: 2px; }
        .header-title { font-size: 12px; font-weight: 900; padding: 2px 0; }
        .row { display: flex; justify-content: space-between; margin: 1px 0; }
        .table { width: 100%; border-collapse: collapse; }
        .table th { border-bottom: 1px dashed #000; padding: 4px 0; text-align: left; font-weight: 900; }
        .table td { padding: 2px 0; vertical-align: top; }
        .grand-total { font-size: 14px; font-weight: 900; border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 4px 0; margin: 4px 0; }
        .gst-summary-title { font-weight: 900; margin-top: 8px; margin-bottom: 2px; }
        .gst-box { border: 1px dashed #000; margin-top: 4px; }
        .gst-header { display: flex; border-bottom: 1px dashed #000; background: #f0f0f0; }
        .gst-row { display: flex; }
        .gst-col { flex: 1; text-align: center; font-size: 9px; padding: 2px 0; border-right: 1px dashed #000; }
        .gst-col:last-child { border-right: none; }
        .footer { margin-top: 10px; text-align: center; }
    `;

    return `
    <html>
        <head><style>${styles}</style></head>
        <body>
            <div class="text-center">
                ${settings?.store?.logo ? `<img src="${settings.store.logo}" style="width: 50px; height: 50px; object-fit: contain; margin-bottom: 5px;" />` : ''}
                <div class="store-name">${storeName}</div>
                <div>${storeAddress}</div>
                <div>Phone: ${storePhone}</div>
                ${storeGstin ? `<div>GSTIN: ${storeGstin}</div>` : ''}
            </div>

            <div class="dashed"></div>
            <div class="text-center header-title">BILL RECEIPT</div>
            <div class="dashed"></div>

            <div class="row">
                <span>Bill No: ${bill.id ? bill.id.slice(-6).toUpperCase() : '-'}</span>
                <span>Date: ${dateStr}</span>
            </div>
            <div class="row">
                <span>Cust: ${customerName.split(' ')[0]}</span>
                <span>Time: ${timeStr}</span>
            </div>
            <div class="row">
                <span>Mode: ${paymentMode}</span>
                <span></span>
            </div>

            <div class="dashed"></div>

            <table class="table">
                <thead>
                    <tr>
                        <th style="width: 20px;">Sn</th>
                        <th>Item</th>
                        <th style="width: 50px; text-align: right;">Rate</th>
                        <th style="width: 60px; text-align: right;">Amt</th>
                    </tr>
                </thead>
                <tbody>
                    ${items.map((item, i) => `
                        <tr>
                            <td>${i + 1}</td>
                            <td>${item.name} ${item.variantName ? `(${item.variantName})` : ''}</td>
                            <td class="text-right">${parseFloat(item.price || item.sellingPrice).toFixed(2)}</td>
                            <td class="text-right">${parseFloat(item.total).toFixed(2)}</td>
                        </tr>
                        <tr>
                            <td></td>
                            <td colspan="3" style="font-size: 9px; color: #444;">Qty: ${item.quantity}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>

            <div class="dashed"></div>

            <div class="row">
                <span>Taxable Amount:</span>
                <span class="bold">₹${subtotal.toFixed(2)}</span>
            </div>
            <div class="row">
                <span>Total Tax:</span>
                <span class="bold">₹${totalTax.toFixed(2)}</span>
            </div>
            ${roundOff !== 0 ? `
            <div class="row">
                <span>Round Off:</span>
                <span class="bold">${roundOff > 0 ? '+' : ''}${roundOff.toFixed(2)}</span>
            </div>
            ` : ''}

            <div class="grand-total row">
                <span>GRAND TOTAL:</span>
                <span>₹${totalAmount.toFixed(2)}</span>
            </div>

            <div class="gst-summary-title">GST SUMMARY</div>
            <div class="gst-box">
                <div class="gst-header">
                    <div class="gst-col" style="flex: 0.8;">%</div>
                    <div class="gst-col" style="flex: 1.2;">Taxable</div>
                    ${isInter ? `
                        <div class="gst-col" style="flex: 2;">IGST</div>
                    ` : `
                        <div class="gst-col">CGST</div>
                        <div class="gst-col">SGST</div>
                    `}
                </div>
                ${Object.keys(taxSummary).length > 0 ? Object.keys(taxSummary).map(rate => `
                    <div class="gst-row">
                        <div class="gst-col" style="flex: 0.8;">${rate}%</div>
                        <div class="gst-col" style="flex: 1.2;">${taxSummary[rate].taxable.toFixed(2)}</div>
                        ${isInter ? `
                            <div class="gst-col" style="flex: 2;">${taxSummary[rate].tax.toFixed(2)}</div>
                        ` : `
                            <div class="gst-col">${(taxSummary[rate].tax / 2).toFixed(2)}</div>
                            <div class="gst-col">${(taxSummary[rate].tax / 2).toFixed(2)}</div>
                        `}
                    </div>
                `).join('') : `
                    <div class="gst-row">
                        <div class="gst-col" style="flex: 1; border-right: none;">No Tax Details</div>
                    </div>
                `}
            </div>

            <div class="dashed" style="margin-top: 8px;"></div>
            <div class="footer">
                Thank You! Visit Again.
            </div>
        </body>
    </html>
    `;
};

const generateDetailedHTML = (bill, settings, colors) => {
    const store = settings?.store || {};
    const storeAddress = store.address || {};
    const bank = settings?.bankDetails || {};
    const items = bill.cart || bill.items || [];
    const customer = bill.customer || {};
    const customerName = bill.customerName || customer.fullName || customer.name || 'Walk-in Customer';
    const isInter = bill.taxType === 'inter';
    const invoiceDate = bill.date ? new Date(bill.date).toLocaleDateString('en-GB') : new Date().toLocaleDateString('en-GB');
    const { showLogo = true, showHsn = true, showQrcode = true } = settings?.invoice || {};

    const subtotal = Number(bill.totals?.subtotal || 0);
    const tax = Number(bill.totals?.tax || 0);
    const total = Number(bill.totals?.total || 0);

    const itemsHTML = items.map((item, idx) => {
        const qty = parseFloat(item.quantity || 0);
        const rate = parseFloat(item.price || item.sellingPrice || 0);
        const taxable = qty * rate;
        const taxRate = parseFloat(item.taxRate || 0);
        const rowTax = taxable * (taxRate / 100);
        const rowTotal = taxable + rowTax;

        return `
            <tr style="min-height: 30px;">
                <td style="border: 1px solid #000; text-align: center;">${idx + 1}</td>
                <td style="border: 1px solid #000; padding-left: 4px;">${item.name} ${item.variantName ? `(${item.variantName})` : ''}</td>
                <td style="border: 1px solid #000; text-align: center;">${qty}</td>
                <td style="border: 1px solid #000; text-align: right; padding-right: 2px;">${rate.toFixed(2)}</td>
                <td style="border: 1px solid #000; text-align: right; padding-right: 2px;">${taxable.toFixed(2)}</td>
                ${isInter ? `
                    <td style="border: 1px solid #000; text-align: center;">${taxRate}%</td>
                    <td style="border: 1px solid #000; text-align: right; padding-right: 2px;">${rowTax.toFixed(2)}</td>
                ` : `
                    <td style="border: 1px solid #000; text-align: center;">${taxRate / 2}%</td>
                    <td style="border: 1px solid #000; text-align: right; padding-right: 2px;">${(rowTax / 2).toFixed(2)}</td>
                    <td style="border: 1px solid #000; text-align: center;">${taxRate / 2}%</td>
                    <td style="border: 1px solid #000; text-align: right; padding-right: 2px;">${(rowTax / 2).toFixed(2)}</td>
                `}
                <td style="border: 1px solid #000; text-align: right; padding-right: 2px; font-weight: bold;">${rowTotal.toFixed(2)}</td>
            </tr>
        `;
    }).join('');

    return `
    <html>
    <head>
        <style>
            body { font-family: sans-serif; margin: 0; padding: 20px; color: #000; font-size: 10px; }
            .container { width: 100%; border: 2px solid #000; }
            .row { display: flex; border-bottom: 1px solid #000; }
            .col { flex: 1; border-right: 1px solid #000; padding: 5px; }
            .col:last-child { border-right: none; }
            .bold { font-weight: bold; }
            .text-center { text-align: center; }
            .bg-gray { background: #e2e2e*2; }
            table { width: 100%; border-collapse: collapse; }
            .checkbox { width: 10px; height: 10px; border: 1px solid #000; display: inline-block; margin-left: 5px; vertical-align: middle; }
            .checked { background: #000; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="row">
                <div class="col" style="flex: 0 0 70px; display: flex; align-items: center; justify-content: center;">
                    ${showLogo && store.logo ? `<img src="${store.logo}" style="width: 60px; height: 60px; object-fit: contain;" />` : '<span class="bold">LOGO</span>'}
                </div>
                <div class="col" style="text-align: center;">
                    <div class="bold" style="font-size: 14px;">${store.name || 'Store Name'}</div>
                    <div>${storeAddress.street || ''}, ${storeAddress.city || ''}, ${storeAddress.state || ''} - ${storeAddress.pincode || ''}</div>
                    <div>Tel: ${store.contact || ''}</div>
                    <div class="bold">GSTIN: ${store.gstin || 'N/A'}</div>
                </div>
                <div class="col" style="flex: 0 0 100px; padding: 0;">
                    <div style="border-bottom: 1px solid #000; padding: 2px;">Original <span class="checkbox checked"></span></div>
                    <div style="border-bottom: 1px solid #000; padding: 2px;">Duplicate <span class="checkbox"></span></div>
                    <div style="border-bottom: 1px solid #000; padding: 2px;">Triplicate <span class="checkbox"></span></div>
                    <div style="padding: 2px;">Extra Copy <span class="checkbox"></span></div>
                </div>
            </div>
            <div class="row bg-gray" style="justify-content: center; padding: 2px;"><span class="bold">TAX INVOICE</span></div>
            <div class="row" style="justify-content: center; padding: 2px; font-style: italic;">(See rule 7, for a tax invoice referred to in section 31)</div>
            <div class="row">
                <div class="col">
                    <div><span class="bold">Invoice No:</span> ${bill.weekly_sequence || '1'}</div>
                    <div><span class="bold">Invoice Date:</span> ${invoiceDate}</div>
                    <div style="margin-top: 5px;"><span class="bold">Reverse Charge (Y/N):</span> No</div>
                    <div><span class="bold">State:</span> ${storeAddress.state || '-'}</div>
                </div>
                <div class="col">
                    <div><span class="bold">Transport Mode:</span> -</div>
                    <div><span class="bold">Vehicle Number:</span> -</div>
                    <div style="margin-top: 5px;"><span class="bold">Date of Supply:</span> ${invoiceDate}</div>
                    <div><span class="bold">Place of Supply:</span> ${isInter ? 'Inter-State' : 'Local'}</div>
                </div>
            </div>
            <div class="row bg-gray">
                <div class="col text-center"><span class="bold">Detail of Receiver (Billed to)</span></div>
                <div class="col text-center"><span class="bold">Detail of Consignee (Shipped to)</span></div>
            </div>
            <div class="row" style="min-height: 60px;">
                <div class="col">
                    <div><span class="bold">Name:</span> ${customerName}</div>
                    <div><span class="bold">Address:</span> ${customer.address || '-'}</div>
                    <div><span class="bold">GSTIN:</span> ${customer.gstin || '-'}</div>
                    <div><span class="bold">Phone:</span> ${customer.mobile || '-'}</div>
                </div>
                <div class="col">
                    <div><span class="bold">Name:</span> ${customerName}</div>
                    <div><span class="bold">Address:</span> ${customer.address || '-'}</div>
                    <div><span class="bold">GSTIN:</span> ${customer.gstin || '-'}</div>
                    <div><span class="bold">State:</span> ${customer.state || '-'}</div>
                </div>
            </div>
            <table>
                <thead class="bg-gray">
                    <tr>
                        <th rowspan="2" style="border: 1px solid #000; width: 30px;">S.No</th>
                        <th rowspan="2" style="border: 1px solid #000;">Product Description</th>
                        <th rowspan="2" style="border: 1px solid #000; width: 30px;">Qty</th>
                        <th rowspan="2" style="border: 1px solid #000; width: 50px;">Rate</th>
                        <th rowspan="2" style="border: 1px solid #000; width: 60px;">Taxable Value</th>
                        ${isInter ? `
                            <th colspan="2" style="border: 1px solid #000;">IGST</th>
                        ` : `
                            <th colspan="2" style="border: 1px solid #000;">CGST</th>
                            <th colspan="2" style="border: 1px solid #000;">SGST</th>
                        `}
                        <th rowspan="2" style="border: 1px solid #000; width: 70px;">Total</th>
                    </tr>
                    <tr>
                        ${isInter ? `
                            <th style="border: 1px solid #000; width: 30px;">Rate</th>
                            <th style="border: 1px solid #000; width: 50px;">Amt</th>
                        ` : `
                            <th style="border: 1px solid #000; width: 25px;">Rate</th>
                            <th style="border: 1px solid #000; width: 35px;">Amt</th>
                            <th style="border: 1px solid #000; width: 25px;">Rate</th>
                            <th style="border: 1px solid #000; width: 35px;">Amt</th>
                        `}
                    </tr>
                </thead>
                <tbody>
                    ${itemsHTML}
                    <tr class="bold">
                        <td colspan="4" style="border: 1px solid #000; text-align: right;">Total</td>
                        <td style="border: 1px solid #000; text-align: right;">${subtotal.toFixed(2)}</td>
                        ${isInter ? `
                            <td colspan="2" style="border: 1px solid #000; text-align: right;">${tax.toFixed(2)}</td>
                        ` : `
                            <td colspan="2" style="border: 1px solid #000; text-align: right;">${(tax / 2).toFixed(2)}</td>
                            <td colspan="2" style="border: 1px solid #000; text-align: right;">${(tax / 2).toFixed(2)}</td>
                        `}
                        <td style="border: 1px solid #000; text-align: right;">${total.toFixed(2)}</td>
                    </tr>
                </tbody>
            </table>
            <div class="row">
                <div class="col" style="flex: 1.5;">
                    <div class="bold">Total Invoice Amount in Words:</div>
                    <div style="font-style: italic; margin-top: 5px;">${numberToWords(total)}</div>
                    <div style="margin-top: 10px;">
                        <div class="bold">Bank Details:</div>
                        <div>A/c Name: ${bank.accountName || '-'}</div>
                        <div>Bank: ${bank.bankName || '-'}</div>
                        <div>A/c No: ${bank.accountNumber || '-'}</div>
                        <div>IFSC: ${bank.ifsc || '-'}</div>
                    </div>
                </div>
                <div class="col" style="flex: 1; padding: 0;">
                    <div style="display: flex; justify-content: space-between; padding: 2px 5px; border-bottom: 1px solid #000;">
                        <span>Total Amount before Tax:</span><span>${subtotal.toFixed(2)}</span>
                    </div>
                    ${isInter ? `
                        <div style="display: flex; justify-content: space-between; padding: 2px 5px; border-bottom: 1px solid #000;">
                            <span>Add: IGST:</span><span>${tax.toFixed(2)}</span>
                        </div>
                    ` : `
                        <div style="display: flex; justify-content: space-between; padding: 2px 5px; border-bottom: 1px solid #000;">
                            <span>Add: CGST:</span><span>${(tax / 2).toFixed(2)}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; padding: 2px 5px; border-bottom: 1px solid #000;">
                            <span>Add: SGST:</span><span>${(tax / 2).toFixed(2)}</span>
                        </div>
                    `}
                    <div style="display: flex; justify-content: space-between; padding: 2px 5px; border-bottom: 1px solid #000;">
                        <span>Total Tax Amount:</span><span>${tax.toFixed(2)}</span>
                    </div>
                    <div class="bg-gray bold" style="display: flex; justify-content: space-between; padding: 5px;">
                        <span>Total Amount after Tax:</span><span>${total.toFixed(2)}</span>
                    </div>
                    <div class="text-center" style="font-size: 8px; padding: 2px;">GST on Reverse Charge: No</div>
                </div>
            </div>
            <div class="row" style="border-bottom: none; min-height: 80px;">
                <div class="col" style="flex: 1.5;">
                    <div class="bold">Terms & Conditions:</div>
                    <div style="font-size: 8px;">${settings?.invoice?.termsAndConditions || '1. Goods once sold will not be taken back. 2. Interest @18% pa will be charged if not paid within due date.'}</div>
                </div>
                <div class="col" style="flex: 1; display: flex; flex-direction: column; justify-content: space-between; text-align: right;">
                    <div class="bold">For ${store.name || ''}</div>
                    <div style="margin-top: 30px;">Authorised Signatory</div>
                </div>
            </div>
        </div>
    </body>
    </html>
    `;
};

const generateClassicHTML = (bill, settings, colors) => {
    const store = settings?.store || {};
    const storeAddress = store.address || {};
    const items = bill.cart || bill.items || [];
    const customer = bill.customer || {};
    const customerName = bill.customerName || customer.fullName || customer.name || 'Walk-in Customer';
    const isInter = bill.taxType === 'inter';
    const invoiceDate = bill.date ? new Date(bill.date).toLocaleDateString('en-GB') : new Date().toLocaleDateString('en-GB');
    const currency = settings?.defaults?.currency || '₹';
    const { showLogo = true } = settings?.invoice || {};

    const itemsHTML = items.map((item, idx) => {
        const qty = parseFloat(item.quantity || 0);
        const rate = parseFloat(item.price || item.sellingPrice || 0);
        const taxable = qty * rate;
        const taxRate = parseFloat(item.taxRate || 0);
        const total = taxable * (1 + taxRate / 100);

        return `
            <tr>
                <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">
                    <div style="font-weight: bold; color: #1e293b;">${item.name}</div>
                    <div style="font-size: 9px; color: #64748b; margin-top: 2px;">
                        Rate: ${currency}${rate.toFixed(2)} | Tax: ${taxRate}% ${isInter ? 'IGST' : 'GST'}
                    </div>
                </td>
                <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: center; color: #1e293b;">${qty}</td>
                <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: bold; color: #1e293b;">${currency}${total.toFixed(2)}</td>
            </tr>
        `;
    }).join('');

    return `
    <html>
    <head>
        <style>
            body { font-family: 'Helvetica', sans-serif; margin: 0; padding: 0; color: #334155; }
            .header { background: ${colors.primary}; padding: 30px; color: #fff; display: flex; justify-content: space-between; align-items: center; }
            .logo-box { width: 60px; height: 60px; background: #fff; border-radius: 8px; display: flex; align-items: center; justify-content: center; overflow: hidden; padding: 4px; }
            .content { padding: 30px; }
            .addr-box { display: flex; justify-content: space-between; margin-bottom: 30px; border-bottom: 1px solid #e2e8f0; padding-bottom: 20px; }
            .footer { display: flex; margin-top: 30px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
            .grand-total { background: ${colors.primary}; color: #fff; padding: 15px; display: flex; justify-content: space-between; align-items: center; font-size: 18px; font-weight: 900; }
        </style>
    </head>
    <body>
        <div class="header">
            <div>
                <div style="font-size: 24px; font-weight: 900; text-transform: uppercase;">${store.name || 'STORE NAME'}</div>
                <div style="font-size: 12px; margin-top: 5px; opacity: 0.9;">${storeAddress.street || ''}, ${storeAddress.city || ''}</div>
                <div style="font-size: 11px; margin-top: 2px; opacity: 0.8;">GSTIN: ${store.gstin || 'N/A'}</div>
            </div>
            ${showLogo && store.logo ? `<div class="logo-box"><img src="${store.logo}" style="width: 100%; height: 100%; object-fit: contain;"/></div>` : ''}
        </div>
        <div class="content">
            <div class="addr-box">
                <div>
                    <div style="font-size: 10px; font-weight: bold; color: #64748b; text-transform: uppercase; margin-bottom: 5px;">Bill To:</div>
                    <div style="font-size: 18px; font-weight: 900; color: #0f172a;">${customerName}</div>
                    <div style="font-size: 13px; color: #64748b; margin-top: 5px;">${customer.mobile || ''}</div>
                </div>
                <div style="text-align: right;">
                    <div style="font-size: 10px; font-weight: bold; color: #64748b; text-transform: uppercase; margin-bottom: 5px;">Invoice Details:</div>
                    <div style="font-size: 14px; font-weight: bold; color: #0f172a;">No: ${bill.weekly_sequence || '1'}</div>
                    <div style="font-size: 13px; color: #64748b; margin-top: 2px;">Date: ${invoiceDate}</div>
                </div>
            </div>
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="background: #f8fafc;">
                        <th style="padding: 12px; text-align: left; border-bottom: 2px solid ${colors.primary}; color: #475569; font-size: 12px;">Description</th>
                        <th style="padding: 12px; text-align: center; border-bottom: 2px solid ${colors.primary}; color: #475569; font-size: 12px; width: 60px;">Qty</th>
                        <th style="padding: 12px; text-align: right; border-bottom: 2px solid ${colors.primary}; color: #475569; font-size: 12px; width: 100px;">Total</th>
                    </tr>
                </thead>
                <tbody>${itemsHTML}</tbody>
            </table>
            <div class="footer">
                <div style="flex: 1.5; padding: 20px; border-right: 1px solid #e2e8f0;">
                    <div style="font-weight: bold; font-size: 12px; margin-bottom: 10px;">Terms & Notes</div>
                    <div style="font-size: 11px; line-height: 1.6; color: #64748b;">
                        1. Goods once sold will be not taken back.<br/>
                        2. Interest @18% pa will be charged if not paid within due date.<br/>
                        Thank you for your business!
                    </div>
                </div>
                <div style="flex: 1;">
                    <div style="padding: 15px; font-size: 12px;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                            <span>Subtotal:</span><span class="bold">${currency}${Number(bill.totals.subtotal).toFixed(2)}</span>
                        </div>
                        ${isInter ? `
                            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                                <span>IGST:</span><span class="bold">${currency}${Number(bill.totals.tax).toFixed(2)}</span>
                            </div>
                        ` : `
                            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                                <span>CGST:</span><span class="bold">${currency}${Number(bill.totals.tax / 2).toFixed(2)}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                                <span>SGST:</span><span class="bold">${currency}${Number(bill.totals.tax / 2).toFixed(2)}</span>
                            </div>
                        `}
                        ${bill.totals.discount > 0 ? `
                        <div style="display: flex; justify-content: space-between; margin-bottom: 8px; color: #ef4444;">
                            <span>Discount:</span><span class="bold">-${currency}${Number(bill.totals.discount).toFixed(2)}</span>
                        </div>
                        ` : ''}
                        <div style="display: flex; justify-content: space-between; color: #64748b; font-size: 10px;">
                            <span>Round Off:</span><span>${bill.totals.roundOff.toFixed(2)}</span>
                        </div>
                    </div>
                    <div class="grand-total">
                        <span style="font-size: 12px; opacity: 0.9;">TOTAL DUE</span>
                        <span>${currency}${Number(bill.totals.total).toFixed(2)}</span>
                    </div>
                </div>
            </div>
        </div>
    </body>
    </html>
    `;
};

const generateMinimalHTML = (bill, settings, colors) => {
    const store = settings?.store || {};
    const storeAddress = store.address || {};
    const items = bill.cart || bill.items || [];
    const customer = bill.customer || {};
    const customerName = bill.customerName || customer.fullName || customer.name || 'Walk-in Customer';
    const invoiceDate = bill.date ? new Date(bill.date).toLocaleDateString('en-GB') : new Date().toLocaleDateString('en-GB');
    const currency = settings?.defaults?.currency || '₹';
    const { showLogo = true } = settings?.invoice || {};

    const itemsHTML = items.map((item) => {
        const qty = parseFloat(item.quantity || 0);
        const rate = parseFloat(item.price || item.sellingPrice || 0);
        const taxable = qty * rate;
        const taxRate = parseFloat(item.taxRate || 0);
        const total = taxable * (1 + taxRate / 100);

        return `
            <tr style="border-bottom: 1px solid #f3f4f6;">
                <td style="padding: 12px 0;">
                    <div style="font-weight: 500; font-size: 14px;">${item.name}</div>
                </td>
                <td style="padding: 12px 0; text-align: center; color: #1f2937;">${qty}</td>
                <td style="padding: 12px 0; text-align: right; color: #1f2937;">${rate.toFixed(2)}</td>
                <td style="padding: 12px 0; text-align: right; color: #1f2937;">${taxRate}%</td>
                <td style="padding: 12px 0; text-align: right; font-weight: bold; color: #111;">${total.toFixed(2)}</td>
            </tr>
        `;
    }).join('');

    return `
    <html>
    <head>
        <style>
            body { font-family: sans-serif; margin: 0; padding: 0; color: #1f2937; line-height: 1.5; }
            .header-teal { background: ${colors.primary}; color: #fff; padding: 40px; display: flex; justify-content: space-between; }
            .content { padding: 40px; }
            .meta-row { display: flex; justify-content: space-between; margin-bottom: 40px; }
            .label { font-size: 10px; font-weight: bold; color: #9ca3af; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px; }
            .footer-flex { display: flex; gap: 40px; margin-top: 40px; }
            .notes-card { flex: 1; background: #f0fdfa; padding: 20px; border-radius: 8px; }
            .totals-list { flex: 1; }
            .total-banner { background: ${colors.primary}; color: #fff; padding: 15px 20px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; margin-top: 10px; }
        </style>
    </head>
    <body>
        <div class="header-teal">
            <div style="display: flex; align-items: center; gap: 20px;">
                ${showLogo && store.logo ? `<img src="${store.logo}" style="width: 60px; height: 60px; object-fit: contain; background: #fff; border-radius: 8px; padding: 5px;" />` : ''}
                <div>
                    <h1 style="margin: 0; font-size: 40px; font-weight: 900; text-transform: uppercase;">INVOICE</h1>
                    <div style="margin-top: 10px; opacity: 0.8; font-weight: 600;">No: ${bill.weekly_sequence || '1'}</div>
                </div>
            </div>
            <div style="text-align: right;">
                <div style="font-size: 18px; font-weight: bold;">${store.name || ''}</div>
                <div style="font-size: 11px; opacity: 0.8; margin-top: 5px; max-width: 250px;">
                    ${storeAddress.street || ''}, ${storeAddress.city || ''}, ${storeAddress.state || ''} ${storeAddress.pincode || ''}<br/>
                    ${store.email || ''} | GSTIN: ${store.gstin || ''}
                </div>
            </div>
        </div>
        <div class="content">
            <div class="meta-row">
                <div>
                    <div class="label">BILL TO</div>
                    <div style="font-size: 20px; font-weight: 900;">${customerName}</div>
                    <div style="font-size: 13px; color: #6b7280; margin-top: 3px;">${customer.mobile || ''}</div>
                </div>
                <div style="text-align: right;">
                    <div style="margin-bottom: 10px;">
                        <div class="label">INVOICE DATE</div>
                        <div style="font-weight: 600;">${invoiceDate}</div>
                    </div>
                </div>
            </div>
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="border-bottom: 2px solid #e5e7eb;">
                        <th style="padding-bottom: 10px; text-align: left; font-size: 10px; color: #9ca3af; text-transform: uppercase;">ITEM</th>
                        <th style="padding-bottom: 10px; text-align: center; font-size: 10px; color: #9ca3af; text-transform: uppercase; width: 50px;">QTY</th>
                        <th style="padding-bottom: 10px; text-align: right; font-size: 10px; color: #9ca3af; text-transform: uppercase; width: 80px;">PRICE</th>
                        <th style="padding-bottom: 10px; text-align: right; font-size: 10px; color: #9ca3af; text-transform: uppercase; width: 60px;">TAX</th>
                        <th style="padding-bottom: 10px; text-align: right; font-size: 10px; color: #9ca3af; text-transform: uppercase; width: 100px;">AMOUNT</th>
                    </tr>
                </thead>
                <tbody>${itemsHTML}</tbody>
            </table>
            <div class="footer-flex">
                <div class="notes-card">
                    <div class="label" style="color: #115e59;">NOTES</div>
                    <div style="font-size: 12px; color: #374151;">Thank you for your business!</div>
                    <div class="label" style="color: #115e59; margin-top: 15px;">TERMS</div>
                    <div style="font-size: 10px; color: #6b7280;">1. Goods once sold will not be taken back.<br/>2. Interest @18% pa will be charged if not paid within due date.</div>
                </div>
                <div class="totals-list">
                    <div style="display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #f3f4f6;">
                        <span style="color: #6b7280;">Subtotal</span><span style="font-weight: 600;">${currency}${Number(bill.totals.subtotal).toFixed(2)}</span>
                    </div>
                    ${isInter ? `
                        <div style="display: flex; justify-content: space-between; padding: 5px 0;">
                            <span style="color: #6b7280;">IGST</span><span style="font-weight: 600;">${currency}${Number(bill.totals.tax).toFixed(2)}</span>
                        </div>
                    ` : `
                        <div style="display: flex; justify-content: space-between; padding: 5px 0;">
                            <span style="color: #6b7280;">CGST</span><span style="font-weight: 600;">${currency}${Number(bill.totals.tax / 2).toFixed(2)}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; padding: 5px 0;">
                            <span style="color: #6b7280;">SGST</span><span style="font-weight: 600;">${currency}${Number(bill.totals.tax / 2).toFixed(2)}</span>
                        </div>
                    `}
                    ${bill.totals.discount > 0 ? `
                        <div style="display: flex; justify-content: space-between; padding: 5px 0; color: #ef4444;">
                            <span>Discount</span><span>-${currency}${Number(bill.totals.discount).toFixed(2)}</span>
                        </div>
                    ` : ''}
                    <div class="total-banner">
                        <span style="font-weight: bold; letter-spacing: 1px;">TOTAL</span>
                        <span style="font-size: 24px; font-weight: 900;">${currency}${Number(bill.totals.total).toFixed(2)}</span>
                    </div>
                </div>
            </div>
        </div>
    </body>
    </html>
    `;
};

const generateCompactHTML = (bill, settings, colors) => {
    const store = settings?.store || {};
    const storeAddress = store.address || {};
    const items = bill.cart || bill.items || [];
    const customer = bill.customer || {};
    const customerName = bill.customerName || customer.fullName || customer.name || 'Walk-in Customer';
    const isInter = bill.taxType === 'inter';
    const invoiceDate = bill.date ? new Date(bill.date).toLocaleDateString('en-GB') : new Date().toLocaleDateString('en-GB');
    const currency = settings?.defaults?.currency || '₹';
    const { showLogo = true } = settings?.invoice || {};

    const itemsHTML = items.map((item, idx) => {
        const qty = parseFloat(item.quantity || 0);
        const rate = parseFloat(item.price || item.sellingPrice || 0);
        const taxable = qty * rate;
        const taxRate = parseFloat(item.taxRate || 0);
        const total = taxable * (1 + taxRate / 100);

        return `
            <tr>
                <td style="padding: 10px; border-bottom: 1px solid ${colors.primary};">
                    <div style="font-weight: bold; color: #1e293b;">${item.name}</div>
                </td>
                <td style="padding: 10px; border-bottom: 1px solid ${colors.primary}; text-align: center;">${qty}</td>
                <td style="padding: 10px; border-bottom: 1px solid ${colors.primary}; text-align: right;">${rate.toFixed(2)}</td>
                <td style="padding: 10px; border-bottom: 1px solid ${colors.primary}; text-align: right; font-weight: bold;">${total.toFixed(2)}</td>
            </tr>
        `;
    }).join('');

    return `
    <html>
    <head>
        <style>
            body { font-family: serif; margin: 0; padding: 0; color: #475569; background: #fff; }
            .header-compact { text-align: center; padding: 40px; }
            .biz-name { font-size: 28px; font-weight: 900; color: ${colors.primary}; margin-bottom: 5px; text-transform: uppercase; }
            .info-bar { background: #fef9ef; margin: 0 40px; padding: 15px 30px; border-top: 2px solid ${colors.primary}; border-bottom: 2px solid ${colors.primary}; display: flex; justify-content: space-between; align-items: center; font-weight: bold; color: ${colors.primary}; }
            .content { padding: 40px; }
            .addr-grid { display: flex; justify-content: space-between; margin-bottom: 30px; }
            .section-title { font-size: 11px; font-weight: 900; color: ${colors.primary}; text-transform: uppercase; border-bottom: 2px solid ${colors.primary}; margin-bottom: 15px; padding-bottom: 5px; width: fit-content; }
            .footer-box { border: 2px solid ${colors.primary}; margin-top: 30px; display: flex; }
            .grand-total-row { background: #fef9ef; padding: 15px; display: flex; justify-content: space-between; align-items: center; font-size: 20px; font-weight: 900; color: ${colors.primary}; border-bottom: 1px solid ${colors.primary}; }
        </style>
    </head>
    <body>
        <div class="header-compact">
            ${showLogo && store.logo ? `<img src="${store.logo}" style="width: 80px; height: 80px; object-fit: contain; margin-bottom: 10px;" />` : ''}
            <div class="biz-name">${store.name || 'KWIQ BILL'}</div>
            <div style="font-size: 12px;">${storeAddress.street || ''}, ${storeAddress.city || ''}</div>
            <div style="font-size: 11px; font-weight: bold; margin-top: 5px;">GSTIN: ${store.gstin || ''}</div>
        </div>
        <div class="info-bar">
            <span>INVOICE NO: ${bill.weekly_sequence || '1'}</span>
            <span>DATE: ${invoiceDate}</span>
        </div>
        <div class="content">
            <div class="addr-grid">
                <div style="flex: 1;">
                    <div class="section-title">Sold To</div>
                    <div style="font-size: 18px; font-weight: 900; color: #1e293b;">${customerName}</div>
                    <div style="font-size: 13px; color: #64748b; margin-top: 5px;">${customer.mobile || ''}</div>
                </div>
                <div style="flex: 1; text-align: right;">
                    <div class="section-title" style="margin-left: auto;">Company</div>
                    <div style="font-size: 14px; font-weight: bold;">${store.name || ''}</div>
                    <div style="font-size: 12px; color: #64748b;">${store.contact || ''}</div>
                </div>
            </div>
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="color: ${colors.primary}; font-weight: 900; font-size: 12px; text-transform: uppercase;">
                        <th style="padding: 10px; text-align: left; border-bottom: 2px solid ${colors.primary};">Item</th>
                        <th style="padding: 10px; text-align: center; border-bottom: 2px solid ${colors.primary}; width: 60px;">Qty</th>
                        <th style="padding: 10px; text-align: right; border-bottom: 2px solid ${colors.primary}; width: 80px;">Rate</th>
                        <th style="padding: 10px; text-align: right; border-bottom: 2px solid ${colors.primary}; width: 100px;">Amount</th>
                    </tr>
                </thead>
                <tbody>${itemsHTML}</tbody>
            </table>
            <div class="footer-box">
                <div style="flex: 1.5; padding: 20px; border-right: 2px solid ${colors.primary};">
                    <div class="section-title">Notes / Terms</div>
                    <div style="font-size: 11px; line-height: 1.6;">1. Goods once sold will be not taken back.<br/>2. Pay securely via UPI.</div>
                </div>
                <div style="flex: 1;">
                    <div class="grand-total-row">
                        <span style="font-size: 12px;">TOTAL</span>
                        <span>${currency}${Number(bill.totals.total).toFixed(2)}</span>
                    </div>
                    <div style="padding: 15px; font-size: 11px;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                            <span>Subtotal:</span><span>${currency}${Number(bill.totals.subtotal).toFixed(2)}</span>
                        </div>
                        ${isInter ? `
                            <div style="display: flex; justify-content: space-between;">
                                <span>IGST:</span><span>${currency}${Number(bill.totals.tax).toFixed(2)}</span>
                            </div>
                        ` : `
                            <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
                                <span>CGST:</span><span>${currency}${Number(bill.totals.tax / 2).toFixed(2)}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between;">
                                <span>SGST:</span><span>${currency}${Number(bill.totals.tax / 2).toFixed(2)}</span>
                            </div>
                        `}
                    </div>
                </div>
            </div>
        </div>
    </body>
    </html>
    `;
};

export const generateReceiptHTML = (bill, settings = {}, mode = 'invoice') => {
    const paperSize = settings?.invoice?.paperSize || '80mm';
    if (paperSize === '80mm' || paperSize === '58mm') {
        return generateThermalReceiptHTML(bill, settings, mode);
    }

    const isBW = mode === 'customer' || mode === 'bw';
    const template = (isBW && settings?.invoice?.billTemplate) ? settings.invoice.billTemplate : (settings?.invoice?.template || 'Classic');

    if (!bill.totals) {
        bill.totals = {
            total: bill.total || 0,
            subtotal: bill.subtotal || 0,
            tax: bill.tax || 0,
            discount: bill.discount || 0,
            grossTotal: bill.grossTotal || 0,
            amountReceived: bill.amountReceived || 0,
            roundOff: bill.roundOff || 0,
            additionalCharges: bill.additionalCharges || 0
        };
    }

    let colors = isBW ? { primary: '#000000' } :
        template === 'Detailed' ? { primary: '#334155' } :
            template === 'Compact' ? { primary: '#8B5E3C' } :
                template === 'Minimal' ? { primary: '#137A6E' } : { primary: '#003594' };

    if (template === 'Detailed' || template === 'GST') return generateDetailedHTML(bill, settings, colors);
    if (template === 'Classic') return generateClassicHTML(bill, settings, colors);
    if (template === 'Minimal') return generateMinimalHTML(bill, settings, colors);
    if (template === 'Compact') return generateCompactHTML(bill, settings, colors);

    return generateClassicHTML(bill, settings, colors);
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

export const printBarcode = async (productName, barcodeValue, settings = {}) => {
    const storeName = settings?.store?.name || 'Kwiq Billing';
    try {
        const html = `
        <html>
        <head>
            <link href="https://fonts.googleapis.com/css2?family=Libre+Barcode+39&display=swap" rel="stylesheet">
            <style>
                body {
                    margin: 0;
                    padding: 0;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    height: 100%;
                    width: 100%;
                    background: #fff;
                    font-family: Arial, sans-serif;
                }
                .label {
                    text-align: center;
                    padding: 5px;
                }
                .store-name {
                    font-size: 11px;
                    font-weight: 900;
                    margin-bottom: 2px;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                }
                .product-name {
                    font-size: 9px;
                    color: #444;
                    margin-bottom: 4px;
                }
                .barcode {
                    font-family: 'Libre Barcode 39', cursive;
                    font-size: 52px;
                    margin: 0;
                    padding: 0;
                    line-height: 1;
                }
                .barcode-text {
                    font-size: 10px;
                    margin-top: 1px;
                    letter-spacing: 2px;
                    font-weight: bold;
                }
            </style>
        </head>
        <body>
            <div class="label">
                <div class="store-name">${storeName}</div>
                <div class="product-name">${productName}</div>
                <div class="barcode">*${barcodeValue}*</div>
                <div class="barcode-text">${barcodeValue}</div>
            </div>
        </body>
        </html>
        `;

        await Print.printAsync({
            html,
            width: 188, // ~50mm in points
            height: 94,  // ~25mm in points
        });
    } catch (error) {
        console.error('Barcode Print error:', error);
        Alert.alert('Error', 'Failed to print barcode');
    }
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

        // Choose format based on mode (Bill vs Invoice)
        // customer/bw = Bill Receipt (Thermal)
        // invoice = System Invoice (A4/A5)
        if (mode === 'customer' || mode === 'bw') {
            format = settings?.invoice?.billPaperSize || '80mm';
        } else {
            // Default to Invoice Size, unless template is explicitly 'Thermal' (legacy check)
            const template = settings?.invoice?.template || 'Classic';
            if (template === 'Thermal') {
                format = settings?.invoice?.billPaperSize || '80mm';
            } else {
                format = settings?.invoice?.invoicePaperSize || 'A4';
            }
        }
    }

    // Ensure format is in settings for downstream calls
    if (!settings.invoice) settings.invoice = {};
    settings.invoice.paperSize = format;

    try {
        const html = generateReceiptHTML(bill, settings, mode);
        const paperSize = format; // settings.invoice.paperSize is now synced

        // Define width based on paper size
        // Define width based on paper size
        let width = 302; // Default for 80mm
        let height = undefined; // Default auto/page height 

        if (paperSize === '58mm') {
            width = 219;
            height = 8000; // Simulate long roll
        }
        else if (paperSize === 'A4') width = 595;
        else if (paperSize === 'A5') width = 420;
        else {
            // 80mm case
            width = 302;
            height = 8000; // Simulate long roll
        }

        await Print.printAsync({
            html,
            width,
            height,
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

let isSharingInProgress = false;

export const shareReceiptPDF = async (bill, settings = {}) => {
    if (isSharingInProgress) return;
    isSharingInProgress = true;
    try {
        const html = generateReceiptHTML(bill, settings);
        const { uri } = await Print.printToFileAsync({ html });
        await shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
    } catch (error) {
        console.error('Share error:', error);
        Alert.alert('Error', 'Failed to share receipt');
    } finally {
        isSharingInProgress = false;
    }
};

/**
 * Bulk Print/Share Logic
 */
export const shareBulkReceiptsPDF = async (bills, settings = {}) => {
    if (isSharingInProgress) return;
    isSharingInProgress = true;
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
    } finally {
        isSharingInProgress = false;
    }
};
