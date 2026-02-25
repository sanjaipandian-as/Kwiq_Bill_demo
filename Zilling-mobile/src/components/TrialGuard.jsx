import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Linking, TouchableOpacity, SafeAreaView, Dimensions, Animated } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

const TrialGuard = ({ children }) => {
    const { user, logout } = useAuth();
    const [trialInfo, setTrialInfo] = useState({ expired: false, daysRemaining: null });
    const pulseAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        if (!user) {
            setTrialInfo({ expired: false, daysRemaining: null });
            return;
        }

        if (user.trialExpiresAt) {
            const expirationDate = new Date(user.trialExpiresAt);
            const today = new Date();
            const timeDiff = expirationDate.getTime() - today.getTime();
            const daysRemaining = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

            setTrialInfo({
                expired: today > expirationDate,
                daysRemaining: Math.max(0, daysRemaining),
            });
        }
    }, [user]);

    // Pulse animation for the icon
    useEffect(() => {
        if (trialInfo.expired) {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, {
                        toValue: 1.1,
                        duration: 1000,
                        useNativeDriver: true,
                    }),
                    Animated.timing(pulseAnim, {
                        toValue: 1,
                        duration: 1000,
                        useNativeDriver: true,
                    }),
                ])
            ).start();
        }
    }, [trialInfo.expired]);

    if (trialInfo.expired) {
        return (
            <View style={styles.container}>
                <LinearGradient
                    colors={['#ffffff', '#f8f9ff']}
                    style={styles.gradient}
                >
                    <SafeAreaView style={styles.safeArea}>
                        <View style={styles.content}>
                            <View style={styles.iconContainer}>
                                <Animated.View style={[styles.iconBackground, { transform: [{ scale: pulseAnim }] }]}>
                                    <Ionicons name="time" size={60} color="#FF6B6B" />
                                </Animated.View>
                                <View style={styles.pulseRing} />
                            </View>

                            <View style={styles.textContainer}>
                                <Text style={styles.title}>Your Free Trial Has Ended</Text>
                                <Text style={styles.subtitle}>
                                    Your 30-day trial period of Kwiq Bill has successfully completed.
                                </Text>
                                <Text style={styles.description}>
                                    To continue accessing your dashboard, managing inventory, and generating professional invoices, please upgrade to our premium plan.
                                </Text>
                            </View>

                            <View style={styles.buttonContainer}>
                                <TouchableOpacity
                                    style={styles.paymentButton}
                                    onPress={() => Linking.openURL('https://kwiqbill.com/pricing')}
                                    activeOpacity={0.8}
                                >
                                    <LinearGradient
                                        colors={['#4A90E2', '#357ABD']}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 0 }}
                                        style={styles.buttonGradient}
                                    >
                                        <Text style={styles.paymentButtonText}>Unlock Premium Access</Text>
                                        <Ionicons name="arrow-forward" size={20} color="#fff" style={styles.buttonIcon} />
                                    </LinearGradient>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.contactButton}
                                    onPress={() => Linking.openURL('mailto:support@kwiqbill.com')}
                                >
                                    <Text style={styles.contactButtonText}>Contact Kwiq Bill Team</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.logoutButton}
                                    onPress={logout}
                                >
                                    <Ionicons name="log-out-outline" size={20} color="#FF6B6B" />
                                    <Text style={styles.logoutButtonText}>Logout from Account</Text>
                                </TouchableOpacity>
                            </View>

                            <View style={styles.footer}>
                                <Text style={styles.footerText}>Need more time? Reach out to us.</Text>
                            </View>
                        </View>
                    </SafeAreaView>
                </LinearGradient>
            </View>
        );
    }

    // Show trial days remaining banner when less than 7 days remain
    if (trialInfo.daysRemaining !== null && trialInfo.daysRemaining <= 7 && trialInfo.daysRemaining > 0) {
        return (
            <View style={{ flex: 1 }}>
                <View style={styles.trialBanner}>
                    <LinearGradient
                        colors={trialInfo.daysRemaining <= 3 ? ['#FF6B6B', '#FF4757'] : ['#FFA502', '#FF6348']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.bannerGradient}
                    >
                        <Ionicons
                            name={trialInfo.daysRemaining <= 3 ? "warning" : "time-outline"}
                            size={16}
                            color="#fff"
                        />
                        <Text style={styles.bannerText}>
                            {trialInfo.daysRemaining === 1
                                ? 'Last day of your free trial!'
                                : `${trialInfo.daysRemaining} days left in your free trial`}
                        </Text>
                        <TouchableOpacity
                            onPress={() => Linking.openURL('https://kwiqbill.com/pricing')}
                            style={styles.bannerUpgradeBtn}
                        >
                            <Text style={styles.bannerUpgradeText}>Upgrade</Text>
                        </TouchableOpacity>
                    </LinearGradient>
                </View>
                {children}
            </View>
        );
    }

    return children;
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    gradient: {
        flex: 1,
    },
    safeArea: {
        flex: 1,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 32,
    },
    iconContainer: {
        marginBottom: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconBackground: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#FF6B6B',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
        elevation: 10,
        zIndex: 2,
    },
    pulseRing: {
        position: 'absolute',
        width: 140,
        height: 140,
        borderRadius: 70,
        borderWidth: 1,
        borderColor: 'rgba(255, 107, 107, 0.3)',
    },
    textContainer: {
        alignItems: 'center',
        marginBottom: 48,
    },
    title: {
        fontSize: 28,
        fontWeight: '800',
        color: '#1A1A1A',
        marginBottom: 16,
        textAlign: 'center',
        letterSpacing: -0.5,
    },
    subtitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#4A4A4A',
        textAlign: 'center',
        marginBottom: 12,
        lineHeight: 26,
    },
    description: {
        fontSize: 15,
        color: '#757575',
        textAlign: 'center',
        lineHeight: 22,
        paddingHorizontal: 10,
    },
    buttonContainer: {
        width: '100%',
        gap: 16,
    },
    paymentButton: {
        width: '100%',
        height: 60,
        borderRadius: 16,
        overflow: 'hidden',
        shadowColor: '#4A90E2',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 15,
        elevation: 8,
    },
    buttonGradient: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 20,
    },
    paymentButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
    },
    buttonIcon: {
        marginLeft: 10,
    },
    contactButton: {
        height: 56,
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 16,
        borderWidth: 1.5,
        borderColor: '#E0E0E0',
        backgroundColor: '#fff',
    },
    contactButtonText: {
        color: '#4A90E2',
        fontSize: 16,
        fontWeight: '600',
    },
    footer: {
        marginTop: 40,
    },
    footerText: {
        color: '#9E9E9E',
        fontSize: 14,
    },
    logoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 10,
        paddingVertical: 10,
    },
    logoutButtonText: {
        color: '#FF6B6B',
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 8,
    },
    // Trial warning banner styles
    trialBanner: {
        overflow: 'hidden',
    },
    bannerGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        paddingHorizontal: 16,
        gap: 8,
    },
    bannerText: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '600',
        flex: 1,
    },
    bannerUpgradeBtn: {
        backgroundColor: 'rgba(255,255,255,0.25)',
        paddingHorizontal: 14,
        paddingVertical: 5,
        borderRadius: 12,
    },
    bannerUpgradeText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '700',
    },
});

export default TrialGuard;
