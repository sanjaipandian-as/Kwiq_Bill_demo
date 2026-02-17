import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { User, Phone, Mail, MapPin, Search, UserPlus, CheckCircle2 } from 'lucide-react-native';
import { Input } from '../../../../components/ui/Input';
import { Button } from '../../../../components/ui/Button';
import { Card } from '../../../../components/ui/Card';

const CustomerStep = ({ customer, onSelect, onNext }) => {
    const [searchTerm, setSearchTerm] = useState('');

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <View style={styles.header}>
                <Text style={styles.title}>Select Customer</Text>
                <Text style={styles.subtitle}>Choose an existing customer or add a new one</Text>
            </View>

            <View style={styles.searchSection}>
                <View style={styles.searchBar}>
                    <Search size={20} color="#64748b" />
                    <Input
                        placeholder="Search by name or phone..."
                        value={searchTerm}
                        onChangeText={setSearchTerm}
                        style={styles.searchInput}
                    />
                </View>
                <Button variant="outline" style={styles.addBtn}>
                    <UserPlus size={20} color="#2563eb" style={{ marginRight: 8 }} />
                    <Text style={{ color: '#2563eb' }}>New</Text>
                </Button>
            </View>

            {customer ? (
                <Card style={styles.selectedCard}>
                    <View style={styles.selectedHeader}>
                        <View style={styles.avatar}>
                            <User size={24} color="#2563eb" />
                        </View>
                        <View style={styles.selectedInfo}>
                            <Text style={styles.selectedName}>{customer.name || customer.fullName}</Text>
                            <View style={styles.badge}>
                                <Text style={styles.badgeText}>Selected</Text>
                            </View>
                        </View>
                        <CheckCircle2 size={24} color="#16a34a" />
                    </View>

                    <View style={styles.detailsList}>
                        <View style={styles.detailItem}>
                            <Phone size={16} color="#64748b" />
                            <Text style={styles.detailText}>{customer.phone || 'No phone'}</Text>
                        </View>
                        {customer.email && (
                            <View style={styles.detailItem}>
                                <Mail size={16} color="#64748b" />
                                <Text style={styles.detailText}>{customer.email}</Text>
                            </View>
                        )}
                        {customer.address && (
                            <View style={styles.detailItem}>
                                <MapPin size={16} color="#64748b" />
                                <Text style={styles.detailText}>{customer.address}</Text>
                            </View>
                        )}
                    </View>

                    <Button onPress={onNext} style={styles.nextBtn}>
                        Continue with this Customer
                    </Button>
                </Card>
            ) : (
                <View style={styles.emptyState}>
                    <TouchableOpacity
                        style={[styles.walkInBtn, { borderColor: '#2563eb' }]}
                        onPress={() => onSelect('search')}
                    >
                        <UserPlus size={40} color="#2563eb" />
                        <Text style={[styles.walkInTitle, { color: '#2563eb' }]}>Add Customer</Text>
                        <Text style={styles.walkInSub}>A customer name and mobile number are required to proceed.</Text>
                    </TouchableOpacity>
                </View>
            )}
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    content: { padding: 16 },
    header: { marginBottom: 20 },
    title: { fontSize: 24, fontWeight: 'bold', color: '#0f172a' },
    subtitle: { fontSize: 14, color: '#64748b', marginTop: 4 },
    searchSection: { flexDirection: 'row', gap: 12, marginBottom: 20 },
    searchBar: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' },
    searchInput: { flex: 1, borderWidth: 0, height: 48 },
    addBtn: { height: 48, borderRadius: 12 },
    selectedCard: { padding: 20, borderColor: '#2563eb', borderWidth: 2, backgroundColor: '#fff' },
    selectedHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
    avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center' },
    selectedInfo: { flex: 1, marginLeft: 12 },
    selectedName: { fontSize: 18, fontWeight: 'bold', color: '#0f172a' },
    badge: { alignSelf: 'flex-start', backgroundColor: '#dcfce7', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12, marginTop: 4 },
    badgeText: { fontSize: 10, color: '#16a34a', fontWeight: 'bold' },
    detailsList: { gap: 12, marginBottom: 20 },
    detailItem: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    detailText: { fontSize: 14, color: '#475569' },
    nextBtn: { marginTop: 8 },
    emptyState: { alignItems: 'center', marginTop: 40 },
    walkInBtn: { width: '100%', padding: 32, alignItems: 'center', backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', borderStyle: 'dashed' },
    walkInTitle: { fontSize: 18, fontWeight: 'bold', color: '#0f172a', marginTop: 12 },
    walkInSub: { fontSize: 14, color: '#64748b', marginTop: 4 }
});

export default CustomerStep;
