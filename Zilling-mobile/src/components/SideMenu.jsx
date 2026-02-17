import React, { useEffect, useRef } from 'react';
import {
    View, Text, StyleSheet, Animated, Dimensions, Pressable,
    TouchableWithoutFeedback, Platform, StatusBar, ScrollView, TouchableOpacity, Image
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ScanBarcode, Receipt, FileText, PieChart, X, Users, LogOut, ChevronRight, Package, Settings, Trash2 } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';

const { width, height } = Dimensions.get('window');
const MENU_WIDTH = width * 0.82;

const MENU_ITEMS = [
    { id: 'Invoices', label: 'History & Invoices', icon: FileText, color: '#000' },
    { id: 'Expenses', label: 'Expense Tracker', icon: Receipt, color: '#ef4444' },
    { id: 'Reports', label: 'Business Reports', icon: PieChart, color: '#2563eb' },
    { id: 'GST', label: 'GST Filing & Stats', icon: PieChart, color: '#d97706' },
    { id: 'RecycleBin', label: 'Recycle Bin', icon: Trash2, color: '#64748b' },
];

const SideMenu = ({ isOpen, onClose }) => {
    const navigation = useNavigation();
    const { logout, user } = useAuth();
    const { settings } = useSettings();
    const storeLogo = settings?.store?.logo;
    const slideAnim = useRef(new Animated.Value(-MENU_WIDTH)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(slideAnim, {
                toValue: isOpen ? 0 : -MENU_WIDTH,
                duration: 300,
                useNativeDriver: true,
            }),
            Animated.timing(opacityAnim, {
                toValue: isOpen ? 1 : 0,
                duration: 300,
                useNativeDriver: true,
            }),
        ]).start();
    }, [isOpen]);

    if (!isOpen && slideAnim._value === -MENU_WIDTH) return null;

    return (
        <View style={styles.fullScreen} pointerEvents={isOpen ? 'auto' : 'none'}>
            <TouchableWithoutFeedback onPress={onClose}>
                <Animated.View style={[styles.overlay, { opacity: opacityAnim }]} />
            </TouchableWithoutFeedback>

            <Animated.View style={[styles.drawer, { transform: [{ translateX: slideAnim }] }]}>
                {/* Header Section */}
                <View style={styles.drawerHeader}>
                    <View style={styles.userSection}>
                        <View style={styles.avatarLarge}>
                            {storeLogo ? (
                                <Image source={{ uri: storeLogo }} style={styles.avatarImage} resizeMode="contain" />
                            ) : (
                                <Text style={styles.avatarText}>{settings?.store?.name?.charAt(0) || user?.name?.charAt(0) || 'K'}</Text>
                            )}
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.userName} numberOfLines={1}>{user?.name || 'Administrator'}</Text>
                        </View>
                    </View>
                    <Pressable onPress={onClose} style={styles.closeIcon}>
                        <X size={22} color="#000" />
                    </Pressable>
                </View>

                {/* Main Navigation */}
                <ScrollView
                    style={styles.menuList}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 20 }}
                >
                    <Text style={styles.sectionLabel}>Financials</Text>
                    {MENU_ITEMS.map((item) => (
                        <TouchableOpacity
                            key={item.id}
                            activeOpacity={0.7}
                            onPress={() => { onClose(); navigation.navigate(item.id); }}
                            style={styles.menuItem}
                        >
                            <View style={[styles.iconBox, { borderColor: item.color === '#000' ? '#e2e8f0' : item.color }]}>
                                <item.icon size={18} color={item.color} strokeWidth={2.5} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.menuItemLabel}>{item.label}</Text>
                            </View>
                            <ChevronRight size={14} color="#cbd5e1" strokeWidth={3} />
                        </TouchableOpacity>
                    ))}

                    <View style={styles.divider} />

                    <Text style={styles.sectionLabel}>System</Text>
                    <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => { onClose(); navigation.navigate('Settings'); }}
                        style={styles.menuItem}
                    >
                        <View style={[styles.iconBox, { borderColor: '#e2e8f0' }]}>
                            <Settings size={18} color="#000" strokeWidth={2.5} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.menuItemLabel}>Settings</Text>
                        </View>
                        <ChevronRight size={14} color="#cbd5e1" strokeWidth={3} />
                    </TouchableOpacity>
                </ScrollView>

                {/* Footer Section */}
                <View style={styles.drawerFooter}>
                    <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => { onClose(); logout(); }}
                        style={styles.logoutBtn}
                    >
                        <Text style={styles.logoutText}>SIGN OUT ACCOUNT</Text>
                        <LogOut size={20} color="#ef4444" strokeWidth={2.5} />
                    </TouchableOpacity>
                    <View style={styles.versionContainer}>
                        <Text style={styles.versionHeader}>KWIQ BILLING MOBILE</Text>
                        <Text style={styles.versionSub}>V1.0.8 • PRODUCTION READY</Text>
                    </View>
                </View>
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    fullScreen: { ...StyleSheet.absoluteFillObject, zIndex: 9999 },
    overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0, 0, 0, 0.5)' },
    drawer: {
        position: 'absolute',
        left: 0, top: 0, bottom: 0,
        width: MENU_WIDTH,
        backgroundColor: '#ffffff',
        borderTopRightRadius: 30,
        borderBottomRightRadius: 30,
        paddingTop: Platform.OS === 'ios' ? 60 : (StatusBar.currentHeight || 24) + 20,
        shadowColor: '#000',
        shadowOffset: { width: 10, height: 0 },
        shadowOpacity: 0.1,
        shadowRadius: 30,
        elevation: 25,
        display: 'flex',       // Ensure flex behavior
        flexDirection: 'column' // Stack children vertically
    },
    drawerHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 24,
        marginBottom: 35,
        flexShrink: 0 // Don't shrink header
    },
    userSection: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 15,
        flex: 1
    },
    avatarLarge: {
        width: 54,
        height: 54,
        borderRadius: 18,
        backgroundColor: '#000',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden'
    },
    avatarImage: { width: '100%', height: '100%', backgroundColor: '#fff' },
    avatarText: { color: '#fff', fontSize: 22, fontWeight: '900' },
    userName: { fontSize: 18, fontWeight: '900', color: '#000', letterSpacing: -0.5 },
    closeIcon: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#f1f5f9'
    },

    menuList: {
        flex: 1,
        paddingHorizontal: 16
    },
    sectionLabel: {
        fontSize: 10,
        fontWeight: '900',
        color: '#cbd5e1',
        textTransform: 'uppercase',
        letterSpacing: 2,
        marginLeft: 15,
        marginBottom: 15,
        marginTop: 10
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 12,
        borderRadius: 20,
        gap: 16,
        marginBottom: 5
    },
    iconBox: {
        width: 46,
        height: 46,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#f1f5f9',
        backgroundColor: '#fff'
    },
    menuItemLabel: { fontSize: 16, fontWeight: '700', color: '#1e293b' },

    divider: { height: 1.5, backgroundColor: '#f8fafc', marginVertical: 20, marginHorizontal: 15 },

    drawerFooter: {
        padding: 24,
        paddingBottom: Platform.OS === 'ios' ? 40 : 30,
        flexShrink: 0, // Don't shrink footer
        borderTopWidth: 1,
        borderTopColor: '#f8fafc',
        backgroundColor: '#fff' // Ensure background
    },
    logoutBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#fff',
        paddingVertical: 18,
        paddingHorizontal: 24,
        borderRadius: 24,
        borderWidth: 1.5,
        borderColor: '#fee2e2', // Darker border for visibility
        marginBottom: 15,
        shadowColor: '#fee2e2',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 4
    },
    logoutText: { fontSize: 15, fontWeight: '900', color: '#ef4444', letterSpacing: 0.8 },
    versionContainer: { alignItems: 'center', gap: 4 },
    versionHeader: { fontSize: 10, color: '#94a3b8', fontWeight: '900', letterSpacing: 1.5 }, // Visible color
    versionSub: { fontSize: 8, color: '#cbd5e1', fontWeight: '800' } // Visible color
});

export default SideMenu;