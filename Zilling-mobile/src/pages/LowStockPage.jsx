import React, { useMemo, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useProducts } from '../context/ProductContext';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Package, AlertTriangle } from 'lucide-react-native';

const LowStockPage = ({ navigation }) => {
    const { products, loading, fetchProducts } = useProducts();

    useEffect(() => {
        fetchProducts();
    }, []);

    const lowStockItems = useMemo(() => {
        return products.filter(item => {
            const minStock = parseFloat(item.min_stock) || parseFloat(item.minStock) || 0;
            return minStock > 0 && stock <= minStock;
        }).sort((a, b) => (parseFloat(a.stock) || 0) - (parseFloat(b.stock) || 0));
    }, [products]);

    const renderItem = ({ item }) => {
        return (
            <View style={styles.card}>
                <View style={styles.cardHeader}>
                    <View style={styles.headerLeft}>
                        <View style={[styles.iconBox, { backgroundColor: '#fef2f2' }]}>
                            <AlertTriangle size={20} color="#dc2626" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                            <Text style={styles.category}>{item.category || 'Uncategorized'}</Text>
                        </View>
                    </View>
                    <View style={styles.stockBadge}>
                        <Text style={styles.stockText}>{item.stock || 0} left</Text>
                    </View>
                </View>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            {/* Header Gradient */}
            <LinearGradient
                colors={['#1e293b', '#1e293b']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={styles.headerGradient}
            >
                <SafeAreaView edges={['top']} style={styles.safeHeader}>
                    <View style={styles.headerContent}>
                        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                            <ArrowLeft size={24} color="#fff" />
                        </TouchableOpacity>
                        <View>
                            <Text style={styles.headerTitle}>Low Stock Alert</Text>
                            <Text style={styles.headerSubtitle}>{lowStockItems.length} Items need attention</Text>
                        </View>
                    </View>
                </SafeAreaView>
            </LinearGradient>

            {/* Product List */}
            <View style={styles.listWrapper}>
                <FlatList
                    data={lowStockItems}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={
                        loading ? (
                            <ActivityIndicator size="large" color="#2563eb" style={{ marginTop: 50 }} />
                        ) : (
                            <View style={styles.emptyState}>
                                <Package size={48} color="#cbd5e1" />
                                <Text style={styles.emptyText}>Inventory is healthy!</Text>
                                <Text style={styles.emptySub}>No items are running low on stock.</Text>
                            </View>
                        )
                    }
                />
            </View>
        </View>
    );
};

export default LowStockPage;

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    headerGradient: { paddingBottom: 24, paddingHorizontal: 20, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
    safeHeader: { paddingTop: 10 },
    headerContent: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 10 },
    backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 12 },
    headerTitle: { fontSize: 24, fontWeight: '800', color: '#fff' },
    headerSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: '500' },

    listWrapper: { flex: 1, paddingHorizontal: 20, marginTop: 20 },
    listContent: { paddingBottom: 50 },

    card: { backgroundColor: '#fff', borderRadius: 20, marginBottom: 16, padding: 16, borderLeftWidth: 4, borderLeftColor: '#dc2626', shadowColor: '#94a3b8', shadowOpacity: 0.1, shadowRadius: 10, elevation: 3 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    iconBox: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    name: { fontSize: 16, fontWeight: '700', color: '#1e293b' },
    category: { fontSize: 12, color: '#64748b', marginTop: 2 },

    stockBadge: { backgroundColor: '#fef2f2', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#fee2e2' },
    stockText: { fontSize: 13, fontWeight: '800', color: '#dc2626' },

    emptyState: { alignItems: 'center', marginTop: 60 },
    emptyText: { fontSize: 18, color: '#10b981', marginTop: 16, fontWeight: '700' },
    emptySub: { fontSize: 14, color: '#64748b', marginTop: 4 },
});
