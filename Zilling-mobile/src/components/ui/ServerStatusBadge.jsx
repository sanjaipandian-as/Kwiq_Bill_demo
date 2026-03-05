import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Wifi, WifiOff, Database, Loader } from 'lucide-react-native';
import { API } from '../../services/api';

/**
 * ServerStatusBadge - Shows realtime backend + database connection status.
 * 
 * Props:
 *  - style: optional override container style
 *  - variant: 'light' (for dark backgrounds like login) or 'dark' (for white backgrounds like onboarding)
 *  - compact: if true, shows a smaller badge
 */
const ServerStatusBadge = ({ style, variant = 'dark', compact = false }) => {
    const [status, setStatus] = useState('checking'); // 'checking' | 'connected' | 'disconnected'
    const pulseAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        let isMounted = true;
        let intervalId;

        const checkHealth = async () => {
            try {
                const res = await API.get('/health', { timeout: 5000 });
                if (isMounted) {
                    setStatus(res.data?.status === 'connected' ? 'connected' : 'disconnected');
                }
            } catch (err) {
                if (isMounted) {
                    setStatus('disconnected');
                }
            }
        };

        // Check immediately
        checkHealth();

        // Re-check every 15 seconds
        intervalId = setInterval(checkHealth, 15000);

        return () => {
            isMounted = false;
            clearInterval(intervalId);
        };
    }, []);

    // Pulse animation for the status dot
    useEffect(() => {
        if (status === 'connected') {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, { toValue: 0.4, duration: 1200, useNativeDriver: true }),
                    Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
                ])
            ).start();
        } else {
            pulseAnim.setValue(1);
        }
    }, [status]);

    const isLight = variant === 'light';

    const getStatusConfig = () => {
        switch (status) {
            case 'connected':
                return {
                    icon: <Database size={compact ? 12 : 14} color="#10b981" />,
                    text: 'Server Connected',
                    dotColor: '#10b981',
                    bgColor: isLight ? 'rgba(16, 185, 129, 0.12)' : 'rgba(16, 185, 129, 0.08)',
                    borderColor: isLight ? 'rgba(16, 185, 129, 0.3)' : 'rgba(16, 185, 129, 0.2)',
                    textColor: isLight ? '#6ee7b7' : '#10b981',
                };
            case 'disconnected':
                return {
                    icon: <WifiOff size={compact ? 12 : 14} color="#ef4444" />,
                    text: 'Server Offline',
                    dotColor: '#ef4444',
                    bgColor: isLight ? 'rgba(239, 68, 68, 0.12)' : 'rgba(239, 68, 68, 0.08)',
                    borderColor: isLight ? 'rgba(239, 68, 68, 0.3)' : 'rgba(239, 68, 68, 0.2)',
                    textColor: isLight ? '#fca5a5' : '#ef4444',
                };
            default:
                return {
                    icon: <Wifi size={compact ? 12 : 14} color={isLight ? '#94a3b8' : '#64748b'} />,
                    text: 'Checking...',
                    dotColor: isLight ? '#94a3b8' : '#64748b',
                    bgColor: isLight ? 'rgba(148, 163, 184, 0.12)' : 'rgba(100, 116, 139, 0.08)',
                    borderColor: isLight ? 'rgba(148, 163, 184, 0.3)' : 'rgba(100, 116, 139, 0.15)',
                    textColor: isLight ? '#94a3b8' : '#64748b',
                };
        }
    };

    const config = getStatusConfig();

    return (
        <View
            style={[
                styles.container,
                {
                    backgroundColor: config.bgColor,
                    borderColor: config.borderColor,
                },
                compact && styles.compactContainer,
                style,
            ]}
        >
            {config.icon}
            <Animated.View
                style={[
                    styles.statusDot,
                    { backgroundColor: config.dotColor },
                    compact && styles.compactDot,
                    status === 'connected' && { opacity: pulseAnim },
                ]}
            />
            <Text
                style={[
                    styles.statusText,
                    { color: config.textColor },
                    compact && styles.compactText,
                ]}
            >
                {config.text}
            </Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        gap: 8,
        alignSelf: 'center',
    },
    compactContainer: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 14,
        gap: 6,
    },
    statusDot: {
        width: 7,
        height: 7,
        borderRadius: 4,
    },
    compactDot: {
        width: 5,
        height: 5,
        borderRadius: 3,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 0.3,
    },
    compactText: {
        fontSize: 10,
    },
});

export default ServerStatusBadge;
