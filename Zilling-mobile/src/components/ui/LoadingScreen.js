
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing, StatusBar } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Zap } from 'lucide-react-native';

const LoadingScreen = ({ message = "Initializing..." }) => {
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const rotateAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        // Pulsing animation for the logo
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1.2,
                    duration: 1000,
                    useNativeDriver: true,
                    easing: Easing.inOut(Easing.ease),
                }),
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 1000,
                    useNativeDriver: true,
                    easing: Easing.inOut(Easing.ease),
                }),
            ])
        ).start();

        // Subtle rotation for the background/accent
        Animated.loop(
            Animated.timing(rotateAnim, {
                toValue: 1,
                duration: 4000,
                easing: Easing.linear,
                useNativeDriver: true,
            })
        ).start();
    }, []);

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />
            <LinearGradient
                colors={['#0f172a', '#1e293b', '#0f172a']}
                style={styles.background}
            />

            <View style={styles.content}>
                <Animated.View
                    style={[
                        styles.logoContainer,
                        { transform: [{ scale: pulseAnim }] }
                    ]}
                >
                    <LinearGradient
                        colors={['#2563eb', '#3b82f6']}
                        style={styles.logoGradient}
                    >
                        <Zap size={44} color="white" strokeWidth={2.5} />
                    </LinearGradient>
                </Animated.View>

                <View style={styles.textStack}>
                    <Text style={styles.brandName}>Kwiq Billing</Text>
                    <Text style={styles.message}>{message}</Text>
                </View>

                <View style={styles.footer}>
                    <View style={styles.loaderContainer}>
                        <View style={styles.loaderTrack}>
                            <Animated.View style={[styles.loaderFill, {
                                transform: [{
                                    translateX: rotateAnim.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [-100, 200]
                                    })
                                }]
                            }]} />
                        </View>
                    </View>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0f172a',
    },
    background: {
        ...StyleSheet.absoluteFillObject,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    logoContainer: {
        width: 100,
        height: 100,
        borderRadius: 30,
        overflow: 'hidden',
        shadowColor: '#3b82f6',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 15,
        marginBottom: 40,
    },
    logoGradient: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    textStack: {
        alignItems: 'center',
    },
    brandName: {
        fontSize: 28,
        fontWeight: '900',
        color: '#ffffff',
        letterSpacing: -0.5,
        marginBottom: 8,
    },
    message: {
        fontSize: 14,
        color: '#94a3b8',
        fontWeight: '600',
        letterSpacing: 0.5,
        textTransform: 'uppercase',
    },
    footer: {
        position: 'absolute',
        bottom: 80,
        width: '100%',
        paddingHorizontal: 60,
    },
    loaderContainer: {
        height: 4,
        width: '100%',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 2,
        overflow: 'hidden',
    },
    loaderTrack: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    loaderFill: {
        height: '100%',
        width: '40%',
        backgroundColor: '#3b82f6',
        borderRadius: 2,
    }
});

export default LoadingScreen;
