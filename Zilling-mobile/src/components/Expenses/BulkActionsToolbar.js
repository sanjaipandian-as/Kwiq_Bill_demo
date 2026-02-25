import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Animated } from 'react-native';
import { Trash2, Download, X, Tag, RefreshCw } from 'lucide-react-native';

export const BulkActionsToolbar = ({
    selectedCount,
    onClearSelection,
    onCategoryChange,
    onMarkRecurring,
    onExportCSV,
    onDelete,
    categories = []
}) => {
    if (selectedCount === 0) return null;

    return (
        <Animated.View style={styles.container}>
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
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#fff',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingTop: 16,
        paddingBottom: 24,
        paddingHorizontal: 16,
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0',
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
        padding: 4,
    },
    countText: {
        color: '#0f172a',
        fontSize: 16,
        fontWeight: '700',
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
        backgroundColor: '#f1f5f9',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 12,
        gap: 8,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    deleteBtn: {
        backgroundColor: '#fef2f2',
        borderColor: '#fecaca',
    },
    actionText: {
        color: '#0f172a',
        fontSize: 14,
        fontWeight: '600',
    },
    divider: {
        width: 1,
        height: 24,
        backgroundColor: '#e2e8f0',
        marginHorizontal: 4,
    },
    label: {
        color: '#64748b',
        fontSize: 12,
        fontWeight: '600',
    },
    catBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#0f172a',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 12,
        gap: 6,
    },
    catText: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '600',
    },
});
