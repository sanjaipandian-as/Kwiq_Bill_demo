import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Platform, Image } from 'react-native';
import { Card } from '../../../components/ui/Card';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { Calculator, Printer, Scan, Calendar, Save, Plus, Award } from 'lucide-react-native';
import CalculatorModal from './CalculatorModal';

// Import for PDF Export
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { generateReceiptHTML } from '../../../utils/printUtils';
const BillingSidebar = ({
    customer,
    items,
    totals,
    onPaymentChange,
    paymentMode,
    paymentStatus,
    amountReceived,
    paymentReference,
    onSavePrint,
    onPrintCustomerBill,
    onSaveInvoice,
    onCustomerSearch,

    settings,
    billId,
    taxType = 'intra',
    onTaxTypeChange,
    isPrinterConnected = true,
    onConnectPrinter,
    onLoyaltyClick,
    loyaltyPointsRedeemed = 0,
    remarks = ''
}) => {
    const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);
    const currentDate = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    const selectedBillTemplate = settings?.invoice?.billTemplate || 'Classic';

    const generateAndExportBill = async (size) => {
        if (onSavePrint) onSavePrint(size);
    };

    return (
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
            {/* Header Tools */}
            <View style={styles.topTools}>
                <View style={styles.dateBox}>
                    <Calendar size={16} color="#94a3b8" />
                    <Text style={styles.dateText}>{currentDate}</Text>
                </View>
                <TouchableOpacity onPress={() => setIsCalculatorOpen(true)} style={styles.calcBtn}>
                    <Calculator size={18} color="#000" />
                </TouchableOpacity>
            </View>

            <CalculatorModal isOpen={isCalculatorOpen} onClose={() => setIsCalculatorOpen(false)} />

            {/* Customer Section */}
            <TouchableOpacity onPress={() => onCustomerSearch('search')} style={styles.customerCard}>
                <View style={styles.customerIcon}>
                    <Text style={styles.customerIconText}>{customer ? customer.name.charAt(0) : '?'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={styles.labelSmall}>BILL TO</Text>
                    <Text style={styles.customerNameMain}>{customer ? customer.name : 'Select Customer'}</Text>
                </View>
                <View style={styles.addBtnCircle}>
                    <Plus size={16} color="#000" />
                </View>
            </TouchableOpacity>

            {/* Loyalty Points Section - Only visible when customer is selected */}
            {customer && (
                <View style={styles.loyaltySection}>
                    <View style={styles.loyaltyHeader}>
                        <Award size={18} color="#000" />
                        <Text style={styles.loyaltyTitle}>Loyalty Rewards</Text>
                    </View>
                    <View style={styles.loyaltyBody}>
                        <View>
                            <Text style={styles.toyaltyLabel}>Available Points</Text>
                            <Text style={styles.loyaltyPointsValue}>{customer.loyaltyPoints || 0} pts</Text>
                        </View>
                        <TouchableOpacity
                            style={[styles.redeemBtn, totals.loyaltyPointsDiscount > 0 && styles.redeemBtnActive]}
                            onPress={onLoyaltyClick}
                        >
                            <Text style={[styles.redeemBtnText, totals.loyaltyPointsDiscount > 0 && styles.redeemBtnTextActive]}>
                                {totals.loyaltyPointsDiscount > 0 ? 'Managed Reward' : 'Redeem Points'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                    {totals.loyaltyPointsDiscount > 0 && (
                        <View style={styles.appliedRewardInfo}>
                            <View style={styles.rewardDot} />
                            <Text style={styles.appliedRewardText}>
                                ₹{totals.loyaltyPointsDiscount.toFixed(0)} saved ({loyaltyPointsRedeemed} pts used)
                            </Text>
                        </View>
                    )}
                    {customer && (
                        <View style={styles.projectedBalanceBox}>
                            <Text style={styles.projectedLabel}>Next Balance</Text>
                            <Text style={styles.projectedValue}>
                                {(customer.loyaltyPoints || 0) - loyaltyPointsRedeemed + (totals.pointsEarned || 0)} pts
                            </Text>
                        </View>
                    )}
                </View>
            )}

            {/* Tax Type Toggle */}
            <View style={styles.taxToggleContainer}>
                <Text style={styles.labelSmall}>TAX TYPE</Text>
                <View style={styles.taxSwitch}>
                    <TouchableOpacity
                        style={[styles.taxOption, taxType === 'intra' && styles.taxOptionActive]}
                        onPress={() => onTaxTypeChange && onTaxTypeChange('intra')}
                    >
                        <Text style={[styles.taxOptionText, taxType === 'intra' && styles.taxOptionTextActive]}>INTRA (Local)</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.taxOption, taxType === 'inter' && styles.taxOptionActive]}
                        onPress={() => onTaxTypeChange && onTaxTypeChange('inter')}
                    >
                        <Text style={[styles.taxOptionText, taxType === 'inter' && styles.taxOptionTextActive]}>INTER (IGST)</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Totals Dashboard */}
            <View style={styles.dashboardTotals}>
                <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Sub-total</Text>
                    <Text style={styles.summaryValue}>₹{totals.grossTotal.toFixed(0)}</Text>
                </View>
                <View style={[styles.summaryRow, { marginTop: 4 }]}>
                    <Text style={styles.summaryLabel}>Total Tax</Text>
                    <Text style={styles.summaryValue}>₹{totals.tax.toFixed(0)}</Text>
                </View>

                {/* Bill Level Breakdown */}
                {totals.itemDiscount > 0 && (
                    <View style={[styles.summaryRow, { marginTop: 4 }]}>
                        <Text style={[styles.summaryLabel, { color: '#64748b' }]}>Item Discounts</Text>
                        <Text style={[styles.summaryValue, { color: '#64748b' }]}>-₹{totals.itemDiscount.toFixed(0)}</Text>
                    </View>
                )}
                {totals.additionalCharges > 0 && (
                    <View style={[styles.summaryRow, { marginTop: 4 }]}>
                        <Text style={[styles.summaryLabel, { color: '#000' }]}>Extra Charges</Text>
                        <Text style={[styles.summaryValue, { color: '#000' }]}>+₹{totals.additionalCharges.toFixed(0)}</Text>
                    </View>
                )}
                {totals.discount > 0 && (
                    <View style={[styles.summaryRow, { marginTop: 4 }]}>
                        <Text style={[styles.summaryLabel, { color: '#22c55e' }]}>Bill Discount</Text>
                        <Text style={[styles.summaryValue, { color: '#22c55e' }]}>-₹{totals.discount.toFixed(0)}</Text>
                    </View>
                )}
                {totals.loyaltyPointsDiscount > 0 && (
                    <View style={[styles.summaryRow, { marginTop: 4 }]}>
                        <Text style={[styles.summaryLabel, { color: '#1d4ed8' }]}>Loyalty Reward</Text>
                        <Text style={[styles.summaryValue, { color: '#1d4ed8' }]}>-₹{totals.loyaltyPointsDiscount.toFixed(0)}</Text>
                    </View>
                )}

                <View style={styles.dashDivider} />

                <Text style={styles.payableLabel}>TOTAL PAYABLE</Text>
                <Text style={styles.payableAmount}>₹{totals.total.toFixed(0)}</Text>

                {totals.pointsEarned > 0 && (
                    <View style={styles.pointsEarnedBox}>
                        <Award size={14} color="#64748b" />
                        <Text style={styles.pointsEarnedText}>Points to Earn: {totals.pointsEarned} pts</Text>
                    </View>
                )}
            </View>

            {remarks && remarks.trim() !== '' && (
                <View style={styles.remarksDisplay}>
                    <Text style={styles.labelSmall}>REMARKS</Text>
                    <Text style={styles.remarksText}>{remarks}</Text>
                </View>
            )}

            {/* Payment Controls */}
            <View style={styles.paymentSection}>
                <Text style={styles.sectionTitleSmall}>PAYMENT STATUS</Text>
                <View style={styles.statusToggle}>
                    {['Paid', 'Unpaid', 'Partially Paid'].map(s => (
                        <TouchableOpacity
                            key={s}
                            style={[styles.statusOption, paymentStatus === s && styles.statusOptionActive]}
                            onPress={() => onPaymentChange('status', s)}
                        >
                            <Text style={[styles.statusOptionText, paymentStatus === s && styles.statusOptionTextActive]}>{s}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <Text style={[styles.sectionTitleSmall, { marginTop: 20 }]}>PAYMENT MODE</Text>
                <View style={styles.modeToggle}>
                    {['Cash', 'UPI', 'Card'].map(m => (
                        <TouchableOpacity
                            key={m}
                            style={[styles.modeOption, paymentMode === m && styles.modeOptionActive]}
                            onPress={() => onPaymentChange('mode', m)}
                        >
                            <Text style={[styles.modeOptionText, paymentMode === m && styles.modeOptionTextActive]}>{m}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {paymentMode !== 'Cash' && (
                    <View style={styles.referenceSection}>
                        <Input
                            value={paymentReference}
                            onChangeText={(v) => onPaymentChange('reference', v)}
                            style={styles.refInput}
                            placeholder={paymentMode === 'UPI' ? "Txn ID..." : "Last 4 Digits..."}
                        />
                    </View>
                )}

                <View style={styles.amountInputSection}>
                    <Text style={styles.labelSmall}>AMOUNT RECEIVED</Text>
                    <Input
                        keyboardType="numeric"
                        value={amountReceived.toString()}
                        onChangeText={(v) => onPaymentChange('amount', v)}
                        style={styles.largeAmountInput}
                        placeholder="0.00"
                    />
                </View>

                {parseFloat(amountReceived || 0) > 0 && (
                    <View style={styles.calcResult}>
                        <Text style={styles.calcResultLabel}>
                            {parseFloat(amountReceived || 0) >= totals.total ? 'CHANGE TO RETURN' : 'BALANCE DUE'}
                        </Text>
                        <Text style={[styles.calcResultValue, parseFloat(amountReceived || 0) < totals.total && { color: '#ef4444' }]}>
                            ₹{Math.abs((parseFloat(amountReceived) || 0) - totals.total).toFixed(0)}
                        </Text>
                    </View>
                )}
            </View>

            {/* Bill Preview */}
            <View style={styles.livePreviewFrame}>
                <View style={styles.previewMeta}>
                    <Text style={styles.previewMetaText}>PREVIEW ({selectedBillTemplate})</Text>
                    <View style={styles.previewDot} />
                </View>
                <BillLivePreview
                    items={items}
                    totals={totals}
                    settings={settings}
                    template={selectedBillTemplate}
                    taxType={taxType}
                    customer={customer}
                    billId={billId}
                    paymentMode={paymentMode}
                    remarks={remarks}
                />
            </View>

            <View style={styles.finalActions}>
                {/* Printer Status Indicator */}
                <TouchableOpacity
                    style={styles.printerStatusRow}
                    onPress={onConnectPrinter}
                    activeOpacity={0.7}
                >
                    <View style={[styles.statusDot, { backgroundColor: isPrinterConnected ? '#22c55e' : '#ef4444' }]} />
                    <Text style={[styles.printerStatusText, { color: isPrinterConnected ? '#166534' : '#ef4444' }]}>
                        {isPrinterConnected ? 'Printer Active' : 'Connect the Printer'}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.mainCompleteBtn} onPress={() => generateAndExportBill('80mm')}>
                    <Save size={20} color="#000" />
                    <Text style={styles.mainCompleteBtnText}>Complete & Print Bill</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => generateAndExportBill('A4')} style={styles.secondarySaveBtn}>
                    <Text style={styles.secondarySaveBtnText}>Save and Share A4 PDF</Text>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, paddingHorizontal: 4 },

    topTools: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    dateBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: '#f1f5f9' },
    dateText: { fontSize: 13, fontWeight: '700', color: '#475569' },
    calcBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#f1f5f9' },

    customerCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', padding: 16, borderRadius: 24, borderWidth: 1.5, borderColor: '#f1f5f9', marginBottom: 20 },
    customerIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
    customerIconText: { color: '#fff', fontWeight: '900', fontSize: 18 },
    labelSmall: { fontSize: 9, fontWeight: '900', color: '#94a3b8', letterSpacing: 1, marginBottom: 4 },
    customerNameMain: { fontSize: 16, fontWeight: '800', color: '#000' },
    addBtnCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },

    taxToggleContainer: { marginBottom: 20, paddingHorizontal: 4 },
    taxSwitch: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 12, padding: 4, borderWidth: 1, borderColor: '#f1f5f9' },
    taxOption: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
    taxOptionActive: { backgroundColor: '#000' },
    taxOptionText: { fontSize: 10, fontWeight: '800', color: '#94a3b8' },
    taxOptionTextActive: { color: '#fff' },

    dashboardTotals: { backgroundColor: '#fff', padding: 24, borderRadius: 32, borderWidth: 1.5, borderColor: '#f1f5f9', marginBottom: 20 },
    summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    summaryLabel: { fontSize: 13, fontWeight: '700', color: '#94a3b8' },
    summaryValue: { fontSize: 14, fontWeight: '800', color: '#475569' },
    dashDivider: { height: 1.5, backgroundColor: '#f1f5f9', marginVertical: 20 },
    payableLabel: { fontSize: 10, fontWeight: '900', color: '#000', letterSpacing: 1.5, marginBottom: 4, textAlign: 'center' },
    payableAmount: { fontSize: 42, fontWeight: '900', color: '#000', textAlign: 'center' },

    paymentSection: { backgroundColor: '#fff', padding: 24, borderRadius: 32, borderWidth: 1.5, borderColor: '#f1f5f9', marginBottom: 20 },
    sectionTitleSmall: { fontSize: 10, fontWeight: '900', color: '#94a3b8', letterSpacing: 1.5, marginBottom: 12 },
    statusToggle: { flexDirection: 'row', gap: 8 },
    statusOption: { flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: '#f8fafc', alignItems: 'center', borderWidth: 1, borderColor: '#f1f5f9' },
    statusOptionActive: { backgroundColor: '#000', borderColor: '#000' },
    statusOptionText: { fontSize: 11, fontWeight: '800', color: '#94a3b8' },
    statusOptionTextActive: { color: '#fff' },

    modeToggle: { flexDirection: 'row', gap: 8 },
    modeOption: { flex: 1, paddingVertical: 12, borderRadius: 14, backgroundColor: '#f8fafc', alignItems: 'center', borderWidth: 1, borderColor: '#f1f5f9' },
    modeOptionActive: { backgroundColor: '#eff6ff', borderColor: '#22c55e' },
    modeOptionText: { fontSize: 14, fontWeight: '800', color: '#475569' },
    modeOptionTextActive: { color: '#22c55e' },

    referenceSection: { marginTop: 12 },
    refInput: { backgroundColor: '#f8fafc', borderRadius: 12, height: 48, fontWeight: '700' },
    amountInputSection: { marginTop: 20 },
    largeAmountInput: { height: 60, fontSize: 24, fontWeight: '900', color: '#000', backgroundColor: '#f8fafc', borderRadius: 16 },

    calcResult: { marginTop: 20, paddingTop: 20, borderTopWidth: 1.5, borderTopColor: '#f1f5f9', alignItems: 'center' },
    calcResultLabel: { fontSize: 10, fontWeight: '900', color: '#94a3b8', letterSpacing: 1 },
    calcResultValue: { fontSize: 28, fontWeight: '900', color: '#22c55e', marginTop: 4 },

    livePreviewFrame: { backgroundColor: '#f1f5f9', padding: 20, borderRadius: 32, marginBottom: 20 },
    previewMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
    previewMetaText: { fontSize: 10, fontWeight: '900', color: '#94a3b8', letterSpacing: 1 },
    previewDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22c55e' },

    finalActions: { marginBottom: 30 },
    mainCompleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#22c55e', height: 64, borderRadius: 20 },
    mainCompleteBtnText: { fontSize: 16, fontWeight: '900', color: '#000' },
    secondarySaveBtn: { marginTop: 15, alignItems: 'center' },
    secondarySaveBtnText: { fontSize: 13, fontWeight: '800', color: '#94a3b8', textDecorationLine: 'underline' },

    printerStatusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 12 },
    statusDot: { width: 8, height: 8, borderRadius: 4 },
    printerStatusText: { fontSize: 12, fontWeight: '700' },

    remarksDisplay: { backgroundColor: '#fdfce6', padding: 16, borderRadius: 18, borderLeftWidth: 4, borderLeftColor: '#facc15', marginBottom: 20 },
    remarksText: { fontSize: 13, fontWeight: '700', color: '#854d0e', fontStyle: 'italic' },

    // Loyalty Section Styles
    loyaltySection: {
        backgroundColor: '#fff',
        padding: 20,
        borderRadius: 24,
        borderWidth: 1.5,
        borderColor: '#f1f5f9',
        marginBottom: 20,
    },
    loyaltyHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
    },
    loyaltyTitle: {
        fontSize: 14,
        fontWeight: '900',
        color: '#000',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    loyaltyBody: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    toyaltyLabel: {
        fontSize: 10,
        fontWeight: '700',
        color: '#64748b',
    },
    loyaltyPointsValue: {
        fontSize: 18,
        fontWeight: '900',
        color: '#0f172a',
    },
    redeemBtn: {
        backgroundColor: '#f1f5f9',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    redeemBtnActive: {
        backgroundColor: '#000',
        borderColor: '#000',
    },
    redeemBtnText: {
        fontSize: 12,
        fontWeight: '800',
        color: '#475569',
    },
    redeemBtnTextActive: {
        color: '#fff',
    },
    appliedRewardInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
    },
    rewardDot: {
        width: 6, height: 6,
        borderRadius: 3,
        backgroundColor: '#000',
    },
    appliedRewardText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#475569',
    },
    projectedBalanceBox: {
        marginTop: 12,
        padding: 10,
        backgroundColor: '#f8fafc',
        borderRadius: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    projectedLabel: {
        fontSize: 10,
        fontWeight: '700',
        color: '#64748b',
    },
    projectedValue: {
        fontSize: 11,
        fontWeight: '800',
        color: '#334155',
    },

    pointsEarnedBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#f8fafc',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 10,
        marginTop: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        alignSelf: 'center'
    },
    pointsEarnedText: {
        fontSize: 12,
        fontWeight: '800',
        color: '#64748b',
    },
});

const BillLivePreview = ({ items, totals, settings, template, taxType, customer, billId, paymentMode, remarks }) => {
    const store = settings?.store || {};
    const showHsn = settings?.invoice?.showHsn !== false;
    const showTaxBreakup = settings?.invoice?.showTaxBreakup === true;
    const isInter = taxType === 'inter';

    // Styles for "Thermal" look
    const textStyle = { fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontSize: 10, color: '#000' };
    const boldStyle = { ...textStyle, fontWeight: 'bold' };
    const dividerStyle = { borderBottomWidth: 1, borderBottomColor: '#94a3b8', borderStyle: 'dashed', marginVertical: 8 };

    const isInclusive = settings?.tax?.defaultType === 'Inclusive' || settings?.tax?.priceMode === 'Inclusive';

    // Calculate Tax Summary for Layout
    const taxSummary = {};
    items.forEach(item => {
        const rate = parseFloat(item.taxRate || 0);
        const price = parseFloat(item.price || item.sellingPrice || 0);
        const qty = parseFloat(item.quantity || 0);

        let taxable = price * qty;
        let taxVal = 0;

        if (isInclusive) {
            // Inclusive: Back-calculate taxable
            const totalInc = price * qty;
            taxable = totalInc / (1 + (rate / 100));
            taxVal = totalInc - taxable;
        } else {
            // Exclusive: Taxable is price * qty
            taxVal = taxable * rate / 100;
        }

        if (!taxSummary[rate]) {
            taxSummary[rate] = { taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0 };
        }
        taxSummary[rate].taxable += taxable;
        if (isInter) {
            taxSummary[rate].igst += taxVal;
        } else {
            taxSummary[rate].cgst += taxVal / 2;
            taxSummary[rate].sgst += taxVal / 2;
        }
        taxSummary[rate].total += taxVal;
    });

    return (
        <View style={{ backgroundColor: '#fff', borderRadius: 4, padding: 16, shadowColor: '#000', shadowOpacity: 0.1, elevation: 4 }}>
            {/* Header */}
            <View style={{ alignItems: 'center', marginBottom: 12 }}>
                {store.logo ? (
                    <Image
                        source={{ uri: store.logo }}
                        style={{ width: 60, height: 60, marginBottom: 8, borderRadius: 8 }}
                        resizeMode="contain"
                    />
                ) : null}
                <Text style={{ ...boldStyle, fontSize: 14, textTransform: 'uppercase' }}>{store.name || 'Store Name'}</Text>
                <Text style={{ ...textStyle, textAlign: 'center', marginTop: 4 }}>
                    {typeof store.address === 'object'
                        ? `${store.address.street || ''}, ${store.address.city || ''}`
                        : store.address}
                </Text>
                <Text style={textStyle}>Phone: {store.contact || store.phone}</Text>
                {store.gstin && <Text style={textStyle}>GSTIN: {store.gstin}</Text>}
            </View>

            <View style={dividerStyle} />
            <Text style={{ ...boldStyle, textAlign: 'center', fontSize: 12 }}>BILL PREVIEW</Text>
            <View style={dividerStyle} />

            {/* Meta */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={textStyle}>Bill No: {billId}</Text>
                <Text style={textStyle}>Date: {new Date().toLocaleDateString()}</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={textStyle}>Cust: {customer ? customer.name.split(' ')[0] : 'Walk-in'}</Text>
                <Text style={textStyle}>Mode: {paymentMode}</Text>
            </View>

            <View style={dividerStyle} />

            {/* Items Table Header */}
            <View style={{ flexDirection: 'row', marginBottom: 4 }}>
                <Text style={{ ...textStyle, width: 20 }}>Sn</Text>
                <Text style={{ ...textStyle, flex: 1 }}>Item</Text>
                <Text style={{ ...textStyle, width: 60, textAlign: 'right' }}>Rate</Text>
                <Text style={{ ...textStyle, width: 70, textAlign: 'right' }}>Amt</Text>
            </View>

            {/* Items List */}
            <View>
                {items.map((item, idx) => {
                    const tr = parseFloat(item.taxRate || 0);
                    const taxLabel = isInter ? `IGST @ ${tr}%` : `CGST @ ${tr / 2}% SGST @ ${tr / 2}%`;
                    return (
                        <View key={idx} style={{ marginBottom: 6 }}>
                            <Text style={{ ...textStyle, fontSize: 9, fontStyle: 'italic' }}>{idx + 1}) {taxLabel}</Text>
                            <Text style={{ ...textStyle, paddingLeft: 10 }}>
                                {item.name} {item.variantName ? `(${item.variantName})` : ''}
                            </Text>
                            <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
                                <Text style={{ ...textStyle, width: 60, textAlign: 'right' }}>{parseFloat(item.price || item.sellingPrice).toFixed(2)}</Text>
                                <Text style={{ ...textStyle, width: 70, textAlign: 'right' }}>{item.total.toFixed(2)}</Text>
                            </View>
                        </View>
                    );
                })}
            </View>

            <View style={dividerStyle} />

            {/* Totals */}
            <View style={{ alignItems: 'flex-end', gap: 2 }}>
                <View style={{ flexDirection: 'row', width: '100%', justifyContent: 'space-between' }}>
                    <Text style={textStyle}>Taxable Amount:</Text>
                    <Text style={textStyle}>₹{totals.subtotal.toFixed(2)}</Text>
                </View>
                <View style={{ flexDirection: 'row', width: '100%', justifyContent: 'space-between' }}>
                    <Text style={textStyle}>Total Tax:</Text>
                    <Text style={textStyle}>₹{totals.tax.toFixed(2)}</Text>
                </View>
                {totals.additionalCharges > 0 && (
                    <View style={{ flexDirection: 'row', width: '100%', justifyContent: 'space-between' }}>
                        <Text style={textStyle}>Extra Charges:</Text>
                        <Text style={textStyle}>₹{totals.additionalCharges.toFixed(2)}</Text>
                    </View>
                )}
                {totals.discount > 0 && (
                    <View style={{ flexDirection: 'row', width: '100%', justifyContent: 'space-between' }}>
                        <Text style={{ ...textStyle, color: '#000' }}>Bill Discount:</Text>
                        <Text style={textStyle}>-₹{totals.discount.toFixed(2)}</Text>
                    </View>
                )}
                {totals.loyaltyPointsDiscount > 0 && (
                    <View style={{ flexDirection: 'row', width: '100%', justifyContent: 'space-between' }}>
                        <Text style={{ ...textStyle, color: '#10b981' }}>Loyalty Disc:</Text>
                        <Text style={{ ...textStyle, color: '#10b981' }}>-₹{totals.loyaltyPointsDiscount.toFixed(2)}</Text>
                    </View>
                )}

                <View style={{ flexDirection: 'row', width: '100%', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#000', borderStyle: 'dashed', marginTop: 4, paddingTop: 4 }}>
                    <Text style={boldStyle}>GRAND TOTAL:</Text>
                    <Text style={boldStyle}>₹{totals.total.toFixed(2)}</Text>
                </View>

                {totals.roundOff !== 0 && (
                    <Text style={{ ...textStyle, fontSize: 9 }}>Round Off: {totals.roundOff > 0 ? '+' : ''}{totals.roundOff.toFixed(2)}</Text>
                )}
            </View>

            {remarks && remarks.trim() !== '' && (
                <View style={{ marginTop: 8, padding: 8, backgroundColor: '#f9fafb', borderStyle: 'dashed', borderWidth: 1, borderColor: '#d1d5db' }}>
                    <Text style={{ ...textStyle, fontSize: 9 }}>REMARKS: {remarks}</Text>
                </View>
            )}

            <View style={dividerStyle} />

            {/* GST Summary */}
            <Text style={{ ...boldStyle, marginBottom: 4 }}>GST SUMMARY</Text>
            <View style={{ borderWidth: 1, borderColor: '#000', borderStyle: 'dashed' }}>
                <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#000', borderStyle: 'dashed' }}>
                    <Text style={{ ...boldStyle, fontSize: 9, flex: 1, padding: 2, borderRightWidth: 1, borderRightColor: '#000', borderStyle: 'dashed', textAlign: 'center' }}>%</Text>
                    <Text style={{ ...boldStyle, fontSize: 9, flex: 2, padding: 2, borderRightWidth: 1, borderRightColor: '#000', borderStyle: 'dashed', textAlign: 'center' }}>Taxable</Text>
                    {isInter ? (
                        <Text style={{ ...boldStyle, fontSize: 9, flex: 2, padding: 2, textAlign: 'center' }}>IGST</Text>
                    ) : (
                        <>
                            <Text style={{ ...boldStyle, fontSize: 9, flex: 2, padding: 2, borderRightWidth: 1, borderRightColor: '#000', borderStyle: 'dashed', textAlign: 'center' }}>CGST</Text>
                            <Text style={{ ...boldStyle, fontSize: 9, flex: 2, padding: 2, textAlign: 'center' }}>SGST</Text>
                        </>
                    )}
                </View>
                {Object.keys(taxSummary).length > 0 ? Object.keys(taxSummary).map((rate, idx) => (
                    <View key={rate} style={{ flexDirection: 'row', borderTopWidth: idx > 0 ? 1 : 0, borderTopColor: '#000', borderStyle: 'dashed' }}>
                        <Text style={{ ...textStyle, fontSize: 9, flex: 1, padding: 2, borderRightWidth: 1, borderRightColor: '#000', borderStyle: 'dashed', textAlign: 'center' }}>{rate}%</Text>
                        <Text style={{ ...textStyle, fontSize: 9, flex: 2, padding: 2, borderRightWidth: 1, borderRightColor: '#000', borderStyle: 'dashed', textAlign: 'right' }}>{taxSummary[rate].taxable.toFixed(2)}</Text>
                        {isInter ? (
                            <Text style={{ ...textStyle, fontSize: 9, flex: 2, padding: 2, textAlign: 'right' }}>{taxSummary[rate].igst.toFixed(2)}</Text>
                        ) : (
                            <>
                                <Text style={{ ...textStyle, fontSize: 9, flex: 2, padding: 2, borderRightWidth: 1, borderRightColor: '#000', borderStyle: 'dashed', textAlign: 'right' }}>{taxSummary[rate].cgst.toFixed(2)}</Text>
                                <Text style={{ ...textStyle, fontSize: 9, flex: 2, padding: 2, textAlign: 'right' }}>{taxSummary[rate].sgst.toFixed(2)}</Text>
                            </>
                        )}
                    </View>
                )) : (
                    <Text style={{ ...textStyle, textAlign: 'center', padding: 4 }}>No Tax Details</Text>
                )}
            </View>

            <View style={dividerStyle} />
            <Text style={{ ...textStyle, textAlign: 'center' }}>Thank You! Visit Again.</Text>
        </View>
    );
};

export default BillingSidebar;