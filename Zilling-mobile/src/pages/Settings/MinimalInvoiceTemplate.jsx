import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';

const MinimalInvoiceTemplate = ({ data, taxType = 'intra' }) => {
    // Default dummy data if not provided (matching the image style)
    const invoiceData = data || {
        invoiceNo: '#6981e46389ed8bc3c8a24d4f',
        date: '2/3/2026',
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
                    <Text style={styles.storeName} numberOfLines={1} adjustsFontSizeToFit>kaviraja</Text>
                    <Text style={styles.storeAddress}>D. NO: 7, Kulandaivelpuram, 1st street,</Text>
                    <Text style={styles.storeAddress}>Vellakottai, Aruppukottai, virudhunagar, Tamil</Text>
                    <Text style={styles.storeAddress}>Nadu, 626101</Text>
                    <Text style={styles.storeAddress}>mkvr2006@gmail.com</Text>
                    <Text style={styles.storeAddress}>GSTIN: 123456789</Text>
                </View>
            </View>

            {/* Content Body */}
            <View style={styles.body}>
                {/* Bill To & Dates */}
                <View style={styles.metaRow}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.label}>BILL TO</Text>
                        <Text style={styles.billToName}>{invoiceData.billTo}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                        <View style={styles.dateRow}>
                            <Text style={styles.label}>INVOICE DATE</Text>
                            <Text style={styles.dateValue}>{invoiceData.date}</Text>
                        </View>
                        <View style={styles.dateRow}>
                            <Text style={styles.label}>DUE DATE</Text>
                            <Text style={styles.dateValue}>{invoiceData.dueDate}</Text>
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
                    {invoiceData.items.map((item, index) => (
                        <View key={index} style={styles.tableRow}>
                            <Text style={[styles.td, { flex: 2, textAlign: 'left', paddingLeft: 4 }]}>{item.desc}</Text>
                            <Text style={[styles.td, styles.colCenter, { width: 40 }]}>{item.qty}</Text>
                            <Text style={[styles.td, styles.colRight, { width: 70 }]}>{item.price}</Text>
                            <Text style={[styles.td, styles.colRight, { width: 40 }]}>{item.tax}</Text>
                            <Text style={[styles.td, { width: 80, textAlign: 'right', fontWeight: 'bold', paddingRight: 4 }]}>{item.amount}</Text>
                        </View>
                    ))}
                    {/* Filler Row for visuals */}
                    <View style={[styles.tableRow, { height: 20, borderBottomWidth: 0 }]}></View>
                </View>

                {/* Footer Section */}
                <View style={styles.footer}>
                    {/* Left: Notes */}
                    <View style={styles.notesContainer}>
                        <Text style={styles.notesTitle}>NOTES</Text>
                        <Text style={styles.notesText}>Thank you for your business!</Text>
                        <View style={{ height: 10 }} />
                        <Text style={styles.termsTitle}>Terms:</Text>
                        <Text style={styles.termsText}>
                            1. Goods once sold will not be taken back. 2. Interest
                            @18% pa will be charged if not paid within due date.
                        </Text>
                    </View>

                    {/* Right: Totals */}
                    <View style={styles.totalsContainer}>
                        <View style={styles.subtotalRow}>
                            <Text style={styles.subtotalLabel}>Subtotal</Text>
                            <Text style={styles.subtotalValue}>₹{invoiceData.subtotal}</Text>
                        </View>

                        {/* Distinct Tax Breakdown Section */}
                        <View style={styles.taxSection}>
                            {taxType === 'intra' ? (
                                <>
                                    <View style={styles.taxRow}>
                                        <Text style={styles.taxLabel}>CGST (2.5%)</Text>
                                        <Text style={styles.taxValue}>₹{parseFloat(invoiceData.taxAmount) / 2}</Text>
                                    </View>
                                    <View style={styles.taxRow}>
                                        <Text style={styles.taxLabel}>SGST (2.5%)</Text>
                                        <Text style={styles.taxValue}>₹{parseFloat(invoiceData.taxAmount) / 2}</Text>
                                    </View>
                                </>
                            ) : (
                                <View style={styles.taxRow}>
                                    <Text style={styles.taxLabel}>IGST (5%)</Text>
                                    <Text style={styles.taxValue}>₹{invoiceData.taxAmount}</Text>
                                </View>
                            )}
                        </View>

                        <View style={styles.grandTotalBox}>
                            <Text style={styles.grandTotalLabel}>TOTAL</Text>
                            <Text style={styles.grandTotalValue}>₹{invoiceData.total}</Text>
                        </View>
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
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 5,
        overflow: 'hidden' // Important for rounded corners if any, or general clean edges
    },
    header: {
        backgroundColor: '#147e70', // Teal color from image
        padding: 24,
        flexDirection: 'row',
        justifyContent: 'space-between'
    },
    headerTitle: {
        fontSize: 28, // Reduced from 32
        fontWeight: '900',
        color: '#fff',
        marginBottom: 8,
        lineHeight: 34
    },
    invoiceNo: {
        fontSize: 12,
        fontWeight: '600',
        color: '#b2dfdb', // Lighter teal
        marginBottom: 4
    },
    storeName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 4,
        textAlign: 'right'
    },
    storeAddress: {
        fontSize: 10,
        color: '#e0f2f1',
        textAlign: 'right',
        lineHeight: 14
    },
    body: {
        padding: 24,
        backgroundColor: '#fff'
    },
    metaRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 30
    },
    label: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#9ca3af', // Gray-400
        marginBottom: 4,
        letterSpacing: 0.5,
        textTransform: 'uppercase'
    },
    billToName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#000'
    },
    dateRow: {
        flexDirection: 'row',
        gap: 20,
        marginBottom: 4,
        justifyContent: 'flex-end',
        alignItems: 'center'
    },
    dateValue: {
        fontSize: 12,
        fontWeight: '600',
        color: '#000',
        width: 80,
        textAlign: 'right'
    },
    table: {
        marginBottom: 30
    },
    tableHeader: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
        paddingBottom: 8,
        marginBottom: 8
    },
    th: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#9ca3af',
        textTransform: 'uppercase'
    },
    tableRow: {
        flexDirection: 'row',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6'
    },
    td: {
        fontSize: 11, // Slightly smaller for better fit
        color: '#1f2937',
        fontWeight: '500'
    },
    colCenter: { textAlign: 'center' },
    colRight: { textAlign: 'right' },
    footer: {
        flexDirection: 'row',
        gap: 20
    },
    notesContainer: {
        flex: 1,
        backgroundColor: '#f0fdfa', // Very light teal
        padding: 16,
        borderRadius: 4
    },
    notesTitle: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#115e59', // Dark teal
        marginBottom: 4
    },
    notesText: {
        fontSize: 11,
        color: '#4b5563',
        marginBottom: 8
    },
    termsTitle: {
        fontSize: 11,
        fontWeight: 'bold',
        color: '#374151',
        marginBottom: 2
    },
    termsText: {
        fontSize: 10,
        color: '#6b7280',
        lineHeight: 14
    },
    totalsContainer: {
        flex: 1,
        justifyContent: 'flex-start'
    },
    subtotalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
        alignItems: 'center'
    },
    subtotalLabel: {
        fontSize: 12,
        color: '#4b5563'
    },
    subtotalValue: {
        fontSize: 12,
        fontWeight: '600',
        color: '#1f2937'
    },
    taxSection: {
        borderTopWidth: 1,
        borderTopColor: '#f3f4f6',
        paddingTop: 8,
        marginTop: 8,
        marginBottom: 8
    },
    taxRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 4
    },
    taxLabel: {
        fontSize: 11,
        color: '#6b7280'
    },
    taxValue: {
        fontSize: 11,
        fontWeight: '600',
        color: '#374151'
    },
    grandTotalBox: {
        backgroundColor: '#147e70',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 4,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 4
    },
    grandTotalLabel: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#fff',
        textTransform: 'uppercase'
    },
    grandTotalValue: {
        fontSize: 18,
        fontWeight: '900',
        color: '#fff'
    }
});

export default MinimalInvoiceTemplate;
