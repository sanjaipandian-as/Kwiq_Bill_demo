import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Dimensions, Animated, Platform, ScrollView } from 'react-native';
import { Megaphone, X, Bell, Info, AlertTriangle, ChevronRight, Volume2, ShieldAlert, Wrench, Clock } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { services } from '../services/api';
import { useAuth } from '../context/AuthContext';

const { width } = Dimensions.get('window');

const BroadcastOverlay = () => {
    const auth = useAuth();
    const user = auth ? auth.user : null;
    const [broadcast, setBroadcast] = useState(null);
    const [visible, setVisible] = useState(false);
    
    // Animation refs
    const slideAnim = useRef(new Animated.Value(-150)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(0.9)).current;

    useEffect(() => {
        if (user) {
            checkBroadcast();
        }
    }, [user]);

    const checkBroadcast = async () => {
        try {
            const res = await services.broadcasts.getLatest();
            const latest = res.data;

            if (latest && latest._id) {
                // Use user-specific key so it persists correctly per account on the device
                const userKey = user?.email ? user.email.replace(/[@.]/g, '_') : 'guest';
                const storageKey = `seen_broadcast_${userKey}_${latest._id}`;
                
                const seenStatus = await AsyncStorage.getItem(storageKey);
                
                if (!seenStatus) {
                    setBroadcast(latest);
                    setVisible(true);
                    
                    // PRO-LEVEL: Mark as seen immediately if it's just an announcement
                    // This satisfies the "once they saw it, don't show again" request strictly
                    if (latest.type === 'announcement') {
                        await AsyncStorage.setItem(storageKey, 'true');
                    }

                    // Sequence Animation
                    Animated.parallel([
                        Animated.spring(slideAnim, {
                            toValue: 15,
                            useNativeDriver: true,
                            friction: 8,
                            tension: 40
                        }),
                        Animated.timing(opacityAnim, {
                            toValue: 1,
                            duration: 400,
                            useNativeDriver: true
                        }),
                        Animated.spring(scaleAnim, {
                            toValue: 1,
                            useNativeDriver: true,
                            friction: 8
                        })
                    ]).start();
                }
            }
        } catch (error) {
            console.log('[Broadcast] No new updates found');
        }
    };

    const handleDismiss = async () => {
        if (broadcast && broadcast._id) {
            const userKey = user?.email ? user.email.replace(/[@.]/g, '_') : 'guest';
            const storageKey = `seen_broadcast_${userKey}_${broadcast._id}`;
            await AsyncStorage.setItem(storageKey, 'true');
        }
        
        Animated.parallel([
            Animated.timing(slideAnim, {
                toValue: -200,
                duration: 300,
                useNativeDriver: true
            }),
            Animated.timing(opacityAnim, {
                toValue: 0,
                duration: 250,
                useNativeDriver: true
            })
        ]).start(() => setVisible(false));
    };

    if (!visible || !broadcast) return null;

    const getTheme = () => {
        switch (broadcast.type) {
            case 'maintenance': return { 
                colors: ['#F59E0B', '#D97706'], 
                text: '#FFFFFF', 
                icon: Wrench, 
                label: 'MAINTENANCE',
                accent: 'rgba(255,255,255,0.2)'
            };
            case 'critical': return { 
                colors: ['#EF4444', '#B91C1C'], 
                text: '#FFFFFF', 
                icon: ShieldAlert, 
                label: 'CRITICAL ALERT',
                accent: 'rgba(255,255,255,0.2)'
            };
            default: return { 
                colors: ['#FFFFFF', '#F8FAFC'], 
                text: '#1E293B', 
                icon: Megaphone, 
                label: 'ANNOUNCEMENT',
                accent: '#F1F5F9'
            };
        }
    };

    const theme = getTheme();
    const Icon = theme.icon;

    const calcLifespan = () => {
        if (!broadcast.startTime || !broadcast.expiryTime) return null;
        const s = new Date(broadcast.startTime);
        const e = new Date(broadcast.expiryTime);
        if (isNaN(s.getTime()) || isNaN(e.getTime())) return null;
        if (e <= s) return null;
        const diff = e - s;
        const totalMinutes = Math.floor(diff / (1000 * 60));
        const hours = Math.floor(totalMinutes / 60);
        const days = Math.floor(hours / 24);
        const remHours = hours % 24;
        const remMinutes = totalMinutes % 60;
        
        if (days > 0) return `${days}d ${remHours}h`;
        if (hours > 0) return `${hours}h ${remMinutes}m`;
        return `${remMinutes}m`;
    };

    const duration = calcLifespan();

    return (
        <View style={styles.container} pointerEvents="box-none">
            <Animated.View style={[
                styles.wrapper,
                { 
                    opacity: opacityAnim,
                    transform: [
                        { translateY: slideAnim },
                        { scale: scaleAnim }
                    ]
                }
            ]}>
                {/* 1. Priority Tab */}
                <View style={styles.tabContainer}>
                    <View style={[styles.priorityTab, { borderColor: theme.colors[0], backgroundColor: '#fff' }]}>
                        <Text style={[styles.priorityText, { color: theme.colors[0] }]}>
                            {String(broadcast.priority || 'NORMAL').toUpperCase()} PRIORITY
                        </Text>
                    </View>
                </View>

                {/* 2. Main Alert Card */}
                <View style={[styles.proCard, { borderColor: theme.colors[0] }]}>
                    <View style={styles.cardHeader}>
                        <Text style={styles.brandedHeader}>KWIQ BILL</Text>
                    </View>
                    <View style={[styles.separator, { backgroundColor: theme.colors[0] }]} />
                    
                    <ScrollView style={styles.cardBody} bounces={false}>
                        <View style={styles.contentSection}>
                            <Text style={styles.metaLabel}>SIGNAL TITLE :</Text>
                            <Text style={styles.mainTitle}>{broadcast.title}</Text>
                        </View>

                        <View style={styles.contentSection}>
                            <Text style={styles.metaLabel}>MESSAGE CONTENT :</Text>
                            <Text style={styles.mainMessage}>{broadcast.message}</Text>
                        </View>

                        {/* Temporal Footer */}
                        <View style={styles.temporalFooter}>
                            <View style={styles.tRow}>
                                <Clock size={10} color="#94a3b8" />
                                <Text style={styles.tText}>EMISSION: {new Date(broadcast.startTime || broadcast.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</Text>
                            </View>
                            <View style={styles.tRow}>
                                <ChevronRight size={10} color="#94a3b8" />
                                <Text style={styles.tText}>EXPIRY: {broadcast.expiryTime ? new Date(broadcast.expiryTime).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'PERPETUAL'}</Text>
                            </View>
                            
                            {duration && (
                                <View style={styles.durationPill}>
                                    <Text style={styles.durationText}>TOTAL DURATION: {duration}</Text>
                                </View>
                            )}
                        </View>
                    </ScrollView>

                    <Pressable 
                        onPress={handleDismiss}
                        style={({ pressed }) => [
                            styles.dismissBtn,
                            { backgroundColor: theme.colors[0], opacity: pressed ? 0.9 : 1 }
                        ]}
                    >
                        <Text style={styles.dismissText}>ACKNOWLEDGE SIGNAL</Text>
                    </Pressable>
                </View>
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        paddingTop: Platform.OS === 'ios' ? 60 : 20,
        alignItems: 'center',
    },
    wrapper: {
        width: width * 0.9,
    },
    tabContainer: {
        width: '100%',
        alignItems: 'center',
        zIndex: 10,
        marginBottom: -1,
    },
    priorityTab: {
        paddingHorizontal: 20,
        paddingVertical: 6,
        borderWidth: 1.5,
        borderBottomWidth: 0,
        borderTopLeftRadius: 14,
        borderTopRightRadius: 14,
        minWidth: 160,
        alignItems: 'center',
    },
    priorityText: {
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 1.5,
    },
    proCard: {
        backgroundColor: '#fff',
        borderRadius: 24,
        borderWidth: 1.5,
        overflow: 'hidden',
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 12 },
                shadowOpacity: 0.2,
                shadowRadius: 16,
            },
            android: {
                elevation: 15,
            },
        }),
    },
    cardHeader: {
        paddingVertical: 12,
        alignItems: 'center',
    },
    brandedHeader: {
        fontSize: 14,
        fontWeight: '900',
        letterSpacing: 4,
        color: '#000',
        marginLeft: 4,
    },
    separator: {
        height: 1.5,
        width: '100%',
    },
    cardBody: {
        maxHeight: 400,
        padding: 20,
    },
    contentSection: {
        marginBottom: 16,
    },
    metaLabel: {
        fontSize: 9,
        fontWeight: '900',
        color: '#94a3b8',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 4,
    },
    mainTitle: {
        fontSize: 18,
        fontWeight: '950',
        color: '#000',
        lineHeight: 22,
    },
    mainMessage: {
        fontSize: 13,
        fontWeight: '600',
        color: '#475569',
        lineHeight: 18,
    },
    temporalFooter: {
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
        paddingTop: 12,
        marginTop: 4,
    },
    tRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 4,
    },
    tText: {
        fontSize: 9,
        fontWeight: '800',
        color: '#94a3b8',
        letterSpacing: 0.3,
    },
    durationPill: {
        alignSelf: 'flex-start',
        backgroundColor: '#f1f5f9',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 8,
        marginTop: 8,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    durationText: {
        fontSize: 9,
        fontWeight: '900',
        color: '#0f172a',
        letterSpacing: 0.5,
    },
    dismissBtn: {
        paddingVertical: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    dismissText: {
        fontSize: 12,
        fontWeight: '900',
        color: '#fff',
        letterSpacing: 2,
    }
});

export default BroadcastOverlay;
