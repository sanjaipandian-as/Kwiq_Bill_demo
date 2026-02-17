import React from 'react';
import { View, Text, StyleSheet, Dimensions, Image } from 'react-native';
import { CheckCircle2 } from 'lucide-react-native';

const DetailedInvoiceTemplate = ({ settings, data }) => {
    // Fallback data for preview if settings not provided
    const store = settings?.store || {
        name: 'Kwiq Bill',
        legalName: 'Kwiq Bill',
        address: { street: 'D. NO: 7, Kulandaivelpuram, 1st street, Vellakottai, Aruppukottai, virudhunagar', state: 'Tamil Nadu', pincode: '626101' },
        contact: '8825804521',
        gstin: '123456789'
    };

    const bank = settings?.bankDetails || {
        accountName: '',
        accountNumber: '',
        ifsc: '',
        bankName: '',
        branch: ''
    };

    const invoice = data || {
        invoiceNo: 'C8A24D35',
        date: '15/02/2026',
        items: [
            { name: 'Sample Product', quantity: 1, price: 100, taxableValue: 100, total: 100, cgstRate: '0%', cgstAmt: '0.00', sgstRate: '0%', sgstAmt: '0.00' },
            { name: 'Sugar 1kg', hsn: '1901', quantity: 2, price: 50, taxableValue: 100, total: 105, cgstRate: '2.5%', cgstAmt: '2.50', sgstRate: '2.5%', sgstAmt: '2.50' },
            { name: 'Rice 5kg', hsn: '1006', quantity: 1, price: 300, taxableValue: 300, total: 300, cgstRate: '0%', cgstAmt: '0.00', sgstRate: '0%', sgstAmt: '0.00' }
        ],
        customer: { name: 'N. Rajakumari Marimuthu', address: '-', mobile: '-', gstin: '-' },
        totals: {
            subtotal: 500.00,
            tax: 5.00,
            cgst: 2.50,
            sgst: 2.50,
            igst: 0.00,
            total: 505.00
        },
        amountInWords: 'Rupees Five Hundred Five Only',
        taxType: 'intra'
    };

    const logo = store.logo;

    return (
        <View style={styles.detailedPaper}>
            {/* Row 1: Logo | Center Info | Copies */}
            <View style={[styles.detailedRow, { borderBottomWidth: 1 }]}>
                <View style={[styles.detailedCol, { width: 70, justifyContent: 'center', alignItems: 'center' }]}>
                    {logo ? (
                        <Image source={{ uri: logo }} style={{ width: 60, height: 60, resizeMode: 'contain' }} />
                    ) : (
                        <Text style={styles.detailedBold}>LOGO</Text>
                    )}
                </View>
                <View style={[styles.detailedCol, { flex: 1, alignItems: 'center', padding: 8 }]}>
                    <Text style={[styles.detailedBold, { fontSize: 16, marginBottom: 4 }]}>{store.name}</Text>
                    <Text style={[styles.detailedText, { textAlign: 'center' }]}>
                        {store.address?.street}, {store.address?.city && `${store.address.city}, `}{store.address?.state}, {store.address?.pincode}
                    </Text>
                    <Text style={styles.detailedText}>Tel: {store.contact}</Text>
                    <Text style={styles.detailedBold}>GSTIN: {store.gstin || 'N/A'}</Text>
                </View>
                <View style={[styles.detailedCol, { width: 90, padding: 0, borderRightWidth: 0 }]}>
                    <View style={[styles.detailedRow, { borderBottomWidth: 1, padding: 2 }]}>
                        <Text style={[styles.detailedText, { flex: 1 }]}>Original</Text>
                        <View style={styles.detailedCheckBox}><CheckCircle2 size={10} color="#000" /></View>
                    </View>
                    <View style={[styles.detailedRow, { borderBottomWidth: 1, padding: 2 }]}>
                        <Text style={[styles.detailedText, { flex: 1 }]}>Duplicate</Text>
                        <View style={styles.detailedCheckBox} />
                    </View>
                    <View style={[styles.detailedRow, { borderBottomWidth: 1, padding: 2 }]}>
                        <Text style={[styles.detailedText, { flex: 1 }]}>Triplicate</Text>
                        <View style={styles.detailedCheckBox} />
                    </View>
                    <View style={[styles.detailedRow, { borderBottomWidth: 0, padding: 2 }]}>
                        <Text style={[styles.detailedText, { flex: 1 }]}>Extra Copy</Text>
                        <View style={styles.detailedCheckBox} />
                    </View>
                </View>
            </View>

            {/* Row 2: TAX INVOICE */}
            <View style={[styles.detailedRow, { justifyContent: 'center', backgroundColor: '#e2e2e2', paddingVertical: 2, borderBottomWidth: 1 }]}>
                <Text style={[styles.detailedBold, { fontSize: 12 }]}>TAX INVOICE</Text>
            </View>
            <View style={[styles.detailedRow, { justifyContent: 'center', paddingVertical: 2, borderBottomWidth: 1 }]}>
                <Text style={[styles.detailedText, { fontStyle: 'italic' }]}>(See rule 7, for a tax invoice referred to in section 31)</Text>
            </View>

            {/* Row 3: Invoice Info Grid */}
            <View style={[styles.detailedRow, { borderBottomWidth: 1 }]}>
                {/* Left Half */}
                <View style={[styles.detailedCol, { flex: 1, padding: 4 }]}>
                    <Text style={styles.detailedText}><Text style={styles.detailedBold}>Invoice No:</Text> {invoice.invoiceNo}</Text>
                    <Text style={styles.detailedText}><Text style={styles.detailedBold}>Invoice Date:</Text> {invoice.date}</Text>
                    <View style={{ height: 4 }} />
                    <Text style={styles.detailedText}><Text style={styles.detailedBold}>Reverse Charge (Y/N):</Text> No</Text>
                    <Text style={styles.detailedText}><Text style={styles.detailedBold}>State:</Text> {store.address?.state || '-'}</Text>
                </View>
                {/* Right Half */}
                <View style={[styles.detailedCol, { flex: 1, padding: 4, borderRightWidth: 0 }]}>
                    <Text style={styles.detailedText}><Text style={styles.detailedBold}>Transport Mode:</Text> -</Text>
                    <Text style={styles.detailedText}><Text style={styles.detailedBold}>Vehicle Number:</Text> -</Text>
                    <View style={{ height: 4 }} />
                    <Text style={styles.detailedText}><Text style={styles.detailedBold}>Date of Supply:</Text> {invoice.date}</Text>
                    <Text style={styles.detailedText}><Text style={styles.detailedBold}>Place of Supply:</Text> {invoice.taxType === 'inter' ? 'Inter-State' : 'Local'}</Text>
                </View>
            </View>

            {/* Row 4: Addresses Header */}
            <View style={[styles.detailedRow, { borderBottomWidth: 1, backgroundColor: '#e2e2e2' }]}>
                <View style={[styles.detailedCol, { flex: 1, alignItems: 'center' }]}>
                    <Text style={styles.detailedBold}>Detail of Receiver (Billed to)</Text>
                </View>
                <View style={[styles.detailedCol, { flex: 1, alignItems: 'center', borderRightWidth: 0 }]}>
                    <Text style={styles.detailedBold}>Detail of Consignee (Shipped to)</Text>
                </View>
            </View>

            {/* Row 5: Addresses Content */}
            <View style={[styles.detailedRow, { borderBottomWidth: 1, minHeight: 70 }]}>
                <View style={[styles.detailedCol, { flex: 1 }]}>
                    <Text style={styles.detailedText}><Text style={styles.detailedBold}>Name:</Text> {invoice.customer?.name || ''}</Text>
                    <Text style={styles.detailedText}><Text style={styles.detailedBold}>Address:</Text> {invoice.customer?.address || '-'}</Text>
                    <Text style={styles.detailedText}><Text style={styles.detailedBold}>GSTIN:</Text> {invoice.customer?.gstin || '-'}</Text>
                    <Text style={styles.detailedText}><Text style={styles.detailedBold}>Phone:</Text> {invoice.customer?.mobile || '-'}</Text>
                </View>
                <View style={[styles.detailedCol, { flex: 1, borderRightWidth: 0 }]}>
                    <Text style={styles.detailedText}><Text style={styles.detailedBold}>Name:</Text> {invoice.customer?.name || ''}</Text>
                    <Text style={styles.detailedText}><Text style={styles.detailedBold}>Address:</Text> {invoice.customer?.address || '-'}</Text>
                    <Text style={styles.detailedText}><Text style={styles.detailedBold}>GSTIN:</Text> {invoice.customer?.gstin || '-'}</Text>
                    <Text style={styles.detailedText}><Text style={styles.detailedBold}>State:</Text> {invoice.customer?.state || '-'}</Text>
                </View>
            </View>

            {/* Row 6: Product Table Header */}
            <View style={[styles.detailedRow, { borderBottomWidth: 1, backgroundColor: '#e2e2e2' }]}>
                <View style={[styles.detailedCol, { width: 18, alignItems: 'center', justifyContent: 'center' }]}><Text style={styles.detailedBold}>S.No</Text></View>
                <View style={[styles.detailedCol, { flex: 2, alignItems: 'center', justifyContent: 'center' }]}><Text style={styles.detailedBold}>Product Description</Text></View>
                <View style={[styles.detailedCol, { width: 22, alignItems: 'center', justifyContent: 'center' }]}><Text style={styles.detailedBold}>Qty</Text></View>
                <View style={[styles.detailedCol, { width: 30, alignItems: 'center', justifyContent: 'center' }]}><Text style={styles.detailedBold}>Rate</Text></View>
                <View style={[styles.detailedCol, { width: 40, alignItems: 'center', justifyContent: 'center' }]}><Text style={[styles.detailedBold, { fontSize: 8 }]}>Taxable Value</Text></View>

                {invoice.taxType === 'inter' ? (
                    <View style={[styles.detailedCol, { width: 80, padding: 0 }]}>
                        <View style={{ borderBottomWidth: 1, borderColor: '#000', alignItems: 'center' }}><Text style={styles.detailedBold}>IGST</Text></View>
                        <View style={{ flexDirection: 'row', flex: 1 }}>
                            <View style={{ flex: 1, borderRightWidth: 1, borderColor: '#000', alignItems: 'center' }}><Text style={styles.detailedText}>Rate</Text></View>
                            <View style={{ flex: 1.5, alignItems: 'center' }}><Text style={styles.detailedText}>Amt</Text></View>
                        </View>
                    </View>
                ) : (
                    <>
                        {/* CGST */}
                        <View style={[styles.detailedCol, { width: 40, padding: 0 }]}>
                            <View style={{ borderBottomWidth: 1, borderColor: '#000', alignItems: 'center' }}><Text style={styles.detailedBold}>CGST</Text></View>
                            <View style={{ flexDirection: 'row', flex: 1 }}>
                                <View style={{ flex: 1, borderRightWidth: 1, borderColor: '#000', alignItems: 'center' }}><Text style={styles.detailedText}>Rate</Text></View>
                                <View style={{ flex: 1, alignItems: 'center' }}><Text style={styles.detailedText}>Amt</Text></View>
                            </View>
                        </View>
                        {/* SGST */}
                        <View style={[styles.detailedCol, { width: 40, padding: 0 }]}>
                            <View style={{ borderBottomWidth: 1, borderColor: '#000', alignItems: 'center' }}><Text style={styles.detailedBold}>SGST</Text></View>
                            <View style={{ flexDirection: 'row', flex: 1 }}>
                                <View style={{ flex: 1, borderRightWidth: 1, borderColor: '#000', alignItems: 'center' }}><Text style={styles.detailedText}>Rate</Text></View>
                                <View style={{ flex: 1, alignItems: 'center' }}><Text style={styles.detailedText}>Amt</Text></View>
                            </View>
                        </View>
                    </>
                )}
                <View style={[styles.detailedCol, { width: 40, borderRightWidth: 0, alignItems: 'center', justifyContent: 'center' }]}><Text style={styles.detailedBold}>Total</Text></View>
            </View>

            {/* Product Rows */}
            {invoice.items.map((item, index) => (
                <View key={index} style={[styles.detailedRow, { borderBottomWidth: 1, minHeight: 35 }]}>
                    <View style={[styles.detailedCol, { width: 18, alignItems: 'center' }]}><Text style={styles.detailedText}>{index + 1}</Text></View>
                    <View style={[styles.detailedCol, { flex: 2 }]}><Text style={styles.detailedText}>{item.name}</Text></View>
                    <View style={[styles.detailedCol, { width: 22, alignItems: 'center' }]}><Text style={styles.detailedText}>{item.quantity}</Text></View>
                    <View style={[styles.detailedCol, { width: 30, alignItems: 'flex-end' }]}><Text style={styles.detailedText}>{parseFloat(item.price).toFixed(2)}</Text></View>
                    <View style={[styles.detailedCol, { width: 40, alignItems: 'flex-end' }]}><Text style={styles.detailedText}>{parseFloat(item.taxableValue || item.price * item.quantity).toFixed(2)}</Text></View>

                    {invoice.taxType === 'inter' ? (
                        <View style={[styles.detailedCol, { width: 80, padding: 0, flexDirection: 'row' }]}>
                            <View style={{ flex: 1, borderRightWidth: 1, borderColor: '#000', alignItems: 'center' }}><Text style={styles.detailedText}>{item.igstRate || (parseFloat(item.taxRate) || 0) + '%'}</Text></View>
                            <View style={{ flex: 1.5, alignItems: 'flex-end', paddingRight: 2 }}><Text style={styles.detailedText}>{parseFloat(item.igstAmt || item.taxAmount || 0).toFixed(2)}</Text></View>
                        </View>
                    ) : (
                        <>
                            <View style={[styles.detailedCol, { width: 40, padding: 0, flexDirection: 'row' }]}>
                                <View style={{ flex: 1, borderRightWidth: 1, borderColor: '#000', alignItems: 'center' }}><Text style={styles.detailedText}>{item.cgstRate || (parseFloat(item.taxRate) / 2 || 0) + '%'}</Text></View>
                                <View style={{ flex: 1, alignItems: 'flex-end', paddingRight: 2 }}><Text style={styles.detailedText}>{parseFloat(item.cgstAmt || item.taxAmount / 2 || 0).toFixed(2)}</Text></View>
                            </View>
                            <View style={[styles.detailedCol, { width: 40, padding: 0, flexDirection: 'row' }]}>
                                <View style={{ flex: 1, borderRightWidth: 1, borderColor: '#000', alignItems: 'center' }}><Text style={styles.detailedText}>{item.sgstRate || (parseFloat(item.taxRate) / 2 || 0) + '%'}</Text></View>
                                <View style={{ flex: 1, alignItems: 'flex-end', paddingRight: 2 }}><Text style={styles.detailedText}>{parseFloat(item.sgstAmt || item.taxAmount / 2 || 0).toFixed(2)}</Text></View>
                            </View>
                        </>
                    )}
                    <View style={[styles.detailedCol, { width: 40, borderRightWidth: 0, alignItems: 'flex-end' }]}><Text style={styles.detailedBold}>{parseFloat(item.total).toFixed(2)}</Text></View>
                </View>
            ))}

            {/* Row 8: Table Total */}
            <View style={[styles.detailedRow, { borderBottomWidth: 1 }]}>
                <View style={{ flex: 1, alignItems: 'flex-end', paddingRight: 8 }}><Text style={styles.detailedBold}>Total</Text></View>
                <View style={{ width: 40, borderLeftWidth: 1, borderColor: '#000', alignItems: 'flex-end', paddingRight: 4, borderRightWidth: 1 }}><Text style={styles.detailedBold}>{parseFloat(invoice.totals.subtotal).toFixed(2)}</Text></View>
                <View style={{ width: 80, borderRightWidth: 1, borderColor: '#000', alignItems: 'center' }}><Text style={styles.detailedBold}>{parseFloat(invoice.totals.tax).toFixed(2)}</Text></View>
                <View style={{ width: 40, alignItems: 'flex-end', paddingRight: 4 }}><Text style={styles.detailedBold}>{parseFloat(invoice.totals.total).toFixed(2)}</Text></View>
            </View>

            {/* Row 9: Amount Words & Tax Summary */}
            <View style={[styles.detailedRow, { borderBottomWidth: 1 }]}>
                {/* Left: Words */}
                <View style={[styles.detailedCol, { flex: 1, padding: 4, minHeight: 80 }]}>
                    <Text style={[styles.detailedText, { marginBottom: 4 }]}><Text style={styles.detailedBold}>Total Invoice Amount in Words:</Text></Text>
                    <Text style={[styles.detailedText, { fontStyle: 'italic' }]}>{invoice.amountInWords || 'Amount in words'}</Text>
                </View>
                {/* Right: Summary Box */}
                <View style={{ width: 180, borderLeftWidth: 1, borderColor: '#000' }}>
                    <View style={[styles.detailedRow, { borderBottomWidth: 1 }]}>
                        <View style={{ flex: 1, padding: 2 }}><Text style={styles.detailedText}>Total Amount before Tax:</Text></View>
                        <View style={{ width: 60, alignItems: 'flex-end', padding: 2 }}><Text style={styles.detailedText}>{parseFloat(invoice.totals.subtotal).toFixed(2)}</Text></View>
                    </View>
                    {invoice.taxType === 'intra' ? (
                        <>
                            <View style={[styles.detailedRow, { borderBottomWidth: 1 }]}>
                                <View style={{ flex: 1, padding: 2 }}><Text style={styles.detailedText}>Add: CGST</Text></View>
                                <View style={{ width: 60, alignItems: 'flex-end', padding: 2 }}><Text style={styles.detailedText}>{parseFloat(invoice.totals.cgst).toFixed(2)}</Text></View>
                            </View>
                            <View style={[styles.detailedRow, { borderBottomWidth: 1 }]}>
                                <View style={{ flex: 1, padding: 2 }}><Text style={styles.detailedText}>Add: SGST</Text></View>
                                <View style={{ width: 60, alignItems: 'flex-end', padding: 2 }}><Text style={styles.detailedText}>{parseFloat(invoice.totals.sgst).toFixed(2)}</Text></View>
                            </View>
                        </>
                    ) : (
                        <View style={[styles.detailedRow, { borderBottomWidth: 1 }]}>
                            <View style={{ flex: 1, padding: 2 }}><Text style={styles.detailedText}>Add: IGST</Text></View>
                            <View style={{ width: 60, alignItems: 'flex-end', padding: 2 }}><Text style={styles.detailedText}>{parseFloat(invoice.totals.igst || invoice.totals.tax).toFixed(2)}</Text></View>
                        </View>
                    )}
                    <View style={[styles.detailedRow, { borderBottomWidth: 1 }]}>
                        <View style={{ flex: 1, padding: 2 }}><Text style={styles.detailedText}>Total Tax Amount:</Text></View>
                        <View style={{ width: 60, alignItems: 'flex-end', padding: 2 }}><Text style={styles.detailedText}>{parseFloat(invoice.totals.tax).toFixed(2)}</Text></View>
                    </View>
                    <View style={[styles.detailedRow, { borderBottomWidth: 0, backgroundColor: '#e2e2e2' }]}>
                        <View style={{ flex: 1, padding: 2 }}><Text style={styles.detailedBold}>Total Amount after Tax:</Text></View>
                        <View style={{ width: 60, alignItems: 'flex-end', padding: 2 }}><Text style={styles.detailedBold}>{parseFloat(invoice.totals.total).toFixed(2)}</Text></View>
                    </View>
                </View>
            </View>

            {/* Row 10: Reverse Charge Note */}
            <View style={[styles.detailedRow, { borderBottomWidth: 1, justifyContent: 'center', padding: 2 }]}>
                <Text style={styles.detailedText}>GST on Reverse Charge: No</Text>
            </View>

            {/* Row 11: Footer */}
            <View style={[styles.detailedRow, { borderBottomWidth: 0, minHeight: 80 }]}>
                {/* Left: Bank & Terms */}
                <View style={[styles.detailedCol, { flex: 1, padding: 4 }]}>
                    <Text style={styles.detailedBold}>Bank Details:</Text>
                    <View style={{ marginLeft: 4 }}>
                        <Text style={styles.detailedText}><Text style={styles.detailedBold}>A/c Name:</Text> {bank.accountName || '-'}</Text>
                        <Text style={styles.detailedText}><Text style={styles.detailedBold}>Bank:</Text> {bank.bankName || '-'}</Text>
                        <Text style={styles.detailedText}><Text style={styles.detailedBold}>A/c No:</Text> {bank.accountNumber || '-'}</Text>
                        <Text style={styles.detailedText}><Text style={styles.detailedBold}>IFSC:</Text> {bank.ifsc || '-'}</Text>
                    </View>

                    <View style={{ height: 6 }} />
                    <Text style={styles.detailedBold}>Terms & Conditions:</Text>
                    <Text style={[styles.detailedText, { fontSize: 7, marginTop: 2 }]}>{settings?.invoice?.termsAndConditions || '1. Goods once sold will not be taken back. 2. Interest @18% pa will be charged if not paid within due date.'}</Text>
                </View>
                {/* Right: Signature */}
                <View style={[styles.detailedCol, { width: 140, borderRightWidth: 0, alignItems: 'center', justifyContent: 'space-between', padding: 4 }]}>
                    <Text style={[styles.detailedText, { textAlign: 'center' }]}>Certified that the particulars given above are true and correct</Text>
                    <View style={{ alignItems: 'flex-end', width: '100%', marginTop: 10 }}>
                        <Text style={styles.detailedBold}>For {store.name}</Text>
                        <View style={{ height: 20 }} />
                        <Text style={styles.detailedText}>Authorised Signatory</Text>
                    </View>
                </View>
            </View>

        </View>
    );
};

const styles = StyleSheet.create({
    detailedPaper: {
        width: '100%',
        backgroundColor: '#fff',
        borderWidth: 2,
        borderColor: '#000',
        overflow: 'hidden'
    },
    detailedRow: {
        flexDirection: 'row',
        borderColor: '#000'
    },
    detailedCol: {
        borderRightWidth: 1,
        borderColor: '#000',
        padding: 4
    },
    detailedText: {
        fontSize: 8,
        color: '#000',
        fontFamily: 'System',
        flexWrap: 'wrap'
    },
    detailedBold: {
        fontSize: 8,
        fontWeight: 'bold',
        color: '#000'
    },
    detailedCheckBox: {
        width: 10,
        height: 10,
        borderWidth: 1,
        borderColor: '#000',
        marginLeft: 4,
        justifyContent: 'center',
        alignItems: 'center'
    }
});

export default DetailedInvoiceTemplate;
