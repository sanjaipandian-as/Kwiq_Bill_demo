import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { Store } from 'lucide-react-native';

const ClassicInvoiceTemplate = ({ settings, data }) => {
    // Fallback/Demo Data
    const store = settings?.store || {
        name: 'KWIQ BILL',
        address: { street: '123, Market Street', city: 'Chennai', state: 'Tamil Nadu', pincode: '600001' },
        contact: '9876543210'
    };

    const invoice = data || {
        invoiceNo: '#INV-1001',
        date: '14/10/2026',
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

    const colors = {
        primary: '#003594',
        border: '#e2e8f0',
        text: '#334155',
        lightText: '#64748b'
    };

    return (
        <View style={styles.a4Paper}>
            {/* Blue Header */}
            <View style={[styles.a4BlueHeader, { backgroundColor: colors.primary }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 }}>
                    {store.logo ? (
                        <Image source={{ uri: store.logo }} style={{ width: 40, height: 40, backgroundColor: '#fff', borderRadius: 4 }} />
                    ) : (
                        <View style={{ width: 40, height: 40, backgroundColor: '#ffffff22', borderRadius: 4, alignItems: 'center', justifyContent: 'center' }}>
                            <Store size={20} color="#fff" />
                        </View>
                    )}
                    <Text style={styles.a4Title}>INVOICE</Text>
                </View>
            </View>

            {/* Date & Info Msg */}
            <View style={styles.a4MetaRow}>
                <View style={{ flex: 1 }} />
                <View style={styles.a4MetaGrid}>
                    <View style={styles.a4MetaItem}>
                        <Text style={styles.a4MetaLabel}>DATE</Text>
                        <Text style={styles.a4MetaValue}>{invoice.date}</Text>
                    </View>
                    <View style={styles.a4MetaItem}>
                        <Text style={styles.a4MetaLabel}>INVOICE NO.</Text>
                        <Text style={styles.a4MetaValue}>{invoice.invoiceNo}</Text>
                    </View>
                </View>
            </View>
            <Text style={styles.a4PaymentTerms}>Payment Terms: Due on Receipt</Text>

            {/* Bill To / From */}
            <View style={styles.a4AddressRow}>
                <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={[styles.a4LabelBlue, { color: colors.primary }]}>COMPANY NAME</Text>
                    <Text style={styles.a4NameBold}>{store.name}</Text>
                    <Text style={styles.a4AddressText}>{store.address?.street}, {store.address?.city}</Text>
                    <Text style={styles.a4AddressText}>{store.address?.state}, {store.address?.pincode}</Text>
                    <Text style={styles.a4AddressText}>{store.contact}</Text>
                </View>
                <View style={{ flex: 1, paddingLeft: 10, alignItems: 'flex-start' }}>
                    <Text style={[styles.a4LabelBlue, { color: colors.primary }]}>BILL TO</Text>
                    <Text style={styles.a4NameBold}>{invoice.customer?.name || 'Walk-in Customer'}</Text>
                    <Text style={styles.a4AddressText}>{invoice.customer?.address || '-'}</Text>
                </View>
            </View>

            {/* Table Header */}
            <View style={[styles.a4TableHeader, { backgroundColor: colors.primary }]}>
                <Text style={[styles.a4Th, { flex: 2, textAlign: 'left' }]}>DESCRIPTION</Text>
                <Text style={[styles.a4Th, { flex: 0.5, textAlign: 'center' }]}>QTY</Text>
                <Text style={[styles.a4Th, { flex: 1, textAlign: 'right' }]}>UNIT PRICE</Text>
                <Text style={[styles.a4Th, { flex: 1, textAlign: 'right' }]}>TOTAL</Text>
            </View>

            {/* Table Rows */}
            {invoice.items.map((item, index) => (
                <View key={index} style={styles.a4TableRow}>
                    <Text style={[styles.a4Td, { flex: 2, textAlign: 'left' }]}>{item.name}</Text>
                    <Text style={[styles.a4Td, { flex: 0.5, textAlign: 'center' }]}>{item.quantity}</Text>
                    <Text style={[styles.a4Td, { flex: 1, textAlign: 'right' }]}>₹{parseFloat(item.price).toFixed(2)}</Text>
                    <Text style={[styles.a4Td, { flex: 1, textAlign: 'right' }]}>₹{parseFloat(item.total).toFixed(2)}</Text>
                </View>
            ))}

            {/* Totals */}
            <View style={{ alignItems: 'flex-end', marginTop: 10 }}>
                <View style={styles.a4TotalRow}>
                    <Text style={styles.a4TotalLabel}>SUBTOTAL</Text>
                    <Text style={styles.a4TotalValue}>₹{parseFloat(invoice.totals.subtotal).toFixed(2)}</Text>
                </View>
                {invoice.taxType === 'intra' ? (
                    <>
                        <View style={styles.a4TotalRow}>
                            <Text style={styles.a4TotalLabel}>CGST</Text>
                            <Text style={styles.a4TotalValue}>₹{parseFloat(invoice.totals.cgst).toFixed(2)}</Text>
                        </View>
                        <View style={styles.a4TotalRow}>
                            <Text style={styles.a4TotalLabel}>SGST</Text>
                            <Text style={styles.a4TotalValue}>₹{parseFloat(invoice.totals.sgst).toFixed(2)}</Text>
                        </View>
                    </>
                ) : (
                    <View style={styles.a4TotalRow}>
                        <Text style={styles.a4TotalLabel}>IGST</Text>
                        <Text style={styles.a4TotalValue}>₹{parseFloat(invoice.totals.igst || invoice.totals.tax).toFixed(2)}</Text>
                    </View>
                )}
                <View style={[styles.a4BalanceBox, { backgroundColor: colors.primary }]}>
                    <Text style={styles.a4BalanceLabel}>BALANCE DUE</Text>
                    <Text style={styles.a4BalanceValue}>₹{parseFloat(invoice.totals.total).toFixed(2)}</Text>
                </View>
            </View>

            {/* Footer Notes */}
            <View style={{ marginTop: 20 }}>
                <Text style={[styles.a4LabelBlue, { color: colors.primary }]}>Remarks / Payment Instructions:</Text>
                <Text style={styles.a4Notes}>Thank you for your business!</Text>
                <Text style={styles.a4Notes}>Make all checks payable to {store.name}</Text>
            </View>

            <View style={{ marginTop: 30 }}>
                <Text style={styles.a4ThankYou}>Thank you for your business!</Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    a4Paper: {
        width: '100%',
        backgroundColor: '#fff',
        paddingBottom: 40,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 1.41,
    },
    a4BlueHeader: {
        height: 60,
        justifyContent: 'center',
    },
    a4Title: {
        fontSize: 24,
        fontWeight: '900',
        color: '#fff',
        letterSpacing: 2,
    },
    a4MetaRow: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        marginTop: 20,
    },
    a4MetaGrid: {
        width: 180,
    },
    a4MetaItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    a4MetaLabel: {
        fontSize: 10,
        fontWeight: '700',
        color: '#64748b',
    },
    a4MetaValue: {
        fontSize: 10,
        fontWeight: '600',
        color: '#1e293b',
    },
    a4PaymentTerms: {
        paddingHorizontal: 20,
        fontSize: 10,
        color: '#64748b',
        marginTop: 5,
    },
    a4AddressRow: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        marginTop: 20,
        marginBottom: 20,
    },
    a4LabelBlue: {
        fontSize: 10,
        fontWeight: '800',
        marginBottom: 6,
        textTransform: 'uppercase',
    },
    a4NameBold: {
        fontSize: 14,
        fontWeight: '800',
        color: '#1e293b',
        marginBottom: 4,
    },
    a4AddressText: {
        fontSize: 11,
        color: '#475569',
        lineHeight: 16,
    },
    a4TableHeader: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        paddingVertical: 8,
    },
    a4Th: {
        fontSize: 10,
        fontWeight: '800',
        color: '#fff',
    },
    a4TableRow: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    a4Td: {
        fontSize: 11,
        color: '#334155',
    },
    a4TotalRow: {
        flexDirection: 'row',
        width: 200,
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 4,
    },
    a4TotalLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: '#64748b',
    },
    a4TotalValue: {
        fontSize: 11,
        fontWeight: '700',
        color: '#1e293b',
    },
    a4BalanceBox: {
        flexDirection: 'row',
        width: 200,
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 12,
        marginTop: 10,
    },
    a4BalanceLabel: {
        fontSize: 12,
        fontWeight: '800',
        color: '#fff',
    },
    a4BalanceValue: {
        fontSize: 14,
        fontWeight: '900',
        color: '#fff',
    },
    a4Notes: {
        fontSize: 10,
        color: '#64748b',
        paddingHorizontal: 20,
        lineHeight: 14,
    },
    a4ThankYou: {
        fontSize: 18,
        fontWeight: '900',
        color: '#e2e8f0',
        textAlign: 'center',
        fontStyle: 'italic',
    },
});

export default ClassicInvoiceTemplate;
