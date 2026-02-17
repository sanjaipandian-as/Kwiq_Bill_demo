import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const ThermalInvoiceTemplate = ({ settings, data, taxType = 'intra' }) => {
    // Fallback/Demo Data
    const store = settings?.store || {
        name: 'SARAVANAN STORES',
        address: { street: '5/395, thiruchuli road', city: 'Aruppukottai', state: 'TN', pincode: '' },
        contact: '8220158988',
        gstin: '1234567890'
    };

    const invoice = data || {
        invoiceNo: '1',
        date: '14/2/2026',
        customer: { name: '' },
        paymentMode: 'Cash',
        items: [
            { name: 'Sugar 1kg', quantity: 1, price: 50, total: 50 }
        ],
        totals: {
            subtotal: 50,
            tax: 0,
            total: 50
        }
    };

    return (
        <View style={styles.thermalPaper}>
            <Text style={styles.tpStoreName}>{store.name}</Text>
            <Text style={[styles.tpText, styles.tpTextCenter]}>{store.address?.street}, {store.address?.city}</Text>
            <Text style={[styles.tpText, styles.tpTextCenter]}>Phone: {store.contact}</Text>
            {store.gstin && <Text style={[styles.tpText, styles.tpTextCenter]}>GSTIN: {store.gstin}</Text>}

            <View style={styles.tpDashedLine} />
            <Text style={styles.tpHeader}>BILL RECEIPT</Text>
            <View style={styles.tpDashedLine} />

            <View style={styles.tpRow}>
                <Text style={styles.tpText}>Bill No: {invoice.invoiceNo}</Text>
                <Text style={styles.tpText}>Date: {invoice.date}</Text>
            </View>
            <View style={styles.tpRow}>
                <Text style={styles.tpText}>Cust: {invoice.customer?.name || ''}</Text>
                <Text style={styles.tpText}>Mode: {invoice.paymentMode}</Text>
            </View>

            <View style={styles.tpDashedLine} />
            <View style={styles.tpRow}>
                <Text style={[styles.tpTextBold, { width: 30 }]}>Sn</Text>
                <Text style={[styles.tpTextBold, { flex: 1 }]}>Item</Text>
                <Text style={[styles.tpTextBold, { width: 50, textAlign: 'right' }]}>Rate</Text>
                <Text style={[styles.tpTextBold, { width: 60, textAlign: 'right' }]}>Amt</Text>
            </View>
            <View style={styles.tpDashedLine} />

            {/* ITEMS */}
            {invoice.items.map((item, index) => (
                <View key={index} style={styles.tpRow}>
                    <Text style={[styles.tpText, { width: 30 }]}>{index + 1}</Text>
                    <Text style={[styles.tpText, { flex: 1 }]}>{item.name}</Text>
                    <Text style={[styles.tpText, { width: 50, textAlign: 'right' }]}>{parseFloat(item.price).toFixed(2)}</Text>
                    <Text style={[styles.tpText, { width: 60, textAlign: 'right' }]}>{parseFloat(item.total).toFixed(2)}</Text>
                </View>
            ))}

            <View style={styles.tpDashedLine} />
            <View style={styles.tpRow}>
                <Text style={styles.tpText}>Taxable Amount:</Text>
                <Text style={styles.tpTextBold}>₹{parseFloat(invoice.totals.subtotal).toFixed(2)}</Text>
            </View>
            <View style={styles.tpRow}>
                <Text style={styles.tpText}>Total Tax:</Text>
                <Text style={styles.tpTextBold}>₹{parseFloat(invoice.totals.tax).toFixed(2)}</Text>
            </View>
            <View style={styles.tpDashedLine} />
            <View style={styles.tpRow}>
                <Text style={styles.tpTotal}>GRAND TOTAL:</Text>
                <Text style={styles.tpTotal}>₹{parseFloat(invoice.totals.total).toFixed(2)}</Text>
            </View>

            <Text style={[styles.tpTextBold, { marginTop: 8, marginBottom: 2 }]}>GST SUMMARY</Text>
            <View style={styles.tpGxBox}>
                <View style={styles.tpGxHeader}>
                    <Text style={[styles.tpText, { flex: 0.8, textAlign: 'center', fontSize: 9 }]}>%</Text>
                    <Text style={[styles.tpText, { flex: 1.2, textAlign: 'center', fontSize: 9, borderLeftWidth: 1, borderLeftColor: '#94a3b8', borderStyle: 'dashed' }]}>Taxable</Text>
                    {taxType === 'inter' ? (
                        <Text style={[styles.tpText, { flex: 2, textAlign: 'center', fontSize: 9, borderLeftWidth: 1, borderLeftColor: '#94a3b8', borderStyle: 'dashed' }]}>IGST</Text>
                    ) : (
                        <>
                            <Text style={[styles.tpText, { flex: 1, textAlign: 'center', fontSize: 9, borderLeftWidth: 1, borderLeftColor: '#94a3b8', borderStyle: 'dashed' }]}>CGST</Text>
                            <Text style={[styles.tpText, { flex: 1, textAlign: 'center', fontSize: 9, borderLeftWidth: 1, borderLeftColor: '#94a3b8', borderStyle: 'dashed' }]}>SGST</Text>
                        </>
                    )}
                </View>
                {invoice.totals.tax > 0 ? (
                    <View style={styles.tpGxRow}>
                        <Text style={[styles.tpText, { flex: 0.8, textAlign: 'center', fontSize: 9 }]}>-</Text>
                        <Text style={[styles.tpText, { flex: 1.2, textAlign: 'center', fontSize: 9, borderLeftWidth: 1, borderLeftColor: '#94a3b8', borderStyle: 'dashed' }]}>{invoice.totals.subtotal.toFixed(2)}</Text>
                        {taxType === 'inter' ? (
                            <Text style={[styles.tpText, { flex: 2, textAlign: 'center', fontSize: 9, borderLeftWidth: 1, borderLeftColor: '#94a3b8', borderStyle: 'dashed' }]}>{invoice.totals.tax.toFixed(2)}</Text>
                        ) : (
                            <>
                                <Text style={[styles.tpText, { flex: 1, textAlign: 'center', fontSize: 9, borderLeftWidth: 1, borderLeftColor: '#94a3b8', borderStyle: 'dashed' }]}>{(invoice.totals.tax / 2).toFixed(2)}</Text>
                                <Text style={[styles.tpText, { flex: 1, textAlign: 'center', fontSize: 9, borderLeftWidth: 1, borderLeftColor: '#94a3b8', borderStyle: 'dashed' }]}>{(invoice.totals.tax / 2).toFixed(2)}</Text>
                            </>
                        )}
                    </View>
                ) : (
                    <View style={styles.tpGxRow}>
                        <Text style={[styles.tpText, { flex: 1, textAlign: 'center', paddingVertical: 4, fontSize: 9 }]}>No Tax Details</Text>
                    </View>
                )}
            </View>
            <View style={styles.tpDashedLine} />
            <Text style={[styles.tpText, styles.tpTextCenter]}>Thank You! Visit Again.</Text>
        </View>
    );
};

const styles = StyleSheet.create({
    thermalPaper: {
        width: 280, // Simulation of a thermal roll width
        backgroundColor: '#fff',
        padding: 10,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        alignSelf: 'center',
    },
    tpStoreName: {
        fontSize: 14,
        fontWeight: '900',
        color: '#000',
        textAlign: 'center',
        textTransform: 'uppercase',
    },
    tpHeader: {
        fontSize: 12,
        fontWeight: '900',
        color: '#000',
        textAlign: 'center',
        paddingVertical: 2,
    },
    tpText: {
        fontSize: 10,
        color: '#000',
        fontFamily: 'monospace',
    },
    tpTextBold: {
        fontSize: 10,
        fontWeight: '900',
        color: '#000',
        fontFamily: 'monospace',
    },
    tpTextCenter: {
        textAlign: 'center',
    },
    tpDashedLine: {
        borderBottomWidth: 1,
        borderBottomColor: '#000',
        borderStyle: 'dashed',
        marginVertical: 4,
    },
    tpRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginVertical: 1,
    },
    tpTotal: {
        fontSize: 12,
        fontWeight: '900',
        color: '#000',
    },
    tpGxBox: {
        borderWidth: 1,
        borderColor: '#94a3b8',
        borderStyle: 'dashed',
        marginTop: 4,
    },
    tpGxHeader: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#94a3b8',
        borderStyle: 'dashed',
        backgroundColor: '#f8fafc',
    },
    tpGxRow: {
        flexDirection: 'row',
    },
});

export default ThermalInvoiceTemplate;
