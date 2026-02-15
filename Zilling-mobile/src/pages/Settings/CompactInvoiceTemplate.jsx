import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';

const CompactInvoiceTemplate = ({ settings, data }) => {
    // Fallback/Demo Data
    const store = settings?.store || {
        name: 'KWIQ BILL',
        address: { street: '123, Market Street', city: 'Chennai', state: 'Tamil Nadu', pincode: '600001' },
        contact: '9876543210'
    };

    const invoice = data || {
        invoiceNo: '#INV-1001',
        date: '14/10/2026',
        dueDate: '14/10/2026',
        customer: { name: 'John Doe', address: '45, Anna Nagar, Madurai, TN' },
        items: [
            { name: 'Sample Product A', quantity: 1, price: 100, total: 100 },
            { name: 'Sample Product B', quantity: 2, price: 50, total: 100 }
        ],
        totals: {
            subtotal: 200,
            tax: 24,
            cgst: 12,
            sgst: 12,
            total: 224
        },
        taxType: 'intra'
    };

    return (
        <View style={styles.compactPaper}>
            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                {store.logo && (
                    <Image source={{ uri: store.logo }} style={{ width: 40, height: 40, marginRight: 10, borderRadius: 4 }} />
                )}
                <View style={{ flex: 1 }}>
                    <Text style={styles.compactTitle}>INVOICE</Text>
                    <View>
                        <Text style={styles.compactStoreName}>{store.name}</Text>
                        <Text style={styles.compactStoreDetails}>
                            {store.address?.street}, {store.address?.city && `${store.address.city}, `}{store.address?.state}, {store.address?.pincode}
                        </Text>
                        <Text style={styles.compactStoreDetails}>Contact: {store.contact}  |  GSTIN: {store.gstin || 'N/A'}</Text>
                    </View>
                </View>
            </View>

            {/* Meta Bar */}
            <View style={styles.compactMetaContainer}>
                <Text style={styles.compactMetaText}><Text style={styles.compactMetaLabel}>INVOICE NO.:</Text> {invoice.invoiceNo}</Text>
                <View>
                    <Text style={[styles.compactMetaText, { textAlign: 'right' }]}><Text style={styles.compactMetaLabel}>Invoice Date:</Text> {invoice.date}</Text>
                    <Text style={[styles.compactMetaText, { textAlign: 'right' }]}><Text style={styles.compactMetaLabel}>Due Date:</Text> {invoice.dueDate || invoice.date}</Text>
                </View>
            </View>

            {/* Addresses */}
            <View style={styles.compactAddressRow}>
                <View style={styles.compactAddressBlock}>
                    <Text style={styles.compactLabel}>BILL TO</Text>
                    <Text style={styles.compactCustomerName}>{invoice.customer?.name || 'Walk-in'}</Text>
                    <Text style={styles.compactStoreDetails}>{invoice.customer?.address || '-'}</Text>
                </View>
                <View style={[styles.compactAddressBlock, { paddingLeft: 10 }]}>
                    <Text style={styles.compactLabel}>SHIP TO</Text>
                    <Text style={styles.compactCustomerName}>{invoice.customer?.name || 'Walk-in'}</Text>
                    <Text style={styles.compactStoreDetails}>{invoice.customer?.address || '-'}</Text>
                </View>
            </View>

            {/* Table */}
            <View style={{ borderWidth: 1, borderColor: '#855E01' }}>
                <View style={styles.compactTableHeader}>
                    <Text style={[styles.compactTh, { flex: 2 }]}>DESCRIPTION</Text>
                    <Text style={[styles.compactTh, { flex: 0.5, textAlign: 'center' }]}>QTY</Text>
                    <Text style={[styles.compactTh, { flex: 1, textAlign: 'right' }]}>UNIT PRICE</Text>
                    <Text style={[styles.compactTh, { flex: 1, textAlign: 'right' }]}>TOTAL</Text>
                </View>
                {/* Rows */}
                {invoice.items.map((item, index) => (
                    <View key={index} style={styles.compactTableRow}>
                        <Text style={[styles.compactTd, { flex: 2 }]}>{item.name}</Text>
                        <Text style={[styles.compactTd, { flex: 0.5, textAlign: 'center' }]}>{item.quantity}</Text>
                        <Text style={[styles.compactTd, { flex: 1, textAlign: 'right' }]}>₹{parseFloat(item.price).toFixed(2)}</Text>
                        <Text style={[styles.compactTd, { flex: 1, textAlign: 'right' }]}>₹{parseFloat(item.total).toFixed(2)}</Text>
                    </View>
                ))}
                {/* Filler to match height if needed */}
                <View style={[styles.compactTableRow, { height: 40, borderBottomWidth: 0 }]}></View>
            </View>

            {/* Footer */}
            <View style={styles.compactFooter}>
                <View style={styles.compactTermsBox}>
                    <Text style={[styles.compactLabel, { fontSize: 9 }]}>Terms & Instructions</Text>
                    <Text style={[styles.compactFooterText, { marginBottom: 8 }]}>
                        1. Goods once sold will not be taken back.
                        2. Interest @18% pa will be charged if not paid within due date.
                    </Text>
                    <Text style={[styles.compactLabel, { fontSize: 9 }]}>Payment Mode: <Text style={{ fontWeight: '400', color: '#334155' }}>{invoice.paymentMode || 'Cash/UPI'}</Text></Text>

                    <View style={{ marginTop: 24, alignItems: 'center' }}>
                        <Text style={[styles.compactFooterText, { fontWeight: '700' }]}>Seal & Signature</Text>
                    </View>
                </View>
                <View style={styles.compactTotalsBox}>
                    <View style={styles.compactTotalRow}>
                        <Text style={styles.compactFooterText}>SUBTOTAL</Text>
                        <Text style={[styles.compactFooterText, { fontWeight: '700' }]}>₹{parseFloat(invoice.totals.subtotal).toFixed(2)}</Text>
                    </View>
                    {invoice.taxType === 'intra' ? (
                        <>
                            <View style={styles.compactTotalRow}>
                                <Text style={styles.compactFooterText}>CGST</Text>
                                <Text style={[styles.compactFooterText, { fontWeight: '700' }]}>₹{parseFloat(invoice.totals.cgst).toFixed(2)}</Text>
                            </View>
                            <View style={styles.compactTotalRow}>
                                <Text style={styles.compactFooterText}>SGST</Text>
                                <Text style={[styles.compactFooterText, { fontWeight: '700' }]}>₹{parseFloat(invoice.totals.sgst).toFixed(2)}</Text>
                            </View>
                        </>
                    ) : (
                        <View style={styles.compactTotalRow}>
                            <Text style={styles.compactFooterText}>IGST</Text>
                            <Text style={[styles.compactFooterText, { fontWeight: '700' }]}>₹{parseFloat(invoice.totals.igst || invoice.totals.tax).toFixed(2)}</Text>
                        </View>
                    )}
                    <View style={styles.compactGrandTotal}>
                        <Text style={[styles.compactLabel, { marginBottom: 0, color: '#855E01' }]}>GRAND TOTAL</Text>
                        <Text style={[styles.compactLabel, { marginBottom: 0, fontSize: 12, color: '#855E01' }]}>₹{parseFloat(invoice.totals.total).toFixed(2)}</Text>
                    </View>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    compactPaper: {
        width: '100%',
        backgroundColor: '#fff',
        padding: 15,
        elevation: 1,
    },
    compactTitle: {
        fontSize: 18,
        fontWeight: '900',
        color: '#855E01',
        marginBottom: 2,
    },
    compactStoreName: {
        fontSize: 12,
        fontWeight: '800',
        color: '#1e293b',
    },
    compactStoreDetails: {
        fontSize: 9,
        color: '#64748b',
        lineHeight: 12,
    },
    compactMetaContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        backgroundColor: '#FEF9EF',
        marginVertical: 10,
        padding: 8,
        borderTopWidth: 2,
        borderBottomWidth: 2,
        borderColor: '#855E01',
    },
    compactMetaText: {
        fontSize: 9,
        color: '#475569',
    },
    compactMetaLabel: {
        fontWeight: '800',
        color: '#855E01',
    },
    compactAddressRow: {
        flexDirection: 'row',
        marginBottom: 10,
    },
    compactAddressBlock: {
        flex: 1,
    },
    compactLabel: {
        fontSize: 10,
        fontWeight: '800',
        color: '#855E01',
        marginBottom: 4,
    },
    compactCustomerName: {
        fontSize: 11,
        fontWeight: '700',
        color: '#1e293b',
    },
    compactTableHeader: {
        flexDirection: 'row',
        backgroundColor: '#FEF9EF',
        paddingVertical: 6,
        paddingHorizontal: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#855E01',
    },
    compactTh: {
        fontSize: 9,
        fontWeight: '900',
        color: '#855E01',
    },
    compactTableRow: {
        flexDirection: 'row',
        paddingVertical: 6,
        paddingHorizontal: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#FEF9EF',
    },
    compactTd: {
        fontSize: 10,
        color: '#334155',
    },
    compactFooter: {
        flexDirection: 'row',
        marginTop: 10,
        borderWidth: 1,
        borderColor: '#855E01',
    },
    compactTermsBox: {
        flex: 1.5,
        padding: 8,
        borderRightWidth: 1,
        borderRightColor: '#855E01',
    },
    compactTotalsBox: {
        flex: 1,
    },
    compactTotalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderBottomWidth: 1,
        borderBottomColor: '#FEF9EF',
    },
    compactFooterText: {
        fontSize: 9,
        color: '#334155',
    },
    compactGrandTotal: {
        backgroundColor: '#FEF9EF',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 8,
    },
});

export default CompactInvoiceTemplate;
