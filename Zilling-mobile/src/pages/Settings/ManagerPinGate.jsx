import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Animated, Platform, ActivityIndicator } from 'react-native';
import { Shield, Lock, ChevronRight } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSettings } from '../../context/SettingsContext';
import { useToast } from '../../context/ToastContext';

const ManagerPinGate = ({ onUnlocked }) => {
    const { settings, updateSettings, verifyManagerPin } = useSettings();
    const { showToast } = useToast();
    const [isChecking, setIsChecking] = useState(true);
    const [mode, setMode] = useState('enter'); // Default to enter, adjusted in useEffect
    const [pin, setPin] = useState('');
    const [confirmPin, setConfirmPin] = useState('');
    const [error, setError] = useState('');
    const [shakeAnim] = useState(new Animated.Value(0));
    const inputRef = React.useRef(null);

    React.useEffect(() => {
        const checkStatus = async () => {
            try {
                const { SecurityService } = require('../../services/SecurityService');
                const hasPin = settings?.security?.managerPin || (await require('@react-native-async-storage/async-storage').default.getItem('@security_vault_meta'));
                setMode(hasPin ? 'enter' : 'setup');
            } finally {
                setIsChecking(false);
            }
        };
        checkStatus();
    }, [settings?.security?.managerPin]);

    const shake = () => {
        Animated.sequence([
            Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
            Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
            Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
            Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true })
        ]).start();
    };

    const handleSetup = () => {
        if (pin.length < 4) {
            setError('PIN must be 4 digits');
            shake();
            return;
        }
        setMode('confirm');
        setError('');
    };

    const handleConfirm = async () => {
        if (pin !== confirmPin) {
            setError('PINs do not match');
            setConfirmPin('');
            shake();
            return;
        }
        
        await updateSettings('security', {
            managerPin: pin,
            lastPinVerifiedAt: new Date().toISOString()
        });
        showToast('Manager PIN securely configured.', 'success');
        onUnlocked();
    };

    const handleVerify = async (enteredPin) => {
        const isValid = await verifyManagerPin(enteredPin);
        if (isValid) {
            onUnlocked();
        } else if (enteredPin.length === 4) {
            setError('Incorrect PIN');
            setPin('');
            shake();
        }
    };

    const renderDot = (index, currentVal) => {
        const isActive = currentVal.length > index;
        return (
            <View key={index} style={[styles.dot, isActive && styles.dotActive, error ? styles.dotError : null]} />
        );
    };

    if (isChecking) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color="#000" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <LinearGradient colors={['#ffffff', '#f8fafc']} style={styles.content}>
                <View style={styles.header}>
                    <View style={styles.iconContainer}>
                        {mode === 'enter' ? <Lock size={32} color="#000" /> : <Shield size={32} color="#000" />}
                    </View>
                    <Text style={styles.title}>
                        {mode === 'setup' ? 'Set Manager PIN' : mode === 'confirm' ? 'Confirm PIN' : 'Enter Manager PIN'}
                    </Text>
                    <Text style={styles.subtitle}>
                        {mode === 'setup' ? 'Create a secure PIN to protect staff management.' : 
                         mode === 'confirm' ? 'Please re-enter your PIN to confirm.' : 
                         'Authorize access to personnel records.'}
                    </Text>
                </View>

                <TouchableOpacity 
                    activeOpacity={1} 
                    onPress={() => inputRef.current?.focus()}
                    style={{ width: '100%', alignItems: 'center' }}
                >
                    <Animated.View style={[styles.pinContainer, { transform: [{ translateX: shakeAnim }] }]}>
                        <View style={styles.dotsRow}>
                            {[0, 1, 2, 3].map(i => renderDot(i, mode === 'confirm' ? confirmPin : pin))}
                        </View>
                        {error ? <Text style={styles.errorText}>{error}</Text> : <Text style={{ fontSize: 10, color: '#94a3b8', fontWeight: '700' }}>TAP TO TYPE</Text>}
                    </Animated.View>
                </TouchableOpacity>

                <TextInput
                    ref={inputRef}
                    style={styles.hiddenInput}
                    keyboardType="number-pad"
                    maxLength={4}
                    autoFocus={true}
                    value={mode === 'confirm' ? confirmPin : pin}
                    onChangeText={(val) => {
                        setError('');
                        if (mode === 'confirm') {
                            setConfirmPin(val);
                            if (val.length === 4) {
                                // Auto confirm could be risky, let's keep button
                            }
                        } else if (mode === 'enter') {
                            setPin(val);
                            if (val.length === 4) handleVerify(val);
                        } else {
                            setPin(val);
                        }
                    }}
                />

                <TouchableOpacity 
                    style={styles.button}
                    onPress={() => {
                        if (mode === 'setup') handleSetup();
                        else if (mode === 'confirm') handleConfirm();
                        else handleVerify(pin);
                    }}
                >
                    <Text style={styles.buttonText}>
                        {mode === 'setup' ? 'Continue' : mode === 'confirm' ? 'Set PIN' : 'Authorize'}
                    </Text>
                    <ChevronRight size={20} color="#fff" />
                </TouchableOpacity>

                {mode === 'confirm' && (
                    <TouchableOpacity style={styles.backBtn} onPress={() => { setMode('setup'); setConfirmPin(''); }}>
                        <Text style={styles.backBtnText}>Change PIN</Text>
                    </TouchableOpacity>
                )}
            </LinearGradient>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
    content: { flex: 1, padding: 32, alignItems: 'center', justifyContent: 'center' },
    header: { alignItems: 'center', marginBottom: 40 },
    iconContainer: { width: 80, height: 80, borderRadius: 30, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
    title: { fontSize: 24, fontWeight: '900', color: '#000', marginBottom: 10 },
    subtitle: { fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 20, paddingHorizontal: 20, fontWeight: '500' },
    pinContainer: { alignItems: 'center', marginBottom: 40, width: '100%'},
    dotsRow: { flexDirection: 'row', gap: 24, marginBottom: 15 },
    dot: { width: 20, height: 20, borderRadius: 10, borderWidth: 3, borderColor: '#e2e8f0' },
    dotActive: { backgroundColor: '#000', borderColor: '#000' },
    dotError: { borderColor: '#ef4444' },
    errorText: { color: '#ef4444', fontSize: 13, fontWeight: '800', marginTop: 10 },
    hiddenInput: { position: 'absolute', opacity: 0, width: 0, height: 0 },
    button: { 
        backgroundColor: '#000', 
        width: '100%', 
        height: 64, 
        borderRadius: 24, 
        flexDirection: 'row', 
        alignItems: 'center', 
        justifyContent: 'center', 
        gap: 10,
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.15,
        shadowRadius: 24
    },
    buttonText: { color: '#fff', fontSize: 16, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.5 },
    backBtn: { marginTop: 24, padding: 12 },
    backBtnText: { color: '#64748b', fontWeight: '800', fontSize: 13, textDecorationLine: 'underline', textTransform: 'uppercase', letterSpacing: 0.5 }
});

export default ManagerPinGate;
