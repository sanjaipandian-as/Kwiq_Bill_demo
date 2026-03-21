import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Animated, Platform, ActivityIndicator } from 'react-native';
import { Shield, Lock, ChevronRight } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSettings } from '../../context/SettingsContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';


import * as LocalAuthentication from 'expo-local-authentication';

const ManagerPinGate = ({ onUnlocked }) => {
    const { settings, updateSettings, verifyManagerPin } = useSettings();
    const { user } = useAuth();
    const { showToast } = useToast();
    const [isChecking, setIsChecking] = useState(true);
    const [mode, setMode] = useState('enter'); // Default to enter, adjusted in useEffect
    const [pin, setPin] = useState('');
    const [confirmPin, setConfirmPin] = useState('');
    const [error, setError] = useState('');
    const [shakeAnim] = useState(new Animated.Value(0));
    const [otp, setOtp] = useState('');
    const [isRecovering, setIsRecovering] = useState(false);
    const [isVerifying, setIsVerifying] = useState(false);
    const inputRef = React.useRef(null);
    const otpRef = React.useRef(null);

    React.useEffect(() => {
        const checkStatus = async () => {
            try {
                // If settings explicitly say managerPin is null/empty, we ARE in setup mode.
                // This prevents the 'Change PIN' button from triggering biometrics.
                if (settings?.security?.managerPin === null) {
                    setMode('setup');
                    setIsChecking(false);
                    return;
                }

                const { SecurityService } = require('../../services/SecurityService');
                const hasPin = settings?.security?.managerPin || (await require('@react-native-async-storage/async-storage').default.getItem('@security_vault_meta'));
                setMode(hasPin ? 'enter' : 'setup');
            } finally {
                setIsChecking(false);
            }
        };
        checkStatus();
    }, [settings?.security?.managerPin]);

    const isBiometricActive = React.useRef(false);

    const triggerBiometric = async () => {
        if (isVerifying || isBiometricActive.current) return;
        isBiometricActive.current = true;
        try {
            const hasHardware = await LocalAuthentication.hasHardwareAsync();
            const isEnrolled = await LocalAuthentication.isEnrolledAsync();
            if (hasHardware && isEnrolled) {
                const result = await LocalAuthentication.authenticateAsync({
                    promptMessage: 'Authenticate to access staff records',
                    fallbackLabel: 'Use PIN',
                    disableDeviceFallback: false,
                    cancelLabel: 'Cancel'
                });
                if (result.success) {
                    showToast('Biometric Access Granted', 'success');
                    onUnlocked();
                } else {
                    // Biometric rejected or canceled. Manually raise keyboard for PIN.
                    setTimeout(() => { inputRef.current?.focus(); }, 300);
                }
            } else {
                showToast('Biometrics not available or not enrolled on this device.', 'error');
                setTimeout(() => { inputRef.current?.focus(); }, 300);
            }
        } catch (e) {
            console.error('Biometric error', e);
            setTimeout(() => { inputRef.current?.focus(); }, 300);
        } finally {
            isBiometricActive.current = false;
        }
    };

    React.useEffect(() => {
        if (!isChecking) {
            // Safety: Double check that we don't trigger biometrics if we're in setup mode
            if (mode === 'enter' && settings?.security?.managerPin !== null) {
                // Always try biometrics first instead of clashing with auto-focus keyboard
                setTimeout(() => { triggerBiometric(); }, 150); 
            } else {
                // If it's setup or confirm, directly pop the keyboard
                setTimeout(() => { inputRef.current?.focus(); }, 150);
            }
        }
    }, [mode, isChecking, settings?.security?.managerPin]);

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
        
        setIsVerifying(true);
        setError('');
        
        // Small delay to ensure UI updates before heavy crypto freezes the thread
        setTimeout(async () => {
          try {
              await updateSettings('security', {
                  managerPin: pin,
                  lastPinVerifiedAt: new Date().toISOString()
              });
              showToast('Manager PIN configured successfully.', 'security');
              onUnlocked();
          } catch (e) {
              setError('Failed to save security settings.');
          } finally {
              setIsVerifying(false);
          }
        }, 100);
    };

    const handleVerify = async (enteredPin) => {
        if (isVerifying) return;
        
        if (!enteredPin || enteredPin.length < 4) {
            setError('Enter 4-digit PIN');
            shake();
            return;
        }

        setIsVerifying(true);
        setError('');
        
        // Timeout allows the UI to update with "Verifying..." before PBKDF2 freezes the thread
        setTimeout(async () => {
            try {
                const isValid = await verifyManagerPin(enteredPin);
                if (isValid) {
                    onUnlocked();
                } else {
                    setError('Incorrect PIN');
                    setPin('');
                    shake();
                    // Refocus after shake/clear
                    setTimeout(() => inputRef.current?.focus(), 300);
                }
            } catch (err) {
                setError('System Error');
                shake();
            } finally {
                setIsVerifying(false);
            }
        }, 50);
    };

    const handleRecoveryVault = async () => {
        if (otp.length < 8) {
            setError('Enter 8-character code');
            shake();
            return;
        }

        setIsRecovering(true);
        setError('');
        try {
            const { SecurityService } = require('../../services/SecurityService');
            const result = await SecurityService.recoverVaultWithOTP(otp, user);
            
            if (result.success) {
                // FORCE UI UPDATE: Wipe local PIN knowledge to ensure we are in a fresh setup mode
                setPin('');
                setConfirmPin('');
                setOtp('');
                setError('');
                showToast('Success!', 'success');
                setMode('setup');
                
                // Re-focus the first PIN dot after a short delay for the UI flip
                setTimeout(() => inputRef.current?.focus(), 500);
            } else {
                setError(result.error || 'Invalid Code');
                shake();
            }
        } catch (e) {
            setError('Recovery Failed');
            shake();
        } finally {
            setIsRecovering(false);
        }
    };

    const renderDot = (index, currentVal) => {
        const isActive = currentVal.length > index;
        return (
            <View key={index} style={[styles.box, error ? styles.boxError : (isActive ? styles.boxActive : null)]}>
                {isActive && <View style={styles.centerDot} />}
            </View>
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
                        {(mode === 'enter' || mode === 'recover') ? <Lock size={32} color="#000" /> : <Shield size={32} color="#000" />}
                    </View>
                    <Text style={styles.title}>
                        {mode === 'setup' ? 'Set Manager PIN' : mode === 'confirm' ? 'Confirm PIN' : mode === 'recover' ? 'Identity Verification' : 'Enter Manager PIN'}
                    </Text>
                    <Text style={styles.subtitle}>
                        {mode === 'setup' ? 'Create a secure PIN to protect staff management.' : 
                         mode === 'confirm' ? 'Please re-enter your PIN to confirm.' : 
                         mode === 'recover' ? 'Enter the 8-character code sent by your Admin.' :
                         'Authorize access to personnel records.'}
                    </Text>
                </View>

                {mode !== 'recover' && (
                    <View style={{ width: '100%', alignItems: 'center', position: 'relative' }}>
                        <Animated.View style={[styles.pinContainer, { transform: [{ translateX: shakeAnim }] }]}>
                            <View style={styles.dotsRow}>
                                {[0, 1, 2, 3].map(i => renderDot(i, mode === 'confirm' ? confirmPin : pin))}
                            </View>
                            {isVerifying ? (
                                <View style={{ padding: 15, backgroundColor: '#fdf2f2', borderRadius: 12, borderWidth: 1, borderColor: '#fee2e2', marginTop: 10 }}>
                                    <ActivityIndicator size="small" color="#dc2626" />
                                    <Text style={{ fontSize: 11, color: '#991b1b', fontWeight: '900', textAlign: 'center', marginTop: 8, lineHeight: 16 }}>
                                        WE ARE VERIFYING YOUR PIN WITH YOUR DATA. WITH 256 LAYERS OF PROTECTION, THIS MAY TAKE UP TO 10 SECONDS...
                                    </Text>
                                </View>
                            ) : (
                                error ? <Text style={styles.errorText}>{error}</Text> : <Text style={{ fontSize: 10, color: '#94a3b8', fontWeight: '700' }}>TAP TO TYPE PIN</Text>
                            )}
                        </Animated.View>

                        <TextInput
                            ref={inputRef}
                            style={styles.hiddenInput}
                            keyboardType="number-pad"
                            maxLength={4}
                            autoFocus={false}
                            caretHidden={true}
                            editable={!isVerifying}
                            value={mode === 'confirm' ? confirmPin : pin}
                            onChangeText={(val) => {
                                if (isVerifying) return;
                                setError('');
                                if (mode === 'confirm') {
                                    setConfirmPin(val);
                                } else if (mode === 'enter') {
                                    setPin(val);
                                    if (val.length === 4) handleVerify(val);
                                } else {
                                    setPin(val);
                                }
                            }}
                        />
                    </View>
                )}

                {mode === 'recover' && (
                    <View style={{ width: '100%', marginTop: 20 }}>
                        <TextInput
                            ref={otpRef}
                            style={[styles.input, error ? { borderColor: '#ef4444' } : null]}
                            placeholder="XJ92-K0L1"
                            placeholderTextColor="#94a3b8"
                            autoCapitalize="characters"
                            maxLength={8}
                            value={otp}
                            onChangeText={(val) => {
                                setOtp(val.toUpperCase());
                                setError('');
                            }}
                        />
                        <TouchableOpacity 
                            style={[styles.button, { marginTop: 15 }]} 
                            onPress={handleRecoveryVault}
                            disabled={isRecovering}
                        >
                            {isRecovering ? <ActivityIndicator color="#fff" /> : (
                                <>
                                    <Text style={styles.buttonText}>VERIFY CODE</Text>
                                    <Shield size={20} color="#fff" />
                                </>
                            )}
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.backBtn} onPress={() => { setMode('enter'); setOtp(''); setError(''); }}>
                            <Text style={styles.backBtnText}>BACK TO LOGIN</Text>
                        </TouchableOpacity>

                        <View style={{ marginTop: 40, borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 20, alignItems: 'center' }}>
                            <Text style={{ fontSize: 9, color: '#CBD5E1', fontWeight: '800' }}>DEVICE IDENTITY</Text>
                            <Text style={{ fontSize: 10, color: '#94A3B8', marginTop: 4 }}>Account: {user?.email || 'Unknown'}</Text>
                            <Text style={{ fontSize: 9, color: '#CBD5E1', marginTop: 2 }}>ID: {user?.id || user?.user?.id || 'N/A'}</Text>
                        </View>
                    </View>
                )}

                {mode !== 'recover' && (
                    <TouchableOpacity 
                        style={[styles.button, isVerifying && { opacity: 0.8 }]}
                        onPress={() => {
                            if (isVerifying) return;
                            if (mode === 'setup') handleSetup();
                            else if (mode === 'confirm') handleConfirm();
                            else handleVerify(pin);
                        }}
                        disabled={isVerifying}
                    >
                        {isVerifying ? (
                            <ActivityIndicator color="#fff" size="small" />
                        ) : (
                            <>
                                <Text style={styles.buttonText}>
                                    {mode === 'setup' ? 'Continue' : mode === 'confirm' ? 'Set PIN' : 'Authorize'}
                                </Text>
                                <ChevronRight size={20} color="#fff" />
                            </>
                        )}
                    </TouchableOpacity>
                )}

                {mode === 'confirm' && (
                    <TouchableOpacity style={styles.backBtn} onPress={() => { setMode('setup'); setConfirmPin(''); }}>
                        <Text style={styles.backBtnText}>Change PIN</Text>
                    </TouchableOpacity>
                )}

                {mode === 'enter' && (
                    <>
                        <TouchableOpacity style={styles.backBtn} onPress={triggerBiometric}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <Shield size={16} color="#64748b" />
                                <Text style={styles.backBtnText}>Use FaceID / Fingerprint</Text>
                            </View>
                        </TouchableOpacity>

                        <View style={{ alignItems: 'center', marginTop: 32, paddingHorizontal: 20 }}>
                            <Text style={{ fontSize: 11, color: '#94a3b8', fontWeight: '800', marginBottom: 8, letterSpacing: 0.5 }}>FORGOT PIN?</Text>
                            <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
                                <TouchableOpacity 
                                    onPress={() => {
                                        const cInfo = settings?.store?.contact || settings?.store?.phone;
                                        if (cInfo) require('react-native').Linking.openURL(`tel:${cInfo}`).catch(() => {});
                                    }}
                                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#f1f5f9', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', flex: 1 }}
                                >
                                    <Shield size={14} color="#334155" />
                                    <Text style={{ fontSize: 10, fontWeight: '800', color: '#334155' }}>CONTACT ADMIN</Text>
                                </TouchableOpacity>

                                <TouchableOpacity 
                                    onPress={() => { setMode('recover'); setTimeout(() => otpRef.current?.focus(), 200); }}
                                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#000', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, flex: 1 }}
                                >
                                    <Lock size={14} color="#fff" />
                                    <Text style={{ fontSize: 10, fontWeight: '800', color: '#fff' }}>REDEEM CODE</Text>
                                </TouchableOpacity>
                            </View>
                            <Text style={{ fontSize: 10, color: '#cbd5e1', textAlign: 'center', marginTop: 12, fontWeight: '700', lineHeight: 14 }}>Manual override codes are provided by your Admin for identity verification.</Text>
                        </View>
                    </>
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
    dotsRow: { flexDirection: 'row', gap: 16, marginBottom: 15 },
    box: { width: 50, height: 60, borderRadius: 12, borderWidth: 2, borderColor: '#e2e8f0', justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
    boxActive: { borderColor: '#0f172a', backgroundColor: '#f8fafc' },
    boxError: { borderColor: '#ef4444' },
    centerDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#0f172a' },
    errorText: { color: '#ef4444', fontSize: 13, fontWeight: '800', marginTop: 10 },
    hiddenInput: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0, zIndex: 10, fontSize: 1, color: 'transparent' },
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
    input: {
        width: '100%',
        height: 64,
        backgroundColor: '#f8fafc',
        borderRadius: 20,
        borderWidth: 2,
        borderColor: '#e2e8f0',
        paddingHorizontal: 20,
        fontSize: 24,
        fontWeight: '900',
        color: '#000',
        textAlign: 'center',
        letterSpacing: 4
    },
    buttonText: { color: '#fff', fontSize: 16, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.5 },
    backBtn: { marginTop: 24, padding: 12 },
    backBtnText: { color: '#64748b', fontWeight: '800', fontSize: 13, textDecorationLine: 'underline', textTransform: 'uppercase', letterSpacing: 0.5 }
});

export default React.memo(ManagerPinGate);
