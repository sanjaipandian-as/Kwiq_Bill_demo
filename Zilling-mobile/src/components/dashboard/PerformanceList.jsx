import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { Package, Users, ChevronDown } from 'lucide-react-native';

const ProductCard = React.memo(({ item, index }) => (
  <View style={styles.productCard}>
    <View style={styles.productRank}>
      <Text style={styles.productRankText}>#{index + 1}</Text>
    </View>
    <View style={styles.productIconBg}>
      <Package size={20} color="#fff" />
    </View>
    <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
    <View style={styles.productStats}>
      <Text style={styles.productQty}>{item.qty}</Text>
      <Text style={styles.productLabel}>sold</Text>
    </View>
  </View>
));

const CustomerCard = React.memo(({ item, index }) => (
  <View style={styles.customerCard}>
    <View style={styles.customerRank}>
      <Text style={styles.customerRankText}>#{index + 1}</Text>
    </View>
    <View style={styles.customerAvatar}>
      <Text style={styles.customerAvatarText}>{item.name.charAt(0).toUpperCase()}</Text>
    </View>
    <Text style={styles.customerName} numberOfLines={1}>{item.name}</Text>
    <View style={styles.customerAmount}>
      <Text style={styles.customerAmountValue}>₹{item.total.toLocaleString()}</Text>
      <Text style={styles.customerAmountLabel}>total</Text>
    </View>
  </View>
));

const PerformanceList = ({ 
  title, 
  data, 
  type, 
  filterValue, 
  onFilterPress,
  emptyMessage,
  icon: Icon
}) => {
  return (
    <View style={styles.contentCard}>
      <View style={styles.cardHeaderWithFilter}>
        <View style={styles.cardHeaderRow}>
          <Icon size={18} color="#000" />
          <Text style={styles.cardHeaderTitle}>{title}</Text>
        </View>
        {onFilterPress && (
          <Pressable style={styles.miniFilterBtn} onPress={onFilterPress}>
            <Text style={styles.miniFilterText}>{filterValue}</Text>
            <ChevronDown size={14} color="#64748b" />
          </Pressable>
        )}
      </View>
      {data.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizList}>
          {data.map((item, i) => (
            type === 'product' 
              ? <ProductCard key={i} item={item} index={i} />
              : <CustomerCard key={i} item={item} index={i} />
          ))}
        </ScrollView>
      ) : (
        <View style={styles.emptyState}>
          <Icon size={32} color="#cbd5e1" />
          <Text style={styles.emptyStateText}>{emptyMessage}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  contentCard: { marginHorizontal: 20, backgroundColor: '#fff', borderRadius: 24, paddingVertical: 20, marginBottom: 20, elevation: 3 },
  cardHeaderWithFilter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 15 },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardHeaderTitle: { fontSize: 16, fontWeight: '800', color: '#1e293b' },
  miniFilterBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  miniFilterText: { fontSize: 12, color: '#64748b', fontWeight: '700' },
  horizList: { paddingHorizontal: 20, paddingBottom: 10 },
  productCard: { backgroundColor: '#f8fafc', width: 140, padding: 16, borderRadius: 24, marginRight: 12, borderWidth: 1, borderColor: '#f1f5f9' },
  productRank: { position: 'absolute', top: 12, right: 12, backgroundColor: '#fff', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, elevation: 2 },
  productRankText: { fontSize: 10, fontWeight: '900', color: '#1e293b' },
  productIconBg: { width: 40, height: 40, borderRadius: 14, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  productName: { fontSize: 13, fontWeight: '800', color: '#1e293b', lineHeight: 18, height: 36, marginBottom: 8 },
  productStats: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  productQty: { fontSize: 18, fontWeight: '900', color: '#000' },
  productLabel: { fontSize: 10, fontWeight: '700', color: '#64748b', textTransform: 'uppercase' },
  customerCard: { backgroundColor: '#f8fafc', width: 130, padding: 16, borderRadius: 24, marginRight: 12, alignItems: 'center', borderWidth: 1, borderColor: '#f1f5f9' },
  customerRank: { position: 'absolute', top: 12, right: 12, backgroundColor: '#fff', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, elevation: 2 },
  customerRankText: { fontSize: 10, fontWeight: '900', color: '#1e293b' },
  customerAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', marginBottom: 10, elevation: 4 },
  customerAvatarText: { fontSize: 18, fontWeight: '900', color: '#000' },
  customerName: { fontSize: 13, fontWeight: '800', color: '#1e293b', marginBottom: 6, textAlign: 'center' },
  customerAmount: { alignItems: 'center' },
  customerAmountValue: { fontSize: 14, fontWeight: '900', color: '#000' },
  customerAmountLabel: { fontSize: 9, fontWeight: '700', color: '#64748b', textTransform: 'uppercase' },
  emptyState: { alignItems: 'center', padding: 20 },
  emptyStateText: { marginTop: 10, color: '#94a3b8', fontSize: 14, fontWeight: '600' },
});

export default React.memo(PerformanceList);
