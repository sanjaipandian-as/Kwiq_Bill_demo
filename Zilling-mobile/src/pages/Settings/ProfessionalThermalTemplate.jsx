import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';

const ProfessionalThermalTemplate = ({ settings, data, taxType = 'intra', forceInter = false }) => {
    // Fallback/Demo Data
    const store = settings?.store || {
        name: 'KWIQ BILLING STORE',
        legalName: 'KWIQ SOLUTIONS PVT LTD',
        address: { street: '123, Business Mall, Sector 4', city: 'Chennai', state: 'TN' },
        contact: 'Ph:044-12345678 Cell:9888877777',
        whatsapp: '9888877777',
        gstin: ''
    };

    const lang = settings?.invoice?.billLanguage || 'en';

    const translations = {
        en: { mid: 'M.O.P', date: 'Date', receiptNo: 'Receipt No', time: 'Time', item: 'Item', qty: 'Qty', price: 'Price', amt: 'Amount', totalItems: 'Total Items', total: 'Total', taxPct: 'TAX %', taxableVal: 'TAXABLE VAL.', cgst: 'CGST', sgst: 'SGST', igst: 'IGST', totalAmt: 'TOTAL AMT', grandTotal: 'Grand Total', whatsapp: 'WHATSAPP NO', mobile: 'MOBILE NO' },
        ta: { mid: 'M.O.P', date: 'தேதி', receiptNo: 'ரசீது எண்', time: 'நேரம்', item: 'பொருள்', qty: 'அளவு', price: 'விலை', amt: 'தொகை', totalItems: 'மொத்த பொருட்கள்', total: 'மொத்தம்', taxPct: 'வரி %', taxableVal: 'வரிக்குரியது', cgst: 'CGST', sgst: 'SGST', igst: 'IGST', totalAmt: 'மொத்த தொகை', grandTotal: 'மொத்தம்', whatsapp: 'வாட்ஸ்அப் எண்', mobile: 'மொபைல் எண்' },
        hi: { mid: 'M.O.P', date: 'दिनांक', receiptNo: 'رसीद संख्या', time: 'समय', item: 'वस्तु', qty: 'मात्रा', price: 'मूल्य', amt: 'राशि', totalItems: 'कुल वस्तुएं', total: 'कुल', taxPct: 'कर %', taxableVal: 'कर योग्य', cgst: 'CGST', sgst: 'SGST', igst: 'IGST', totalAmt: 'कुल राशि', grandTotal: 'कुल योग', whatsapp: 'व्हाट्सएप नंबर', mobile: 'मोबाइल नंबर' }
    };

    const t = translations[lang] || translations.en;

    const invoice = data || {
        invoiceNo: '6440',
        date: '06/03/26',
        time: '11:56 AM',
        paymentMode: 'Cash',
        items: t.items || [
            { name: 'BADAM 10RS', quantity: 8, unit: 'S', price: 80.00, total: 640.00, taxRate: 5 },
            { name: 'SAMBAR - 20G', quantity: 2, unit: 'S', price: 75.00, total: 150.00, taxRate: 5 },
            { name: 'CHICKEN - 20G', quantity: 1, unit: 'S', price: 75.00, total: 75.00, taxRate: 5 },
            { name: '65 - 20G', quantity: 1, unit: 'S', price: 75.00, total: 75.00, taxRate: 5 },
            { name: 'KULAMBU PODI- 25G', quantity: 1, unit: 'S', price: 75.00, total: 75.00, taxRate: 5 }
        ],
        totals: {
            subtotal: 966.40,
            tax: 48.32,
            cgst: 24.16,
            sgst: 24.16,
            igst: 0,
            total: 1015.00,
            totalItems: 5,
            totalQty: 13.0
        }
    };

    const isInter = forceInter || taxType === 'inter' || invoice.taxType === 'inter';

    return (
        <View style={styles.thermalPaper}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.storeName}>{store.name}</Text>

                <Text style={styles.contactText}>WHATSAPP NO: {store.contact || store.phone || store.whatsapp}</Text>

                {/* Address — handle both string and {street, city} object */}
                {(() => {
                    const addr = store.address;
                    if (!addr) return null;
                    if (typeof addr === 'string') return <Text style={styles.addressText}>{addr}</Text>;
                    return (
                        <>
                            {addr.street ? <Text style={styles.addressText}>{addr.street}</Text> : null}
                            {addr.city ? <Text style={styles.addressText}>{addr.city}</Text> : null}
                        </>
                    );
                })()}

                {/* Show TAX INVOICE with double lines for invoice mode; single line for regular bills */}
                {(data?.mode === 'invoice' || settings?.invoice?.mode === 'invoice') ? (
                    <>
                        <View style={[styles.dashedLine, { width: '100%', marginVertical: 4 }]} />
                        <Text style={[styles.storeName, { fontSize: 13 }]}>TAX INVOICE</Text>
                        <View style={[styles.dashedLine, { width: '100%', marginVertical: 4 }]} />
                    </>
                ) : (
                    <View style={[styles.dashedLine, { width: '100%', marginVertical: 4 }]} />
                )}
            </View>

            {/* Metadata */}
            <View style={[styles.row, { marginTop: 10, paddingHorizontal: 2 }]}>
                <Text style={styles.infoText}>
                    {t.mid}: {
                        (() => {
                            const m = (invoice.paymentMode || '').toLowerCase();
                            return m.includes('cash') ? 'Cash'
                                : m.includes('upi') ? 'UPI'
                                : m.includes('card') ? 'Card'
                                : invoice.paymentMode || 'Cash';
                        })()
                    }
                </Text>
                <Text style={styles.infoText}>{t.date}: {invoice.date}</Text>
            </View>
            <View style={[styles.row, { paddingHorizontal: 2 }]}>
                <Text style={styles.infoText}>{t.receiptNo}: {invoice.invoiceNo}</Text>
                <Text style={styles.infoText}>{t.time}: {invoice.time || '11:56'}</Text>
            </View>
            {isVIP(invoice.customer) && (
                <Text style={[styles.infoText, { paddingHorizontal: 2, color: '#000', fontWeight: '900' }]}>
                    RE-WS-VIP {invoice.customer?.fullName || invoice.customer?.name || ''}
                </Text>
            )}

            <View style={styles.dashedLine} />

            {/* Table Header */}
            <View style={styles.tableHeader}>
                <Text style={[styles.headerText, { flex: 2.2, textAlign: 'left' }]}>{t.item}</Text>
                <Text style={[styles.headerText, { flex: 0.8, textAlign: 'center' }]}>{t.qty}</Text>
                <Text style={[styles.headerText, { flex: 1.1, textAlign: 'right' }]}>{t.price}</Text>
                <Text style={[styles.headerText, { flex: 1.1, textAlign: 'right' }]}>{t.amt}</Text>
            </View>

            <View style={styles.dashedLine} />

            {/* Items */}
            {invoice.items.map((item, index) => (
                <View key={index} style={[styles.row, { marginBottom: 6, paddingHorizontal: 2, alignItems: 'flex-start' }]}>
                    <Text style={[styles.itemText, { flex: 2.2, textAlign: 'left' }]}>{item.name}</Text>
                    <Text style={[styles.itemText, { flex: 0.8, textAlign: 'center' }]}>{item.quantity}{item.unit || 'S'}</Text>
                    <Text style={[styles.itemText, { flex: 1.1, textAlign: 'right' }]}>{parseFloat(item.price).toFixed(2)}</Text>
                    <Text style={[styles.itemText, { flex: 1.1, textAlign: 'right' }]}>{parseFloat(item.total).toFixed(2)}</Text>
                </View>
            ))}

            <View style={styles.dashedLine} />

            {/* Summary Row */}
            <View style={[styles.row, { paddingHorizontal: 2 }]}>
                <Text style={[styles.summaryText, { fontSize: 11 }]}>{t.totalItems}:{invoice.totals.totalItems} / {t.qty} {parseFloat(invoice.totals.totalQty || 0).toFixed(3)}</Text>
                <Text style={styles.summaryText}>{parseFloat(invoice.totals.total).toFixed(2)}</Text>
            </View>

            <View style={styles.dashedLine} />

            {settings?.invoice?.showTaxBreakup !== false && (
                <>
                    {/* Tax Table */}
                    <View style={[styles.taxRow, { paddingHorizontal: 2 }]}>
                        <Text style={[styles.taxLabel, { flex: 1.2 }]}>{t.taxPct}</Text>
                        <Text style={[styles.taxLabel, { flex: 2.2 }]}>{t.taxableVal}</Text>
                        {isInter ? (
                            <Text style={[styles.taxLabel, { flex: 1.2 }]}>{t.igst}</Text>
                        ) : (
                            <>
                                <Text style={[styles.taxLabel, { flex: 1.2 }]}>{t.cgst}</Text>
                                <Text style={[styles.taxLabel, { flex: 1.2 }]}>{t.sgst}</Text>
                            </>
                        )}
                        <Text style={[styles.taxLabel, { flex: 2.2, textAlign: 'right' }]}>{t.totalAmt}</Text>
                    </View>
                    <View style={[styles.taxRow, { paddingHorizontal: 2, marginTop: 2 }]}>
                        <Text style={[styles.taxValue, { flex: 1.2 }]}>{(invoice.items[0]?.taxRate || 5).toFixed(2)}%</Text>
                        <Text style={[styles.taxValue, { flex: 2.2 }]}>{parseFloat(invoice.totals.subtotal).toFixed(2)}</Text>
                        {isInter ? (
                            <Text style={[styles.taxValue, { flex: 1.2 }]}>{parseFloat(invoice.totals.igst || invoice.totals.tax || 0).toFixed(2)}</Text>
                        ) : (
                            <>
                                <Text style={[styles.taxValue, { flex: 1.2 }]}>{parseFloat(invoice.totals.cgst || (invoice.totals.tax / 2)).toFixed(2)}</Text>
                                <Text style={[styles.taxValue, { flex: 1.2 }]}>{parseFloat(invoice.totals.sgst || (invoice.totals.tax / 2)).toFixed(2)}</Text>
                            </>
                        )}
                        <Text style={[styles.taxValue, { flex: 2.2, textAlign: 'right', fontWeight: '900' }]}>{parseFloat(invoice.totals.total).toFixed(2)}</Text>
                    </View>

                    <View style={styles.dashedLine} />
                </>
            )}

            {/* Grand Total */}
            <View style={[styles.row, { paddingVertical: 6, paddingHorizontal: 4 }]}>
                <Text style={styles.grandTotalLabel}>{t.grandTotal} :</Text>
                <Text style={styles.grandTotalValue}>₹{parseFloat(invoice.totals.total).toFixed(2)}</Text>
            </View>

            <View style={styles.dashedLine} />

            {/* Footer */}
            <View style={{ alignItems: 'center', marginTop: 4 }}>
                <Text style={styles.footerText}>MOBILE NO: {store.contact || store.phone || store.whatsapp || 'N/A'}</Text>

                <View style={{ marginTop: 12, alignItems: 'center' }}>
                    <Text style={[styles.footerText, { fontSize: 13, textTransform: 'none' }]}>
                        {settings?.invoice?.footerNote || 'Thank you for shopping!'}
                    </Text>
                    {isVIP(invoice.customer) && (
                        <Text style={[styles.footerText, { fontSize: 12, marginTop: 4, textTransform: 'none', fontStyle: 'italic' }]}>
                            Thank you for your business with us!
                        </Text>
                    )}
                </View>

                {/* Terms & Conditions Section */}
                {(settings?.invoice?.showTerms !== false) && (
                    <View style={{ width: '100%', marginTop: 10, paddingHorizontal: 4 }}>
                        <View style={styles.dashedLine} />
                        <Text style={[styles.infoText, { fontSize: 10, marginBottom: 4, textAlign: 'left' }]}>TERMS & CONDITIONS:</Text>
                            {settings?.invoice?.termsAndConditions ? (
                                <Text style={[styles.itemText, { fontSize: 10, marginBottom: 2, textAlign: 'left', width: '100%' }]}>{settings.invoice.termsAndConditions}</Text>
                            ) : null}
                            {settings?.invoice?.conditionsText ? (
                                <Text style={[styles.itemText, { fontSize: 10, textAlign: 'left', width: '100%' }]}>{settings.invoice.conditionsText}</Text>
                            ) : null}
                    </View>
                )}

                {/* Formal Details (Only if Toggle ON) */}
                {settings?.invoice?.showBankAndSignature && (
                    <View style={{ width: '100%', marginTop: 8 }}>
                        {settings?.bankDetails?.bankName && (
                            <View style={{ borderTopWidth: 1, borderTopColor: '#000', borderStyle: 'dashed', paddingTop: 4 }}>
                                <Text style={[styles.infoText, { fontSize: 10 }]}>BANK DETAILS:</Text>
                                <Text style={[styles.infoText, { fontSize: 9 }]}>Bank: {settings.bankDetails.bankName}</Text>
                                <Text style={[styles.infoText, { fontSize: 9 }]}>A/C: {settings.bankDetails.accountNumber}</Text>
                                <Text style={[styles.infoText, { fontSize: 9 }]}>IFSC: {settings.bankDetails.ifsc}</Text>
                                <View style={[styles.dashedLine, { marginTop: 4 }]} />
                            </View>
                        )}
                        <View style={{ alignItems: 'flex-end', marginTop: 15, paddingRight: 10 }}>
                            <Text style={[styles.infoText, { fontSize: 11, marginBottom: 2 }]}>For {store.name}</Text>
                            <View style={{ height: 25 }} />
                            <Text style={[styles.footerText, { fontSize: 10 }]}>Authorised Signatory</Text>
                        </View>
                        <View style={[styles.dashedLine, { marginVertical: 8 }]} />
                    </View>
                )}
            </View>

            <View style={{ height: 20 }} />
        </View>
    );
};

const styles = StyleSheet.create({
    thermalPaper: {
        width: 300,
        backgroundColor: '#fff',
        padding: 5,
        alignSelf: 'center',
    },
    header: {
        alignItems: 'center',
        marginBottom: 5,
    },
    storeName: {
        fontSize: 18,
        fontWeight: '900',
        color: '#000',
        textTransform: 'uppercase',
        textAlign: 'center',
    },
    contactText: {
        fontSize: 11,
        color: '#000',
        fontWeight: '700',
        marginTop: 2,
    },
    legalName: {
        fontSize: 14,
        fontWeight: '900',
        color: '#000',
        marginTop: 4,
        textAlign: 'center',
    },
    addressText: {
        fontSize: 11,
        color: '#000',
        fontWeight: '600',
        textAlign: 'center',
    },
    infoText: {
        fontSize: 12,
        color: '#000',
        fontWeight: '700',
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    dashedLine: {
        borderBottomWidth: 1.5,
        borderBottomColor: '#000',
        borderStyle: 'dashed',
        marginVertical: 6,
    },
    tableHeader: {
        flexDirection: 'row',
        paddingVertical: 2,
        paddingHorizontal: 2,
    },
    headerText: {
        fontSize: 12,
        fontWeight: '900',
        color: '#000',
        textTransform: 'uppercase',
    },
    itemTitle: {
        fontSize: 13,
        fontWeight: '800',
        color: '#000',
        marginBottom: 2,
    },
    itemText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#000',
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    },
    summaryText: {
        fontSize: 12,
        fontWeight: '900',
        color: '#000',
    },
    taxRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    taxLabel: {
        fontSize: 9,
        fontWeight: '900',
        color: '#000',
        textAlign: 'center',
    },
    taxValue: {
        fontSize: 10,
        fontWeight: '700',
        color: '#000',
        textAlign: 'center',
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    },
    grandTotalLabel: {
        fontSize: 16,
        fontWeight: '900',
        color: '#000',
    },
    grandTotalValue: {
        fontSize: 18,
        fontWeight: '900',
        color: '#000',
    },
    footerText: {
        fontSize: 12,
        fontWeight: '900',
        color: '#000',
        textAlign: 'center',
        textTransform: 'uppercase',
    }
});

const isVIP = (cust) => {
    if (!cust) return false;
    const tags = cust.tags || '';
    return typeof tags === 'string' ? tags.includes('VIP') : (Array.isArray(tags) && tags.includes('VIP'));
};

export default ProfessionalThermalTemplate;
