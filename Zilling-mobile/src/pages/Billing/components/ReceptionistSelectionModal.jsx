import React from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, FlatList, Dimensions, Platform } from 'react-native';
import { Contact, X, CheckCircle2 } from 'lucide-react-native';
import { useSettings } from '../../../context/SettingsContext';

const { width } = Dimensions.get('window');

const ReceptionistSelectionModal = ({ visible, onClose, onSelect, selectedId }) => {
    const { settings } = useSettings();
    const activeReceptionists = (settings?.receptionists || []).filter(r => r.is_active === 1);

    const renderItem = ({ item }) => (
        <TouchableOpacity
            style={[
                styles.item,
                selectedId === item.id && styles.selectedItem
            ]}
            onPress={() => onSelect(item)}
            activeOpacity={0.7}
        >
            <View style={[
                styles.avatar,
                selectedId === item.id && styles.selectedAvatar
            ]}>
                <Contact size={20} color={selectedId === item.id ? '#fff' : '#64748b'} />
            </View>
            <View style={{ flex: 1 }}>
                <Text style={[
                    styles.name,
                    selectedId === item.id && styles.selectedName
                ]}>{item.name}</Text>
                <Text style={styles.id}>ID: {item.id}</Text>
            </View>
            {selectedId === item.id && (
                <CheckCircle2 size={20} color="#000" />
            )}
        </TouchableOpacity>
    );

    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={styles.content}>
                    <View style={styles.header}>
                        <View>
                            <Text style={styles.title}>Select Receptionist</Text>
                            <Text style={styles.subtitle}>Who is issuing this bill?</Text>
                        </View>
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                            <X size={20} color="#000" />
                        </TouchableOpacity>
                    </View>

                    {activeReceptionists.length === 0 ? (
                        <View style={styles.emptyContainer}>
                            <Contact size={48} color="#e2e8f0" strokeWidth={1} style={{ marginBottom: 16 }} />
                            <Text style={styles.emptyTitle}>No Active Staff Found</Text>
                            <Text style={styles.emptyText}>
                                Please add receptionists in Settings {'>'} Users section first.
                            </Text>
                        </View>
                    ) : (
                        <FlatList
                            data={activeReceptionists}
                            keyExtractor={item => item.id}
                            renderItem={renderItem}
                            contentContainerStyle={styles.list}
                        />
                    )}
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20
    },
    content: {
        width: Platform.OS === 'web' ? 400 : width * 0.9,
        maxHeight: '70%',
        backgroundColor: '#fff',
        borderRadius: 28,
        overflow: 'hidden',
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 24,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9'
    },
    title: {
        fontSize: 18,
        fontWeight: '900',
        color: '#000',
        letterSpacing: -0.5
    },
    subtitle: {
        fontSize: 12,
        color: '#64748b',
        fontWeight: '600'
    },
    closeBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#f1f5f9',
        justifyContent: 'center',
        alignItems: 'center'
    },
    list: {
        padding: 12
    },
    item: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 16,
        marginBottom: 8,
        backgroundColor: '#fff',
        borderWidth: 1.5,
        borderColor: '#f1f5f9'
    },
    selectedItem: {
        borderColor: '#000',
        backgroundColor: '#f8fafc'
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: '#f1f5f9',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16
    },
    selectedAvatar: {
        backgroundColor: '#000'
    },
    name: {
        fontSize: 15,
        fontWeight: '700',
        color: '#0f172a'
    },
    selectedName: {
        color: '#000'
    },
    id: {
        fontSize: 11,
        color: '#94a3b8',
        fontWeight: '600',
        marginTop: 2
    },
    emptyContainer: {
        padding: 48,
        alignItems: 'center',
        justifyContent: 'center'
    },
    emptyTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: '#0f172a',
        marginBottom: 8
    },
    emptyText: {
        fontSize: 13,
        color: '#64748b',
        textAlign: 'center',
        lineHeight: 18
    }
});

export default ReceptionistSelectionModal;
