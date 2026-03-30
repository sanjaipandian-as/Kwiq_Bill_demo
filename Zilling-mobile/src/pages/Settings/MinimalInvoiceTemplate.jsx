import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';

const MinimalInvoiceTemplate = ({ data, settings, taxType = 'intra', options = {} }) => {
    // Default dummy data if not provided (matching the image style)
    const store = settings?.store || {
        name: 'kaviraja',
        address: { street: 'D. NO: 7, Kulandaivelpuram, 1st street, Vellakottai, Aruppukottai, virudhunagar', state: 'Tamil Nadu', pincode: '626101' },
        email: 'mkvr2006@gmail.com',
        gstin: '123456789'
    };

    const bank = settings?.bankDetails || {};

    const invoiceData = data || {
        invoiceNo: '#6981e46389ed8bc3c8a24d4f',
        date: '2/3/2026',
        time: '11:56 AM',
        dueDate: '2/3/2026',
        billTo: 'N. Rajakumari Marimuthu',
        items: [
            { desc: 'Sample Product', hsn: '-', qty: 1, price: '100.00', tax: '0%', amount: '100.00' },
            { desc: 'Sugar 1kg', hsn: '1701', qty: 2, price: '50.00', tax: '5%', amount: '100.00' }
        ],
        subtotal: '200.00',
        total: '210.00',
        taxAmount: '10.00'
    };


    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <View style={{ width: '40%' }}>
                    <Text style={styles.headerTitle} numberOfLines={1} adjustsFontSizeToFit>Invoice</Text>
                    <Text style={styles.invoiceNo}>{invoiceData.invoiceNo}</Text>
                </View>
                <View style={{ width: '60%', alignItems: 'flex-end' }}>
                    <Text style={styles.storeName} numberOfLines={1} adjustsFontSizeToFit>{store.name}</Text>
                    <Text style={styles.storeAddress}>{store.address?.street}</Text>
                    <Text style={styles.storeAddress}>{store.address?.city} {store.address?.state} {store.address?.pincode}</Text>
                    <Text style={styles.storeAddress}>{store.email}</Text>
                    <Text style={styles.storeAddress}>GSTIN: {store.gstin}</Text>
                </View>
            </View>

            {/* Content Body */}
            <View style={styles.body}>
                {/* Bill To & Dates */}
                <View style={styles.metaRow}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.label}>BILL TO</Text>
                        <Text style={styles.billToName}>{invoiceData.billTo || invoiceData.customerName}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                        <View style={styles.dateRow}>
                            <Text style={styles.label}>INVOICE DATE</Text>
                            <Text style={styles.dateValue}>{invoiceData.date}</Text>
                        </View>
                        <View style={styles.dateRow}>
                            <Text style={styles.label}>TIME</Text>
                            <Text style={styles.dateValue}>{invoiceData.time || '12:00 PM'}</Text>
                        </View>
                        <View style={styles.dateRow}>
                            <Text style={styles.label}>DUE DATE</Text>
                            <Text style={styles.dateValue}>{invoiceData.dueDate || invoiceData.date}</Text>
                        </View>
                    </View>
                </View>

                {/* Table */}
                <View style={styles.table}>
                    {/* Header */}
                    <View style={styles.tableHeader}>
                        <Text style={[styles.th, { flex: 2, textAlign: 'left', paddingLeft: 4 }]}>ITEM</Text>
                        <Text style={[styles.th, styles.colCenter, { width: 40 }]}>QTY</Text>
                        <Text style={[styles.th, styles.colRight, { width: 70 }]}>PRICE</Text>
                        <Text style={[styles.th, styles.colRight, { width: 40 }]}>TAX</Text>
                        <Text style={[styles.th, { width: 80, textAlign: 'right', paddingRight: 4 }]}>AMOUNT</Text>
                    </View>

                    {/* Rows */}
                    {(invoiceData.items || invoiceData.cart || []).map((item, index) => (
                        <View key={index} style={styles.tableRow}>
                            <Text style={[styles.td, { flex: 2, textAlign: 'left', paddingLeft: 4 }]}>{item.desc || item.name}</Text>
                            <Text style={[styles.td, styles.colCenter, { width: 40 }]}>{item.qty || item.quantity}</Text>
                            <Text style={[styles.td, styles.colRight, { width: 70 }]}>{item.price}</Text>
                            <Text style={[styles.td, styles.colRight, { width: 40 }]}>{item.tax || item.taxRate + '%'}</Text>
                            <Text style={[styles.td, { width: 80, textAlign: 'right', fontWeight: 'bold', paddingRight: 4 }]}>{item.amount || item.total}</Text>
                        </View>
                    ))}
                    {/* Filler Row for visuals */}
                    <View style={[styles.tableRow, { height: 20, borderBottomWidth: 0 }]}></View>
                </View>

                {/* Footer Section */}
                <View style={styles.footer}>
                    {/* Left: Notes & Bank Details */}
                    <View style={styles.notesContainer}>
                        {!options?.hideAccountDetails && bank.accountNumber && (
                            <View style={{ marginBottom: 16 }}>
                                <Text style={styles.notesTitle}>PAYMENT DETAILS</Text>
                                <Text style={styles.bankInfoText}>{bank.bankName}</Text>
                                <Text style={styles.bankInfoText}>{bank.accountName}</Text>
                                <Text style={styles.bankInfoText}>A/c: <Text style={{ fontWeight: '700', color: '#334155' }}>{bank.accountNumber}</Text></Text>
                                <Text style={styles.bankInfoText}>IFSC: <Text style={{ fontWeight: '700', color: '#334155' }}>{bank.ifsc}</Text></Text>
                            </View>
                        )}
                        <Text style={styles.notesTitle}>NOTES & REMARKS</Text>
                        <Text style={styles.notesText}>{settings?.invoice?.footerNote || 'Thank you for your business!'}</Text>

                        {(settings?.invoice?.showTerms !== false) && (settings?.invoice?.termsAndConditions || settings?.invoice?.conditionsText) && (
                            <View style={{ marginTop: 12 }}>
                                <Text style={styles.termsTitle}>TERMS & CONDITIONS</Text>
                                {settings?.invoice?.termsAndConditions ? (
                                    <Text style={styles.termsText}>• {settings.invoice.termsAndConditions}</Text>
                                ) : null}
                                {settings?.invoice?.conditionsText ? (
                                    <Text style={styles.termsText}>• {settings.invoice.conditionsText}</Text>
                                ) : null}
                            </View>
                        )}
                    </View>

                    {/* Right: Totals */}
                    <View style={styles.totalsContainer}>
                        <View style={styles.summaryItem}>
                            <Text style={styles.summaryLabel}>Sub-Total</Text>
                            <Text style={styles.summaryValue}>₹{parseFloat(invoiceData.subtotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                        </View>

                        {/* Distinct Tax Breakdown Section */}
                        <View style={styles.taxContainer}>
                            {taxType === 'intra' ? (
                                <>
                                    <View style={styles.taxItem}>
                                        <Text style={styles.taxLabel}>CGST</Text>
                                        <Text style={styles.taxValue}>₹{(parseFloat(invoiceData.taxAmount || invoiceData.tax || 0) / 2).toFixed(2)}</Text>
                                    </View>
                                    <View style={styles.taxItem}>
                                        <Text style={styles.taxLabel}>SGST</Text>
                                        <Text style={styles.taxValue}>₹{(parseFloat(invoiceData.taxAmount || invoiceData.tax || 0) / 2).toFixed(2)}</Text>
                                    </View>
                                </>
                            ) : (
                                <View style={styles.taxItem}>
                                    <Text style={styles.taxLabel}>IGST</Text>
                                    <Text style={styles.taxValue}>₹{parseFloat(invoiceData.taxAmount || invoiceData.tax || 0).toFixed(2)}</Text>
                                </View>
                            )}
                        </View>

                        <View style={styles.grandTotalContainer}>
                            <View style={styles.grandTotalContent}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.grandTotalLabel}>Invoice Total</Text>
                                    <Text style={styles.taxInclusiveText}>Tax Inclusive</Text>
                                </View>
                                <Text style={styles.grandTotalValue} numberOfLines={1} adjustsFontSizeToFit>
                                    ₹{parseFloat(invoiceData.total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </Text>
                            </View>
                        </View>

                        {!options?.isNonAuthorized && (
                            <View style={{ marginTop: 24, alignItems: 'flex-end' }}>
                                <View style={{ width: 100, height: 1.5, backgroundColor: '#0d9488', marginBottom: 6 }} />
                                <Text style={{ fontSize: 9, color: '#0d9488', fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 }}>Authorized Signatory</Text>
                                {invoiceData.receptionist_name ? (
                                    <Text style={{ fontSize: 7, color: '#444', marginTop: 2 }}>({invoiceData.receptionist_name.toUpperCase()})</Text>
                                ) : null}
                            </View>
                        )}
                    </View>
                </View>

            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
        backgroundColor: '#fff',
    },
    header: {
        backgroundColor: '#000', // Changed to Black for true minimal look
        padding: 24,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start'
    },
    headerTitle: {
        fontSize: 32,
        fontWeight: '900',
        color: '#fff',
        letterSpacing: -1,
        marginBottom: 4
    },
    invoiceNo: {
        fontSize: 11,
        fontWeight: '700',
        color: '#ccfbf1',
        letterSpacing: 0.5,
        opacity: 0.9
    },
    storeName: {
        fontSize: 20,
        fontWeight: '800',
        color: '#fff',
        marginBottom: 6,
        textAlign: 'right'
    },
    storeAddress: {
        fontSize: 10,
        color: '#f0fdfa',
        textAlign: 'right',
        lineHeight: 14,
        fontWeight: '500'
    },
    body: {
        padding: 24,
        backgroundColor: '#fff'
    },
    metaRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 32,
        paddingBottom: 24,
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6'
    },
    label: {
        fontSize: 10,
        fontWeight: '800',
        color: '#94a3b8',
        marginBottom: 6,
        letterSpacing: 1,
        textTransform: 'uppercase'
    },
    billToName: {
        fontSize: 16,
        fontWeight: '800',
        color: '#1e293b'
    },
    dateRow: {
        flexDirection: 'row',
        marginBottom: 4,
        justifyContent: 'flex-end',
        alignItems: 'center',
        gap: 12
    },
    dateValue: {
        fontSize: 12,
        fontWeight: '700',
        color: '#334155',
        textAlign: 'right',
        minWidth: 80
    },
    table: {
        marginBottom: 32
    },
    tableHeader: {
        flexDirection: 'row',
        backgroundColor: '#f8fafc',
        paddingVertical: 10,
        paddingHorizontal: 8,
        borderRadius: 8,
        marginBottom: 4
    },
    th: {
        fontSize: 10,
        fontWeight: '900',
        color: '#64748b',
        textTransform: 'uppercase',
        letterSpacing: 0.5
    },
    tableRow: {
        flexDirection: 'row',
        paddingVertical: 12,
        paddingHorizontal: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9'
    },
    td: {
        fontSize: 11,
        color: '#334155',
        fontWeight: '600'
    },
    colCenter: { textAlign: 'center' },
    colRight: { textAlign: 'right' },
    footer: {
        flexDirection: 'row',
        gap: 30 // Increased gap
    },
    notesContainer: {
        flex: 1,
        backgroundColor: '#f8fafc', // Softer neutral background
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#f1f5f9'
    },
    notesTitle: {
        fontSize: 10,
        fontWeight: '900',
        color: '#000',
        marginBottom: 8,
        letterSpacing: 1,
        textTransform: 'uppercase'
    },
    notesText: {
        fontSize: 11,
        color: '#475569',
        lineHeight: 16,
        fontWeight: '500'
    },
    bankInfoText: {
        fontSize: 11,
        color: '#64748b',
        lineHeight: 16,
        marginBottom: 2
    },
    termsTitle: {
        fontSize: 9,
        fontWeight: '900',
        color: '#64748b',
        marginBottom: 4,
        letterSpacing: 0.5
    },
    termsText: {
        fontSize: 9,
        color: '#94a3b8',
        lineHeight: 13,
        marginBottom: 2
    },
    totalsContainer: {
        flex: 1.2, // Give more space to totals
        justifyContent: 'flex-start'
    },
    summaryItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 10,
        alignItems: 'center',
        paddingHorizontal: 4
    },
    summaryLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: '#64748b'
    },
    summaryValue: {
        fontSize: 13,
        fontWeight: '800',
        color: '#1e293b'
    },
    taxContainer: {
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
        paddingTop: 10,
        marginTop: 4,
        marginBottom: 12,
        paddingHorizontal: 4
    },
    taxItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 6
    },
    taxLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: '#94a3b8'
    },
    taxValue: {
        fontSize: 11,
        fontWeight: '700',
        color: '#64748b'
    },
    grandTotalContainer: {
        backgroundColor: '#000',
        borderRadius: 8,
        overflow: 'hidden',
    },
    grandTotalContent: {
        paddingVertical: 14,
        paddingHorizontal: 16,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    grandTotalLabel: {
        fontSize: 12,
        fontWeight: '900',
        color: '#fff',
        textTransform: 'uppercase',
        letterSpacing: 0.5
    },
    taxInclusiveText: {
        fontSize: 8,
        color: '#ccfbf1',
        fontWeight: '700',
        marginTop: 1
    },
    grandTotalValue: {
        fontSize: 18,
        fontWeight: '900',
        color: '#fff',
        flex: 1,
        textAlign: 'right'
    }
});

const isVIP = (cust) => {
    if (!cust) return false;
    const tags = cust.tags || '';
    return typeof tags === 'string' ? tags.includes('VIP') : (Array.isArray(tags) && tags.includes('VIP'));
};

export default MinimalInvoiceTemplate;
