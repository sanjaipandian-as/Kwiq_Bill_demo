import React, { useEffect, useRef, useState } from 'react';
import {
    View, Text, StyleSheet, Animated, Dimensions, Pressable,
    TouchableWithoutFeedback, Platform, StatusBar, ScrollView, TouchableOpacity, Image, Modal
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
    FileText, PieChart, X, Users, LogOut, ChevronRight, Package, Settings,
    Trash2, CreditCard, Receipt, ShieldCheck, HelpCircle, ExternalLink, Sparkles
} from 'lucide-react-native';
import { debouncedNavigate } from '../utils/navigationUtils';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { APP_VERSION } from '../config/version';

const { width } = Dimensions.get('window');

// 🚀 REFINED WIDTH: Standard boutique ratio (approx 72%)
const MENU_WIDTH = width * 0.72;

const MENU_GROUPS = [
    {
        title: 'Transactions',
        items: [
            { id: 'Invoices', label: 'All Invoices', icon: FileText },
            { id: 'Billing', label: 'Create New Bill', icon: CreditCard },
        ]
    },
    {
        title: 'Analysis & Compliance',
        items: [
            { id: 'Reports', label: 'Business Reports', icon: PieChart },
            { id: 'Expenses', label: 'Expense Tracker', icon: Receipt },
            { id: 'GST', label: 'GST Analytics', icon: ShieldCheck },
            { id: 'RecycleBin', label: 'Recycle Bin', icon: Trash2 },
        ]
    },
    {
        title: 'Management',
        items: [
            { id: 'Products', label: 'Inventory / Stock', icon: Package },
            { id: 'Customers', label: 'Customer Directory', icon: Users },
        ]
    }
];

const SideMenu = ({ isOpen, onClose }) => {
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();
    const { logout, user } = useAuth();
    const { settings } = useSettings();
    const storeLogo = settings?.store?.logo;

    const [shouldRender, setShouldRender] = useState(isOpen);
    const slideAnim = useRef(new Animated.Value(-MENU_WIDTH)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (isOpen) {
            setShouldRender(true);
            Animated.parallel([
                Animated.timing(slideAnim, {
                    toValue: 0,
                    duration: 350,
                    useNativeDriver: true,
                }),
                Animated.timing(opacityAnim, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: true,
                }),
            ]).start();
        } else {
            Animated.parallel([
                Animated.timing(slideAnim, {
                    toValue: -MENU_WIDTH,
                    duration: 300,
                    useNativeDriver: true,
                }),
                Animated.timing(opacityAnim, {
                    toValue: 0,
                    duration: 250,
                    useNativeDriver: true,
                }),
            ]).start(() => {
                setShouldRender(false);
            });
        }
    }, [isOpen]);

    const handleNavigation = (screen, params = {}) => {
        onClose();
        debouncedNavigate(navigation, screen, params);
    };

    return (
        <Modal
            visible={shouldRender}
            transparent
            animationType="none"
            onRequestClose={onClose}
        >
            <View style={styles.fullScreen}>
                <TouchableWithoutFeedback onPress={onClose}>
                    <Animated.View style={[styles.overlay, { opacity: opacityAnim }]} />
                </TouchableWithoutFeedback>

                <Animated.View style={[styles.drawer, {
                    transform: [{ translateX: slideAnim }],
                    width: MENU_WIDTH,
                }]}>
                    {/* Header */}
                    <View style={[styles.drawerHeader, { paddingTop: Math.max(insets.top, 24) + 20 }]}>
                        <View style={styles.userInfoWrapper}>
                            <View style={styles.avatarContainer}>
                                {storeLogo ? (
                                    <Image source={{ uri: storeLogo }} style={styles.avatarImage} />
                                ) : (
                                    <View style={styles.avatarPlaceholder}>
                                        <View style={styles.iconCircle}>
                                            <Users size={24} color="#000" />
                                        </View>
                                    </View>
                                )}
                            </View>

                            <View style={styles.headerTextGroup}>
                                <Text style={styles.userName} numberOfLines={1}>
                                    {settings?.store?.name || user?.name || 'Administrator'}
                                </Text>
                                <View style={styles.statusRow}>
                                    <Text style={styles.statusText}>PRO ENTERPRISE</Text>
                                </View>
                            </View>
                        </View>

                        <TouchableOpacity
                            onPress={onClose}
                            activeOpacity={0.7}
                            style={styles.closeBtn}
                        >
                            <View style={styles.closeIconWrapper}>
                                <X size={20} color="#000" strokeWidth={3} />
                            </View>
                        </TouchableOpacity>
                    </View>

                    {/* Navigation Items */}
                    <ScrollView
                        style={styles.menuScroll}
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={{ paddingBottom: 40 }}
                    >
                        {MENU_GROUPS.map((group, gIdx) => (
                            <View key={gIdx} style={styles.groupContainer}>
                                <Text style={styles.groupTitle}>{group.title}</Text>
                                {group.items.map((item) => (
                                    <TouchableOpacity
                                        key={item.id}
                                        activeOpacity={0.7}
                                        onPress={() => handleNavigation(item.id)}
                                        style={styles.menuItem}
                                    >
                                        <View style={styles.iconBox}>
                                            <item.icon size={20} color="#fff" strokeWidth={2} />
                                        </View>
                                        <Text style={styles.menuItemLabel}>{item.label}</Text>
                                        <ChevronRight size={14} color="#475569" strokeWidth={2.5} />
                                    </TouchableOpacity>
                                ))}
                            </View>
                        ))}

                        <View style={styles.groupContainer}>
                            <Text style={styles.groupTitle}>Settings</Text>
                            <TouchableOpacity
                                activeOpacity={0.7}
                                onPress={() => handleNavigation('Settings')}
                                style={styles.menuItem}
                            >
                                <View style={styles.iconBox}>
                                    <Settings size={20} color="#fff" strokeWidth={2} />
                                </View>
                                <Text style={styles.menuItemLabel}>Configuration</Text>
                                <ChevronRight size={14} color="#475569" strokeWidth={2.5} />
                            </TouchableOpacity>

                            <TouchableOpacity
                                activeOpacity={0.7}
                                onPress={() => handleNavigation('Settings', { tab: 'contact' })}
                                style={styles.menuItem}
                            >
                                <View style={styles.iconBox}>
                                    <HelpCircle size={20} color="#fff" strokeWidth={2} />
                                </View>
                                <Text style={styles.menuItemLabel}>Help & Support</Text>
                                <ExternalLink size={12} color="#475569" />
                            </TouchableOpacity>
                        </View>
                    </ScrollView>

                    {/* Footer - With Safe Area Support */}
                    <View style={[styles.drawerFooter, { paddingBottom: Math.max(insets.bottom, 20) + 10 }]}>
                        <TouchableOpacity
                            activeOpacity={0.9}
                            onPress={() => { onClose(); logout(); }}
                            style={styles.logoutBtn}
                        >
                            <Text style={styles.logoutText}>SIGN OUT</Text>
                            <LogOut size={18} color="#000" strokeWidth={2.5} />
                        </TouchableOpacity>
                        <View style={styles.versionContainer}>
                            <Text style={styles.versionText}>KWIQ BILL {APP_VERSION}</Text>
                        </View>
                    </View>
                </Animated.View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    fullScreen: {
        flex: 1,
        backgroundColor: 'transparent'
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.6)'
    },
    drawer: {
        position: 'absolute',
        left: 0, top: 0, bottom: 0,
        backgroundColor: '#000000',
        borderTopRightRadius: 36,
        borderBottomRightRadius: 36,
        overflow: 'hidden',
    },
    drawerHeader: {
        paddingBottom: 30,
        paddingHorizontal: 24,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#111',
    },
    userInfoWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        flex: 1,
    },
    avatarContainer: {
        position: 'relative',
    },
    avatarImage: {
        width: 46,
        height: 44,
        borderRadius: 14,
        backgroundColor: '#fff',
    },
    avatarPlaceholder: {
        width: 50,
        height: 50,
        borderRadius: 14,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#f1f5f9',
        alignItems: 'center',
        justifyContent: 'center'
    },
    headerTextGroup: {
        flex: 1,
    },
    userName: {
        fontSize: 18,
        fontWeight: '900',
        color: '#fff',
        letterSpacing: -0.4,
        marginBottom: 2,
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 2,
    },
    statusText: {
        fontSize: 10,
        fontWeight: '900',
        color: '#ffffffff',
        letterSpacing: 1.5,
        textTransform: 'uppercase',
    },
    closeBtn: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 3,
    },
    closeIconWrapper: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    menuScroll: {
        flex: 1,
    },
    groupContainer: {
        paddingTop: 24,
        paddingHorizontal: 16,
    },
    groupTitle: {
        fontSize: 10,
        fontWeight: '900',
        color: '#475569',
        textTransform: 'uppercase',
        letterSpacing: 2,
        marginLeft: 12,
        marginBottom: 16,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 12,
        borderRadius: 16,
        gap: 16,
        marginBottom: 6,
    },
    iconBox: {
        width: 40,
        height: 40,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#111',
    },
    menuItemLabel: {
        flex: 1,
        fontSize: 15,
        fontWeight: '700',
        color: '#cbd5e1',
    },
    drawerFooter: {
        padding: 24,
        backgroundColor: '#000',
    },
    logoutBtn: {
        backgroundColor: '#fff',
        borderRadius: 20,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 18,
        paddingHorizontal: 26,
    },
    logoutText: {
        fontSize: 14,
        fontWeight: '900',
        color: '#000',
        letterSpacing: 1.5,
    },
    versionContainer: {
        marginTop: 16,
        alignItems: 'center',
        opacity: 0.5,
    },
    versionText: {
        fontSize: 10,
        fontWeight: '800',
        color: '#fff',
        letterSpacing: 2,
    }
});

export default SideMenu;
