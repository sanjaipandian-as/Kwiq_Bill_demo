import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Animated } from 'react-native';
import { Trash2, Download, X, Tag, RefreshCw } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const BulkActionsToolbar = ({
    selectedCount,
    onClearSelection,
    onCategoryChange,
    onMarkRecurring,
    onExportCSV,
    onDelete,
    categories = []
}) => {
    const insets = useSafeAreaInsets();
    if (selectedCount === 0) return null;

    return (
        <Animated.View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 24) }]}>
            <View style={styles.header}>
                <View style={styles.selectionCount}>
                    <TouchableOpacity onPress={onClearSelection} style={styles.closeBtn}>
                        <X size={20} color="#0f172a" />
                    </TouchableOpacity>
                    <Text style={styles.countText}>{selectedCount} selected</Text>
                </View>
                <TouchableOpacity onPress={onExportCSV} style={styles.actionIcon}>
                    <Download size={22} color="#fff" />
                </TouchableOpacity>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.actionsList}>
                <TouchableOpacity onPress={onDelete} style={[styles.actionBtn, styles.deleteBtn]}>
                    <Trash2 size={18} color="#fff" />
                    <Text style={styles.actionText}>Delete</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={onMarkRecurring} style={styles.actionBtn}>
                    <RefreshCw size={18} color="#0f172a" />
                    <Text style={styles.actionText}>Recurring</Text>
                </TouchableOpacity>

                <View style={styles.divider} />

                <Text style={styles.label}>Set Category:</Text>
                {categories.slice(0, 5).map(cat => (
                    <TouchableOpacity
                        key={cat}
                        onPress={() => onCategoryChange(cat)}
                        style={styles.catBtn}
                    >
                        <Tag size={14} color="#fff" />
                        <Text style={styles.catText}>{cat}</Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 30,
        left: 20,
        right: 20,
        backgroundColor: '#000',
        borderRadius: 24,
        paddingTop: 16,
        paddingBottom: 24,
        paddingHorizontal: 20,
        elevation: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    selectionCount: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    closeBtn: {
        width: 32,
        height: 32,
        borderRadius: 10,
        backgroundColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    countText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '900',
        letterSpacing: -0.5,
    },
    actionIcon: {
        padding: 8,
    },
    actionsList: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    actionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.1)',
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 14,
        gap: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    deleteBtn: {
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderColor: 'rgba(255,255,255,0.1)',
    },
    actionText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '700',
    },
    divider: {
        width: 1,
        height: 24,
        backgroundColor: 'rgba(255,255,255,0.1)',
        marginHorizontal: 4,
    },
    label: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 1,
        textTransform: 'uppercase',
    },
    catBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 14,
        gap: 8,
    },
    catText: {
        color: '#000',
        fontSize: 13,
        fontWeight: '900',
    },
});
