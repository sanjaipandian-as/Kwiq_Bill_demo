import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Dimensions, Animated, Platform } from 'react-native';
import { Megaphone, X, Bell, Info, AlertTriangle, ChevronRight, Volume2, ShieldAlert, Wrench } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { services } from '../services/api';
import { useAuth } from '../context/AuthContext';

const { width } = Dimensions.get('window');

const BroadcastOverlay = () => {
    const { user } = useAuth();
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

            if (latest) {
                const seenId = await AsyncStorage.getItem(`seen_broadcast_${latest._id}`);
                
                if (!seenId) {
                    setBroadcast(latest);
                    setVisible(true);
                    
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
        if (broadcast) {
            await AsyncStorage.setItem(`seen_broadcast_${broadcast._id}`, 'true');
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
                <LinearGradient
                    colors={theme.colors}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.card}
                >
                    {/* Header Pill */}
                    <View style={styles.header}>
                        <View style={[styles.typePill, { backgroundColor: theme.accent }]}>
                            <Icon size={12} color={theme.text} />
                            <Text style={[styles.typeLabel, { color: theme.text }]}>{theme.label}</Text>
                        </View>
                        <Pressable onPress={handleDismiss} style={styles.closeBtn}>
                            <X size={18} color={theme.text} />
                        </Pressable>
                    </View>

                    {/* Content Body */}
                    <View style={styles.content}>
                        <View style={styles.mainInfo}>
                            <Text style={[styles.title, { color: theme.text }]}>{broadcast.title}</Text>
                            <Text style={[styles.message, { color: theme.text }]} numberOfLines={3}>
                                {broadcast.message}
                            </Text>
                        </View>
                    </View>

                    {/* Premium Action Button */}
                    <Pressable 
                        onPress={handleDismiss} 
                        style={({ pressed }) => [
                            styles.actionBtn,
                            { backgroundColor: theme.accent, opacity: pressed ? 0.8 : 1 }
                        ]}
                    >
                        <Text style={[styles.actionText, { color: theme.text }]}>ACKNOWLEDGE & DISMISS</Text>
                        <ChevronRight size={14} color={theme.text} strokeWidth={3} />
                    </Pressable>
                </LinearGradient>
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
        paddingTop: Platform.OS === 'ios' ? 40 : 10,
        alignItems: 'center',
    },
    wrapper: {
        width: width * 0.92,
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
    card: {
        borderRadius: 28,
        padding: 20,
        paddingTop: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        overflow: 'hidden',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    typePill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 100,
    },
    typeLabel: {
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 1,
    },
    closeBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    content: {
        marginBottom: 20,
    },
    title: {
        fontSize: 18,
        fontWeight: '900',
        marginBottom: 8,
        lineHeight: 22,
    },
    message: {
        fontSize: 14,
        lineHeight: 20,
        fontWeight: '500',
        opacity: 0.9,
    },
    actionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 18,
        gap: 8,
    },
    actionText: {
        fontSize: 12,
        fontWeight: '900',
        letterSpacing: 1,
    }
});

export default BroadcastOverlay;
