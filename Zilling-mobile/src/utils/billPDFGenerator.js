import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { Alert, Platform, Linking } from 'react-native';

/**
 * Generates HTML template for the bill PDF
 */
export const generateBillHTML = (billData, storeSettings) => {
    const storeName = storeSettings?.name || 'Kwiq Billing';
    const storeAddress = storeSettings?.address || '';
    const storePhone = storeSettings?.phone || '';
    const storeGST = storeSettings?.gst || '';

    const customerName = billData.customer?.name || '';
    const customerPhone = billData.customer?.phone || '';

    const dateStr = new Date().toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    // Calculate totals
    const grossTotal = billData.totals?.grossTotal || 0;
    const itemDiscount = billData.totals?.itemDiscount || 0;
    const subtotal = billData.totals?.subtotal || 0;
    const tax = billData.totals?.tax || 0;
    const billDiscount = billData.billDiscount || 0;
    const additionalCharges = billData.additionalCharges || 0;
    const roundOff = billData.totals?.roundOff || 0;
    const total = billData.totals?.total || 0;
    const remarks = billData.remarks || '';

    // Generate items HTML
    let itemsHTML = '';
    if (billData.cart && billData.cart.length > 0) {
        billData.cart.forEach((item, index) => {
            const itemTotal = item.total || (item.price * item.quantity);
            const itemDiscountAmt = item.discount || 0;

            itemsHTML += `
                <tr>
                    <td style="padding: 12px 8px; border-bottom: 1px solid #e5e7eb;">${index + 1}</td>
                    <td style="padding: 12px 8px; border-bottom: 1px solid #e5e7eb; font-weight: 600;">${item.name || item.productName}</td>
                    <td style="padding: 12px 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity}</td>
                    <td style="padding: 12px 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">₹${item.price?.toFixed(2)}</td>
                    ${itemDiscountAmt > 0 ? `<td style="padding: 12px 8px; border-bottom: 1px solid #e5e7eb; text-align: right; color: #ef4444;">-₹${itemDiscountAmt.toFixed(2)}</td>` : '<td style="padding: 12px 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">-</td>'}
                    <td style="padding: 12px 8px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 700;">₹${itemTotal.toFixed(2)}</td>
                </tr>
            `;
        });
    }

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { 
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    padding: 20px;
                    background: #ffffff;
                    color: #111827;
                }
                .container { max-width: 800px; margin: 0 auto; }
                .header { 
                    background: linear-gradient(135deg, #000000 0%, #1a1a1a 100%);
                    color: white;
                    padding: 30px;
                    border-radius: 12px 12px 0 0;
                    margin-bottom: 0;
                }
                .store-name { font-size: 28px; font-weight: 800; margin-bottom: 8px; }
                .store-details { font-size: 13px; opacity: 0.9; line-height: 1.6; }
                .bill-info {
                    background: #f9fafb;
                    padding: 20px 30px;
                    border-left: 4px solid #000;
                    margin-bottom: 24px;
                }
                .bill-info-row { 
                    display: flex; 
                    justify-content: space-between; 
                    margin-bottom: 8px;
                    font-size: 14px;
                }
                .bill-info-label { color: #6b7280; font-weight: 600; }
                .bill-info-value { color: #111827; font-weight: 700; }
                table { 
                    width: 100%; 
                    border-collapse: collapse; 
                    margin-bottom: 24px;
                    background: white;
                }
                thead { 
                    background: #f3f4f6;
                    font-weight: 700;
                    font-size: 13px;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                th { 
                    padding: 14px 8px; 
                    text-align: left;
                    color: #374151;
                    border-bottom: 2px solid #d1d5db;
                }
                th:nth-child(3), th:nth-child(4), th:nth-child(5), th:nth-child(6) { text-align: right; }
                tbody tr:hover { background: #f9fafb; }
                .totals-section {
                    background: #f9fafb;
                    padding: 20px 30px;
                    border-radius: 8px;
                    margin-bottom: 20px;
                }
                .total-row {
                    display: flex;
                    justify-content: space-between;
                    padding: 8px 0;
                    font-size: 14px;
                }
                .total-row.subtotal { 
                    border-bottom: 1px solid #e5e7eb;
                    padding-bottom: 12px;
                    margin-bottom: 8px;
                }
                .total-row.grand-total {
                    border-top: 2px solid #111827;
                    padding-top: 12px;
                    margin-top: 8px;
                    font-size: 18px;
                    font-weight: 800;
                }
                .total-label { color: #6b7280; font-weight: 600; }
                .total-value { color: #111827; font-weight: 700; }
                .discount { color: #ef4444; }
                .charge { color: #10b981; }
                .remarks-section {
                    background: #fffbeb;
                    border-left: 4px solid #f59e0b;
                    padding: 16px 20px;
                    border-radius: 6px;
                    margin-bottom: 20px;
                }
                .remarks-title { 
                    font-size: 13px; 
                    font-weight: 700; 
                    color: #92400e; 
                    margin-bottom: 6px;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                .remarks-text { 
                    font-size: 14px; 
                    color: #78350f; 
                    line-height: 1.6;
                }
                .footer {
                    text-align: center;
                    padding: 20px;
                    color: #6b7280;
                    font-size: 13px;
                    border-top: 2px dashed #d1d5db;
                    margin-top: 30px;
                }
                .footer-thank { 
                    font-size: 16px; 
                    font-weight: 700; 
                    color: #111827; 
                    margin-bottom: 8px;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <!-- Header -->
                <div class="header">
                    <div class="store-name">${storeName}</div>
                    <div class="store-details">
                        ${storeAddress ? `${storeAddress}<br>` : ''}
                        ${storePhone ? `Phone: ${storePhone}<br>` : ''}
                        ${storeGST ? `GSTIN: ${storeGST}` : ''}
                    </div>
                </div>

                <!-- Bill Info -->
                <div class="bill-info">
                    <div class="bill-info-row">
                        <span class="bill-info-label">Customer:</span>
                        <span class="bill-info-value">${customerName}</span>
                    </div>
                    ${customerPhone ? `
                    <div class="bill-info-row">
                        <span class="bill-info-label">Phone:</span>
                        <span class="bill-info-value">+91 ${customerPhone}</span>
                    </div>
                    ` : ''}
                    <div class="bill-info-row">
                        <span class="bill-info-label">Date:</span>
                        <span class="bill-info-value">${dateStr}</span>
                    </div>
                    <div class="bill-info-row">
                        <span class="bill-info-label">Payment:</span>
                        <span class="bill-info-value">${billData.paymentMode || 'Cash'}</span>
                    </div>
                </div>

                <!-- Items Table -->
                <table>
                    <thead>
                        <tr>
                            <th style="width: 40px;">#</th>
                            <th>Item</th>
                            <th style="width: 80px; text-align: center;">Qty</th>
                            <th style="width: 100px; text-align: right;">Price</th>
                            <th style="width: 100px; text-align: right;">Discount</th>
                            <th style="width: 120px; text-align: right;">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsHTML}
                    </tbody>
                </table>

                <!-- Totals -->
                <div class="totals-section">
                    <div class="total-row subtotal">
                        <span class="total-label">Gross Total</span>
                        <span class="total-value">₹${grossTotal.toFixed(2)}</span>
                    </div>
                    ${itemDiscount > 0 ? `
                    <div class="total-row">
                        <span class="total-label">Item Discounts</span>
                        <span class="total-value discount">-₹${itemDiscount.toFixed(2)}</span>
                    </div>
                    ` : ''}
                    <div class="total-row">
                        <span class="total-label">Subtotal</span>
                        <span class="total-value">₹${subtotal.toFixed(2)}</span>
                    </div>
                    ${billDiscount > 0 ? `
                    <div class="total-row">
                        <span class="total-label">Bill Discount</span>
                        <span class="total-value discount">-₹${billDiscount.toFixed(2)}</span>
                    </div>
                    ` : ''}
                    ${tax > 0 ? `
                    <div class="total-row">
                        <span class="total-label">Tax</span>
                        <span class="total-value">+₹${tax.toFixed(2)}</span>
                    </div>
                    ` : ''}
                    ${additionalCharges > 0 ? `
                    <div class="total-row">
                        <span class="total-label">Additional Charges</span>
                        <span class="total-value charge">+₹${additionalCharges.toFixed(2)}</span>
                    </div>
                    ` : ''}
                    ${roundOff !== 0 ? `
                    <div class="total-row">
                        <span class="total-label">Round Off</span>
                        <span class="total-value">${roundOff >= 0 ? '+' : ''}₹${roundOff.toFixed(2)}</span>
                    </div>
                    ` : ''}
                    <div class="total-row grand-total">
                        <span class="total-label">GRAND TOTAL</span>
                        <span class="total-value">₹${total.toFixed(2)}</span>
                    </div>
                </div>

                <!-- Remarks -->
                ${remarks ? `
                <div class="remarks-section">
                    <div class="remarks-title">Remarks</div>
                    <div class="remarks-text">${remarks}</div>
                </div>
                ` : ''}

                <!-- Footer -->
                <div class="footer">
                    <div class="footer-thank">Thank you for your business!</div>
                    <div>Visit us again soon</div>
                </div>
            </div>
        </body>
        </html>
    `;
};

/**
 * Generates a PDF from bill data and returns the file URI
 */
export const generateBillPDF = async (billData, storeSettings) => {
    try {
        const html = generateBillHTML(billData, storeSettings);
        const { uri } = await Print.printToFileAsync({ html });
        return uri;
    } catch (error) {
        console.error('PDF Generation Error:', error);
        throw error;
    }
};

/**
 * Shares bill PDF via WhatsApp - Simple share dialog approach
 */

export const shareBillPDFViaWhatsApp = async (billData, storeSettings, phoneNumber) => {
    try {
        if (!phoneNumber) {
            Alert.alert('Error', 'No phone number provided');
            return false;
        }

        // Generate PDF
        const pdfUri = await generateBillPDF(billData, storeSettings);

        // Check if sharing is available
        const isAvailable = await Sharing.isAvailableAsync();
        if (!isAvailable) {
            Alert.alert('Error', 'Sharing is not available on this device');
            return false;
        }

        // Share the PDF directly
        await Sharing.shareAsync(pdfUri, {
            mimeType: 'application/pdf',
            dialogTitle: `Send Bill to ${billData.customer?.name || 'Customer'}`,
            UTI: 'com.adobe.pdf'
        });

        return true;
    } catch (error) {
        console.error('Share Bill PDF Error:', error);
        Alert.alert('Error', 'Failed to share bill PDF');
        return false;
    }
};
