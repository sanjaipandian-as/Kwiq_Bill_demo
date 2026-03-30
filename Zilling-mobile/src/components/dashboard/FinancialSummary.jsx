import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { TrendingUp, IndianRupee, Clock } from 'lucide-react-native';

const FinancialCard = React.memo(({ title, value, icon: Icon, isPositive }) => (
  <View style={styles.finCard}>
    <View style={[styles.finIcon, { backgroundColor: isPositive ? '#22c55e' : '#ef4444' }]}>
      <Icon size={20} color="#fff" />
    </View>
    <View style={{ flex: 1 }}>
      <Text style={styles.finLabel}>{title}</Text>
      <Text style={[styles.finValue, { color: isPositive ? '#22c55e' : '#ef4444' }]}>{value}</Text>
    </View>
  </View>
));

const FinancialSummary = ({ totalSales, totalExpenses, netProfit, pendingAmount }) => {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.finScroll}>
      <FinancialCard title="Total Revenue" value={`₹${totalSales.toLocaleString()}`} icon={TrendingUp} isPositive={true} />
      <FinancialCard title="Total Expenses" value={`₹${totalExpenses.toLocaleString()}`} icon={IndianRupee} isPositive={false} />
      <FinancialCard title="Net Profit" value={`₹${netProfit.toLocaleString()}`} icon={IndianRupee} isPositive={netProfit >= 0} />
      <FinancialCard title="Pending Due" value={`₹${pendingAmount.toLocaleString()}`} icon={Clock} isPositive={false} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  finScroll: { paddingHorizontal: 20, marginBottom: 25 },
  finCard: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 160,
    padding: 16,
    borderRadius: 20,
    marginRight: 12,
    height: 90,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    gap: 12
  },
  finIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  finLabel: { fontSize: 11, color: '#64748b', fontWeight: '700', marginBottom: 4 },
  finValue: { fontSize: 16, fontWeight: '800' },
});

export default React.memo(FinancialSummary);
