import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const ThermalInvoiceTemplate = ({ settings, data, taxType = 'intra', options = {} }) => {

    // Fallback/Demo Data
    const store = settings?.store || {
        name: 'STORE NAME',
        address: { street: '123 Main St', city: 'City', state: 'ST' },
        contact: '9888877777',
        whatsapp: '9888877777',
        gstin: '22AAAAA0000A1Z5'
    };

    const invoice = data || {
        invoiceNo: '6440',
        date: '14/02/2026',
        time: '11:56 AM',
        customer: { name: 'Guest' },
        paymentMode: 'Cash',
        items: [
            { name: 'Apple', quantity: 1, price: 150, total: 150 }
        ],
        totals: {
            subtotal: 150,
            tax: 0,
            total: 150,
            totalItems: 1,
            totalQty: 1
        }
    };

    const isVIP = (cust) => {
        if (!cust) return false;
        const tags = cust.tags || '';
        return typeof tags === 'string' ? tags.includes('VIP') : (Array.isArray(tags) && tags.includes('VIP'));
    };

    const pModeName = (invoice.paymentMode || invoice.paymentType || 'Cash').toLowerCase();
    const pMode = pModeName.includes('cash') ? 'Cash'
        : pModeName.includes('upi') ? 'UPI'
        : pModeName.includes('card') ? 'Card'
        : pModeName.includes('credit') ? 'Credit'
        : (invoice.paymentMode || 'Cash');

    const customerName = invoice.customerName || invoice.customer?.fullName || invoice.customer?.name || '';
    const hasRealCustomer = customerName && customerName.trim().toLowerCase() !== 'guest';
    const vip = isVIP(invoice.customer);

    const paidAmt = parseFloat(invoice.amountReceived || invoice.paidAmount || 0);
    const totalBill = parseFloat(invoice.totals?.total || invoice.total || 0);

    const isInter = taxType === 'inter' || invoice.taxType === 'inter';

    return (
        <View style={styles.thermalPaper}>
            <Text style={styles.tpStoreName}>{store.name}</Text>
            
            {(store.whatsapp || store.contact || store.phone) ? (
                <Text style={styles.tpTextCenter}>WHATSAPP NO: {store.whatsapp || store.contact || store.phone}</Text>
            ) : null}
            
            {(() => {
                const addr = store.address;
                if (!addr) return null;
                if (typeof addr === 'string') return <Text style={styles.tpTextCenter}>{addr}</Text>;
                return (
                    <>
                        {addr.street && <Text style={styles.tpTextCenter}>{addr.street}</Text>}
                        {addr.city && <Text style={styles.tpTextCenter}>{addr.city}</Text>}
                    </>
                );
            })()}

            {store.gstin ? <Text style={styles.tpTextCenter}>GSTIN: {store.gstin}</Text> : null}

            <View style={styles.tpDashedLine} />
            {(invoice.mode === 'invoice' || settings?.invoice?.mode === 'invoice') ? (
                <>
                    <Text style={[styles.tpTextCenter, { fontWeight: 'bold' }]}>TAX INVOICE</Text>
                    <View style={styles.tpDashedLine} />
                </>
            ) : null}

            <View style={styles.tpRow}>
                <Text style={styles.tpText}>Bill: {invoice.invoiceNo || invoice.weekly_sequence || (invoice.id ? String(invoice.id).slice(-6).toUpperCase() : '-')}</Text>
                <Text style={styles.tpText}>{invoice.date} {invoice.time || '12:00 PM'}</Text>
            </View>
            <View style={[styles.tpRow, { justifyContent: 'flex-end' }]}>
                <Text style={styles.tpText}>Mode: {pMode}</Text>
            </View>
            {hasRealCustomer ? (
                <View style={styles.tpRow}>
                    <Text style={styles.tpText}>Cust: {customerName.substring(0, 20)}{vip ? ' (VIP)' : ''}</Text>
                </View>
            ) : vip ? (
                <Text style={[styles.tpTextCenter, { fontWeight: 'bold' }]}>VIP CUSTOMER</Text>
            ) : null}
            
            <View style={styles.tpDashedLine} />
            
            <View style={styles.tpRow}>
                <Text style={[styles.tpText, { width: 20 }]}>Sn</Text>
                <Text style={[styles.tpText, { flex: 1 }]}>Item</Text>
                <Text style={[styles.tpText, { width: 35, textAlign: 'right' }]}>Qty</Text>
                <Text style={[styles.tpText, { width: 45, textAlign: 'right' }]}>Rate</Text>
                <Text style={[styles.tpText, { width: 60, textAlign: 'right' }]}>Amt</Text>
            </View>
            <View style={styles.tpDashedLine} />

            {invoice.items.map((item, index) => (
                <View key={index} style={styles.tpRow}>
                    <Text style={[styles.tpText, { width: 20 }]}>{index + 1}</Text>
                    <Text style={[styles.tpText, { flex: 1 }]} numberOfLines={1}>{item.name}</Text>
                    <Text style={[styles.tpText, { width: 35, textAlign: 'right' }]}>{item.quantity}</Text>
                    <Text style={[styles.tpText, { width: 45, textAlign: 'right' }]}>{parseFloat(item.price).toFixed(2)}</Text>
                    <Text style={[styles.tpText, { width: 60, textAlign: 'right' }]}>{parseFloat(item.total).toFixed(2)}</Text>
                </View>
            ))}

            <View style={styles.tpDashedLine} />

            <View style={styles.summaryBox}>
                <View style={styles.summaryRow}>
                    <Text style={styles.tpText}>Taxable Amount:</Text>
                    <Text style={styles.tpText}>Rs.{parseFloat(invoice.totals?.subtotal || invoice.subtotal || 0).toFixed(2).padStart(8)}</Text>
                </View>
                <View style={styles.summaryRow}>
                    <Text style={styles.tpText}>Total Tax:</Text>
                    <Text style={styles.tpText}>Rs.{parseFloat(invoice.totals?.tax || invoice.tax || 0).toFixed(2).padStart(8)}</Text>
                </View>
                {(invoice.totals?.additionalCharges > 0 || invoice.additionalCharges > 0) && (
                    <View style={styles.summaryRow}>
                        <Text style={styles.tpText}>Extra Charges:</Text>
                        <Text style={styles.tpText}>+Rs.{parseFloat(invoice.totals?.additionalCharges || invoice.additionalCharges).toFixed(2).padStart(8)}</Text>
                    </View>
                )}
                {(invoice.totals?.discount > 0 || invoice.discount > 0) && (
                    <View style={styles.summaryRow}>
                        <Text style={styles.tpText}>Bill Discount:</Text>
                        <Text style={styles.tpText}>-Rs.{parseFloat(invoice.totals?.discount || invoice.discount).toFixed(2).padStart(8)}</Text>
                    </View>
                )}
            </View>

            <View style={styles.tpDoubleLine} />
            <View style={styles.summaryRow}>
                <Text style={styles.tpTotal}>GRAND TOTAL:</Text>
                <Text style={styles.tpTotal}>Rs.{parseFloat(invoice.totals?.total || invoice.total || 0).toFixed(2).padStart(8)}</Text>
            </View>
            <View style={styles.tpDoubleLine} />

            <View style={styles.summaryBox}>
                <View style={styles.summaryRow}>
                    <Text style={styles.tpText}>Status:</Text>
                    <Text style={styles.tpText}>{paidAmt >= totalBill ? 'PAID'.padStart(11) : 'UNPAID'.padStart(11)}</Text>
                </View>
                <View style={styles.summaryRow}>
                    <Text style={styles.tpText}>Paid Amount:</Text>
                    <Text style={styles.tpText}>Rs.{parseFloat(paidAmt).toFixed(2).padStart(8)}</Text>
                </View>
                {Math.abs(totalBill - paidAmt) > 0.01 && (
                    <View style={styles.summaryRow}>
                        <Text style={styles.tpText}>{paidAmt >= totalBill ? "Change:" : "Balance:"}</Text>
                        <Text style={styles.tpText}>Rs.{Math.abs(totalBill - paidAmt).toFixed(2).padStart(8)}</Text>
                    </View>
                )}
            </View>

            {settings?.invoice?.showTaxBreakup !== false && invoice.totals?.tax > 0 && (
                <View style={{ marginTop: 8 }}>
                    <Text style={[styles.tpTextBold, styles.tpTextCenter, { marginBottom: 4 }]}>GST SUMMARY</Text>
                    <View style={styles.textAsciiTable}>
                        <Text style={[styles.tpText, { paddingVertical: 1 }]}>{isInter ? "+-------+----------+----------------+" : "+-------+----------+--------+--------+"}</Text>
                        <Text style={[styles.tpText, { paddingVertical: 1 }]}>{isInter ? "|   %   |  Taxable |      IGST      |" : "|   %   |  Taxable |  CGST  |  SGST  |"}</Text>
                        <Text style={[styles.tpText, { paddingVertical: 1 }]}>{isInter ? "+-------+----------+----------------+" : "+-------+----------+--------+--------+"}</Text>
                        
                        {(invoice.items || []).slice(0, 1).map((_, i) => {
                            const taxRate = parseFloat(invoice.items[0]?.taxRate || 5).toFixed(2);
                            const tVal = parseFloat(invoice.totals?.subtotal || invoice.subtotal || 0).toFixed(2).padStart(8);
                            const tst = parseFloat(invoice.totals?.tax / 2 || 0).toFixed(2).padStart(6);
                            const tIgst = parseFloat(invoice.totals?.tax || 0).toFixed(2).padStart(14);
                            
                            return (
                                <Text key={i} style={[styles.tpText, { paddingVertical: 1 }]}>
                                    {isInter 
                                        ? `| ${taxRate.padStart(5)} | ${tVal} | ${tIgst} |`
                                        : `| ${taxRate.padStart(5)} | ${tVal} | ${tst} | ${tst} |`
                                    }
                                </Text>
                            );
                        })}
                        <Text style={[styles.tpText, { paddingVertical: 1 }]}>{isInter ? "+-------+----------+----------------+" : "+-------+----------+--------+--------+"}</Text>
                    </View>
                </View>
            )}

            <View style={styles.tpDashedLine} />

            {settings?.invoice?.showBankAndSignature && (
                <>
                    {!options?.hideAccountDetails && settings?.bankDetails?.bankName && (
                        <>
                            <Text style={[styles.tpTextBold, { marginTop: 4 }]}>BANK DETAILS:</Text>
                            <Text style={styles.tpText}>Bank: {settings.bankDetails.bankName}</Text>
                            <Text style={styles.tpText}>A/C: {settings.bankDetails.accountNumber || ''}</Text>
                            <Text style={styles.tpText}>IFSC: {settings.bankDetails.ifsc || ''}</Text>
                            <View style={styles.tpDashedLine} />
                        </>
                    )}
                    {!options?.isNonAuthorized && (
                        <View style={{ marginTop: 20, alignItems: 'flex-end', paddingRight: 5 }}>
                            <Text style={styles.tpText}>AUTHORIZED SIGNATORY</Text>
                            {invoice.receptionist_name ? (
                                <Text style={{ fontSize: 9, color: '#444' }}>({invoice.receptionist_name.toUpperCase()})</Text>
                            ) : null}
                        </View>
                    )}
                </>
            )}


            {settings?.invoice?.showTerms !== false && (settings?.invoice?.termsAndConditions || settings?.invoice?.conditionsText) && (
                <>
                    <Text style={[styles.tpTextBold, { marginTop: 4 }]}>TERMS & CONDITIONS:</Text>
                    {settings?.invoice?.termsAndConditions ? (
                        <Text style={styles.tpText}>{settings.invoice.termsAndConditions}</Text>
                    ) : null}
                    {settings?.invoice?.conditionsText ? (
                        <Text style={styles.tpText}>{settings.invoice.conditionsText}</Text>
                    ) : null}
                    <View style={styles.tpDashedLine} />
                </>
            )}

            <Text style={[styles.tpTextCenter, { marginTop: 8 }]}>
                {settings?.invoice?.footerNote || 'Thank you for shopping!'}
            </Text>
            {vip && (
                <Text style={styles.tpTextCenter}>Thank you for your business with us!</Text>
            )}

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
    tpStoreName: {
        fontSize: 16,
        fontWeight: '900',
        color: '#000',
        textAlign: 'center',
        textTransform: 'uppercase',
    },
    tpText: {
        fontSize: 11,
        color: '#000',
        fontFamily: 'monospace',
    },
    tpTextBold: {
        fontSize: 11,
        fontWeight: 'bold',
        color: '#000',
        fontFamily: 'monospace',
    },
    tpTextCenter: {
        fontSize: 11,
        color: '#000',
        fontFamily: 'monospace',
        textAlign: 'center',
    },
    tpDashedLine: {
        borderBottomWidth: 1,
        borderBottomColor: '#000',
        borderStyle: 'dashed',
        marginVertical: 4,
    },
    tpDoubleLine: {
        borderBottomWidth: 3,
        borderBottomColor: '#000',
        borderStyle: 'double',
        marginVertical: 4,
    },
    tpRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginVertical: 1,
        paddingHorizontal: 5
    },
    summaryBox: {
        paddingHorizontal: 15,
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginVertical: 2,
    },
    tpTotal: {
        fontSize: 13,
        fontWeight: '900',
        color: '#000',
        fontFamily: 'monospace',
        paddingHorizontal: 15,
    },
    textAsciiTable: {
        alignItems: 'center',
        paddingHorizontal: 2
    }
});

export default ThermalInvoiceTemplate;
