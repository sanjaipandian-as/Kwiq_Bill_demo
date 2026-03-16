import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Linking, TouchableOpacity, SafeAreaView, Dimensions, Animated, Modal, Image, ScrollView, DeviceEventEmitter } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useAuth } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

const TrialGuard = ({ children }) => {
    const { user, logout, refreshUser } = useAuth();
    const [rechecking, setRechecking] = useState(false);
    const [status, setStatus] = useState({
        blocked: false,
        expired: false,
        warning: false,
        daysRemaining: null,
        type: 'trial' // 'trial' or 'plan'
    });
    const [showPlans, setShowPlans] = useState(false);
    const pulseAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        if (!user) {
            setStatus({ blocked: false, expired: false, warning: false, daysRemaining: null, type: 'trial' });
            return;
        }

        const now = new Date();
        let expiryDate = user.plan === 'free' ? new Date(user.trialExpiresAt) : new Date(user.planExpiresAt);

        if (!expiryDate || isNaN(expiryDate.getTime())) {
            expiryDate = new Date();
            expiryDate.setDate(expiryDate.getDate() + 30);
        }

        const timeDiff = expiryDate.getTime() - now.getTime();
        const daysRemaining = Math.max(0, Math.ceil(timeDiff / (1000 * 60 * 60 * 24)));

        setStatus({
            blocked: !!user.isBlocked,
            expired: now > expiryDate,
            warning: daysRemaining <= 7 && daysRemaining > 0,
            daysRemaining,
            type: user.plan === 'free' ? 'trial' : 'plan'
        });

        const sub = DeviceEventEmitter.addListener('TRIAL_EXPIRED_EVENT', () => {
             setStatus(prev => ({ ...prev, expired: true }));
        });

        return () => {
             if (sub) sub.remove();
        };
    }, [user]);

    const handleManualRefresh = async () => {
        setRechecking(true);
        try {
            await refreshUser();
        } finally {
            setTimeout(() => setRechecking(false), 1000);
        }
    };

    useEffect(() => {
        if (status.expired || status.blocked) {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, { toValue: 1.05, duration: 1500, useNativeDriver: true }),
                    Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
                ])
            ).start();
        }
    }, [status.expired, status.blocked]);

    if (status.blocked) {
        return (
            <View style={styles.container}>
                <LinearGradient colors={['#ffffff', '#fff1f1']} style={styles.gradient}>
                    <SafeAreaView style={styles.safeArea}>
                        <View style={styles.content}>
                            <View style={styles.iconContainer}>
                                <Animated.View style={[styles.iconBackground, { transform: [{ scale: pulseAnim }] }]}>
                                    <Ionicons name="shield-outline" size={60} color="#FF4444" />
                                </Animated.View>
                            </View>

                            <View style={styles.textContainer}>
                                <Text style={[styles.title, { color: '#FF4444' }]}>Account Blocked</Text>
                                <Text style={styles.description}>
                                    Your account access has been restricted. Please contact support to resolve this issue.
                                </Text>
                            </View>

                            <View style={styles.buttonContainer}>
                                <TouchableOpacity style={styles.mainUpgradeBtn} onPress={() => Linking.openURL('https://wa.me/917558175156')}>
                                    <Text style={styles.mainUpgradeBtnText}>Contact Support</Text>
                                </TouchableOpacity>

                                <TouchableOpacity style={styles.secondarySyncBtn} onPress={handleManualRefresh} disabled={rechecking}>
                                    <Text style={styles.secondarySyncText}>{rechecking ? 'Checking...' : 'Refresh Status'}</Text>
                                </TouchableOpacity>

                                <TouchableOpacity style={styles.logoutButton} onPress={logout}>
                                    <Text style={styles.logoutButtonText}>Logout</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </SafeAreaView>
                </LinearGradient>
            </View>
        );
    }

    if (status.expired) {
        return (
            <View style={styles.container}>
                <LinearGradient colors={['#FDFDFD', '#F4F7FA', '#E9EEF5']} style={styles.gradient}>
                    <SafeAreaView style={styles.safeArea} edges={['top']}>
                        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                            {/* Curved Header Section like Dashboard */}
                            <LinearGradient
                                colors={['#000000', '#1a1a1a']}
                                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                                style={styles.headerCurve}
                            >
                                <View style={styles.topNav}>
                                    <View style={styles.brandGroup}>
                                        <View style={styles.brandBox}>
                                            <Svg width={38} height={38} viewBox="40 25 170 90">
                                                <Path d="m199.7 31.42h-40.34l-47.32 43.39v-43.39h-29.28v23.27c0 3.1-1.86 4.29-4.15 4.29h-24.18v81.01c23.85-7.16 45.36-16.68 63.87-29.77l30.5 31.59h44.88l-47.93-51.91 53.95-58.48z" fill="#000" />
                                                <Path d="m54.71 53.9 21.58-22.48h0.42v22.48h-22z" fill="#000" />
                                                <Path d="m65.81 74.97h28.47v5.65h-28.47v-5.65z" fill="#FEFFFE" />
                                                <Path d="m65.81 87.63h22.66v4.7h-22.66v-4.7z" fill="#FEFFFE" />
                                                <Path d="m54.46 127.2c34.55-15.5 62.45-35.2 101.6-69.29l-5.6-4.16 24.48-9.22-10.5 24.7-3.63-6.82c-26.79 26.89-60.01 55.42-112.6 81.33l6.18-3.02v-13.52z" fill="#FEFFFE" />
                                            </Svg>
                                        </View>
                                        <View>
                                            <Text style={styles.brandText}>KWIQ BILL</Text>
                                            <Text style={styles.brandTagline}>ENTERPRISE GRADE</Text>
                                        </View>
                                    </View>
                                </View>

                                <View style={styles.illustrationHero}>
                                    <Svg width={width * 0.8} height={200} viewBox="0 0 250 250" fill="none">
                                        <Path d="m52.9 74.19v-37.76c0-4.64 3.6-7.41 6.71-7.43h129.6c4.61 0 7.21 3.84 7.21 7.71v3.25l3.36 0.17c0.89 0.05 1.61 0.66 1.61 1.55l-0.28 37.25c0 0.68-0.45 1.1-1.18 1.36l-3.51 1.13v3.72c2.92 0.77 5.61 2.84 8.59 6.37l18.86 20.97c6.99 6.9 9.29 9.83 9.46 18.28s0 36.98 1.03 49.9c0.6 7.81 3.78 13.1 7.59 23.81" stroke="#fff" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" />
                                        <Path d="m47.51 79.61-37.25 1.47c-2.64 0-3.14 2.68-3.14 4.33 0 2.35 1.2 3.76 3.84 3.76h1.65l-0.19 4.87c0 13.17 4.87 23.82 19.9 35.02 6.39 4.77 7.72 7.41 6.34 13.96-1.74 4.36-4.75 5.59-10.35 10.9-10.18 9.17-15.89 18.84-15.89 31.76v5.54" stroke="#fff" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" />
                                        <Path d="m12.42 89.17h35.09" stroke="#fff" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" />
                                        <Path d="m21.16 109.1c1.03 4.87 6.88 11.05 14.75 16.9 6.87 5.15 8.87 7.98 9.55 12.95 1.04-6.85 3.46-9.04 7.44-11.64v1.74c-2.19 1.7-3.98 4.34-3.98 9.9 0 4.87 5.03 8.65 8.8 11.69 10.89 8.45 18.25 18.27 18.25 33.46v6.5" stroke="#fff" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" />
                                        <Path d="m21.16 109.1c2.64-0.82 8.91-0.82 14.47 0.82l11.88 4.05" stroke="#fff" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" />
                                        <Path d="m59.32 136.3h107.7" stroke="#fff" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" />
                                        <Path d="m196.5 116 1.44 2.42" stroke="#fff" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" />
                                        <Path d="m196.5 120.7c2.45-2.65 5.2-3.5 10.81-5" stroke="#fff" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" />
                                        <Path d="m197.8 138.2c4.74-4.44 8.27-8.29 15.02-9.93" stroke="#fff" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" />
                                        <Path d="m142.7 136.9-2.34 12.31c-0.31 1.54 2.77 2.89 5.75 2.89 5.97 0 11.53-5.01 13.77-15.2" stroke="#fff" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" />
                                        <Path d="m147.1 137.4c-0.4 7.48-2.01 11.86-5.4 12.35" stroke="#fff" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" />
                                        <Path d="m167.5 137.6c-0.89 2.14-2.24 3.52-3.42 4.5-0.6 0.51-0.38 1.22-0.02 2.55 1.29 4.69 1.72 10.27-2.6 18.02-2.48 2.91-5.2 3.25-6.84 2.91-1.14-0.26-1.39-0.94-1.83-2.53l-2.64-9.97" stroke="#fff" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" />
                                        <Path d="m154.5 151.1c2.81 1.25 4.46 5.57 3.17 9.97" stroke="#fff" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" />
                                        <Path d="m165.8 160.4c1.57 4.4 1.41 10.28 2.81 17.98 2.29 10.5 7.39 20 16.67 26.5 4.62 3.37 6.67 8.8 8.64 15.09" stroke="#fff" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" />
                                        <Path d="m196.5 133.4c-1.12 0.98-2.41 0-3.86-2.64-6.6-10.33-15.5-27.42-23.99-31.88s-14.56 1.22-15.54 7.07c-1.64 10.17 6.84 21.91 13.9 29.66 4.73 4.65 9.13 13 9.13 18.85-0.89 11.33-1.7 24.39 18.2 42.65" stroke="#fff" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" />
                                        <Path d="m167.8 102c-2.8-3.25-6.9-2.31-9.47 0-3.16 2.84-2.93 7.24 2.28 13.99 0.55 0.7 1.19 0.67 2.07 0.16l8.72-5.85c0.65-0.45 0.3-1.55-0.3-2.63-0.93-1.69-1.82-3.96-3.3-5.67z" stroke="#fff" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" />
                                        <Path d="m170.6 126.2c3.19-2.27 5.07-3.87 8.37-5.28" stroke="#fff" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" />
                                        <Path d="m174.6 129.6c2.52-1.34 4.29-2.61 6.32-4.26" stroke="#fff" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" />
                                        <Path d="m10.72 191.5h68.13c2.94 0 3.56 2.18 3.56 4.1 0 2.51-1.25 4.01-3.73 4.01h-67.96c-2.81 0-3.72-1.89-3.72-4.3 0-2.07 0.91-3.81 3.72-3.81z" stroke="#fff" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" />
                                        <Path d="m17.58 190.1c3.58-5.85 8.48-9.91 13.64-14.01 7.49-6.02 10.59-7.63 12.4-7.63 2.49 0 4.67 2.28 10.1 6.53 6.05 4.71 12.36 9.04 16.34 14.77" stroke="#fff" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" />
                                        <Path d="m45.46 143.8v20.33" stroke="#fff" strokeDasharray="1 6" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" />
                                        <Path d="m201.2 41.11-152.5 37.5v39l152.5-38.28v-38.22z" fill="#fff" stroke="#fff" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" />
                                        <Path d="m48.63 77.11 1.29-2.2" stroke="#fff" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" />
                                        <Path d="m201.2 40.94-152.5 37.67v2.57l152.5-38.56v-1.68z" fill="#FEFFFE" stroke="#fff" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" />
                                        <Path d="m200 80.13-150.9 36.59v1.69l1.02-0.03" stroke="#fff" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" />
                                        <Path d="m204.4 145.1c1.3 1.05 3.02 2.07 4.39 2.07" stroke="#fff" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" />
                                        <Path d="m66.29 46.06c-2.13-0.55-4.59-0.84-4.59-3.15 0-1.77 1.57-2.9 3.55-2.9 2.13 0 3.36 1.07 3.36 2.75h-1.88c-0.12-0.87-0.72-1.2-1.54-1.2-0.93 0-1.48 0.48-1.48 1.2 0 0.93 1.25 1.1 2.5 1.45 1.47 0.45 2.72 1.05 2.72 2.63 0 1.77-1.38 2.65-3.32 2.65-2.19 0-3.57-1.13-3.57-2.93h1.84c0.11 1.07 0.78 1.51 1.84 1.51 0.94 0 1.54-0.44 1.54-1.23 0-0.48-0.37-0.63-0.97-0.78z" fill="#fff" />
                                        <Path d="m70.01 40.23h1.8v5.96c0 1.19 0.6 1.73 1.7 1.73s1.7-0.54 1.7-1.73v-5.96h1.8v5.96c0 2.08-1.38 3.22-3.5 3.22s-3.5-1.14-3.5-3.22v-5.96z" fill="#fff" />
                                        <Path d="m78.07 40.23h2.86c2.12 0 3.31 0.68 3.31 2.28 0 0.85-0.45 1.5-1.33 1.9 0.98 0.3 1.53 0.95 1.53 1.95 0 1.55-1.19 2.43-3.43 2.43h-2.94v-8.56zm1.74 1.43v2.15h1.07c1.14 0 1.59-0.45 1.59-1.15s-0.45-1-1.66-1h-1zm0 3.45v2.32h1.2c1.2 0 1.65-0.42 1.65-1.22 0-0.72-0.45-1.1-1.73-1.1h-1.12z" fill="#fff" />
                                        <Path d="m89.07 46.06c-2.13-0.55-3.76-0.84-3.76-3.15 0-1.77 1.3-2.9 3.28-2.9 1.9 0 3.02 1.07 3.02 2.75h-1.75c-0.12-0.87-0.62-1.2-1.44-1.2-0.86 0-1.46 0.48-1.46 1.2 0 0.93 1.06 1.1 2.31 1.45 1.47 0.45 2.59 1.05 2.59 2.63 0 1.77-1.27 2.65-3.14 2.65-2.05 0-3.31-1.13-3.31-2.93h1.7c0.1 1.07 0.7 1.51 1.68 1.51 0.87 0 1.42-0.44 1.42-1.23 0-0.48-0.5-0.63-1.14-0.78z" fill="#fff" />
                                        <Path d="m99.53 46.11c-0.2 2.01-1.4 3.3-3.42 3.3-2.5 0-3.8-1.93-3.8-4.55 0-2.7 1.45-4.75 3.85-4.75 1.95 0 3.17 1.25 3.37 3.15h-1.8c-0.22-1.05-0.82-1.65-1.77-1.65-1.55 0-2.1 1.65-2.1 3.2 0 1.7 0.65 3.1 2.15 3.1 1.05 0 1.6-0.75 1.77-1.8h1.75z" fill="#fff" />
                                        <Path d="m101.9 48.79h-1.7v-8.56h3.3c2.05 0 3.3 0.88 3.3 2.73 0 1.2-0.65 2.1-1.6 2.6l2.12 3.23h-2.12l-1.8-2.88h-1.5v2.88zm1.35-4.23c1.25 0 1.8-0.6 1.8-1.6s-0.6-1.35-1.8-1.35h-1.4v2.95h1.4z" fill="#fff" />
                                        <Path d="m108 40.23h1.7v8.56h-1.7v-8.56z" fill="#fff" />
                                        <Path d="m112.7 48.79h-1.7v-8.56h3.15c2.12 0 3.37 1.03 3.37 2.88s-1.32 2.95-3.45 2.95h-1.37v2.73zm1.25-4.08c1.3 0 1.9-0.65 1.9-1.65s-0.65-1.5-1.9-1.5h-1.3v3.15h1.3z" fill="#fff" />
                                        <Path d="m121 41.71h-2.7v-1.48h7.2v1.48h-2.7v7.08h-1.8v-7.08z" fill="#fff" />
                                        <Path d="m126.7 40.23h1.75v8.56h-1.75v-8.56z" fill="#fff" />
                                        <Path d="m133.3 49.01c-2.55 0-3.85-2-3.85-4.45s1.3-4.5 3.85-4.5 3.85 2 3.85 4.45-1.3 4.5-3.85 4.5zm0-7.5c-1.55 0-2.2 1.5-2.2 3.05s0.65 3.05 2.2 3.05 2.2-1.5 2.2-3.05-0.65-3.05-2.2-3.05z" fill="#fff" />
                                        <Path d="m138.3 40.23h1.95l3.55 6.03v-6.03h1.75v8.56h-1.95l-3.55-6.03v6.03h-1.75v-8.56z" fill="#fff" />
                                        <Path d="m62.61 52.19h2c1.7 0 2.65 0.72 2.65 2.12s-1.05 2.23-2.75 2.23h-1.05v2.25h-0.9v-6.6h0.05zm1.9 3.6c1.2 0 1.85-0.58 1.85-1.53 0-1-0.7-1.45-1.9-1.45h-1v2.95h1.05v0.03z" fill="#fff" />
                                        <Path d="m68.11 51.54h0.8v7.25h-0.8v-7.25z" fill="#fff" />
                                        <Path d="m72.81 56.11v-0.5c0-0.6-0.35-1-1.1-1-0.6 0-1 0.3-1.15 0.8h-0.75c0.15-0.95 0.95-1.5 1.95-1.5 1.2 0 1.85 0.65 1.85 1.75v3.13h-0.75v-0.75c-0.3 0.55-0.85 0.87-1.6 0.87-0.95 0-1.5-0.55-1.5-1.4 0-0.95 0.8-1.35 1.9-1.35h1.15v-0.05zm0 0.65h-1.2c-0.75 0-1.1 0.25-1.1 0.8 0 0.45 0.3 0.75 0.95 0.75 0.9 0 1.35-0.6 1.35-1.45v-0.1z" fill="#fff" />
                                        <Path d="m74.81 54.01h0.75v0.8c0.3-0.55 0.8-0.92 1.55-0.92 1.15 0 1.75 0.75 1.75 2v2.87h-0.8v-2.75c0-0.85-0.4-1.4-1.2-1.4-0.85 0-1.3 0.65-1.3 1.55v2.6h-0.8v-4.75h0.05z" fill="#fff" />
                                        <Path d="m82.81 52.19h3.85v0.7h-3.05v2.25h2.6v0.7h-2.6v2.3h3.15v0.7h-4v-6.65h0.05z" fill="#fff" />
                                        <Path d="m87.76 54.01h0.75v0.8c0.3-0.55 0.8-0.92 1.55-0.92 1.15 0 1.75 0.75 1.75 2v2.87h-0.8v-2.75c0-0.85-0.4-1.4-1.2-1.4-0.85 0-1.3 0.65-1.3 1.55v2.6h-0.8v-4.75h0.05z" fill="#fff" />
                                        <Path d="m96.31 57.26c-0.2 0.95-0.95 1.6-2.05 1.6-1.5 0-2.25-1.15-2.25-2.5 0-1.4 0.8-2.55 2.15-2.55 1.4 0 2.15 1.05 2.15 2.3v0.35h-3.5c0.05 1 0.6 1.75 1.5 1.75 0.7 0 1.15-0.4 1.3-1h0.7v0.05zm-3.45-1.35h2.7c-0.1-0.9-0.6-1.45-1.4-1.45-0.8 0.05-1.2 0.65-1.3 1.45z" fill="#fff" />
                                        <Path d="m100.8 58.79h-0.75v-0.9c-0.35 0.65-0.9 1.02-1.65 1.02-1.3 0-2.05-1.15-2.05-2.5s0.8-2.52 2.1-2.52c0.75 0 1.3 0.45 1.55 1.05v-3.4h0.8v7.25zm-0.85-2.48c0-1.05-0.6-1.75-1.5-1.75-1 0-1.5 0.8-1.5 1.8s0.5 1.8 1.5 1.8c0.95 0.05 1.5-0.8 1.5-1.85z" fill="#fff" />
                                        <Path d="m68.31 112.4h52.75c5.77 0 7.25 4.73 7.25 7v0.5c0 5.08-4 8-7.6 8h-52.4c-4.65 0-6.7-4.5-6.7-7.75v-1c0-3.75 2.7-6.75 6.7-6.75z" fill="#FEFFFE" stroke="#fff" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.2" />
                                        <Path d="m70.01 117.1h1.8c1.45 0 2.35 0.6 2.35 1.85 0 0.75-0.45 1.35-1.1 1.7l1.4 2.2h-1.35l-1.15-2h-0.9v2h-1.05v-5.75zm1.6 0.95h-0.6v1.9h0.65c0.85 0 1.3-0.4 1.3-1s-0.45-0.9-1.35-0.9z" fill="#fff" />
                                        <Path d="m75.41 117.1h3.6v0.95h-2.5v1.4h2.1v0.9h-2.1v1.5h2.6v0.95h-3.7v-5.7z" fill="#fff" />
                                        <Path d="m80.01 117.1h1.25l2.35 4v-4h1.1v5.75h-1.25l-2.35-4v4h-1.1v-5.75z" fill="#fff" />
                                        <Path d="m86.21 117.1h3.6v0.95h-2.5v1.4h2.1v0.9h-2.1v1.5h2.6v0.95h-3.7v-5.7z" fill="#fff" />
                                        <Path d="m90.31 117.1h1.15l0.95 4.3 1.05-4.3h1.15l1.05 4.3 0.95-4.3h1.15l-1.45 5.75h-1.25l-1.1-4.25-1.1 4.25h-1.25l-1.3-5.75z" fill="#fff" />
                                        <Path d="m102.1 117.1h1.25l2.35 4v-4h1.1v5.75h-1.25l-2.35-4v4h-1.1v-5.75z" fill="#fff" />
                                        <Path d="m110.2 123c-1.8 0-2.75-1.45-2.75-3.05s0.95-3 2.75-3 2.75 1.45 2.75 3.05-0.95 3-2.75 3zm0-5.1c-1.15 0-1.65 1.05-1.65 2.1s0.5 2.1 1.65 2.1 1.65-1.05 1.65-2.1-0.5-2.1-1.65-2.1z" fill="#fff" />
                                        <Path d="m113.1 117.1h1.15l0.95 4.3 1.05-4.3h1.15l1.05 4.3 0.95-4.3h1.15l-1.45 5.75h-1.25l-1.1-4.25-1.1 4.25h-1.25l-1.3-5.75z" fill="#fff" />
                                        <Path d="m114.1 146.6h0.55c11.05 0 19 11.1 19 21.05 0 10.5-9.7 19.3-19.65 19.3h-0.25c-10.5 0-19.85-9.4-19.85-18.7v-1.15c0-11 8.85-20.5 20.2-20.5z" fill="#FEFFFE" stroke="#fff" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" />
                                        <Path d="m114 152.6v1.4" stroke="#fff" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                                        <Path d="m124.1 157-0.9 1.2" stroke="#fff" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.2" />
                                        <Path d="m128.8 167.7h-1.4" stroke="#fff" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
                                        <Path d="m124.4 178.2-1.1-1.1" stroke="#fff" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.2" />
                                        <Path d="m114 182.2v0.75-0.75z" stroke="#fff" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                                        <Path d="m103.5 177.8 0.4-0.4" stroke="#fff" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
                                        <Path d="m99.11 167.7h0.75" stroke="#fff" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
                                        <Path d="m103.5 157.1-0.4-0.4" stroke="#fff" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
                                        <Path d="m113.8 156.6v11.05l5.8 5.15" stroke="#fff" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                                        <Path d="m68.06 82.61 13.65-3.2 0.8 3.5-9.1 2.3 1.3 5.5 8.3-2.15 0.8 3.5-8.3 2.15 1.45 5.95 9.1-2.55 0.85 3.5-14.3 3.8-4.55-22.3z" fill="#FEFFFE" />
                                        <Path d="m91.31 86.56-7.7-8.25 5.4-1.45 5.5 6.65 2-8.5 5.05-1.4-3.35 12.05 7.6 8.95-5.1 1.5-5.3-7-2.65 8.8-5.05 1.4 3.6-12.75z" fill="#FEFFFE" />
                                        <Path d="m103.3 73.61 7.75-2c5.7-1.5 8.5 1.3 8.95 5.4 0.55 4.45-2.8 7.3-6.9 8.4l-3.05 0.85 1.35 7.45-4.8 1.3-3.3-21.4zm8.2 8.55c2.8-0.8 4.1-2.4 3.75-4.75-0.35-2.1-1.85-2.85-4.65-2.1l-2.6 0.75 1.1 6.75 2.4-0.65z" fill="#FEFFFE" />
                                        <Path d="m121.7 68.61 4.5-1.2 3.95 21.3-4.5 1.2-3.95-21.3z" fill="#FEFFFE" />
                                        <Path d="m130 66.31 7.6-2c5.4-1.45 8.3 0.55 8.9 4.5 0.4 2.45-0.6 4.55-2.35 6.15l5.75 7.2-5 1.45-4.8-6.45-4 1.15 1.4 7.25-4.6 1.3-2.9-20.55zm7.65 8c2.45-0.75 3.75-2.3 3.4-4.4-0.35-2-1.75-2.6-4.35-1.85l-2.4 0.7 1.1 6.15 2.25-0.6z" fill="#FEFFFE" />
                                        <Path d="m146.9 62.31 14.2-4 1 3.5-9.7 2.9 1.3 5.35 8.6-2.65 1 3.35-8.8 2.75 1.5 5.65 9.7-3.05 1 3.35-14.5 4.45-5.3-21.6z" fill="#FEFFFE" />
                                        <Path d="m163.9 57.76 7.15-1.9c7.15-2 10.65 1.75 11.55 8.15 1 6.85-1.9 11.9-8.9 13.7l-5.7 1.5-4.1-21.45zm8.9 16.05c4.6-1.3 5.9-4.7 4.9-9.1-1-4.25-3-5.95-7.3-4.75l-1.8 0.5 2.8 13.85 1.4-0.5z" fill="#FEFFFE" />
                                    </Svg>
                                </View>
                            </LinearGradient>

                            <View style={styles.mainContentBody}>
                                <View style={styles.heroSection}>
                                    <Text style={styles.heroTitle}>Upgrade to continue{'\n'}your business growth</Text>
                                    <Text style={styles.heroSub}>Your professional workspace is temporarily paused. Reactivate to resume billing and inventory management.</Text>
                                </View>

                                <View style={styles.benefitsSection}>
                                    <Text style={styles.benefitsTitle}>ENTERPRISE CAPABILITIES</Text>
                                    {[
                                        { icon: 'print-outline', title: 'High-Fidelity Thermal Engine', desc: 'Professional GST/VAT templates with Hindi/Tamil support.' },
                                        { icon: 'stats-chart-outline', title: 'Profit Intelligence', desc: 'Real-time P&L insights and inventory age analytics.' },
                                        { icon: 'cloud-done-outline', title: 'Military-Grade Sync', desc: 'Automated off-site backups with zero-latency recovery.' },
                                        { icon: 'people-outline', title: 'Multi-User Workspace', desc: 'Advanced staff permissions and activity monitoring.' },
                                    ].map((item, i) => (
                                        <View key={i} style={styles.benefitRow}>
                                            <View style={styles.benefitIconBox}>
                                                <Ionicons name={item.icon} size={20} color="#000" />
                                            </View>
                                            <View style={styles.benefitText}>
                                                <Text style={styles.benefitLabel}>{item.title}</Text>
                                                <Text style={styles.benefitSub}>{item.desc}</Text>
                                            </View>
                                        </View>
                                    ))}
                                </View>

                                <View style={styles.ctaGroup}>
                                    <TouchableOpacity style={styles.mainUpgradeBtn} onPress={() => setShowPlans(true)} activeOpacity={0.8}>
                                        <Text style={styles.mainUpgradeBtnText}>VIEW PROFESSIONAL TIERS</Text>
                                        <Ionicons name="chevron-forward" size={18} color="#fff" />
                                    </TouchableOpacity>

                                    <TouchableOpacity style={styles.secondarySyncBtn} onPress={handleManualRefresh} disabled={rechecking}>
                                        <Ionicons name="refresh-circle-outline" size={20} color="#64748b" />
                                        <Text style={styles.secondarySyncText}>{rechecking ? 'SYNCING DATABASE...' : 'REFRESH STATUS'}</Text>
                                    </TouchableOpacity>
                                </View>

                                <View style={styles.conciergeBox}>
                                    <Text style={styles.conciergeLabel}>EXECUTIVE CONCIERGE</Text>
                                    <View style={styles.conciergeRow}>
                                        <TouchableOpacity style={styles.conciergeAction} onPress={() => Linking.openURL('https://wa.me/917558175156')}>
                                            <Ionicons name="logo-whatsapp" size={20} color="#000" />
                                            <Text style={styles.conciergeActionText}>WhatsApp</Text>
                                        </TouchableOpacity>
                                        <View style={styles.verticalDivider} />
                                        <TouchableOpacity style={styles.conciergeAction} onPress={() => Linking.openURL('tel:+917558175156')}>
                                            <Ionicons name="call-outline" size={20} color="#000" />
                                            <Text style={styles.conciergeActionText}>Phone Support</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                <TouchableOpacity style={styles.altLogin} onPress={logout}>
                                    <Text style={styles.altLoginText}>Use a different business account</Text>
                                    <Ionicons name="log-out-outline" size={14} color="#94a3b8" />
                                </TouchableOpacity>

                                <View style={styles.complianceRow}>
                                    <Text style={styles.complianceText}>© 2026 KWIQ BILL CO. • ALL RIGHTS RESERVED</Text>
                                </View>
                            </View>
                        </ScrollView>
                    </SafeAreaView>
                </LinearGradient>

                <Modal visible={showPlans} animationType="fade" transparent>
                    <View style={styles.premiumModalBackdrop}>
                        <View style={styles.premiumModalContainer}>
                            <View style={styles.premiumModalHeader}>
                                <View>
                                    <Text style={styles.modalHeading}>CHOOSE A TIER</Text>
                                    <Text style={styles.modalSubHeading}>Select your growth period</Text>
                                </View>
                                <TouchableOpacity onPress={() => setShowPlans(false)} style={styles.premiumCloseBtn}>
                                    <Ionicons name="close-outline" size={26} color="#000" />
                                </TouchableOpacity>
                            </View>

                            <ScrollView showsVerticalScrollIndicator={false} style={styles.plansList}>
                                {[
                                    { id: '1m', name: 'Standard Pro', period: '1 MONTH', price: '₹499', hot: false },
                                    { id: '3m', name: 'Growth Stack', period: '3 MONTHS', price: '₹1,299', hot: true },
                                    { id: '1y', name: 'Premium Business', period: '1 YEAR', price: '₹4,499', hot: false },
                                    { id: 'unlimited', name: 'Life-time License', period: 'FOR EVER', price: '₹9,999', hot: false },
                                ].map((p) => (
                                    <TouchableOpacity key={p.id} style={[styles.stackCard, p.hot && styles.hotStackCard]} onPress={() => Linking.openURL('https://wa.me/917558175156?text=Upgrade:' + p.name)}>
                                        <View style={styles.pLabel}>
                                            <Text style={[styles.pPeriod, p.hot && { color: 'rgba(255,255,255,0.6)' }]}>{p.period}</Text>
                                            <Text style={[styles.pName, p.hot && { color: '#fff' }]}>{p.name}</Text>
                                        </View>
                                        <View style={styles.pPriceRow}>
                                            <Text style={[styles.pPrice, p.hot && { color: '#fff' }]}>{p.price}</Text>
                                            {p.hot && <View style={styles.popTag}><Text style={styles.popTagText}>TRUSTED</Text></View>}
                                        </View>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>

                            <View style={styles.checkoutFooter}>
                                <TouchableOpacity style={styles.instantCheckoutBtn} onPress={() => Linking.openURL('https://wa.me/917558175156')}>
                                    <Text style={styles.instantCheckoutText}>SECURE ACTIVATION</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>
            </View>
        );
    }

    return (
        <View style={{ flex: 1 }}>
            {children}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    gradient: { flex: 1 },
    safeArea: { flex: 1 },
    scrollContent: {
        flexGrow: 1,
        paddingBottom: 40,
    },
    headerCurve: {
        paddingTop: 44,
        paddingBottom: 0,
        borderBottomLeftRadius: 45,
        borderBottomRightRadius: 45,
        overflow: 'hidden',
        paddingHorizontal: 0,
    },
    topNav: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 24,
        marginBottom: 20,
    },
    brandGroup: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    brandBox: {
        width: 44,
        height: 44,
        backgroundColor: '#fff',
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    brandLetter: { color: '#000', fontSize: 22, fontWeight: '900' },
    brandText: { fontSize: 13, fontWeight: '900', color: '#fff', letterSpacing: 1.5 },
    brandTagline: { fontSize: 8, fontWeight: '700', color: '#cbd5e1', letterSpacing: 1 },
    secureBadgeHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(255,255,255,0.15)',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    secureTextHeader: { fontSize: 10, fontWeight: '900', color: '#fff' },

    illustrationHero: {
        width: '100%',
        height: 140,
        alignItems: 'center',
        justifyContent: 'center',
    },
    fullHeroImage: {
        width: width,
        height: '100%',
    },

    mainContentBody: {
        paddingHorizontal: 24,
        paddingTop: 32,
    },

    heroSection: { alignItems: 'center', marginBottom: 32 },
    heroTitle: {
        fontSize: 22,
        fontWeight: '900',
        color: '#000',
        textAlign: 'center',
        lineHeight: 28,
        letterSpacing: -0.5,
        marginBottom: 12,
    },
    heroSub: {
        fontSize: 15,
        color: '#64748b',
        textAlign: 'center',
        lineHeight: 22,
        fontWeight: '500'
    },

    benefitsSection: {
        marginBottom: 32,
        padding: 20,
        backgroundColor: '#fff',
        borderRadius: 24,
        borderWidth: 1.5,
        borderColor: '#f1f5f9',
    },
    benefitsTitle: {
        fontSize: 10,
        fontWeight: '900',
        color: '#94a3b8',
        letterSpacing: 1.5,
        marginBottom: 20,
        textAlign: 'center',
    },
    benefitRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        marginBottom: 18,
    },
    benefitIconBox: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: '#f8fafc',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    benefitText: { flex: 1 },
    benefitLabel: { fontSize: 13, fontWeight: '900', color: '#000', marginBottom: 2 },
    benefitSub: { fontSize: 11, color: '#64748b', fontWeight: '500', lineHeight: 16 },

    ctaGroup: { width: '100%', gap: 12, marginBottom: 32 },
    mainUpgradeBtn: {
        height: 64,
        backgroundColor: '#000',
        borderRadius: 22,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
    },
    mainUpgradeBtnText: { color: '#fff', fontSize: 15, fontWeight: '900', letterSpacing: 0.5 },
    secondarySyncBtn: {
        height: 56,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    secondarySyncText: { fontSize: 13, fontWeight: '800', color: '#64748b' },

    conciergeBox: {
        backgroundColor: '#fff',
        borderRadius: 24,
        padding: 20,
        borderWidth: 1.5,
        borderColor: '#f1f5f9',
        marginBottom: 24,
    },
    conciergeLabel: { fontSize: 10, fontWeight: '900', color: '#94a3b8', letterSpacing: 1.5, marginBottom: 16, textAlign: 'center' },
    conciergeRow: { flexDirection: 'row', alignItems: 'center' },
    conciergeAction: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    conciergeActionText: { fontSize: 13, fontWeight: '800', color: '#000' },
    verticalDivider: { width: 1, height: 24, backgroundColor: '#f1f5f9' },

    altLogin: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 30 },
    altLoginText: { fontSize: 13, color: '#94a3b8', fontWeight: '600' },
    complianceRow: { borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 20, alignItems: 'center' },
    complianceText: { fontSize: 9, fontWeight: '800', color: '#cbd5e1', letterSpacing: 0.5 },

    premiumModalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    premiumModalContainer: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 40,
        borderTopRightRadius: 40,
        padding: 24,
        height: '75%',
    },
    premiumModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
    modalHeading: { fontSize: 10, fontWeight: '900', letterSpacing: 2, color: '#94a3b8' },
    modalSubHeading: { fontSize: 22, fontWeight: '900', color: '#000' },
    premiumCloseBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#f8fafc', alignItems: 'center', justifyContent: 'center' },
    plansList: { flex: 1 },
    stackCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 24,
        borderRadius: 24,
        backgroundColor: '#F8F9FB',
        marginBottom: 12,
        borderWidth: 1.5,
        borderColor: '#F1F5F9',
    },
    hotStackCard: {
        backgroundColor: '#000',
        borderColor: '#000',
    },
    pLabel: { gap: 2 },
    pPeriod: { fontSize: 10, fontWeight: '900', color: '#94a3b8' },
    pName: { fontSize: 17, fontWeight: '900', color: '#000' },
    pPriceRow: { alignItems: 'flex-end', gap: 4 },
    pPrice: { fontSize: 20, fontWeight: '900', color: '#000' },
    popTag: { backgroundColor: '#fff', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    popTagText: { fontSize: 8, fontWeight: '900', color: '#000' },
    checkoutFooter: { paddingVertical: 10 },
    instantCheckoutBtn: {
        height: 64,
        backgroundColor: '#000',
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    instantCheckoutText: { color: '#fff', fontSize: 15, fontWeight: '900', letterSpacing: 0.5 },

    // Blocked Screen
    content: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
    iconContainer: { marginBottom: 40, alignItems: 'center', justifyContent: 'center' },
    iconBackground: {
        width: 120, height: 120, borderRadius: 60, backgroundColor: '#fff',
        alignItems: 'center', justifyContent: 'center', elevation: 10,
    },
    textContainer: { alignItems: 'center', width: '100%', marginBottom: 30 },
    title: { fontSize: 28, fontWeight: '900', color: '#000', textAlign: 'center', marginBottom: 12 },
    subtitle: { fontSize: 18, fontWeight: '700', color: '#000', marginBottom: 8 },
    description: { fontSize: 15, color: '#64748b', textAlign: 'center', lineHeight: 22, fontWeight: '500' },
    buttonContainer: { width: '100%', gap: 16 },
    logoutButton: { paddingVertical: 10, alignItems: 'center' },
    logoutButtonText: { color: '#FF4444', fontSize: 16, fontWeight: '700', textDecorationLine: 'underline' },
});

export default TrialGuard;
