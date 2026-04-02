import React from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, FlatList, Dimensions, Platform } from 'react-native';
import { User, X, CheckCircle2, Contact } from 'lucide-react-native';
import { useSettings } from '../../../context/SettingsContext';

const { width } = Dimensions.get('window');

const ReceptionistSelectionModal = ({ visible, onClose, onSelect, selectedId }) => {
    const { settings } = useSettings();
    const activeReceptionists = (settings?.receptionists || []).filter(r =>
        Number(r.is_active) === 1 || r.is_active === true
    );



    const [lockMode, setLockMode] = React.useState('none'); // 'none', 'shift', 'always'

    const handleSelect = (item) => {
        onSelect(item, lockMode !== 'none' ? lockMode : null);
    };

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
                        <>
                            <View style={styles.lockSelector}>
                                <Text style={styles.lockLabel}>SESSION TYPE</Text>
                                <View style={styles.lockOptions}>
                                    {[
                                        { id: 'none', label: 'ONCE', sub: 'Reset per bill' },
                                        { id: 'shift', label: 'SHIFT', sub: 'Lasts until midnight' },
                                        { id: 'weekly', label: 'WEEKLY', sub: 'Lasts 7 days' },
                                        { id: 'always', label: 'STATION', sub: 'Saved on device' }
                                    ].map(opt => (
                                        <TouchableOpacity
                                            key={opt.id}
                                            style={[styles.lockOpt, lockMode === opt.id && styles.lockOptActive]}
                                            onPress={() => setLockMode(opt.id)}
                                        >
                                            <Text style={[styles.lockOptLabel, lockMode === opt.id && styles.lockOptLabelActive]}>{opt.label}</Text>
                                            <Text style={[styles.lockOptSub, lockMode === opt.id && styles.lockOptSubActive]}>{opt.sub}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>

                            <FlatList
                                data={activeReceptionists}
                                keyExtractor={item => item.id}
                                renderItem={({ item }) => (
                                    <TouchableOpacity
                                        style={[
                                            styles.item,
                                            selectedId === item.id && styles.selectedItem
                                        ]}
                                        onPress={() => handleSelect(item)}
                                        activeOpacity={0.7}
                                    >
                                        <View style={[
                                            styles.avatar,
                                            selectedId === item.id && styles.selectedAvatar
                                        ]}>
                                            <User size={20} color={selectedId === item.id ? '#fff' : '#64748b'} />
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
                                )}
                                contentContainerStyle={styles.list}
                            />
                        </>
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
    },
    lockSelector: {
        padding: 20,
        backgroundColor: '#f8fafc',
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9'
    },
    lockLabel: {
        fontSize: 10,
        fontWeight: '900',
        color: '#94a3b8',
        letterSpacing: 1,
        marginBottom: 12
    },
    lockOptions: {
        flexDirection: 'row',
        gap: 8
    },
    lockOpt: {
        flex: 1,
        padding: 10,
        borderRadius: 12,
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        alignItems: 'center'
    },
    lockOptActive: {
        backgroundColor: '#000',
        borderColor: '#000'
    },
    lockOptLabel: {
        fontSize: 11,
        fontWeight: '800',
        color: '#475569'
    },
    lockOptLabelActive: {
        color: '#fff'
    },
    lockOptSub: {
        fontSize: 7,
        fontWeight: '600',
        color: '#94a3b8',
        marginTop: 2
    },
    lockOptSubActive: {
        color: 'rgba(255,255,255,0.6)'
    }
});

export default ReceptionistSelectionModal;
