import React, { useEffect, useRef } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Animated, Platform } from 'react-native';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import { Cloud, CheckCircle2 } from 'lucide-react-native';

const SyncStatusIndicator = () => {
    const { isUploading, syncStatus, queueLength, loading: settingsLoading } = useSettings();
    const { user, isLoading } = useAuth();
    const translateY = useRef(new Animated.Value(-150)).current;

    // Hide the floating pill entirely if the full-screen DataSyncPage is active!
    // This happens during initial Boot (isLoading or settingsLoading) 
    // or during Login sync (!user).
    const isFullScreenSyncActive = !user || isLoading || settingsLoading;

    useEffect(() => {
        if (isUploading && !isFullScreenSyncActive) {
            Animated.spring(translateY, {
                toValue: Platform.OS === 'ios' ? 64 : 54, // Positioned elegantly below status bar/header
                useNativeDriver: true,
                friction: 8,
                tension: 40,
            }).start();
        } else {
            Animated.timing(translateY, {
                toValue: -150,
                duration: 400,
                useNativeDriver: true,
            }).start();
        }
    }, [isUploading, isFullScreenSyncActive]);

    if (!isUploading && translateY._value === -150) return null;
    if (isFullScreenSyncActive) return null;

    return (
        <Animated.View style={[styles.container, { transform: [{ translateY }] }]}>
            <View style={styles.pill}>
                <View style={styles.iconContainer}>
                    <ActivityIndicator size="small" color="#000" />
                </View>
                <View style={styles.content}>
                    <Text style={styles.title}>Secure Sync</Text>
                    <Text style={styles.subtitle} numberOfLines={1}>
                        {queueLength > 0 ? `Uploading ${queueLength} items...` : (syncStatus || 'Protecting your data')}
                    </Text>
                </View>
                <View style={styles.statusBadge}>
                    <Cloud size={16} color="#000" />
                </View>
            </View>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        alignItems: 'center',
        zIndex: 10000,
        paddingHorizontal: 16,
        pointerEvents: 'none',
    },
    pill: {
        flexDirection: 'row',
        alignItems: 'center',
        // Apple Glassmorphism Effect
        backgroundColor: 'rgba(255, 255, 255, 0.85)',
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 18,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 10,
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.05)',
        width: '94%',
        maxWidth: 400,
        pointerEvents: 'auto',
    },
    iconContainer: {
        marginRight: 12,
    },
    content: {
        flex: 1,
    },
    title: {
        color: '#000',
        fontSize: 13,
        fontWeight: '900',
        letterSpacing: -0.3,
    },
    subtitle: {
        color: '#64748b',
        fontSize: 11,
        fontWeight: '600',
        marginTop: 1,
    },
    statusBadge: {
        marginLeft: 8,
        width: 28,
        height: 28,
        borderRadius: 8,
        backgroundColor: 'rgba(0, 0, 0, 0.03)',
        justifyContent: 'center',
        alignItems: 'center',
    }
});



export default SyncStatusIndicator;
