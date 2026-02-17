import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { CheckCircle2, ShoppingBag, User, CreditCard, Printer, Share2 } from 'lucide-react-native';
import { Button } from '../../../../components/ui/Button';
import { Card } from '../../../../components/ui/Card';
import { printReceipt, shareReceiptPDF } from '../../../../utils/printUtils';

const SummaryStep = ({ bill, onReset }) => {
    // Guard against undefined bill
    if (!bill) {
        return (
            <ScrollView style={styles.container} contentContainerStyle={styles.content}>
                <View style={styles.successHeader}>
                    <Text style={styles.successTitle}>No Bill Data</Text>
                </View>
            </ScrollView>
        );
    }

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <View style={styles.successHeader}>
                <View style={styles.iconCircle}>
                    <CheckCircle2 size={40} color="#fff" />
                </View>
                <Text style={styles.successTitle}>Transaction Successful</Text>
                <Text style={styles.billId}>Invoice #{bill.id || 'N/A'}</Text>
            </View>

            <Card style={styles.infoCard}>
                <View style={[styles.row, styles.mb]}>
                    <View style={styles.iconBox}>
                        <User size={18} color="#64748b" />
                    </View>
                    <View style={styles.itemInfo}>
                        <Text style={styles.label}>Customer</Text>
                        <Text style={styles.value}>{bill?.customer ? (bill.customer.name || bill.customer.fullName) : 'Guest'}</Text>
                    </View>
                </View>

                <View style={[styles.row, styles.mb]}>
                    <View style={styles.iconBox}>
                        <CreditCard size={18} color="#64748b" />
                    </View>
                    <View style={styles.itemInfo}>
                        <Text style={styles.label}>Payment Method</Text>
                        <Text style={styles.value}>{bill?.paymentMode || 'Cash'}</Text>
                    </View>
                </View>

                <View style={styles.row}>
                    <View style={styles.iconBox}>
                        <ShoppingBag size={18} color="#64748b" />
                    </View>
                    <View style={styles.itemInfo}>
                        <Text style={styles.label}>Items</Text>
                        <Text style={styles.value}>{bill?.cart?.length || 0} items</Text>
                    </View>
                </View>
            </Card>

            <View style={styles.totalsSection}>
                <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Grand Total</Text>
                    <Text style={styles.totalValue}>₹{(bill?.totals?.total || 0).toFixed(2)}</Text>
                </View>
                {bill.amountReceived > 0 && (
                    <View style={styles.totalRow}>
                        <Text style={styles.changeLabel}>Change Returned</Text>
                        <Text style={styles.changeValue}>₹{Math.max(0, (bill?.amountReceived || 0) - (bill?.totals?.total || 0)).toFixed(2)}</Text>
                    </View>
                )}
            </View>

            <View style={styles.actions}>
                <Button size="lg" style={styles.printBtn} onPress={() => printReceipt(bill)}>
                    <Printer size={20} color="#fff" style={{ marginRight: 8 }} />
                    <Text style={styles.printBtnText}>Print Receipt</Text>
                </Button>
                <View style={styles.subActions}>
                    <Button variant="outline" style={styles.subBtn} onPress={() => shareReceiptPDF(bill)}>
                        <Share2 size={18} color="#475569" style={{ marginRight: 8 }} />
                        <Text style={styles.subBtnText}>Share</Text>
                    </Button>
                    <Button variant="outline" onPress={onReset} style={styles.subBtn}>
                        <Text style={styles.subBtnText}>New Bill</Text>
                    </Button>
                </View>
            </View>

        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    content: { padding: 24 },
    successHeader: { alignItems: 'center', marginBottom: 32 },
    iconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#16a34a', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    successTitle: { fontSize: 24, fontWeight: 'bold', color: '#0f172a' },
    billId: { fontSize: 16, color: '#64748b', marginTop: 4 },
    infoCard: { padding: 20, backgroundColor: '#fff' },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    mb: { marginBottom: 20 },
    iconBox: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
    itemInfo: { flex: 1 },
    label: { fontSize: 12, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 },
    value: { fontSize: 16, fontWeight: '600', color: '#1e293b', marginTop: 2 },
    totalsSection: { marginTop: 32, paddingVertical: 24, borderTopWidth: 1, borderTopColor: '#e2e8f0', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    totalLabel: { fontSize: 18, color: '#64748b' },
    totalValue: { fontSize: 28, fontWeight: 'bold', color: '#0f172a' },
    changeLabel: { fontSize: 14, color: '#64748b' },
    changeValue: { fontSize: 16, fontWeight: 'bold', color: '#16a34a' },
    actions: { marginTop: 32, gap: 12 },
    printBtn: { height: 56, borderRadius: 12, backgroundColor: '#2563eb' },
    printBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    subActions: { flexDirection: 'row', gap: 12 },
    subBtn: { flex: 1, height: 48, borderRadius: 12 },
    subBtnText: { color: '#475569', fontSize: 14, fontWeight: '600' }
});

export default SummaryStep;
