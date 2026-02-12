import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import {
    Tag,
    Trash2,
    PlusCircle,
    Award,
    FileText,
    Percent
} from 'lucide-react-native';

const BottomFunctionBar = ({ onFunctionClick, variant = 'fixed' }) => {
    const functions = [
        { key: 'F4', label: 'Remove', icon: Trash2, color: '#ef4444', bg: '#fff1f2' },
        { key: 'F8', label: 'Charges', icon: PlusCircle, color: '#8b5cf6', bg: '#f5f3ff' },
        { key: 'F9', label: 'Bill Disc', icon: Tag, color: '#f59e0b', bg: '#fffbeb' },
        { key: 'F10', label: 'Loyalty', icon: Award, color: '#10b981', bg: '#ecfdf5' },
        { key: 'F12', label: 'Remarks', icon: FileText, color: '#64748b', bg: '#f8fafc' },
    ];

    return (
        <View style={[styles.container, variant === 'inline' && styles.inlineContainer]}>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={[styles.scroll, variant === 'inline' && styles.inlineScroll]}
            >
                {functions.map((fn) => (
                    <TouchableOpacity
                        key={fn.key}
                        style={[
                            styles.proBtn,
                            { backgroundColor: fn.bg },
                            variant === 'inline' && styles.proBtnInline
                        ]}
                        onPress={() => onFunctionClick(fn.key)}
                        activeOpacity={0.7}
                    >
                        <View style={[styles.iconWrapper, variant === 'inline' && styles.iconWrapperInline]}>
                            <fn.icon size={variant === 'inline' ? 14 : 18} color={fn.color} />
                        </View>
                        <View style={styles.labelWrapper}>
                            <Text style={[styles.btnText, { color: '#1e293b' }, variant === 'inline' && styles.btnTextInline]}>{fn.label}</Text>
                            {variant !== 'inline' && <Text style={styles.keyText}>{fn.key}</Text>}
                        </View>
                    </TouchableOpacity>
                ))}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
        paddingVertical: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 10
    },
    inlineContainer: {
        backgroundColor: 'transparent',
        borderTopWidth: 0,
        paddingVertical: 0,
        marginBottom: 8,
        shadowOpacity: 0,
        elevation: 0,
    },
    scroll: {
        paddingHorizontal: 16,
        gap: 12
    },
    inlineScroll: {
        paddingHorizontal: 0,
    },
    proBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#fff',
        minWidth: 120,
        gap: 10,
    },
    proBtnInline: {
        minWidth: 90,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 12,
        gap: 8,
    },
    iconWrapper: {
        width: 32,
        height: 32,
        borderRadius: 10,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 1,
    },
    iconWrapperInline: {
        width: 24,
        height: 24,
        borderRadius: 8,
    },
    labelWrapper: {
        justifyContent: 'center',
    },
    btnText: {
        fontSize: 12,
        fontWeight: '800',
        letterSpacing: -0.2
    },
    btnTextInline: {
        fontSize: 11,
    },
    keyText: {
        fontSize: 9,
        fontWeight: '700',
        color: '#94a3b8',
        marginTop: -1,
    }
});

export default BottomFunctionBar;
