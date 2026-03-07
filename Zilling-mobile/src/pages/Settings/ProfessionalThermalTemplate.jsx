import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';

const ProfessionalThermalTemplate = ({ settings, data, taxType = 'intra', forceInter = false }) => {
    // Fallback/Demo Data
    const store = settings?.store || {
        name: 'ஆச்சி மசாலா',
        legalName: 'அப்ஸரா மார்க்கெட்டிங்',
        address: { street: '36, பழைய வெற்றிலைக்கார தெரு', city: 'மதுரை-1', state: 'TN' },
        contact: 'Ph:0452-4371419 Cell:9943415355',
        whatsapp: '9894225311',
        gstin: ''
    };

    const lang = settings?.invoice?.billLanguage || 'en';

    const translations = {
        en: {
            mid: 'MID',
            date: 'Date',
            receiptNo: 'Receipt No',
            time: 'Time',
            item: 'Item',
            qty: 'Qty',
            price: 'Price',
            amt: 'Amount',
            totalItems: 'Total Items',
            total: 'Total',
            taxPct: 'TAX %',
            taxableVal: 'TAXABLE VAL.',
            cgst: 'CGST',
            sgst: 'SGST',
            igst: 'IGST',
            totalAmt: 'TOTAL AMT',
            grandTotal: 'Grand Total',
            whatsapp: 'WHATSAPP NO',
            mobile: 'MOBILE NO',
            items: [
                { name: 'BADAM 10RS', quantity: 8, unit: 'S', price: 80.00, total: 640.00, taxRate: 5 },
                { name: 'SAMBAR - 20G', quantity: 2, unit: 'S', price: 75.00, total: 150.00, taxRate: 5 },
                { name: 'CHICKEN - 20G', quantity: 1, unit: 'S', price: 75.00, total: 75.00, taxRate: 5 },
                { name: '65 - 20G', quantity: 1, unit: 'S', price: 75.00, total: 75.00, taxRate: 5 },
                { name: 'KULAMBU PODI- 25G', quantity: 1, unit: 'S', price: 75.00, total: 75.00, taxRate: 5 }
            ]
        },
        ta: {
            mid: 'MID',
            date: 'தேதி',
            receiptNo: 'ரசீது எண்',
            time: 'நேரம்',
            item: 'பொருள்',
            qty: 'அளவு',
            price: 'விலை',
            amt: 'தொகை',
            totalItems: 'மொத்த பொருட்கள்',
            total: 'மொத்தம்',
            taxPct: 'வரி %',
            taxableVal: 'வரிக்குரிய மதிப்பு',
            cgst: 'CGST',
            sgst: 'SGST',
            igst: 'IGST',
            totalAmt: 'மொத்த தொகை',
            grandTotal: 'மொத்தம்',
            whatsapp: 'வாட்ஸ்அப் எண்',
            mobile: 'மொபைல் எண்',
            items: [
                { name: 'பாதாம் 10ரூ', quantity: 8, unit: 'S', price: 80.00, total: 640.00, taxRate: 5 },
                { name: 'சாம்பார் - 20 கி', quantity: 2, unit: 'S', price: 75.00, total: 150.00, taxRate: 5 },
                { name: 'சிக்கன் - 20 கி', quantity: 1, unit: 'S', price: 75.00, total: 75.00, taxRate: 5 },
                { name: '65 - 20 கி', quantity: 1, unit: 'S', price: 75.00, total: 75.00, taxRate: 5 },
                { name: 'குழம்புபொடி- 25 கி', quantity: 1, unit: 'S', price: 75.00, total: 75.00, taxRate: 5 }
            ]
        },
        hi: {
            mid: 'MID',
            date: 'दिनांक',
            receiptNo: 'रसीद संख्या',
            time: 'समय',
            item: 'वस्तु',
            qty: 'मात्रा',
            price: 'मूल्य',
            amt: 'राशि',
            totalItems: 'कुल वस्तुएं',
            total: 'योग',
            taxPct: 'कर %',
            taxableVal: 'कर योग्य मूल्य',
            cgst: 'CGST',
            sgst: 'SGST',
            igst: 'IGST',
            totalAmt: 'कुल राशि',
            grandTotal: 'कुल योग',
            whatsapp: 'व्हाट्सएप नंबर',
            mobile: 'मोबाइल नंबर',
            items: [
                { name: 'बादाम 10रु', quantity: 8, unit: 'S', price: 80.00, total: 640.00, taxRate: 5 },
                { name: 'सांभर - 20 ग्राम', quantity: 2, unit: 'S', price: 75.00, total: 150.00, taxRate: 5 },
                { name: 'चिकन - 20 ग्राम', quantity: 1, unit: 'S', price: 75.00, total: 75.00, taxRate: 5 },
                { name: '65 - 20 ग्राम', quantity: 1, unit: 'S', price: 75.00, total: 75.00, taxRate: 5 },
                { name: 'मसाला पाउडर- 25 ग्राम', quantity: 1, unit: 'S', price: 75.00, total: 75.00, taxRate: 5 }
            ]
        },
        ml: {
            mid: 'MID',
            date: 'തീയതി',
            receiptNo: 'രസീത് നമ്പർ',
            time: 'സമയം',
            item: 'ഇനം',
            qty: 'അളവ്',
            price: 'വില',
            amt: 'തുക',
            totalItems: 'ആകെ ഇനങ്ങൾ',
            total: 'ആകെ',
            taxPct: 'നികുതി %',
            taxableVal: 'നികുതി വിധേയമായ തുക',
            cgst: 'CGST',
            sgst: 'SGST',
            igst: 'IGST',
            totalAmt: 'ആകെ തുക',
            grandTotal: 'ആകെ തുക',
            whatsapp: 'വാട്ട്‌സ്ആപ്പ് നമ്പർ',
            mobile: 'മൊബൈൽ നമ്പർ',
            items: [
                { name: 'ബദാം 10 രൂപ', quantity: 8, unit: 'S', price: 80.00, total: 640.00, taxRate: 5 },
                { name: 'സാമ്പാർ - 20 ഗ്രാം', quantity: 2, unit: 'S', price: 75.00, total: 150.00, taxRate: 5 },
                { name: 'ചിക്കൻ - 20 ഗ്രാം', quantity: 1, unit: 'S', price: 75.00, total: 75.00, taxRate: 5 },
                { name: '65 - 20 ഗ്രാം', quantity: 1, unit: 'S', price: 75.00, total: 75.00, taxRate: 5 },
                { name: 'മസാലപ്പൊടി - 25 ഗ്രാം', quantity: 1, unit: 'S', price: 75.00, total: 75.00, taxRate: 5 }
            ]
        },
        te: {
            mid: 'MID',
            date: 'తేదీ',
            receiptNo: 'రశీదు సంఖ్య',
            time: 'సమయం',
            item: 'వస్తువు',
            qty: 'పరిమాణం',
            price: 'ధర',
            amt: 'మొత్తం',
            totalItems: 'మొత్తం వస్తువులు',
            total: 'మొత్తం',
            taxPct: 'పన్ను %',
            taxableVal: 'పన్ను విధించదగిన విలువ',
            cgst: 'CGST',
            sgst: 'SGST',
            igst: 'IGST',
            totalAmt: 'మొత్తం మొత్తం',
            grandTotal: 'మొత్తం',
            whatsapp: 'వాట్సాప్ నంబర్',
            mobile: 'మొబైల్ నంబర్',
            items: [
                { name: 'బాదం 10రూ', quantity: 8, unit: 'S', price: 80.00, total: 640.00, taxRate: 5 },
                { name: 'సాంబార్ - 20 గ్రా', quantity: 2, unit: 'S', price: 75.00, total: 150.00, taxRate: 5 },
                { name: 'చికెన్ - 20 గ్రా', quantity: 1, unit: 'S', price: 75.00, total: 75.00, taxRate: 5 },
                { name: '65 - 20 గ్రా', quantity: 1, unit: 'S', price: 75.00, total: 75.00, taxRate: 5 },
                { name: 'మసాలా పొడి- 25 గ్రా', quantity: 1, unit: 'S', price: 75.00, total: 75.00, taxRate: 5 }
            ]
        },
        kn: {
            mid: 'MID',
            date: 'ದಿನಾಂಕ',
            receiptNo: 'ರಸೀದಿ ಸಂಖ್ಯೆ',
            time: 'ಸಮಯ',
            item: 'ವಸ್ತು',
            qty: 'ಪ್ರಮಾಣ',
            price: 'ಬೆಲೆ',
            amt: 'ಮೊತ್ತ',
            totalItems: 'ಒಟ್ಟು ವಸ್ತುಗಳು',
            total: 'ಒಟ್ಟು',
            taxPct: 'ತೆರಿಗೆ %',
            taxableVal: 'ತೆರಿಗೆಯ ಮೌಲ್ಯ',
            cgst: 'CGST',
            sgst: 'SGST',
            igst: 'IGST',
            totalAmt: 'ಒಟ್ಟು ಮೊತ್ತ',
            grandTotal: 'ಒಟ್ಟು',
            whatsapp: 'ವಾಟ್ಸಾಪ್ ಸಂಖ್ಯೆ',
            mobile: 'ಮೊಬೈಲ್ ಸಂಖ್ಯೆ',
            items: [
                { name: 'ಬಾದಾಮಿ 10ರೂ', quantity: 8, unit: 'S', price: 80.00, total: 640.00, taxRate: 5 },
                { name: 'ಸಾಂಬಾರ್ - 20 ಗ್ರಾಂ', quantity: 2, unit: 'S', price: 75.00, total: 150.00, taxRate: 5 },
                { name: 'ಚಿಕನ್ - 20 ಗ್ರಾಂ', quantity: 1, unit: 'S', price: 75.00, total: 75.00, taxRate: 5 },
                { name: '65 - 20 ಗ್ರಾಂ', quantity: 1, unit: 'S', price: 75.00, total: 75.00, taxRate: 5 },
                { name: 'ಮಸಾಲಾ ಪುಡಿ- 25 ಗ್ರಾಂ', quantity: 1, unit: 'S', price: 75.00, total: 75.00, taxRate: 5 }
            ]
        }
    };

    const t = translations[lang] || translations.en;

    const invoice = data || {
        invoiceNo: '6440',
        date: '06/03/26',
        time: '11:56',
        mid: '1',
        items: t.items,
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
                <Text style={styles.contactText}>{store.contact || store.phone}</Text>
                {store.legalName && <Text style={styles.legalName}>{store.legalName}</Text>}
                {store.address?.street && <Text style={styles.addressText}>{store.address.street}</Text>}
                {store.address?.city && <Text style={styles.addressText}>{store.address.city}</Text>}

                {store.whatsapp && (
                    <View style={{ marginTop: 8, alignItems: 'center' }}>
                        <Text style={[styles.infoText, { fontSize: 10 }]}>{t.whatsapp}</Text>
                        <Text style={[styles.infoText, { fontSize: 12 }]}>{store.whatsapp}</Text>
                    </View>
                )}
            </View>

            {/* Metadata */}
            <View style={[styles.row, { marginTop: 10, paddingHorizontal: 2 }]}>
                <Text style={styles.infoText}>{t.mid}: {invoice.mid || '1'}</Text>
                <Text style={styles.infoText}>{t.date}: {invoice.date}</Text>
            </View>
            <View style={[styles.row, { paddingHorizontal: 2 }]}>
                <Text style={styles.infoText}>{t.receiptNo}: {invoice.invoiceNo}</Text>
                <Text style={styles.infoText}>{t.time}: {invoice.time || '11:56'}</Text>
            </View>
            <Text style={[styles.infoText, { paddingHorizontal: 2 }]}>RE-WS-VIP 1</Text>

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
                <Text style={styles.footerText}>{t.mobile}: {store.contact || store.phone || store.whatsapp || 'N/A'}</Text>
                {store.whatsapp && store.whatsapp !== (store.contact || store.phone) && <Text style={[styles.footerText, { marginTop: 2 }]}>WHATSAPP: {store.whatsapp}</Text>}
                <Text style={[styles.footerText, { marginTop: 10, fontSize: 10, letterSpacing: 1 }]}>THANK YOU! VISIT AGAIN</Text>
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
        flexDirection: 'row', // Updated for alignment
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

export default ProfessionalThermalTemplate;
