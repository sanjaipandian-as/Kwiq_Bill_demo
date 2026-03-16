import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Platform, Image } from 'react-native';
import { Card } from '../../../components/ui/Card';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { Calculator, Printer, Scan, Calendar, Save, Plus, Award, HelpCircle, Star, Minus } from 'lucide-react-native';
import CalculatorModal from './CalculatorModal';

// Import for PDF Export
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { generateReceiptHTML } from '../../../utils/printUtils';
import ThermalInvoiceTemplate from '../../Settings/ThermalInvoiceTemplate';
import ProfessionalThermalTemplate from '../../Settings/ProfessionalThermalTemplate';
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
    onHelpConnect,
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
    const isVIP = customer && (
        typeof customer.tags === 'string'
            ? customer.tags.includes('VIP')
            : (Array.isArray(customer.tags) && customer.tags.includes('VIP'))
    );

    const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);
    const [printCopyCount, setPrintCopyCount] = useState(1);
    const [isAuthorizedEnabled, setIsAuthorizedEnabled] = useState(false);
    const currentDate = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    const selectedBillTemplate = settings?.invoice?.billTemplate || 'Classic';

    const generateAndExportBill = async (size) => {
        if (onSavePrint) {
            await onSavePrint(size, printCopyCount, isAuthorizedEnabled);
        }
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
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
                <View style={[styles.customerIcon, isVIP && { backgroundColor: '#facc15' }]}>
                    {isVIP ? (
                        <Star size={20} color="#000" fill="#000" />
                    ) : (
                        <Text style={styles.customerIconText}>{customer ? customer.name.charAt(0) : '?'}</Text>
                    )}
                </View>
                <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.labelSmall}>BILL TO</Text>
                        {isVIP && (
                            <View style={styles.vipBadgeMini}>
                                <Text style={styles.vipBadgeTextMini}>VIP CLIENT</Text>
                            </View>
                        )}
                    </View>
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

                <Text style={styles.sectionTitleSmall}>PAYMENT MODE</Text>
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
                    amountReceived={amountReceived}
                    remarks={remarks}
                />

            </View>

            {/* Print Copy Selection - Redesigned as Stepper */}
            <View style={styles.copyCountSection}>
                <Text style={styles.copyLabel}>Bill Copies</Text>
                <View style={styles.stepperContainer}>
                    <TouchableOpacity
                        style={styles.stepBtn}
                        onPress={() => setPrintCopyCount(prev => Math.max(1, prev - 1))}
                    >
                        <Minus size={18} color="#000" />
                    </TouchableOpacity>

                    <View style={styles.countDisplay}>
                        <Text style={styles.countValue}>{printCopyCount}</Text>
                    </View>

                    <TouchableOpacity
                        style={styles.stepBtn}
                        onPress={() => setPrintCopyCount(prev => Math.min(10, prev + 1))}
                    >
                        <Plus size={18} color="#000" />
                    </TouchableOpacity>
                </View>
            </View>
            
            {/* Authorized Signatory Toggle */}
            <TouchableOpacity 
                style={styles.authorizedToggleCard}
                onPress={() => setIsAuthorizedEnabled(!isAuthorizedEnabled)}
                activeOpacity={0.8}
            >
                <View style={styles.toggleTextSection}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Award size={14} color="#000" />
                        <Text style={styles.toggleLabel}>Print Authorized Copy</Text>
                    </View>
                    <Text style={styles.toggleSubLabel}>Adds extra duplicate with signatory section</Text>
                </View>
                <View style={[styles.switchTrack, isAuthorizedEnabled && styles.switchTrackActive]}>
                    <View style={[styles.switchThumb, isAuthorizedEnabled && styles.switchThumbActive]} />
                </View>
            </TouchableOpacity>

            <View style={styles.finalActions}>
                {/* Printer Status Indicator */}
                <TouchableOpacity
                    style={styles.printerStatusCard}
                    onPress={onConnectPrinter}
                    activeOpacity={0.7}
                >
                    <View style={styles.statusInfoRow}>
                        <Printer size={18} color="#000" />
                        <Text style={styles.printerStatusLabel}>PRINTER STATUS</Text>
                        <Text style={[styles.printerStatusValue, { color: isPrinterConnected ? '#22c55e' : '#ef4444' }]}>
                            {isPrinterConnected ? 'CONNECTED' : 'NOT CONNECTED'}
                        </Text>
                    </View>
                </TouchableOpacity>

                {!isPrinterConnected && (
                    <TouchableOpacity
                        style={styles.helpConnectBtnSimpl}
                        onPress={onHelpConnect}
                    >
                        <HelpCircle size={16} color="#475569" />
                        <Text style={styles.helpConnectBtnTextSimpl}>How to connect printer?</Text>
                    </TouchableOpacity>
                )}

                <TouchableOpacity style={styles.mainCompleteBtn} onPress={() => generateAndExportBill('80mm')}>
                    <Save size={20} color="#fff" />
                    <Text style={styles.mainCompleteBtnText}>COMPLETE BILL ({printCopyCount})</Text>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, paddingHorizontal: 4 },
    scrollContent: { paddingBottom: 120 },

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

    modeToggle: { flexDirection: 'row', gap: 10 },
    modeOption: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#fff', alignItems: 'center', borderWidth: 1.5, borderColor: '#f1f5f9' },
    modeOptionActive: { backgroundColor: '#000', borderColor: '#000' },
    modeOptionText: { fontSize: 13, fontWeight: '800', color: '#64748b' },
    modeOptionTextActive: { color: '#fff' },

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

    finalActions: { marginBottom: 30, paddingHorizontal: 4 },
    mainCompleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: '#000', height: 60, borderRadius: 16, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8 },
    mainCompleteBtnText: { fontSize: 15, fontWeight: '900', color: '#fff', letterSpacing: 1 },
    secondarySaveBtn: { marginTop: 15, alignItems: 'center' },
    secondarySaveBtnText: { color: '#000', fontSize: 13, fontWeight: '700' },
    helpConnectBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 10,
        backgroundColor: '#fff',
        borderWidth: 1.5,
        borderColor: '#000',
        borderRadius: 12,
        marginBottom: 12,
    },
    helpConnectBtnText: {
        color: '#000',
        fontSize: 13,
        fontWeight: '900',
        textTransform: 'uppercase',
        letterSpacing: 0.5
    },

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
    // Redesigned Copy Count Styles (Stepper)
    copyCountSection: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#fff',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderRadius: 20,
        marginBottom: 20,
        borderWidth: 1.5,
        borderColor: '#f1f5f9'
    },
    copyLabel: {
        fontSize: 14,
        fontWeight: '800',
        color: '#1e293b'
    },
    stepperContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16
    },
    stepBtn: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: '#f8fafc',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#e2e8f0'
    },
    countDisplay: {
        minWidth: 30,
        alignItems: 'center'
    },
    countValue: {
        fontSize: 18,
        fontWeight: '900',
        color: '#000'
    },
    // Printer Status Card
    printerStatusCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1.5,
        borderColor: '#f1f5f9',
        overflow: 'hidden'
    },
    statusInfoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10
    },
    printerStatusLabel: {
        fontSize: 10,
        fontWeight: '900',
        color: '#94a3b8',
        letterSpacing: 1,
        flex: 1
    },
    printerStatusValue: {
        fontSize: 12,
        fontWeight: '900',
        letterSpacing: 0.5
    },
    helpConnectBtnSimpl: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        marginBottom: 20
    },
    helpConnectBtnTextSimpl: {
        fontSize: 12,
        fontWeight: '700',
        color: '#64748b',
        textDecorationLine: 'underline'
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
    vipBadgeMini: {
        backgroundColor: '#facc15',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
        marginBottom: 4
    },
    vipBadgeTextMini: {
        fontSize: 7,
        fontWeight: '900',
        color: '#000',
        letterSpacing: 0.5
    },
    // Authorized Toggle Styles
    authorizedToggleCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#fff',
        paddingHorizontal: 20,
        paddingVertical: 18,
        borderRadius: 24,
        marginBottom: 20,
        borderWidth: 1.5,
        borderColor: '#f1f5f9',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2
    },
    toggleTextSection: {
        flex: 1,
        marginRight: 15
    },
    toggleLabel: {
        fontSize: 14,
        fontWeight: '900',
        color: '#1e293b',
        letterSpacing: -0.2
    },
    toggleSubLabel: {
        fontSize: 11,
        color: '#94a3b8',
        fontWeight: '600',
        marginTop: 4
    },
    switchTrack: {
        width: 44,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#e2e8f0',
        padding: 2,
        justifyContent: 'center'
    },
    switchTrackActive: {
        backgroundColor: '#000'
    },
    switchThumb: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: '#fff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 2
    },
    switchThumbActive: {
        transform: [{ translateX: 20 }]
    }
});

const BillLivePreview = ({ items, totals, settings, template, taxType, customer, billId, paymentMode, amountReceived, remarks }) => {
    const invoiceData = {
        invoiceNo: billId,
        date: new Date().toLocaleDateString('en-IN'),
        time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
        customer: customer,
        paymentMode: paymentMode,
        items: items,
        totals: totals,
        remarks: remarks,
        amountReceived: amountReceived
    };

    if (template === 'Professional') {
        return <ProfessionalThermalTemplate settings={settings} data={invoiceData} taxType={taxType} />;
    }

    return <ThermalInvoiceTemplate settings={settings} data={invoiceData} taxType={taxType} />;
};

export default BillingSidebar;