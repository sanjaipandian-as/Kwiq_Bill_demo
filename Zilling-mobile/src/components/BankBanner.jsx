import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, TouchableOpacity } from 'react-native';
import { Landmark, X, ChevronRight, AlertCircle, ArrowRightCircle } from 'lucide-react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSettings } from '../context/SettingsContext';

const BankBanner = () => {
    const navigation = useNavigation();
    const { settings, isDecryptionReady } = useSettings();
    const [isVisible, setIsVisible] = useState(true);
    
    const fadeAnim = React.useRef(new Animated.Value(0)).current;

    // Reset visibility when the screen is focused
    useFocusEffect(
        React.useCallback(() => {
            setIsVisible(true);
        }, [])
    );

    const bankDetails = settings?.bankDetails;
    // We check if basic bank details are missing. 
    // accountNumber and ifsc are the most critical.
    const isMissing = !bankDetails?.accountNumber || !bankDetails?.ifsc;

    useEffect(() => {
        if (isDecryptionReady && isMissing && isVisible) {
            Animated.spring(fadeAnim, {
                toValue: 1,
                useNativeDriver: true,
                tension: 50,
                friction: 10
            }).start();
        } else {
            Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 250,
                useNativeDriver: true
            }).start();
        }
    }, [isDecryptionReady, isMissing, isVisible]);

    if (!isDecryptionReady || !isMissing || !isVisible) return null;

    const handleComplete = () => {
        navigation.navigate('Settings', { tab: 'bank' });
    };

    return (
        <Animated.View 
            style={[
                styles.container, 
                { 
                    opacity: fadeAnim, 
                    transform: [{ translateY: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }] 
                }
            ]}
        >
            <View style={styles.iconContainer}>
                <View style={styles.iconBox}>
                    <Landmark size={20} color="#000" strokeWidth={2.5} />
                </View>
            </View>
            
            <View style={styles.content}>
                <Text style={styles.title}>BANK PROFILE MISSING</Text>
                <Text style={styles.subtitle}>
                    Enable invoice payments by completing your bank details.
                </Text>
            </View>

            <View style={styles.actions}>
                <Pressable 
                    style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]} 
                    onPress={handleComplete}
                >
                    <Text style={styles.actionText}>COMPLETE</Text>
                    <ArrowRightCircle size={14} color="#fff" strokeWidth={2.5} />
                </Pressable>

                <TouchableOpacity 
                    style={styles.closeBtn} 
                    onPress={() => setIsVisible(false)}
                    activeOpacity={0.7}
                >
                    <Text style={styles.closeText}>CLOSE</Text>
                </TouchableOpacity>
            </View>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        marginHorizontal: 16,
        marginTop: 16,
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
    },
    iconContainer: {
        marginRight: 14,
    },
    iconBox: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: '#f8fafc',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    content: {
        flex: 1,
    },
    title: {
        fontSize: 10,
        fontWeight: '900',
        color: '#000',
        letterSpacing: 1.5,
        marginBottom: 2,
    },
    subtitle: {
        fontSize: 11,
        color: '#64748b',
        fontWeight: '600',
        lineHeight: 15,
        paddingRight: 8,
    },
    actions: {
        alignItems: 'center',
        gap: 6,
    },
    actionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#000',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 10,
        gap: 4,
    },
    actionText: {
        fontSize: 9,
        fontWeight: '900',
        color: '#fff',
        letterSpacing: 0.5,
    },
    closeBtn: {
        paddingVertical: 4,
        paddingHorizontal: 10,
        borderRadius: 6,
    },
    closeText: {
        fontSize: 8,
        fontWeight: '900',
        color: '#94a3b8',
        letterSpacing: 1,
    },
    pressed: {
        opacity: 0.7,
        transform: [{ scale: 0.96 }],
    },
});

export default BankBanner;
