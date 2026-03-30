import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Linking, TouchableOpacity, SafeAreaView, Dimensions, Animated, DeviceEventEmitter } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const TrialGuard = ({ children }) => {
    const { user, logout, refreshUser } = useAuth();
    const [rechecking, setRechecking] = useState(false);
    const [status, setStatus] = useState({
        blocked: false
    });
    const pulseAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        if (!user) {
            setStatus({ blocked: false });
            return;
        }

        setStatus({
            blocked: !!user.isBlocked
        });
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
        if (status.blocked) {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, { toValue: 1.05, duration: 1500, useNativeDriver: true }),
                    Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
                ])
            ).start();
        }
    }, [status.blocked]);

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
                                <TouchableOpacity style={styles.supportButton} onPress={() => Linking.openURL('https://wa.me/917558175156')}>
                                    <Text style={styles.supportButtonText}>Contact Support</Text>
                                </TouchableOpacity>

                                <TouchableOpacity style={styles.refreshButton} onPress={handleManualRefresh} disabled={rechecking}>
                                    <Text style={styles.refreshButtonText}>{rechecking ? 'Checking Status...' : 'Refresh Access'}</Text>
                                </TouchableOpacity>

                                <TouchableOpacity style={styles.logoutButton} onPress={logout}>
                                    <Text style={styles.logoutButtonText}>Logout Account</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </SafeAreaView>
                </LinearGradient>
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
    content: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
    iconContainer: { marginBottom: 40, alignItems: 'center', justifyContent: 'center' },
    iconBackground: {
        width: 120, height: 120, borderRadius: 60, backgroundColor: '#fff',
        alignItems: 'center', justifyContent: 'center', elevation: 12,
        shadowColor: '#FF4444', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 10
    },
    textContainer: { alignItems: 'center', width: '100%', marginBottom: 40 },
    title: { fontSize: 32, fontWeight: '900', color: '#000', textAlign: 'center', marginBottom: 12, letterSpacing: -1 },
    description: { fontSize: 16, color: '#64748b', textAlign: 'center', lineHeight: 24, fontWeight: '500' },
    buttonContainer: { width: '100%', gap: 16 },
    supportButton: {
        height: 64,
        backgroundColor: '#000',
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 4,
        shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8
    },
    supportButtonText: { color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: 0.5 },
    refreshButton: {
        height: 56,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#f1f5f9'
    },
    refreshButtonText: { fontSize: 14, fontWeight: '800', color: '#64748b' },
    logoutButton: { paddingVertical: 10, alignItems: 'center' },
    logoutButtonText: { color: '#FF4444', fontSize: 15, fontWeight: '700', textDecorationLine: 'underline' },
});

export default TrialGuard;
