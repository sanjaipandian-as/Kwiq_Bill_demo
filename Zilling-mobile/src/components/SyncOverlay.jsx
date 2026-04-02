import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, Easing, Platform, Modal } from 'react-native';
import { Cloud } from 'lucide-react-native';

const { width } = Dimensions.get('window');

const SyncOverlay = ({ isVisible }) => {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(0.95)).current;
    const rotateAnim = useRef(new Animated.Value(0)).current;
    
    const [statusIndex, setStatusIndex] = useState(0);
    const statuses = [
        'INITIALIZING SECURE BRIDGE...',
        'FETCHING CLOUD REVISIONS...',
        'DECRYPTING SECURE VAULT...',
        'ALIGNING LOCAL LEDGER...',
        'FINALIZING INTEGRITY CHECK...'
    ];

    useEffect(() => {
        if (isVisible) {
            // Animate In
            Animated.parallel([
                Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
                Animated.spring(scaleAnim, { toValue: 1, friction: 8, useNativeDriver: true })
            ]).start();

            // Continuous Rotation for the outer ring
            Animated.loop(
                Animated.timing(rotateAnim, { toValue: 1, duration: 3000, easing: Easing.linear, useNativeDriver: true })
            ).start();

            // Cycle through sophisticated status messages
            const interval = setInterval(() => {
                setStatusIndex(prev => (prev + 1) % statuses.length);
            }, 1200);
            
            return () => clearInterval(interval);
        }
    }, [isVisible]);

    const spin = rotateAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg']
    });

    return (
        <Modal transparent visible={isVisible} animationType="none" statusBarTranslucent>
            <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
                <View style={styles.overlay} />
                <Animated.View style={[styles.content, { transform: [{ scale: scaleAnim }] }]}>
                    
                    {/* The Rotating Dashed Ring */}
                    <View style={styles.iconContainer}>
                        <Animated.View style={[styles.rotatingRing, { transform: [{ rotate: spin }] }]} />
                        <View style={styles.centerIcon}>
                            <Cloud size={32} color="#FFFFFF" strokeWidth={1.5} />
                        </View>
                    </View>

                    {/* Minimalist Brand & Status */}
                    <View style={styles.textStack}>
                        <Text style={styles.brandTitle}>KWIQ SYNC</Text>
                        <View style={styles.divider} />
                        <Text style={styles.statusText}>{statuses[statusIndex]}</Text>
                    </View>

                    <View style={styles.footer}>
                        <Text style={styles.footerText}>SECURE END-TO-END ENCRYPTION ACTIVE</Text>
                    </View>
                </Animated.View>
            </Animated.View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.92)' },
    content: { width: width * 0.8, alignItems: 'center' },
    iconContainer: { width: 100, height: 100, justifyContent: 'center', alignItems: 'center', marginBottom: 30 },
    rotatingRing: {
        position: 'absolute', width: 100, height: 100, borderRadius: 50,
        borderWidth: 2, borderColor: '#FFFFFF', borderStyle: 'dashed', opacity: 0.2
    },
    centerIcon: {
        width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)'
    },
    brandTitle: { fontSize: 14, fontWeight: '900', color: '#FFFFFF', letterSpacing: 6, marginBottom: 12 },
    textStack: { alignItems: 'center', marginBottom: 20 },
    statusText: {
        fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: '700', letterSpacing: 1.5,
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    },
    divider: { height: 1, width: 40, backgroundColor: 'rgba(255,255,255,0.15)', marginBottom: 15 },
    footer: { position: 'absolute', bottom: -100, alignItems: 'center' },
    footerText: { fontSize: 8, color: 'rgba(255,255,255,0.3)', fontWeight: '600', letterSpacing: 1 }
});

export default SyncOverlay;
