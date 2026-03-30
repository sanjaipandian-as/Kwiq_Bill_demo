import * as Print from 'expo-print';
import { shareAsync } from 'expo-sharing';
import { Alert, Platform } from 'react-native';
import { exportToDeviceFolders } from '../services/backupservices';
import { fetchAllTableData } from '../services/database';
import { BLEPrinter, COMMANDS, ColumnAlignment } from 'react-native-thermal-receipt-printer-image-qr';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { globalPrintRef } from './printGlobals';


const hasIndianScript = (text) => {
    if (!text) return false;
    const regex = /[\u0B80-\u0BFF\u0900-\u097F\u0D00-\u0D7F\u0C00-\u0C7F\u0C80-\u0CFF]/;
    return regex.test(text);
};

const formatSafeDate = (dateVal) => {
    const d = new Date(dateVal || Date.now());
    if (isNaN(d.getTime())) return new Date().toLocaleDateString('en-GB');
    return d.toLocaleDateString('en-GB');
};

const formatSafeTime = (dateVal) => {
    const d = new Date(dateVal || Date.now());
    if (isNaN(d.getTime())) return new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
};


// Global state to track printer connection to avoid redundant connects which can crash native side
let lastConnectedAddress = null;
let connectionTimestamp = 0;
// Forces a fresh connection for most separate bills to avoid stale driver state
const CONNECTION_EXPIRY = 30000;
// Maximum ms we wait for any single BLE print/connect call before treating it as stuck
const PRINT_TIMEOUT_MS = 12000;

/**
 * Wraps a BLE printer promise with a hard timeout.
 * If the printer hangs (e.g. powered off mid-print, or barcode scanner
 * interrupts the BLE radio), this rejects after PRINT_TIMEOUT_MS and
 * automatically invalidates the cached connection so the next attempt
 * triggers a clean reconnect rather than silently hanging.
 */
const withPrintTimeout = (promise, label = 'print') => {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            // Invalidate the cached connection so the next print reconnects cleanly
            lastConnectedAddress = null;
            connectionTimestamp = 0;
            reject(new Error(`[Printer] ${label} timed out after ${PRINT_TIMEOUT_MS / 1000}s. Please try again.`));
        }, PRINT_TIMEOUT_MS);

        promise.then(
            (result) => { clearTimeout(timer); resolve(result); },
            (err) => { clearTimeout(timer); reject(err); }
        );
    });
};

/**
 * Exported helper: call this to force a clean reconnect on the next
 * print operation (e.g. from a "Reset & Retry" button in the UI).
 */
export const resetPrinterConnection = () => {
    lastConnectedAddress = null;
    connectionTimestamp = 0;
    console.log('[Printer] Connection state manually reset — will reconnect on next print.');
};

const ensurePrinterConnected = async (address) => {
    if (!address) return false;

    // Fast cache check - only skip connect if it was within the expiry window
    if (lastConnectedAddress === address && (Date.now() - connectionTimestamp < CONNECTION_EXPIRY)) {
        return true;
    }

    try {
        // Only init if we've never connected in this session to avoid driver resets
        if (!lastConnectedAddress) {
            try { await BLEPrinter.init(); } catch (e) { }
        }

        // Wrap connectPrinter itself — if BT is off or device vanished this can hang
        await withPrintTimeout(BLEPrinter.connectPrinter(address), 'connect');
        lastConnectedAddress = address;
        connectionTimestamp = Date.now();
        await new Promise(r => setTimeout(r, 500)); // Wait for hardware to stabilize
        return true;
    } catch (e) {
        console.warn('[Printer] Connection failed, attempting reset:', e);
        try {
            await BLEPrinter.closeConn();
            await new Promise(r => setTimeout(r, 300));
            await withPrintTimeout(BLEPrinter.connectPrinter(address), 'connect-retry');
            lastConnectedAddress = address;
            connectionTimestamp = Date.now();
            return true;
        } catch (retryErr) {
            console.error('[Printer] Final connection failure:', retryErr);
            lastConnectedAddress = null;
            return false;
        }
    }
};
const isVIP = (cust) => {
    if (!cust) return false;
    const tags = cust.tags || '';
    if (Array.isArray(tags)) {
        return tags.some(tag => String(tag).trim().toUpperCase() === 'VIP');
    }
    if (typeof tags !== 'string') return false;
    return tags.split(',').map(tag => tag.trim().toUpperCase()).includes('VIP') || tags.toUpperCase().includes('VIP');
};

const printHybrid = async (content, options = {}, paperFormat = '80mm') => {
    // CRITICAL: If no Indian scripts detected in entire content, 
    // send as ONE single command to ensure the tightest possible spacing.
    if (!hasIndianScript(content)) {
        await BLEPrinter.printText(content, options);
        return;
    }

    const lines = content.split('\n');
    const pixelWidth = paperFormat === '80mm' ? 576 : 384;

    let currentBlock = "";
    let isIndicMode = false;

    const flush = async () => {
        if (!currentBlock) return;
        try {
            if (isIndicMode) {
                const clean = currentBlock.replace(/[\x00-\x1F\x7F-\x9F]/g, "");
                const uri = await globalPrintRef.current?.renderTextToImage(clean, pixelWidth, 24);
                if (uri) {
                    // Timeout guard: image sends are the most likely to hang
                    await withPrintTimeout(BLEPrinter.printPic(uri, { width: pixelWidth }), 'printPic');
                    await new Promise(r => setTimeout(r, 150));
                } else {
                    await withPrintTimeout(BLEPrinter.printText(currentBlock + '\n', options), 'printText-indic-fallback');
                }
            } else {
                // Standard text block - preserves tight line spacing
                await withPrintTimeout(BLEPrinter.printText(currentBlock + '\n', options), 'printText');
                await new Promise(r => setTimeout(r, 60));
            }
        } catch (err) {
            console.warn('[printHybrid] Flush error (or timeout):', err);
            // Attempt a safe ASCII fallback if printing crashed/timed-out
            try {
                const safeText = currentBlock.replace(/[^\x20-\x7E\n]/g, "?");
                await withPrintTimeout(BLEPrinter.printText(safeText + '\n', options), 'printText-safe-fallback');
            } catch (e) {
                // If even the fallback fails, invalidate the connection cache
                lastConnectedAddress = null;
            }
        }
        currentBlock = "";
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (i === lines.length - 1 && line.trim() === '') continue;

        const lineIsIndic = hasIndianScript(line);
        if (lineIsIndic !== isIndicMode && currentBlock) {
            await flush();
        }

        isIndicMode = lineIsIndic;
        currentBlock += (currentBlock ? "\n" : "") + line;
    }
    await flush();
};


export const printBluetoothReceipt = async (bill, settings = {}, format = '80mm', mode = 'customer', options = {}) => {
    try {
        if (options.forceAuthorized) {
            settings = { 
                ...settings, 
                invoice: { ...settings.invoice, showBankAndSignature: true } 
            };
        }
        const printerAddress = settings?.invoice?.selectedPrinter?.address;
        const template = settings?.invoice?.billTemplate || 'Professional';

        // 'Classic' is the SettingsContext default value for the bill template selector.
        // It maps to the Professional thermal layout (clean column format).
        // 'Professional' also routes here. Only 'Standard' uses the plain ESC/POS path below.
        if (template === 'Professional' || template === 'Classic') {
            return await printProfessionalBluetoothReceipt(bill, settings, format, mode, options);
        }

        // ── STANDARD TEMPLATE (only when billTemplate is explicitly 'Standard') ──────────

        const store = settings?.store || {};
        const isInter = bill.taxType === 'inter';
        const items = bill.cart || bill.items || [];
        const is80 = format === '80mm';
        const width = is80 ? 48 : 31;
        const cur = "Rs.";

        // Helpers
        const padR = (s, l) => (String(s) + " ".repeat(l)).substring(0, l);
        const padL = (s, l) => (" ".repeat(l) + String(s)).slice(-l);
        const drawLine = (char = '-') => char.repeat(width) + "\n";
        const center = (s) => {
            const spaces = Math.max(0, Math.floor((width - String(s).length) / 2));
            return " ".repeat(spaces) + String(s) + "\n";
        };

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
        bill.totals.totalItems = bill.totals.totalItems || items.length;
        bill.totals.totalQty = bill.totals.totalQty || items.reduce((sum, i) => sum + parseFloat(i.quantity || 0), 0);

        // 1. Ensure Connection
        if (printerAddress && !(await ensurePrinterConnected(printerAddress))) {
            throw new Error("Printer not connected. Please check Settings.");
        }

        // ── IMAGE RENDER PREVIEW EXACT MATCH ────────────────────────────
        try {
            if (globalPrintRef.current) {
                const pixelWidth = is80 ? 576 : 384;
                const uri = await globalPrintRef.current.renderBillToImage(bill, settings, false, pixelWidth);
                if (uri) {
                    const { BLEPrinter } = require('react-native-thermal-receipt-printer-image-qr');
                    await BLEPrinter.printPic(uri, { width: pixelWidth });
                    await new Promise(r => setTimeout(r, 1000));
                    await BLEPrinter.printText("\n\n\n\n");
                    return true;
                }
            }
        } catch (imgError) {
            console.warn("Image print failed, falling back to text:", imgError);
        }

        // 2. Tax Summary calculation omitted from items list as requested
        const taxSummary = {};
        const isInclusive = settings?.tax?.defaultType === 'Inclusive' || settings?.tax?.priceMode === 'Inclusive';
        items.forEach(item => {
            const tr = parseFloat(item.taxRate || 0);
            const price = parseFloat(item.price || item.sellingPrice || 0);
            const qty = parseFloat(item.quantity || 0);
            let taxable = price * qty;
            let taxVal = 0;
            if (isInclusive) {
                const totalInc = price * qty;
                taxable = totalInc / (1 + (tr / 100));
                taxVal = totalInc - taxable;
            } else {
                taxVal = taxable * (tr / 100);
            }
            if (!taxSummary[tr]) taxSummary[tr] = { taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0 };
            taxSummary[tr].taxable += taxable;
            if (isInter) taxSummary[tr].igst += taxVal;
            else { taxSummary[tr].cgst += taxVal / 2; taxSummary[tr].sgst += taxVal / 2; }
            taxSummary[tr].total += taxVal;
        });

        let header = COMMANDS.TEXT_FORMAT.TXT_NORMAL + COMMANDS.TEXT_FORMAT.TXT_ALIGN_CT;
        header += COMMANDS.TEXT_FORMAT.TXT_4SQUARE + (store.name || 'Store Name').toUpperCase() + "\n";
        header += COMMANDS.TEXT_FORMAT.TXT_NORMAL;

        const contactStr = store.contact || store.phone || store.whatsapp;
        if (contactStr) header += center("WHATSAPP NO: " + contactStr);

        if (typeof store.address === 'object') {
            if (store.address.street) header += center(store.address.street);
            if (store.address.city) header += center(store.address.city);
        } else if (store.address) {
            header += center(store.address);
        }

        if (store.gstin) header += center("GSTIN: " + store.gstin);
        header += drawLine('-');
        if (mode === 'invoice') {
            const invoiceTitle = settings?.invoice?.headerTitle || "TAX INVOICE";
            header += center(invoiceTitle.toUpperCase());
            header += drawLine('-');
        }

        // Meta rows — Bill No + Date + Time on one line
        const bNo = `Bill: ${bill.weekly_sequence || (bill.id ? String(bill.id).slice(-6).toUpperCase() : '-')}`;
        const dtStr = `${formatSafeDate(bill.date)} ${formatSafeTime(bill.date)}`;
        header += padR(bNo, width - dtStr.length) + dtStr + "\n";


        // Payment mode — show readable name, not numeric code
        const customer = bill.customer || {};
        const vip = isVIP(customer);
        const rawMode = (bill.paymentMode || bill.paymentType || 'Cash');
        const pModeName = rawMode.toLowerCase().includes('cash') ? 'Cash'
            : rawMode.toLowerCase().includes('upi') ? 'UPI'
                : rawMode.toLowerCase().includes('card') ? 'Card'
                    : rawMode.toLowerCase().includes('credit') ? 'Credit'
                        : rawMode;
        const pMode = `Mode: ${pModeName}`;
        header += padL(pMode, width) + "\n";

        // Customer row — only if there's a real named customer (not walk-in/guest)
        const customerName = bill.customerName || customer.name || customer.fullName || '';
        const hasRealCustomer = customerName && customerName.trim().toLowerCase() !== 'guest';
        if (hasRealCustomer) {
            const cDisp = `Cust: ${customerName.substring(0, 20)}${vip ? ' (VIP)' : ''}`;
            header += cDisp.substring(0, width) + "\n";
        } else if (vip) {
            header += center('VIP CUSTOMER');
        }

        header += drawLine('-');

        // Items — Sn | Item | Qty | Rate | Amt
        const iCol = is80 ? 18 : 10;  // Item name width
        const qCol = 5;               // Qty width
        const rCol = 7;               // Rate width
        const aCol = width - 3 - iCol - qCol - rCol; // Amt = remaining

        let receiptBody = padR('Sn', 3) + padR('Item', iCol) + padL('Qty', qCol) + padL('Rate', rCol) + padL('Amt', aCol) + "\n";
        receiptBody += drawLine('-');

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const name = (item.name || 'Item').substring(0, iCol);
            const qty = parseFloat(item.quantity || 0);
            const qtyStr = qty % 1 === 0 ? String(qty) : qty.toFixed(2);
            const rate = parseFloat(item.price || item.sellingPrice || 0).toFixed(2);
            const amt = parseFloat(item.total || 0).toFixed(2);
            receiptBody += padR(`${i + 1}`, 3) + padR(name, iCol) + padL(qtyStr, qCol) + padL(rate, rCol) + padL(amt, aCol) + "\n";
        }

        // 6. Totals & Payment Info
        receiptBody += drawLine('-');
        const tot = bill.totals || bill;
        const taxableAmt = parseFloat(tot.subtotal || bill.subtotal || 0);
        const totalTax = parseFloat(tot.tax || bill.tax || 0);
        const totalBill = parseFloat(tot.total || bill.total || 0);
        const paidAmt = parseFloat(bill.amountReceived || bill.paidAmount || 0);
        const additionalCharges = parseFloat(tot.additionalCharges || bill.additionalCharges || 0);
        const discount = parseFloat(tot.discount || bill.discount || 0);
        const remarks = bill.internalNotes || bill.remarks || '';

        receiptBody += padR("Taxable Amount:", width - 12) + padL(`${cur}${taxableAmt.toFixed(2)}`, 12) + "\n";
        receiptBody += padR("Total Tax:", width - 12) + padL(`${cur}${totalTax.toFixed(2)}`, 12) + "\n";
        if (additionalCharges > 0) receiptBody += padR("Extra Charges:", width - 12) + padL(`+${cur}${additionalCharges.toFixed(2)}`, 12) + "\n";
        if (discount > 0) receiptBody += padR("Bill Discount:", width - 12) + padL(`-${cur}${discount.toFixed(2)}`, 12) + "\n";

        receiptBody += drawLine('=');
        receiptBody += COMMANDS.TEXT_FORMAT.TXT_BOLD_ON;
        receiptBody += padR("GRAND TOTAL:", width - 12) + padL(`${cur}${totalBill.toFixed(2)}`, 12) + "\n";
        receiptBody += COMMANDS.TEXT_FORMAT.TXT_BOLD_OFF;
        receiptBody += drawLine('=');

        receiptBody += padR("Status:", width - 12) + padL(paidAmt >= totalBill ? 'PAID' : 'UNPAID', 12) + "\n";
        receiptBody += padR("Paid Amount:", width - 12) + padL(`${cur}${paidAmt.toFixed(2)}`, 12) + "\n";
        if (Math.abs(totalBill - paidAmt) > 0.01) {
            receiptBody += padR(paidAmt >= totalBill ? "Change:" : "Balance:", width - 12) + padL(`${cur}${Math.abs(totalBill - paidAmt).toFixed(2)}`, 12) + "\n";
        }

        if (settings?.invoice?.showTaxBreakup !== false) {
            receiptBody += COMMANDS.TEXT_FORMAT.TXT_BOLD_ON + center("GST SUMMARY") + COMMANDS.TEXT_FORMAT.TXT_BOLD_OFF;

            // Dynamic full-width column calculation
            const cW = is80
                ? (isInter ? [7, 18, 18] : [7, 13, 11, 11])
                : (isInter ? [4, 9, 14] : [4, 9, 6, 6]);

            const hL = "+" + cW.map(w => "-".repeat(w)).join("+") + "+\n";
            receiptBody += hL;
            if (isInter) receiptBody += "|" + padR("%", cW[0]) + "|" + padL("Taxable", cW[1]) + "|" + padL("IGST", cW[2]) + "|\n";
            else receiptBody += "|" + padR("%", cW[0]) + "|" + padL("Taxable", cW[1]) + "|" + padL("CGST", cW[2]) + "|" + padL("SGST", cW[3]) + "|\n";
            receiptBody += hL;

            Object.keys(taxSummary).sort((a, b) => a - b).forEach(rate => {
                const s = taxSummary[rate];
                if (isInter) receiptBody += "|" + padR(rate, cW[0]) + "|" + padL(s.taxable.toFixed(2), cW[1]) + "|" + padL(s.igst.toFixed(2), cW[2]) + "|\n";
                else receiptBody += "|" + padR(rate, cW[0]) + "|" + padL(s.taxable.toFixed(2), cW[1]) + "|" + padL(s.cgst.toFixed(2), cW[2]) + "|" + padL(s.sgst.toFixed(2), cW[3]) + "|\n";
            });
            receiptBody += hL;
        }

        receiptBody += drawLine('-');
        if (remarks.trim()) {
            receiptBody += "NOTES: " + remarks.trim() + "\n";
            receiptBody += drawLine('-');
        }

        // Terms & Conditions — controlled by showTerms toggle in settings
        const showTerms = settings?.invoice?.showTerms !== false; // default ON
        const termsText = (settings?.invoice?.termsAndConditions || '').trim();
        const conditionsText = (settings?.invoice?.conditionsText || '').trim();
        if (showTerms && (termsText || conditionsText)) {
            receiptBody += drawLine('-');
            receiptBody += COMMANDS.TEXT_FORMAT.TXT_BOLD_ON + "TERMS & CONDITIONS:\n" + COMMANDS.TEXT_FORMAT.TXT_BOLD_OFF;
            
            // Terms
            if (termsText) {
                const words = termsText.split(' ');
                let line = '';
                words.forEach(word => {
                    if ((line + word).length > width) {
                        receiptBody += line.trim() + "\n";
                        line = word + ' ';
                    } else {
                        line += word + ' ';
                    }
                });
                if (line.trim()) receiptBody += line.trim() + "\n";
            }
            
            // Conditions
            if (conditionsText) {
                const words = conditionsText.split(' ');
                let line = '';
                words.forEach(word => {
                    if ((line + word).length > width) {
                        receiptBody += line.trim() + "\n";
                        line = word + ' ';
                    } else {
                        line += word + ' ';
                    }
                });
                if (line.trim()) receiptBody += line.trim() + "\n";
            }
            receiptBody += drawLine('-');
        }

        // Footer Note & VIP Message
        const footerNote = settings?.invoice?.footerNote || 'Thank you for shopping!';
        receiptBody += center(footerNote);
        if (vip) {
            receiptBody += center("Thank you for your business with us!");
        }

        // Final Authorized Signatory Footer (absolute bottom)
        if (settings?.invoice?.showBankAndSignature && !options.isNonAuthorized) {
            receiptBody += drawLine('-'); // Divider line
            receiptBody += "\n\n" + center("_______________________");
            receiptBody += center("AUTHORIZED SIGNATORY") + "\n";
            if (bill.receptionist_name) {
                receiptBody += center("(" + bill.receptionist_name.toUpperCase() + ")");
            }
        }

        // Optional Bank Details
        if (settings?.invoice?.showBankAndSignature && !options.hideAccountDetails) {
            const bank = settings?.bankDetails || {};
            if (bank.bankName) {
                receiptBody += drawLine('-');
                receiptBody += COMMANDS.TEXT_FORMAT.TXT_BOLD_ON + "BANK DETAILS:\n" + COMMANDS.TEXT_FORMAT.TXT_BOLD_OFF;
                receiptBody += `Bank: ${bank.bankName}\n`;
                receiptBody += `A/C: ${bank.accountNumber || ''}\n`;
                receiptBody += `IFSC: ${bank.ifsc || ''}\n`;
            }
            receiptBody += drawLine('-');
        }


        receiptBody += "\n\n\n\n";

        // Use Hybrid Printing for multi-language support
        await printHybrid(header + receiptBody, { cut: true }, format);
        return true;
    } catch (e) {
        console.error('Print failed:', e);
        throw e;
    }
};

export const printProfessionalBluetoothReceipt = async (bill, settings = {}, format = '80mm', mode = 'customer', options = {}) => {
    try {
        if (options.forceAuthorized) {
            settings = { 
                ...settings, 
                invoice: { ...settings.invoice, showBankAndSignature: true } 
            };
        }
        const printerAddress = settings?.invoice?.selectedPrinter?.address;
        const store = settings?.store || {};
        const items = bill.cart || bill.items || [];
        const is80 = format === '80mm';
        const width = is80 ? 48 : 31;
        const cur = "Rs.";
        const lang = settings?.invoice?.billLanguage || 'en';
        const customer = bill.customer || {};
        const vip = isVIP(customer);

        const translations = {
            en: { mid: 'M.O.P', date: 'Date', receiptNo: 'Bill No', time: 'Time', item: 'Item', qty: 'Qty', price: 'Price', amt: 'Amount', totalItems: 'Total Items', totalQty: 'Qty', taxPct: 'TAX %', taxable: 'TAXABLE', cgst: 'CGST', sgst: 'SGST', igst: 'IGST', grandTotal: 'Grand Total', total: 'Total', mobile: 'MOBILE NO', whatsapp: 'WHATSAPP' },
            ta: { mid: 'M.O.P', date: 'தேதி', receiptNo: 'ரசீது எண்', time: 'நேரம்', item: 'பொருள்', qty: 'அளவு', price: 'விலை', amt: 'தொகை', totalItems: 'மொத்த பொருட்கள்', totalQty: 'அளவு', taxPct: 'வரி %', taxable: 'வரிக்குரியது', cgst: 'CGST', sgst: 'SGST', igst: 'IGST', grandTotal: 'மொத்தம்', total: 'மொத்தம்', mobile: 'மொபைல் எண்', whatsapp: 'வாட்ஸ்அப்' },
            hi: { mid: 'M.O.P', date: 'दिनांक', receiptNo: 'रसीद संख्या', time: 'समय', item: 'वस्तु', qty: 'मात्रा', price: 'मूल्य', amt: 'राशि', totalItems: 'कुल वस्तुएं', totalQty: 'मात्रा', taxPct: 'कर %', taxable: 'कर योग्य', cgst: 'CGST', sgst: 'SGST', igst: 'IGST', grandTotal: 'कुल योग', total: 'कुल', mobile: 'मोबाइल नंबर', whatsapp: 'व्हाट्सएप' },
            ml: { mid: 'M.O.P', date: 'തീയതി', receiptNo: 'രസീത് നമ്പർ', time: 'സമയം', item: 'ഇനം', qty: 'അളവ്', price: 'വില', amt: 'തുക', totalItems: 'ആകെ ഇനങ്ങൾ', totalQty: 'അളവ്', taxPct: 'നികുതി %', taxable: 'നികുതി വിധേയം', cgst: 'CGST', sgst: 'SGST', igst: 'IGST', grandTotal: 'ആകെ തുക', total: 'ആകെ', mobile: 'മൊബൈൽ നമ്പർ', whatsapp: 'വാട്ട്‌സ്ആപ്പ്' },
            te: { mid: 'M.O.P', date: 'తేదీ', receiptNo: 'రశీదు సంఖ్య', time: 'సమయం', item: 'వస్తువు', qty: 'పరిమాణం', price: 'ధర', amt: 'మొత్తం', totalItems: 'మొత్తం వస్తువులు', totalQty: 'అమౌంట్', taxPct: 'పన్ను %', taxable: 'పన్ను విధించదగినది', cgst: 'CGST', sgst: 'SGST', igst: 'IGST', grandTotal: 'మొత్తం', total: 'మొత్తం', mobile: 'మొబైల్ నంబర్', whatsapp: 'వాట్సాప్' },
            kn: { mid: 'M.O.P', date: 'ದಿನಾಂಕ', receiptNo: 'ರಸೀದಿ ಸಂಖ್ಯೆ', time: 'ಸಮಯ', item: 'ವಸ್ತು', qty: 'ಪ್ರಮಾಣ', price: 'ಬೆಲೆ', amt: 'ಮೊತ್ತ', totalItems: 'ಒಟ್ಟು ವಸ್ತುಗಳು', totalQty: 'ಪ್ರಮಾಣ', taxPct: 'ತೆರಿಗೆ %', taxable: 'ತೆರಿಗೆಯ ಮೌಲ್ಯ', cgst: 'CGST', sgst: 'SGST', igst: 'IGST', grandTotal: 'ಒಟ್ಟು', total: 'ಒಟ್ಟು', mobile: 'ಮೊಬೈಲ್ ಸಂಖ್ಯೆ', whatsapp: 'ವಾಟ್ಸಾಪ್' }
        };
        const t = translations[lang] || translations.en;

        // Helpers
        const padR = (s, l) => (String(s) + " ".repeat(l)).substring(0, l);
        const padL = (s, l) => (" ".repeat(l) + String(s)).slice(-l);
        const drawLine = (char = '-') => char.repeat(width) + "\n";
        const center = (s) => {
            if (!s) return "";
            return String(s).split('\n').map(line => {
                const spaces = Math.max(0, Math.floor((width - line.length) / 2));
                return " ".repeat(spaces) + line;
            }).join('\n') + "\n";
        };

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
        bill.totals.totalItems = bill.totals.totalItems || items.length;
        bill.totals.totalQty = bill.totals.totalQty || items.reduce((sum, i) => sum + parseFloat(i.quantity || 0), 0);

        // 1. Ensure Connection
        if (printerAddress && !(await ensurePrinterConnected(printerAddress))) {
            throw new Error("Printer not connected.");
        }

        // ── IMAGE RENDER PREVIEW EXACT MATCH ────────────────────────────
        try {
            if (globalPrintRef.current) {
                const pixelWidth = is80 ? 576 : 384;
                const uri = await globalPrintRef.current.renderBillToImage(bill, settings, true, pixelWidth);
                if (uri) {
                    const { BLEPrinter } = require('react-native-thermal-receipt-printer-image-qr');
                    await BLEPrinter.printPic(uri, { width: pixelWidth });
                    await new Promise(r => setTimeout(r, 1000));
                    await BLEPrinter.printText("\n\n\n\n");
                    return true;
                }
            }
        } catch (imgError) {
            console.warn("Image print failed, falling back to text:", imgError);
        }

        // ── HEADER ──────────────────────────────────────────────────────────
        // Store name: large + centered (matches in-app preview)
        let printData = COMMANDS.TEXT_FORMAT.TXT_ALIGN_CT;
        printData += COMMANDS.TEXT_FORMAT.TXT_4SQUARE;
        printData += (store.name || 'Store Name').toUpperCase() + "\n";
        printData += COMMANDS.TEXT_FORMAT.TXT_NORMAL;

        const contactStrProf = store.contact || store.phone || store.whatsapp;
        if (contactStrProf) printData += center("WHATSAPP NO: " + contactStrProf);

        if (typeof store.address === 'object') {
            if (store.address.street) printData += center(store.address.street);
            if (store.address.city) printData += center(store.address.city);
        } else if (store.address) {
            printData += center(store.address);
        }

        if (store.gstin) printData += center("GSTIN: " + store.gstin);

        // Header type: TAX INVOICE for invoices, clean line only for customer bills
        printData += drawLine('=');
        if (mode === 'invoice') {
            const invoiceTitle = settings?.invoice?.headerTitle || "TAX INVOICE";
            printData += COMMANDS.TEXT_FORMAT.TXT_BOLD_ON;
            printData += center(invoiceTitle.toUpperCase());
            printData += center("(Original for Recipient)");
            printData += COMMANDS.TEXT_FORMAT.TXT_BOLD_OFF;
            printData += drawLine('-');
        }
        printData += COMMANDS.TEXT_FORMAT.TXT_ALIGN_LT;



        // ── BILL META ────────────────────────────────────────────────────────
        const now = new Date(bill.date || Date.now());
        const ds = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear().toString().slice(-2)}`;
        // Manual AM/PM -- toLocaleTimeString on Android outputs U+202F (narrow no-break space) before
        // AM/PM which ESC/POS printers render as garbage like 'c>'. Build the string manually.
        const rawH = now.getHours();
        const rawM = now.getMinutes();
        const ampm = rawH >= 12 ? 'PM' : 'AM';
        const h12 = rawH % 12 || 12;
        const ts = h12 + ':' + rawM.toString().padStart(2, '0') + ' ' + ampm;

        // Payment mode — readable name, not numeric codes
        const rawMode = (bill.paymentMode || bill.paymentType || 'Cash');
        const pModeName = rawMode.toLowerCase().includes('cash') ? 'Cash'
            : rawMode.toLowerCase().includes('upi') ? 'UPI'
                : rawMode.toLowerCase().includes('card') ? 'Card'
                    : rawMode.toLowerCase().includes('credit') ? 'Credit'
                        : rawMode;
        const midStr = `${t.mid || 'Mode'}: ${pModeName}`;
        const dateStr = `${t.date}: ${ds}`;
        printData += padR(midStr, width - dateStr.length) + dateStr + "\n";

        const billNo = `${t.receiptNo}: ${bill.weekly_sequence || String(bill.id || '').slice(-6).toUpperCase() || '-'}`;
        const timeStr = `${t.time}: ${ts}`;
        printData += padR(billNo, width - timeStr.length) + timeStr + "\n";

        if (vip) {
            const custName = bill.customerName || customer.fullName || customer.name || '';
            printData += COMMANDS.TEXT_FORMAT.TXT_BOLD_ON + "RE-WS-VIP " + custName + COMMANDS.TEXT_FORMAT.TXT_BOLD_OFF + "\n";
        }

        printData += drawLine('-');

        // Table Header
        const col1 = width - 24; // Item name part
        const col2 = 6;  // Qty
        const col3 = 9;  // Rate
        const col4 = 9;  // Amt

        printData += padR(t.item, col1) + padR(t.qty, col2) + padL(t.price, col3) + padL(t.amt, col4) + "\n";
        printData += drawLine('-');

        let totalQtySum = 0;
        items.forEach(item => {
            const name = (item.name || '').toUpperCase().substring(0, col1 - 1);
            const qty = parseFloat(item.quantity || 0);
            totalQtySum += qty;
            const rate = parseFloat(item.price || 0).toFixed(2);
            const amt = parseFloat(item.total || 0).toFixed(2);
            printData += padR(name, col1) + padR(`${qty}${item.unit || 'S'}`, col2) + padL(rate, col3) + padL(amt, col4) + "\n";
        });

        printData += drawLine('-');

        const tot = bill.totals || bill;
        const summary = `${t.totalItems}:${items.length} / ${t.totalQty} ${totalQtySum.toFixed(3)}`;
        const totalAmt = parseFloat(tot.total || 0).toFixed(2);
        printData += padR(summary, width - totalAmt.length) + totalAmt + "\n";
        printData += drawLine('-');

        if (settings?.invoice?.showTaxBreakup !== false) {
            const isInter = bill.taxType === 'inter';
            const tW = isInter ? Math.floor(width / 4) : Math.floor(width / 5);
            if (isInter) {
                printData += padR(t.taxPct, tW) + padR(t.taxable, tW) + padR(t.igst, tW) + padL(t.total, width - (tW * 3)) + "\n";
            } else {
                printData += padR(t.taxPct, tW) + padR(t.taxable, tW) + padR(t.cgst, tW) + padR(t.sgst, tW) + padL(t.total, width - (tW * 4)) + "\n";
            }

            const trPct = (items[0]?.taxRate || 5).toFixed(2) + "%";
            const taxableVal = parseFloat(tot.subtotal || 0).toFixed(2);
            const cgst = parseFloat(tot.cgst || (tot.tax / 2) || 0).toFixed(2);
            const sgst = parseFloat(tot.sgst || (tot.tax / 2) || 0).toFixed(2);
            const igst = parseFloat(tot.igst || tot.tax || 0).toFixed(2);

            if (isInter) {
                printData += padR(trPct, tW) + padR(taxableVal, tW) + padR(igst, tW) + padL(totalAmt, width - (tW * 3)) + "\n";
            } else {
                printData += padR(trPct, tW) + padR(taxableVal, tW) + padR(cgst, tW) + padR(sgst, tW) + padL(totalAmt, width - (tW * 4)) + "\n";
            }
            printData += drawLine('-');
        }

        printData += COMMANDS.TEXT_FORMAT.TXT_BOLD_ON;
        printData += padR(t.grandTotal.toUpperCase() + " :", width - totalAmt.length - 2) + "Rs." + totalAmt + "\n";
        printData += COMMANDS.TEXT_FORMAT.TXT_BOLD_OFF;
        printData += drawLine('-');

        printData += center("MOBILE NO: " + (store.contact || store.phone || store.whatsapp || 'N/A'));

        // Formal Footer Section (Only if toggled ON)
        if (settings?.invoice?.showBankAndSignature) {
            const bank = settings?.bankDetails || {};
            if (bank.bankName) {
                printData += drawLine('-');
                printData += COMMANDS.TEXT_FORMAT.TXT_BOLD_ON + "BANK DETAILS:\n" + COMMANDS.TEXT_FORMAT.TXT_BOLD_OFF;
                printData += `Bank: ${bank.bankName}\n`;
                printData += `A/C: ${bank.accountNumber || ''}\n`;
                printData += `IFSC: ${bank.ifsc || ''}\n`;
            }
        }

        // Terms & Conditions — controlled by showTerms toggle in settings
        const showTermsProf = settings?.invoice?.showTerms !== false; 
        const termsTextProf = (settings?.invoice?.termsAndConditions || '').trim();
        const conditionsTextProf = (settings?.invoice?.conditionsText || '').trim();
        if (showTermsProf && (termsTextProf || conditionsTextProf)) {
            printData += drawLine('-');
            printData += COMMANDS.TEXT_FORMAT.TXT_BOLD_ON + "TERMS & CONDITIONS:\n" + COMMANDS.TEXT_FORMAT.TXT_BOLD_OFF;
            
            if (termsTextProf) {
                const words = termsTextProf.split(' ');
                let line = '';
                words.forEach(word => {
                    if ((line + word).length > width) {
                        printData += line.trim() + "\n";
                        line = word + ' ';
                    } else {
                        line += word + ' ';
                    }
                });
                if (line.trim()) printData += line.trim() + "\n";
            }
            
            if (conditionsTextProf) {
                const words = conditionsTextProf.split(' ');
                let line = '';
                words.forEach(word => {
                    if ((line + word).length > width) {
                        printData += line.trim() + "\n";
                        line = word + ' ';
                    } else {
                        line += word + ' ';
                    }
                });
                if (line.trim()) printData += line.trim() + "\n";
            }
        }

        // Footer Note & VIP Message
        const footerNoteProf = settings?.invoice?.footerNote || 'Thank you for shopping!';
        printData += "\n" + center(footerNoteProf);
        if (vip) {
            printData += center("Thank you for your business with us!");
        }

        // Final Authorized Signatory Footer (bottom-most row)
        if (settings?.invoice?.showBankAndSignature && !options.isNonAuthorized) {
            printData += drawLine('-'); // Divider line
            printData += "\n\n" + center("_______________________");
            printData += center("AUTHORIZED SIGNATORY") + "\n";
            if (bill.receptionist_name) {
                printData += center("(" + bill.receptionist_name.toUpperCase() + ")");
            }
        }

        // Signatory (Only for Invoices)
        if (mode === 'invoice' && !options.isNonAuthorized) {
            printData += drawLine('-');
            printData += "\n" + center("_______________________");
            printData += center("Authorized Signatory\n");
        }


        printData += "\n\n\n\n";

        // Use Hybrid Printing for multi-language support
        await printHybrid(printData, { cut: true }, format);
        return true;
    } catch (e) {
        console.error('Professional Print failed:', e);
        throw e;
    }
};

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

const generateThermalReceiptHTML = (bill, settings, mode = 'invoice', options = {}) => {
    const paperSize = settings?.invoice?.paperSize || '80mm';
    const storeName = settings?.store?.name || 'Store Name';
    const storeAddressObj = settings?.store?.address || {};
    const storeAddress = `${storeAddressObj.street || ''}, ${storeAddressObj.city || ''}`;
    const storePhone = settings?.store?.contact || settings?.store?.phone || '';
    const storeGstin = settings?.store?.gstin || '';

    const items = bill.cart || bill.items || [];
    const customer = bill.customer || {};
    const vip = isVIP(customer);
    const customerName = bill.customerName || customer.fullName || customer.name || '';

    // Date formatting using safe helpers
    const dateStr = formatSafeDate(bill.date);
    const timeStr = formatSafeTime(bill.date);


    const totalQty = items.reduce((acc, item) => acc + (parseFloat(item.quantity) || 0), 0);
    const subtotal = bill.totals?.subtotal || bill.subtotal || 0;
    const totalTax = (bill.totals?.tax || bill.tax || 0);
    const totalAmount = bill.totals?.total || bill.total || 0;
    const roundOff = bill.totals?.roundOff || 0;
    const loyaltyDiscount = bill.totals?.loyaltyPointsDiscount || 0;
    const amountReceived = parseFloat(bill.amountReceived || 0);
    const additionalCharges = bill.totals?.additionalCharges || bill.additionalCharges || 0;
    const remarks = bill.internalNotes || bill.remarks || '';
    const balanceDue = Math.max(0, totalAmount - amountReceived);

    let paymentStatus = 'Not Paid';
    if (amountReceived >= totalAmount) {
        paymentStatus = 'Paid Fully';
    } else if (amountReceived > 0) {
        paymentStatus = 'Partially Paid';
    }

    const paymentMode = (bill.payments && bill.payments.length > 0) ? bill.payments[0].method : (bill.paymentType || 'Cash');
    const { billTemplate = 'Standard' } = settings?.invoice || {};

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
        .store-name { font-size: 16px; font-weight: 900; text-transform: uppercase; margin-bottom: 4px; }
        .header-title { font-size: 12px; font-weight: 900; padding: 2px 0; border-top: 1px dashed #000; border-bottom: 1px dashed #000; margin: 5px 0; }
        .row { display: flex; justify-content: space-between; margin: 2px 0; }
        .table { width: 100%; border-collapse: collapse; margin-bottom: 5px; }
        .table th { border-bottom: 1px dashed #000; padding: 5px 0; text-align: left; font-weight: 900; }
        .table td { padding: 4px 0; vertical-align: top; }
        .item-info { display: flex; flex-direction: column; }
        .item-row { display: flex; border-bottom: 1px dotted #eee; padding: 4px 0; }
        .item-name-cell { flex: 2; word-wrap: break-word; }
        .item-price-cell { flex: 1; text-align: right; white-space: nowrap; }
        .item-total-cell { flex: 1; text-align: right; white-space: nowrap; }
        .grand-total { font-size: 14px; font-weight: 900; border-top: 2px dashed #000; border-bottom: 2px dashed #000; padding: 6px 0; margin: 8px 0; }
        .payment-box { background-color: #f9f9f9; padding: 5px; border: 1px dashed #000; margin: 10px 0; }
        .gst-summary-title { font-weight: 900; margin-top: 12px; margin-bottom: 4px; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; }
        .gst-box { border: 1px solid #000; margin-top: 4px; width: 100%; }
        .gst-header { display: flex; border-bottom: 1px solid #000; background: #eee; font-weight: 900; }
        .gst-row { display: flex; border-bottom: 1px dotted #000; }
        .gst-row:last-child { border-bottom: none; }
        .gst-col { flex: 1; text-align: center; font-size: 10px; padding: 4px 0; border-right: 1px solid #000; }
        .gst-col:last-child { border-right: none; }
        .footer { margin-top: 15px; text-align: center; font-size: 10px; }
    `;

    if (billTemplate === 'Professional') {
        const lang = settings?.invoice?.billLanguage || 'en';
        const translations = {
            en: { mid: 'M.O.P', date: 'Date', receiptNo: 'Bill No', time: 'Time', item: 'Item', qty: 'Qty', price: 'Price', amt: 'Amount', totalItems: 'Total Items', totalQty: 'Qty', taxPct: 'TAX %', taxable: 'TAXABLE', cgst: 'CGST', sgst: 'SGST', igst: 'IGST', grandTotal: 'Grand Total', total: 'Total', mobile: 'MOBILE NO', whatsapp: 'WHATSAPP' },
            ta: { mid: 'M.O.P', date: 'தேதி', receiptNo: 'ரசீது எண்', time: 'நேரம்', item: 'பொருள்', qty: 'அளவு', price: 'விலை', amt: 'தொகை', totalItems: 'மொத்த பொருட்கள்', totalQty: 'அளவு', taxPct: 'வரி %', taxable: 'வரிக்குரியது', cgst: 'CGST', sgst: 'SGST', igst: 'IGST', grandTotal: 'மொத்தம்', total: 'மொத்தம்', mobile: 'மொபைல் எண்', whatsapp: 'வாட்ஸ்அப்' },
            hi: { mid: 'M.O.P', date: 'दिनांक', receiptNo: 'रसीद संख्या', time: 'समय', item: 'वस्तु', qty: 'मात्रा', price: 'मूल्य', amt: 'राशि', totalItems: 'कुल वस्तुएं', totalQty: 'मात्रा', taxPct: 'कर %', taxable: 'कर योग्य', cgst: 'CGST', sgst: 'SGST', igst: 'IGST', grandTotal: 'कुल योग', total: 'कुल', mobile: 'मोबाइल नंबर', whatsapp: 'व्हाट्सएप' },
            ml: { mid: 'M.O.P', date: 'തീയതി', receiptNo: 'രസീത് നമ്പർ', time: 'സമയം', item: 'ഇനം', qty: 'അളവ്', price: 'വില', amt: 'തുക', totalItems: 'ആകെ ഇനങ്ങൾ', totalQty: 'അളവ്', taxPct: 'നികുതി %', taxable: 'നികുതി വിധേയം', cgst: 'CGST', sgst: 'SGST', igst: 'IGST', grandTotal: 'ആകെ തുക', total: 'ആകെ', mobile: 'മൊബൈൽ നമ്പർ', whatsapp: 'വാട്ട്‌സ്ആപ്പ്' },
            te: { mid: 'M.O.P', date: 'తేదీ', receiptNo: 'రశీదు సంఖ్య', time: 'సమయం', item: 'వస్తువు', qty: 'పరిమాణం', price: 'ధర', amt: 'మొత్తం', totalItems: 'మొత్తం వస్తువులు', totalQty: 'అమౌంట్', taxPct: 'పన్ను %', taxable: 'పన్ను విధించదగినది', cgst: 'CGST', sgst: 'SGST', igst: 'IGST', grandTotal: 'మొత్తం', total: 'మొత్తం', mobile: 'మొబైల్ నంబర్', whatsapp: 'వాట్సాప్' },
            kn: { mid: 'M.O.P', date: 'ದಿನಾಂಕ', receiptNo: 'ರಸೀದಿ ಸಂಖ್ಯೆ', time: 'ಸಮಯ', item: 'ವಸ್ತು', qty: 'ಪ್ರಮಾಣ', price: 'ಬೆಲೆ', amt: 'ಮೊತ್ತ', totalItems: 'ಒಟ್ಟು ವಸ್ತುಗಳು', totalQty: 'ಪ್ರಮಾಣ', taxPct: 'ತೆರಿಗೆ %', taxable: 'ತೆರಿಗೆಯ ಮೌಲ್ಯ', cgst: 'CGST', sgst: 'SGST', igst: 'IGST', grandTotal: 'ಒಟ್ಟು', total: 'ಒಟ್ಟು', mobile: 'ಮೊಬೈಲ್ ಸಂಖ್ಯೆ', whatsapp: 'ವಾಟ್ಸಾಪ್' }
        };
        const t = translations[lang] || translations.en;
        const storeLegalName = settings?.store?.legalName || '';
        const storeWhatsapp = settings?.store?.whatsapp || '';
        const isInter = bill.taxType === 'inter';

        return `
        <html>
            <head>
                <style>
                    body { font-family: 'Courier New', Courier, monospace; font-size: 11px; margin: 0; padding: 5px; color: #000; }
                    .text-center { text-align: center; }
                    .bold { font-weight: 900; }
                    .store-name { font-size: 18px; font-weight: 900; text-transform: uppercase; }
                    .dashed { border-bottom: 2px dashed #000; margin: 5px 0; }
                    .row { display: flex; justify-content: space-between; margin: 2px 0; }
                    .table { width: 100%; border-collapse: collapse; }
                    .table th { border-bottom: 1px dashed #000; padding: 5px 0; text-align: left; font-size: 11px; }
                    .table td { padding: 4px 0; font-size: 11px; vertical-align: top; }
                    .grand-total { font-size: 16px; font-weight: 900; margin: 10px 0; display: flex; justify-content: space-between; border-top: 2px dashed #000; padding-top: 5px; }
                </style>
            </head>
            <body>
                <div class="text-center">
                    <div class="store-name">${storeName}</div>
                    <div class="bold" style="font-size: 13px; margin: 5px 0; border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 2px 0;">
                        ${mode === 'invoice' ? 'TAX INVOICE' : 'RETAIL BILL'}
                    </div>
                    <div>WHATSAPP NO: ${storeWhatsapp || storePhone || 'N/A'}</div>
                    <div style="font-size: 10px;">${storeAddress}</div>
                </div>

                <div class="row" style="margin-top: 10px;">
                    <span>${t.mid || 'M.O.P'}: ${(bill.paymentMode || 'Cash').toLowerCase().includes('cash') ? '1' :
                (bill.paymentMode || 'Cash').toLowerCase().includes('upi') ? '2' :
                    (bill.paymentMode || 'Cash').toLowerCase().includes('card') ? '3' : '1'
            }</span>
                    <span>${t.date} : ${dateStr}</span>
                </div>
                <div class="row">
                    <span>${t.receiptNo} : ${bill.id ? bill.id.slice(-6).toUpperCase() : '-'}</span>
                    <span>${t.time} : ${timeStr}</span>
                </div>
                ${vip ? `<div>RE-WS-VIP ${customerName}</div>` : ''}

                <div class="dashed"></div>

                <table class="table">
                    <thead>
                        <tr>
                            <th style="width: 45%;">${t.item}</th>
                            <th style="width: 15%; text-align: center;">${t.qty}</th>
                            <th style="width: 20%; text-align: right;">${t.price}</th>
                            <th style="width: 20%; text-align: right;">${t.amt}</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${items.map(item => `
                            <tr>
                                <td colspan="4" class="bold">${item.name}</td>
                            </tr>
                            <tr>
                                <td></td>
                                <td style="text-align: center;">${item.quantity}${item.unit || 'S'}</td>
                                <td style="text-align: right;">${parseFloat(item.price).toFixed(2)}</td>
                                <td style="text-align: right;">${parseFloat(item.total).toFixed(2)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>

                <div class="dashed"></div>

                <div class="row bold">
                    <span>${t.totalItems}:${items.length} / ${t.totalQty} ${totalQty.toFixed(3)}</span>
                    <span>${totalAmount.toFixed(2)}</span>
                </div>

                <div class="dashed"></div>

                ${settings?.invoice?.showTaxBreakup !== false ? `
                <table style="width: 100%; border-collapse: collapse; font-size: 9px; text-align: center;">
                    <thead>
                        <tr class="bold">
                            <td style="width: 20%;">${t.taxPct}</td>
                            <td style="width: 25%;">${t.taxable}</td>
                            ${isInter ? `
                            <td style="width: 25%;">${t.igst}</td>
                            ` : `
                            <td style="width: 15%;">${t.cgst}</td>
                            <td style="width: 15%;">${t.sgst}</td>
                            `}
                            <td style="width: 20%;">${t.total}</td>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>${(items[0]?.taxRate || 5).toFixed(2)}%</td>
                            <td>${subtotal.toFixed(2)}</td>
                            ${isInter ? `
                            <td>${totalTax.toFixed(2)}</td>
                            ` : `
                            <td>${(totalTax / 2).toFixed(2)}</td>
                            <td>${(totalTax / 2).toFixed(2)}</td>
                            `}
                            <td>${totalAmount.toFixed(2)}</td>
                        </tr>
                    </tbody>
                </table>

                <div class="dashed"></div>
                ` : ''}

                <div class="grand-total">
                    <span>${t.grandTotal} :</span>
                    <span>₹${totalAmount.toFixed(2)}</span>
                </div>

                <div class="dashed"></div>
                ${(settings?.invoice?.showTerms !== false) ? `
                <div style="text-align: left; margin-bottom: 10px;">
                    <div class="bold" style="font-size: 10px; margin-bottom: 2px;">TERMS & CONDITIONS:</div>
                    ${settings?.invoice?.termsAndConditions ? `<div style="font-size: 10px;">1. ${settings.invoice.termsAndConditions}</div>` : ''}
                    ${settings?.invoice?.conditionsText ? `<div style="font-size: 10px; margin-top: 2px;">2. ${settings.invoice.conditionsText}</div>` : ''}
                </div>
                <div class="dashed"></div>
                ` : ''}
                <div class="text-center" style="margin-top: 10px;">
                    <div class="bold">MOBILE NO: ${storeWhatsapp || storePhone || 'N/A'}</div>
                    <div class="bold" style="font-size: 12px; margin-top: 5px;">
                        ${settings?.invoice?.footerNote || 'THANK YOU! VISIT AGAIN'}
                    </div>
                    ${vip ? `
                    <div class="bold" style="font-size: 11px; color: #000; margin-top: 4px; font-style: italic;">
                        Thank you for your business with us!
                    </div>
                    ` : ''}

                    ${(settings?.invoice?.showBankAndSignature && !options.isNonAuthorized) ? `
                    <div style="margin-top: 15px; border-top: 1px dashed #000; padding-top: 25px; text-align: center;">
                        <div style="margin-bottom: 5px; opacity: 0.5;">____________________________</div>
                        <div style="font-weight: 900; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">AUTHORIZED SIGNATORY</div>
                        ${bill.receptionist_name ? `<div style="font-size: 10px; margin-top: 2px;">(${bill.receptionist_name.toUpperCase()})</div>` : ''}
                    </div>
                    ` : ''}

                </div>
            </body>
        </html>
        `;
    }

    const { showLogoInBill: showLogo = true } = settings?.invoice || {};

    return `
    <html>
        <head><style>${styles}</style></head>
        <body>
            <div class="text-center">
                ${showLogo && settings?.store?.logo ? `<img src="${settings.store.logo}" style="width: 50px; height: 50px; object-fit: contain; margin-bottom: 5px;" />` : ''}
                <div class="store-name">${storeName}</div>
                <div style="font-size: 10px;">${storeAddress}</div>
                <div style="font-size: 10px;">Phone: ${storePhone}</div>
                ${storeGstin ? `<div style="font-size: 10px;">GSTIN: ${storeGstin}</div>` : ''}
            </div>

            <div class="text-center header-title">${mode === 'invoice' ? (settings?.invoice?.headerTitle || 'TAX INVOICE').toUpperCase() : 'RETAIL BILL'}</div>

            <div class="row">
                <span>Bill No: <span class="bold">${bill.id ? bill.id.slice(-6).toUpperCase() : '-'}</span></span>
                <span>Date: ${dateStr}</span>
            </div>
            ${customer.address && typeof customer.address === 'string' && customer.address.trim() ? `<div style="font-size: 10px;">Addr: ${customer.address.trim()}</div>` : ''}
            <div class="row">
                <span>Cust: ${customerName}${vip ? ' (VIP)' : ''}</span>
                <span>Time: ${timeStr}</span>
            </div>
            <div class="row">
                <span>M.O.P: <span class="bold">${(paymentMode || 'Cash').toLowerCase().includes('cash') ? '1' :
            (paymentMode || 'Cash').toLowerCase().includes('upi') ? '2' :
                (paymentMode || 'Cash').toLowerCase().includes('card') ? '3' : '1'
        }</span></span>
            </div>

            <table class="table">
                <thead>
                    <tr>
                        <th style="width: 10%;">Sn</th>
                        <th style="width: 50%;">Item</th>
                        <th style="width: 20%; text-align: right;">Rate</th>
                        <th style="width: 20%; text-align: right;">Amt</th>
                    </tr>
                </thead>
                <tbody>
                    ${items.map((item, i) => `
                        <tr>
                            <td>${i + 1}</td>
                            <td>
                                <div class="item-info">
                                    <span class="bold">${item.name}</span>
                                    ${item.variantName ? `<span style="font-size: 9px; font-style: italic;">(${item.variantName})</span>` : ''}
                                    <span style="font-size: 9px; color: #444;">Qty: ${item.quantity} ${item.unit || ''}</span>
                                </div>
                            </td>
                            <td class="text-right">${parseFloat(item.price || item.sellingPrice).toFixed(2)}</td>
                            <td class="text-right">${parseFloat(item.total).toFixed(2)}</td>
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
            ${bill.totals?.discount > 0 ? `
            <div class="row" style="color: #ef4444;">
                <span>Bill Discount:</span>
                <span class="bold">-₹${parseFloat(bill.totals.discount).toFixed(2)}</span>
            </div>
            ` : ''}
            ${roundOff !== 0 ? `
            <div class="row">
                <span>Round Off:</span>
                <span class="bold">${roundOff > 0 ? '+' : ''}${roundOff.toFixed(2)}</span>
            </div>
            ` : ''}

            ${loyaltyDiscount > 0 ? `
            <div class="row" style="color: #10b981;">
                <span>Loyalty Reward:</span>
                <span class="bold">-₹${loyaltyDiscount.toFixed(2)}</span>
            </div>
            ` : ''}

            ${additionalCharges > 0 ? `
            <div class="row">
                <span>Extra Charges:</span>
                <span class="bold">+₹${additionalCharges.toFixed(2)}</span>
            </div>
            ` : ''}

            <div class="grand-total row">
                <span>GRAND TOTAL:</span>
                <span>₹${totalAmount.toFixed(2)}</span>
            </div>

            <div class="payment-box">
                <div class="row bold" style="font-size: 11px; margin-bottom: 4px; border-bottom: 1px solid #000; padding-bottom: 2px;">
                    <span>PAYMENT STATUS:</span>
                    <span>${paymentStatus.toUpperCase()}</span>
                </div>
                <div class="row">
                    <span>Paid Amount:</span>
                    <span class="bold">₹${amountReceived.toFixed(2)}</span>
                </div>
                <div class="row bold">
                    <span>BALANCE:</span>
                    <span>₹${balanceDue.toFixed(2)}</span>
                </div>
                ${amountReceived > totalAmount ? `
                <div class="row" style="color: #059669;">
                    <span>Change Returned:</span>
                    <span class="bold">₹${(amountReceived - totalAmount).toFixed(2)}</span>
                </div>
                ` : ''}
                <div class="row" style="font-size: 9px; margin-top: 4px; opacity: 0.8;">
                    <span>Payment Mode:</span>
                    <span>${paymentMode}</span>
                </div>
            </div>

            ${remarks.trim() ? `
            <div style="background-color: #f0f0f0; padding: 5px; border: 1px dashed #000; margin: 5px 0;">
                <div class="bold" style="font-size: 10px;">NOTES:</div>
                <div style="font-size: 10px;">${remarks.trim()}</div>
            </div>
            ` : ''}

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
            ${(settings?.invoice?.showTerms !== false) ? `
            <div style="text-align: left; margin: 5px 0;">
                <div class="bold" style="font-size: 10px;">TERMS & CONDITIONS:</div>
                ${settings?.invoice?.termsAndConditions ? `<div style="font-size: 9px;">1. ${settings.invoice.termsAndConditions}</div>` : ''}
                ${settings?.invoice?.conditionsText ? `<div style="font-size: 9px;">2. ${settings.invoice.conditionsText}</div>` : ''}
            </div>
            <div class="dashed"></div>
            ` : ''}
            <div class="footer">
                ${(settings?.bankDetails?.accountNumber && !options.hideAccountDetails) ? `
                    <div style="font-weight: 900; margin-bottom: 2px;">BANK DETAILS</div>
                    <div>${settings.bankDetails.bankName}</div>
                    <div>A/c: ${settings.bankDetails.accountNumber}</div>
                    <div>IFSC: ${settings.bankDetails.ifsc}</div>
                    <div class="dashed"></div>
                ` : ''}
                <div style="font-weight: 900; font-size: 12px;">
                    ${settings?.invoice?.footerNote || 'Thank You! Visit Again.'}
                </div>
                ${vip ? `
                <div style="font-weight: 900; font-size: 11px; margin-top: 4px; font-style: italic;">
                    Thank you for your business with us!
                </div>
                ` : ''}

                ${(settings?.invoice?.showBankAndSignature && !options.isNonAuthorized) ? `
                <div style="margin-top: 15px; border-top: 1px dashed #000; padding-top: 25px; text-align: center;">
                    <div style="margin-bottom: 5px; opacity: 0.5;">____________________________</div>
                    <div style="font-weight: 900; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">AUTHORIZED SIGNATORY</div>
                    ${bill.receptionist_name ? `<div style="font-size: 10px; margin-top: 2px;">(${bill.receptionist_name.toUpperCase()})</div>` : ''}
                </div>
                ` : ''}
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
    const customerName = bill.customerName || customer.fullName || customer.name || '';
    const isInter = bill.taxType === 'inter';
    const invoiceDate = formatSafeDate(bill.date);

    const { showLogo = true, showHsn = true, showQrcode = true } = settings?.invoice || {};

    const subtotal = Number(bill.totals?.subtotal || 0);
    const tax = Number(bill.totals?.tax || 0);
    const total = Number(bill.totals?.total || 0);
    const loyaltyDiscount = Number(bill.totals?.loyaltyPointsDiscount || 0);
    const additionalCharges = Number(bill.totals?.additionalCharges || bill.additionalCharges || 0);
    const billDiscount = Number(bill.totals?.discount || bill.discount || 0);
    const remarks = bill.internalNotes || bill.remarks || '';
    const paidAmount = Number(bill.amountReceived || 0);
    const balance = Math.max(0, total - paidAmount);

    let status = 'Not Paid';
    if (paidAmount >= total) status = 'Paid Fully';
    else if (paidAmount > 0) status = 'Partially Paid';

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
            .bg-gray { background: #e2e2e2; }
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
            <div class="row bg-gray" style="justify-content: center; padding: 2px;"><span class="bold">${mode === 'invoice' ? (settings?.invoice?.headerTitle || 'TAX INVOICE').toUpperCase() : 'RETAIL BILL'}</span></div>
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
                    <div><span class="bold">Address:</span> ${typeof customer.address === 'string' && customer.address.trim() ? customer.address.trim() : '-'}</div>
                    <div><span class="bold">GSTIN:</span> ${customer.gstin && typeof customer.gstin === 'string' ? customer.gstin : '-'}</div>
                    <div><span class="bold">Phone:</span> ${customer.phone || customer.mobile || '-'}</div>
                </div>
                <div class="col">
                    <div><span class="bold">Name:</span> ${customerName}</div>
                    <div><span class="bold">Address:</span> ${typeof customer.address === 'string' && customer.address.trim() ? customer.address.trim() : '-'}</div>
                    <div><span class="bold">GSTIN:</span> ${customer.gstin && typeof customer.gstin === 'string' ? customer.gstin : '-'}</div>
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
                    ${(settings?.invoice?.showBankAndSignature && !options?.hideAccountDetails) ? `
                    <div style="margin-top: 10px;">
                        <div class="bold">Bank Details:</div>
                        <div>A/c Name: ${bank.accountName || '-'}</div>
                        <div>Bank: ${bank.bankName || '-'}</div>
                        <div>A/c No: ${bank.accountNumber || '-'}</div>
                        <div>IFSC: ${bank.ifsc || '-'}</div>
                    </div>
                    ` : ''}
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
                    ${additionalCharges > 0 ? `
                        <div style="display: flex; justify-content: space-between; padding: 2px 5px; border-bottom: 1px solid #000;">
                            <span>Add: Additional Charges:</span><span>${additionalCharges.toFixed(2)}</span>
                        </div>
                    ` : ''}
                    ${billDiscount > 0 ? `
                        <div style="display: flex; justify-content: space-between; padding: 2px 5px; border-bottom: 1px solid #000; color: #ef4444;">
                            <span>Less: Bill Discount:</span><span>-₹${billDiscount.toFixed(2)}</span>
                        </div>
                    ` : ''}
                    ${loyaltyDiscount > 0 ? `
                        <div style="display: flex; justify-content: space-between; padding: 2px 5px; border-bottom: 1px solid #000; color: #1d4ed8;">
                            <span>Less: Loyalty Reward:</span><span>-₹${loyaltyDiscount.toFixed(2)}</span>
                        </div>
                    ` : ''}
                    <div class="bg-gray bold" style="display: flex; justify-content: space-between; padding: 8px; border: 1px solid #000; margin-top: 5px;">
                        <span>GRAND TOTAL:</span><span>₹${total.toFixed(2)}</span>
                    </div>


                    <div style="margin-top: 10px; border: 1px solid #000; padding: 5px; background: #f9fafb;">
                        <div class="bold" style="text-align: center; border-bottom: 1px solid #000; margin-bottom: 5px; font-size: 10px; padding-bottom: 2px;">PAYMENT INFORMATION</div>
                        <div style="display: flex; justify-content: space-between; padding: 2px 0;">
                            <span>Status:</span><span class="bold" style="color: ${paidAmount >= total ? '#16a34a' : paidAmount > 0 ? '#ca8a04' : '#ef4444'};">${status.toUpperCase()}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; padding: 2px 0;">
                            <span>Paid Amount:</span><span class="bold">₹${paidAmount.toFixed(2)}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; padding: 2px 0; color: ${balance > 0 ? '#ef4444' : '#1e293b'};">
                            <span class="bold">Balance:</span><span class="bold">₹${balance.toFixed(2)}</span>
                        </div>
                        ${paidAmount > total ? `
                        <div style="display: flex; justify-content: space-between; padding: 2px 0; color: #16a34a;">
                            <span>Change Returned:</span><span class="bold">₹${(paidAmount - total).toFixed(2)}</span>
                        </div>
                        ` : ''}
                        <div style="display: flex; justify-content: space-between; padding: 2px 0; border-top: 1px dashed #ccc; margin-top: 2px; font-size: 9px;">
                            <span>Payment Mode:</span><span>${bill.paymentMode || bill.paymentType || 'Cash'}</span>
                        </div>
                    </div>
                    <div class="text-center" style="font-size: 8px; padding: 2px;">GST on Reverse Charge: No</div>
                </div>
            </div>
            <div class="row" style="border-bottom: none; min-height: 80px;">
                <div class="col" style="flex: 1.5;">
                    ${remarks.trim() ? `
                        <div style="margin-bottom: 10px; border: 1px dashed #000; padding: 5px;">
                            <div class="bold">Bill Notes:</div>
                            <div style="font-style: italic;">${remarks.trim()}</div>
                        </div>
                    ` : ''}
                    <div class="bold">Terms & Conditions:</div>
                    <div style="font-size: 8px;">
                        ${settings?.invoice?.termsAndConditions ? `1. ${settings.invoice.termsAndConditions}` : ''}
                        ${settings?.invoice?.conditionsText ? `<br/>2. ${settings.invoice.conditionsText}` : ''}
                    </div>
                </div>
                <div class="col" style="flex: 1; display: flex; flex-direction: column; justify-content: space-between; text-align: right;">
                    <div class="bold">For ${store.name || ''}</div>
                    ${(settings?.invoice?.showBankAndSignature && !options?.isNonAuthorized) ? `
                    <div style="margin-top: 30px;">
                        <div>Authorised Signatory</div>
                        ${bill.receptionist_name ? `<div style="font-size: 9px; margin-top: 2px;">(${bill.receptionist_name.toUpperCase()})</div>` : ''}
                    </div>
                    ` : ''}
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
    const vip = isVIP(customer);
    const customerName = bill.customerName || customer.fullName || customer.name || '';
    const isInter = bill.taxType === 'inter';
    const invoiceDate = formatSafeDate(bill.date);


    const currency = settings?.defaults?.currency || '₹';
    const bank = settings?.bankDetails || {};
    const { showLogo = true } = settings?.invoice || {};
    const additionalCharges = Number(bill.totals?.additionalCharges || bill.additionalCharges || 0);
    const remarks = bill.internalNotes || bill.remarks || '';


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
                        ${(bank.accountNumber && !options?.hideAccountDetails) ? `
                            <div style="margin-bottom: 8px;">
                                <div style="font-weight: bold; color: #1e293b;">Bank Details:</div>
                                <div>A/c Name: ${bank.accountName || '-'}</div>
                                <div>Bank: ${bank.bankName || '-'} | A/c: ${bank.accountNumber || '-'}</div>
                                <div>IFSC: ${bank.ifsc || '-'}</div>
                            </div>
                        ` : ''}
                        ${remarks.trim() ? `
                            <div style="margin-bottom: 8px; border-left: 2px solid ${colors.primary}; padding-left: 8px;">
                                <div style="font-weight: bold; color: #1e293b;">Bill Notes:</div>
                                <div style="font-style: italic;">${remarks.trim()}</div>
                            </div>
                        ` : ''}
                        ${settings?.invoice?.termsAndConditions ? `1. ${settings.invoice.termsAndConditions}<br/>` : ''}
                        ${settings?.invoice?.conditionsText ? `2. ${settings.invoice.conditionsText}<br/>` : ''}
                        <div style="font-weight: bold; margin-top: 5px; font-style: italic;">
                            ${settings?.invoice?.footerNote || 'Thank you for your business!'}
                        </div>
                        ${vip ? `<div style="font-weight: bold; color: ${colors.primary}; margin-top: 2px;">Thank you for your business with us!</div>` : ''}
                    </div>
                </div>
                <div style="flex: 1; display: flex; flex-direction: column; justify-content: space-between; align-items: flex-end; padding: 20px;">
                    <div class="bold">For ${store.name || ''}</div>
                    ${(settings?.invoice?.showBankAndSignature && !options?.isNonAuthorized) ? `
                    <div style="margin-top: 30px; text-align: right;">
                        <div style="margin-bottom: 2px;">Authorised Signatory</div>
                        ${bill.receptionist_name ? `<div style="font-size: 9px;">(${bill.receptionist_name.toUpperCase()})</div>` : ''}
                    </div>
                    ` : ''}
                </div>
            </div>
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
                        ${additionalCharges > 0 ? `
                            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                                <span>Add: Charges:</span><span class="bold">${currency}${additionalCharges.toFixed(2)}</span>
                            </div>
                        ` : ''}

                        ${bill.totals.discount > 0 ? `
                        <div style="display: flex; justify-content: space-between; margin-bottom: 8px; color: #ef4444;">
                            <span>Discount:</span><span class="bold">-${currency}${Number(bill.totals.discount).toFixed(2)}</span>
                        </div>
                        ` : ''}
                        ${Number(bill.totals.loyaltyPointsRedeemed || 0) > 0 || Number(bill.totals.loyaltyPointsDiscount || 0) > 0 ? `
                        <div style="display: flex; justify-content: space-between; margin-bottom: 8px; color: #fff; font-size: 11px; opacity: 0.9;">
                            <span>Loyalty Saved:</span><span class="bold">-${currency}${Number(bill.totals.loyaltyPointsDiscount || 0).toFixed(2)}</span>
                        </div>
                        ` : ''}
                        <div style="display: flex; justify-content: space-between; color: #64748b; font-size: 10px;">
                            <span>Round Off:</span><span>${bill.totals.roundOff.toFixed(2)}</span>
                        </div>
                    </div>
                    <div class="grand-total">
                        <span style="font-size: 14px; letter-spacing: 1px;">TOTAL</span>
                        <span>${currency}${Number(bill.totals.total).toFixed(2)}</span>
                    </div>

                    <div style="margin-top: 10px; padding: 12px; background: rgba(255,255,255,0.1); border-radius: 12px; border: 1px dashed rgba(255,255,255,0.3);">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                            <span style="opacity: 0.8; font-size: 10px; text-transform: uppercase;">Payment Status</span>
                            <span style="font-weight: 900; font-size: 12px;">${(Number(bill.amountReceived || 0) >= Number(bill.totals.total) ? 'PAID FULLY' :
            Number(bill.amountReceived || 0) > 0 ? 'PARTIALLY PAID' : 'NOT PAID')}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                            <span style="opacity: 0.8;">Paid Amount:</span><span class="bold">${currency}${Number(bill.amountReceived || 0).toFixed(2)}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; color: ${Math.max(0, Number(bill.totals.total) - Number(bill.amountReceived || 0)) > 0 ? '#fee2e2' : '#fff'};">
                            <span style="opacity: 0.8; font-weight: bold;">Balance:</span><span class="bold">${currency}${Math.max(0, Number(bill.totals.total) - Number(bill.amountReceived || 0)).toFixed(2)}</span>
                        </div>
                        ${(Number(bill.amountReceived || 0) > Number(bill.totals.total)) ? `
                        <div style="display: flex; justify-content: space-between; color: #dcfce7;">
                            <span style="opacity: 0.8;">Change Given:</span><span class="bold">${currency}${Math.round(Number(bill.amountReceived || 0) - Number(bill.totals.total)).toFixed(2)}</span>
                        </div>
                        ` : ''}
                        <div style="display: flex; justify-content: space-between; margin-top: 6px; padding-top: 6px; border-top: 1px solid rgba(255,255,255,0.1); font-size: 10px; opacity: 0.8;">
                            <span>Mode: ${bill.paymentMode || 'Cash'}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </body>
    </html>
    `;
};

const generateMinimalHTML = (bill, settings, colors, options = {}) => {
    const store = settings?.store || {};
    const storeAddress = store.address || {};
    const items = bill.cart || bill.items || [];
    const customer = bill.customer || {};
    const customerName = bill.customerName || customer.fullName || customer.name || '';
    const isInter = bill.taxType === 'inter';
    const invoiceDate = formatSafeDate(bill.date);
    const currency = settings?.defaults?.currency || '₹';
    const bank = settings?.bankDetails || {};

    const { showLogo = true } = settings?.invoice || {};
    const additionalCharges = Number(bill.totals?.additionalCharges || bill.additionalCharges || 0);
    const remarks = bill.internalNotes || bill.remarks || '';


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
                    <div style="font-size: 12px; color: #374151;">${remarks.trim() || 'Thank you for your business!'}</div>
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
                    ${additionalCharges > 0 ? `
                        <div style="display: flex; justify-content: space-between; padding: 5px 0;">
                            <span style="color: #6b7280;">Extra Charges</span><span style="font-weight: 600;">${currency}${additionalCharges.toFixed(2)}</span>
                        </div>
                    ` : ''}
                    ${bill.totals.discount > 0 ? `

                        <div style="display: flex; justify-content: space-between; padding: 5px 0; color: #ef4444;">
                            <span>Discount</span><span>-${currency}${Number(bill.totals.discount).toFixed(2)}</span>
                        </div>
                    ` : ''}
                    ${Number(bill.totals.loyaltyPointsRedeemed || 0) > 0 || Number(bill.totals.loyaltyPointsDiscount || 0) > 0 ? `
                        <div style="display: flex; justify-content: space-between; padding: 5px 0; color: #115e59; font-weight: bold;">
                            <span>Loyalty Deduction</span><span>-${currency}${Number(bill.totals.loyaltyPointsDiscount || 0).toFixed(2)}</span>
                        </div>
                    ` : ''}
                    <div class="total-banner">
                        <span style="font-weight: bold; letter-spacing: 1px;">TOTAL</span>
                        <span style="font-size: 24px; font-weight: 900;">${currency}${Number(bill.totals.total).toFixed(2)}</span>
                    </div>
                    <div style="margin-top: 15px; padding: 15px; border: 1.5px solid #e5e7eb; border-radius: 12px; background: #fdfdfd;">
                        <div style="font-size: 10px; font-weight: 800; color: #9ca3af; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px;">Payment Summary</div>
                        <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 8px;">
                            <span style="color: #6b7280;">Amount Paid:</span><span style="font-weight: 700; color: #111827;">${currency}${Number(bill.amountReceived || 0).toFixed(2)}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 8px;">
                            <span style="color: #6b7280;">Payment Status:</span>
                            <span style="font-weight: 900; padding: 2px 8px; border-radius: 6px; font-size: 11px; background: ${Number(bill.amountReceived || 0) >= Number(bill.totals.total) ? '#dcfce7' : '#fee2e2'}; color: ${Number(bill.amountReceived || 0) >= Number(bill.totals.total) ? '#166534' : '#991b1b'};">
                                ${Number(bill.amountReceived || 0) >= Number(bill.totals.total) ? 'PAID FULLY' :
            Number(bill.amountReceived || 0) > 0 ? 'PARTIALLY PAID' : 'NOT PAID'}
                            </span>
                        </div>
                        <div style="display: flex; justify-content: space-between; font-size: 14px; color: ${Math.max(0, Number(bill.totals.total) - Number(bill.amountReceived || 0)) > 0 ? '#ef4444' : '#111827'}; border-top: 1px dashed #eee; pt: 8px; mt: 8px;">
                            <span style="font-weight: 600;">Balance:</span><span style="font-weight: 900;">${currency}${Math.max(0, Number(bill.totals.total) - Number(bill.amountReceived || 0)).toFixed(2)}</span>
                        </div>
                        ${(Number(bill.amountReceived || 0) > Number(bill.totals.total)) ? `
                        <div style="display: flex; justify-content: space-between; font-size: 13px; color: #16a34a; border-top: 1px dashed #eee; pt: 8px; mt: 8px;">
                            <span>Change Returned:</span><span style="font-weight: 700;">${currency}${(Number(bill.amountReceived || 0) - Number(bill.totals.total)).toFixed(2)}</span>
                        </div>
                        ` : ''}
                    </div>
                </div>
                <!-- Final Signatory Row for Minimal -->
                <div style="margin-top: 30px; display: flex; justify-content: space-between; align-items: flex-end; padding: 0 40px 40px 40px;">
                    <div style="font-size: 10px; color: #6b7280;">
                        ${(settings?.bankDetails?.bankName && !options?.hideAccountDetails) ? `
                            <b>Bank Details:</b><br/>
                            ${settings.bankDetails.bankName} | A/c: ${settings.bankDetails.accountNumber}<br/>
                            IFSC: ${settings.bankDetails.ifsc}
                        ` : ''}
                    </div>
                    <div style="text-align: right;">
                        <div style="font-weight: bold; font-size: 14px;">For ${store.name || ''}</div>
                        ${(settings?.invoice?.showBankAndSignature && !options?.isNonAuthorized) ? `
                        <div style="margin-top: 30px; border-top: 1px solid #000; padding-top: 5px;">Authorised Signatory</div>
                        ${bill.receptionist_name ? `<div style="font-size: 10px; margin-top: 2px;">(${bill.receptionist_name.toUpperCase()})</div>` : ''}
                        ` : ''}
                    </div>
                </div>
                <div style="margin-top: 10px; font-size: 10px; color: #9ca3af; text-align: right; padding-right: 40px;">Mode: ${bill.paymentMode || 'Cash'}</div>

                    </div>
                </div>
            </div>
        </div>
    </body>
    </html>
    `;
};

const generateCompactHTML = (bill, settings, colors, options = {}) => {
    const store = settings?.store || {};
    const storeAddress = store.address || {};
    const items = bill.cart || bill.items || [];
    const customer = bill.customer || {};
    const customerName = bill.customerName || customer.fullName || customer.name || '';
    const isInter = bill.taxType === 'inter';
    const invoiceDate = formatSafeDate(bill.date);
    const currency = settings?.defaults?.currency || '₹';
    const bank = settings?.bankDetails || {};

    const { showLogo = true } = settings?.invoice || {};
    const additionalCharges = Number(bill.totals?.additionalCharges || bill.additionalCharges || 0);
    const remarks = bill.internalNotes || bill.remarks || '';


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
                    <div style="font-size: 11px; line-height: 1.6;">
                        ${remarks.trim() ? `<div style="margin-bottom: 5px; font-weight: bold; color: ${colors.primary};">${remarks.trim()}</div>` : ''}
                        1. Goods once sold will be not taken back.<br/>2. Pay securely via UPI.
                    </div>
                </div>

                <div style="flex: 1;">
                    ${Number(bill.totals.loyaltyPointsDiscount || 0) > 0 ? `
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px; color: ${colors.primary}; font-weight: bold; font-size: 11px;">
                        <span>Loyalty Deduction:</span><span>-${currency}${Number(bill.totals.loyaltyPointsDiscount || 0).toFixed(2)}</span>
                    </div>
                    ` : ''}
                    <div class="grand-total-row">
                        <span style="font-size: 14px;">
                            ${Number(bill.amountReceived || 0) >= Number(bill.totals.total) ? 'PAID FULLY' :
            Number(bill.amountReceived || 0) > 0 ? 'PARTIALLY PAID' : 'NOT PAID'}
                        </span>
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
                            <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed ${colors.primary}; padding-bottom: 8px; margin-bottom: 8px;">
                                <span>SGST:</span><span>${currency}${Number(bill.totals.tax / 2).toFixed(2)}</span>
                            </div>
                        `}
                        ${additionalCharges > 0 ? `
                            <div style="display: flex; justify-content: space-between; margin-bottom: 8px; color: ${colors.primary}; font-weight: bold; font-size: 11px;">
                                <span>Extra Charges:</span><span>${currency}${additionalCharges.toFixed(2)}</span>
                            </div>
                        ` : ''}

                        <div style="display: flex; justify-content: space-between; margin-bottom: 5px; color: ${colors.primary}; font-weight: bold;">
                            <span>Amount Paid:</span><span>${currency}${Number(bill.amountReceived || 0).toFixed(2)}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; color: ${Math.max(0, Number(bill.totals.total) - Number(bill.amountReceived || 0)) > 0 ? '#ef4444' : '#1e293b'}; font-weight: 900;">
                            <span>Balance:</span><span>${currency}${Math.max(0, Number(bill.totals.total) - Number(bill.amountReceived || 0)).toFixed(2)}</span>
                        </div>
                        ${(Number(bill.amountReceived || 0) > Number(bill.totals.total)) ? `
                        <div style="display: flex; justify-content: space-between; color: #16a34a; font-weight: 900;">
                            <span>Change Returned:</span><span>${currency}${(Number(bill.amountReceived || 0) - Number(bill.totals.total)).toFixed(2)}</span>
                        </div>
                        ` : ''}
                        <div style="font-size: 9px; opacity: 0.6; text-align: right; margin-top: 5px;">Mode: ${bill.paymentMode || 'Cash'}</div>
                        ${(settings?.bankDetails?.bankName && !options?.hideAccountDetails) ? `
                            <div style="font-size: 8px; margin-top: 10px; color: ${colors.primary}; opacity: 0.7; border-top: 1px dashed #e2e8f0; padding-top: 5px;">
                                <b>Bank:</b> ${settings.bankDetails.bankName} | <b>A/c:</b> ${settings.bankDetails.accountNumber} | <b>IFSC:</b> ${settings.bankDetails.ifsc}
                            </div>
                        ` : ''}

                        <div style="margin-top: 25px; text-align: center;">
                            <div style="font-weight: bold; font-size: 11px; color: ${colors.primary};">For ${store.name || ''}</div>
                            ${(settings?.invoice?.showBankAndSignature && !options?.isNonAuthorized) ? `
                                <div style="margin-top: 30px; border-top: 1px solid ${colors.primary}; padding-top: 4px; font-weight: bold; font-size: 10px; color: ${colors.primary};">Authorised Signatory</div>
                                ${bill.receptionist_name ? `<div style="font-size: 8px; color: #64748b;">(${bill.receptionist_name.toUpperCase()})</div>` : ''}
                            ` : ''}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </body>
    </html>
    `;

};

export const generateReceiptHTML = (bill, settings = {}, mode = 'invoice', options = {}) => {
    const paperSize = settings?.invoice?.paperSize || '80mm';
    // For customer/bw mode, we always use thermal
    if (mode === 'customer' || mode === 'bw') {
        return generateThermalReceiptHTML(bill, settings, mode, options);
    }

    const isThermalSize = paperSize === '80mm' || paperSize === '58mm';
    let isThermalTemplate = settings?.invoice?.template === 'Thermal';

    // If printing an invoice, explicitly prevent the plain Thermal Bill layout
    // We want a shrunk-down version of the actual Invoice Template instead.
    if (mode === 'invoice') {
        if (isThermalTemplate) {
            isThermalTemplate = false;
            settings = { ...settings, invoice: { ...settings.invoice, template: 'Classic' } };
        }
    } else {
        // Only return the plain receipt bill template if we are NOT in 'invoice' mode
        if (isThermalTemplate || isThermalSize) {
            return generateThermalReceiptHTML(bill, settings, mode, options);
        }
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

    // When forcing an invoice template on an 80mm/58mm thermal printer size, scale it properly.
    if (mode === 'invoice' && isThermalSize && settings !== null) {
        settings = { ...settings, invoice: { ...settings.invoice, isThermalOverride: true } };
    }

    if (template === 'Detailed' || template === 'GST') return generateDetailedHTML(bill, settings, colors, options);
    if (template === 'Classic') return generateClassicHTML(bill, settings, colors, options);
    if (template === 'Minimal') return generateMinimalHTML(bill, settings, colors, options);
    if (template === 'Compact') return generateCompactHTML(bill, settings, colors, options);

    return generateClassicHTML(bill, settings, colors, options);
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

export const testPrinter = async (settings = {}) => {
    const printerAddress = settings?.invoice?.selectedPrinter?.address;
    const storeName = settings?.store?.name || "KWIQ BILL";

    if (!printerAddress) {
        return false;
    }

    try {
        // Use ensurePrinterConnected for robust connection management
        const connected = await ensurePrinterConnected(printerAddress);
        if (!connected) throw new Error("Connection failed");

        // Small initial wait 
        await new Promise(r => setTimeout(r, 200));

        // 1. Print Header (Modern & Bold)
        let header = COMMANDS.TEXT_FORMAT.TXT_ALIGN_CT + COMMANDS.TEXT_FORMAT.TXT_BOLD_ON;
        header += COMMANDS.TEXT_FORMAT.TXT_4SQUARE + "\n" + storeName.toUpperCase() + "\n";
        header += COMMANDS.TEXT_FORMAT.TXT_NORMAL + COMMANDS.TEXT_FORMAT.TXT_BOLD_ON;
        header += "PRINTER TEST REPORT\n\n";
        header += COMMANDS.TEXT_FORMAT.TXT_BOLD_OFF + COMMANDS.TEXT_FORMAT.TXT_ALIGN_LT;
        header += "Status: ONLINE & READY\n";
        header += "Date  : " + new Date().toLocaleDateString() + "\n";
        header += "Time  : " + new Date().toLocaleTimeString() + "\n";
        header += "System: KWIQ BILL v1.0.0\n";
        header += "--------------------------------\n\n";

        await BLEPrinter.printText(header);
        await new Promise(r => setTimeout(r, 100));

        // Use individual Image-based QR rendering for maximum compatibility.
        // Smaller chunks (one QR at a time) prevent "stuck" states on very low cost printers.
        const paperSize = settings?.invoice?.billPaperSize || '80mm';
        const pixelWidth = paperSize === '58mm' ? 360 : 540; // Slightly reduced for margin safety

        try {
            if (globalPrintRef.current) {
                // Combined Support QR (WhatsApp + Call + Email) in a compact vCard format.
                // This is the MOST efficient way to provide all links in one scan.
                // Shortened fields to keep QR version low for cheaper printers.
                const vCard = "BEGIN:VCARD\nVERSION:3.0\nN:Kwiq Bill;Support;;;\nTEL:+917558175156\nEMAIL:support@kwiqbill.com\nURL:https://wa.me/917558175156\nEND:VCARD";

                const supportUri = await globalPrintRef.current.renderSingleQR("SCAN FOR ALL SUPPORT OPTIONS", vCard, pixelWidth);
                if (supportUri) {
                    await BLEPrinter.printPic(supportUri, { width: pixelWidth });
                    await new Promise(r => setTimeout(r, 1000)); // Generous delay for hardware
                }
            } else {
                throw new Error("Global Print Ref not available");
            }
        } catch (qrErr) {
            console.warn('[testPrinter] Image QR failed:', qrErr);
            await BLEPrinter.printText(COMMANDS.TEXT_FORMAT.TXT_ALIGN_CT + "(QRs Temporarily Unavailable)\n\n");
        }

        // 3. Footer
        let footer = COMMANDS.TEXT_FORMAT.TXT_ALIGN_CT + "--------------------------------\n";
        footer += "Your printer is set up and working\n";
        footer += "perfectly with Kwiq Bill.\n\n";
        footer += COMMANDS.TEXT_FORMAT.TXT_BOLD_ON + "Ready to take your business\nto the next level!" + COMMANDS.TEXT_FORMAT.TXT_BOLD_OFF + "\n";
        footer += "\n\n\n\n";
        await BLEPrinter.printText(footer);

        return true;
    } catch (error) {
        console.error('Test print error:', error);
        throw error;
    }
};

export const printReceipt = async (bill, arg2, arg3, arg4, options = {}) => {
    let settings = {};
    let mode = 'customer';
    let format = '80mm';

    // Handle flexible arguments: (bill, format, settings) or (bill, settings, mode)
    if (typeof arg2 === 'string') {
        // Called as (bill, format, settings, mode?)
        format = arg2;
        settings = arg3 || {};
        mode = arg4 || 'customer';
    } else {
        // Called as (bill, settings, mode)
        settings = arg2 || {};
        mode = arg3 || 'customer';

        // Choose format based on mode (Bill vs Invoice)
        // customer/bw = Bill Receipt (Thermal)
        // invoice = System Invoice (A4/A5)
        if (mode === 'customer' || mode === 'bw') {
            format = settings?.invoice?.billPaperSize || '80mm';
        } else {
            format = settings?.invoice?.invoicePaperSize || 'A4';
        }
    }

    // Ensure format is in settings for downstream calls
    if (!settings.invoice) settings.invoice = {};
    settings.invoice.paperSize = format;

    try {
        if (format === '80mm' || format === '58mm') {
            if (settings?.invoice?.selectedPrinter?.address) {
                // Using Bluetooth ESC/POS thermal printing natively
                // Respect the selected thermal template (Standard/Professional)
                // via overrideSettings passed down from the preview screen.
                await printBluetoothReceipt(bill, settings, format, mode, options);
            } else {
                // Inform user why "bluetooth section" or printing is not working
                throw new Error("No Bluetooth Thermal Printer is connected. Please connect one in Settings -> Print & Hardware, or switch your Invoice Paper Size to A4/A5.");
            }
        } else {
            // Using expo-print logic
            const html = generateReceiptHTML(bill, settings, mode, options);
            const paperSize = format;



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
        }

        // Auto backup after print
        try {
            const allData = await fetchAllTableData();
            await exportToDeviceFolders(allData, null, { isAutoSave: true });
        } catch (e) {
            console.warn('Auto-backup failed:', e);
        }
    } catch (error) {
        console.error('Print error:', error);
        throw error;
    }
};

export const printMultipleReceipts = async (bills, arg2, arg3) => {
    let settings = {};
    let mode = 'customer';
    let format = 'A4';

    if (typeof arg2 === 'string') {
        format = arg2;
        settings = arg3 || {};
    } else {
        settings = arg2 || {};
        mode = arg3 || 'customer';
        if (mode === 'customer' || mode === 'bw') {
            format = settings?.invoice?.billPaperSize || '80mm';
        } else {
            format = settings?.invoice?.invoicePaperSize || 'A4';
        }
    }

    if (!settings.invoice) settings.invoice = {};
    settings.invoice.paperSize = format;

    try {
        if (format === '80mm' || format === '58mm') {
            if (settings?.invoice?.selectedPrinter?.address) {
                for (const bill of bills) {
                    if (mode === 'invoice') {
                        await printProfessionalBluetoothReceipt(bill, settings, format, mode);
                    } else {
                        await printBluetoothReceipt(bill, settings, format, mode);
                    }
                }
            } else {
                throw new Error("No Bluetooth Thermal Printer is connected. Please connect one in Settings -> Print & Hardware, or switch your Invoice Paper Size to A4/A5.");
            }
        } else {
            const combinedHtml = bills.map((bill, index) => {
                const rawHtml = generateReceiptHTML(bill, settings, mode);
                const pageBreak = index < bills.length - 1 ? '<div style="page-break-after: always;"></div>' : '';
                return `<div>${rawHtml}</div>${pageBreak}`;
            }).join('');

            let width = 302;
            let height = undefined;
            if (format === '58mm') {
                width = 219;
                height = 8000;
            } else if (format === 'A4') width = 595;
            else if (format === 'A5') width = 420;
            else { width = 302; height = 8000; }

            await Print.printAsync({
                html: combinedHtml,
                width,
                height,
                orientation: Print.Orientation.portrait,
                printerUrl: settings?.invoice?.selectedPrinter?.url || settings?.invoice?.selectedPrinter?.id,
            });
        }
    } catch (e) {
        console.error('Multi Print error:', e);
    }
};

let isSharingInProgress = false;


export const shareReceiptPDF = async (bill, settings = {}, mode = 'invoice', options = {}) => {
    if (isSharingInProgress) return;
    isSharingInProgress = true;
    try {
        const html = generateReceiptHTML(bill, settings, mode, options);

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
 * Generates a combined PDF containing both the Bill (Thermal format) 
 * and the Invoice (A4 format).
 */
export const shareCombinedReceiptPDF = async (bill, settings = {}) => {
    if (isSharingInProgress) return;
    isSharingInProgress = true;
    try {
        // 1. Generate Thermal Bill HTML
        const thermalSettings = {
            ...settings,
            invoice: {
                ...settings.invoice,
                paperSize: settings?.invoice?.billPaperSize || '80mm'
            }
        };
        const thermalHTML = generateReceiptHTML(bill, thermalSettings, 'customer');

        // 2. Generate A4 Invoice HTML
        const a4Settings = {
            ...settings,
            invoice: {
                ...settings.invoice,
                paperSize: 'A4'
            }
        };
        const a4HTML = generateReceiptHTML(bill, a4Settings, 'invoice');

        // 3. Combine them
        const combine = (htmls) => {
            let combinedStyles = "";
            let combinedBody = "";

            htmls.forEach((html, index) => {
                const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/);
                const bodyMatch = html.match(/<body>([\s\S]*?)<\/body>/);
                if (styleMatch) combinedStyles += styleMatch[1] + "\n";
                if (bodyMatch) {
                    const pageBreak = (index < htmls.length - 1) ? '<div style="page-break-after: always; height: 0; overflow: hidden;"></div>' : '';
                    combinedBody += `<div class="invoice-page">${bodyMatch[1]}</div>${pageBreak}`;
                }
            });

            return `
            <html>
                <head>
                    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
                    <style>
                        ${combinedStyles}
                        .invoice-page { position: relative; width: 100%; }
                        @media print { .invoice-page { page-break-inside: avoid; } }
                    </style>
                </head>
                <body>${combinedBody}</body>
            </html>`;
        };

        const finalHTML = combine([thermalHTML, a4HTML]);
        const { uri } = await Print.printToFileAsync({ html: finalHTML });
        await shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });

    } catch (error) {
        console.error('Combined Share error:', error);
        Alert.alert('Error', 'Failed to generate combined PDF');
    } finally {
        isSharingInProgress = false;
    }
};

/**
 * "Download" Logic: On Android, uses SAF to save directly to a folder.
 * On iOS, uses the share sheet (which includes Save to Files).
 */
export const saveReceiptPDF = async (bill, settings = {}, mode = 'invoice', options = {}) => {
    if (isSharingInProgress) return;
    isSharingInProgress = true;
    try {
        const html = generateReceiptHTML(bill, settings, mode, options);

        const { uri } = await Print.printToFileAsync({ html });
        
        const fileName = `Invoice_${bill.weekly_sequence || bill.id || Date.now()}.pdf`;

        if (Platform.OS === 'android') {
            const SAF = FileSystem.StorageAccessFramework;
            
            if (SAF) {
                // Try to use a previously saved URI or request Downloads/Documents
                let rootUri = await AsyncStorage.getItem('@pdf_download_uri');
                
                if (rootUri) {
                    try {
                        await SAF.readDirectoryAsync(rootUri);
                    } catch (e) {
                        rootUri = null;
                    }
                }

                if (!rootUri) {
                    const permissions = await SAF.requestDirectoryPermissionsAsync();
                    if (permissions.granted) {
                        rootUri = permissions.directoryUri;
                        await AsyncStorage.setItem('@pdf_download_uri', rootUri);
                    }
                }

                if (rootUri) {
                    const targetUri = await SAF.createFileAsync(rootUri, fileName, 'application/pdf');
                    const content = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
                    await FileSystem.writeAsStringAsync(targetUri, content, { encoding: FileSystem.EncodingType.Base64 });
                    Alert.alert('Success', `Invoice saved to device: ${fileName}`);
                    return;
                }
            } else {
                console.warn('StorageAccessFramework is undefined in expo-file-system. Falling back to share sheet.');
            }
        }


        // Fallback for iOS or if SAF permission denied
        await shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
    } catch (error) {
        console.error('Download error:', error);
        Alert.alert('Error', 'Failed to download receipt');
    } finally {
        isSharingInProgress = false;
    }
};

export const saveCombinedReceiptPDF = async (bill, settings = {}) => {
    if (isSharingInProgress) return;
    isSharingInProgress = true;
    try {
        // Reuse combined logic... (extracting to a helper would be cleaner, but let's keep it simple for now)
        const thermalSettings = { ...settings, invoice: { ...settings.invoice, paperSize: settings?.invoice?.billPaperSize || '80mm' } };
        const thermalHTML = generateReceiptHTML(bill, thermalSettings, 'customer');
        const a4Settings = { ...settings, invoice: { ...settings.invoice, paperSize: 'A4' } };
        const a4HTML = generateReceiptHTML(bill, a4Settings, 'invoice');

        const combine = (htmls) => {
            let combinedStyles = "";
            let combinedBody = "";
            htmls.forEach((html, index) => {
                const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/);
                const bodyMatch = html.match(/<body>([\s\S]*?)<\/body>/);
                if (styleMatch) combinedStyles += styleMatch[1] + "\n";
                if (bodyMatch) {
                    const pageBreak = (index < htmls.length - 1) ? '<div style="page-break-after: always; height: 0; overflow: hidden;"></div>' : '';
                    combinedBody += `<div class="invoice-page">${bodyMatch[1]}</div>${pageBreak}`;
                }
            });
            return `<html><head><meta name="viewport" content="width=device-width, initial-scale=1.0" /><style>${combinedStyles}.invoice-page { width: 100%; } @media print { .invoice-page { page-break-inside: avoid; } }</style></head><body>${combinedBody}</body></html>`;
        };

        const finalHTML = combine([thermalHTML, a4HTML]);
        const { uri } = await Print.printToFileAsync({ html: finalHTML });
        const fileName = `Combined_Invoice_${bill.weekly_sequence || bill.id || Date.now()}.pdf`;

        if (Platform.OS === 'android') {
            const SAF = FileSystem.StorageAccessFramework;
            if (SAF) {
                let rootUri = await AsyncStorage.getItem('@pdf_download_uri');
                if (rootUri) { try { await SAF.readDirectoryAsync(rootUri); } catch (e) { rootUri = null; } }
                if (!rootUri) {
                    const permissions = await SAF.requestDirectoryPermissionsAsync();
                    if (permissions.granted) {
                        rootUri = permissions.directoryUri;
                        await AsyncStorage.setItem('@pdf_download_uri', rootUri);
                    }
                }

                if (rootUri) {
                    const targetUri = await SAF.createFileAsync(rootUri, fileName, 'application/pdf');
                    const content = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
                    await FileSystem.writeAsStringAsync(targetUri, content, { encoding: FileSystem.EncodingType.Base64 });
                    Alert.alert('Success', `Combined Invoice saved: ${fileName}`);
                    return;
                }
            } else {
                console.warn('StorageAccessFramework is undefined. Falling back to share sheet.');
            }
        }

        await shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
    } catch (error) {
        console.error('Combined Download error:', error);
        Alert.alert('Error', 'Failed to download combined receipt');
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
// 