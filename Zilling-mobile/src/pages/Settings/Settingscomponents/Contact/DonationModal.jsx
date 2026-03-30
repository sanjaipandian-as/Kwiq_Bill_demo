import React, { useState } from 'react';
import {
    View, Text, StyleSheet, Modal, TouchableOpacity, 
    TextInput, ActivityIndicator, Alert, Dimensions,
    SafeAreaView, KeyboardAvoidingView, Platform, ScrollView
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { X, Heart, ShieldCheck, Coffee, CheckCircle } from 'lucide-react-native';
import RazorpayCheckout from 'react-native-razorpay';
import services from '../../../../services/api';

const { width, height } = Dimensions.get('window');

const RAZORPAY_KEY_ID = 'rzp_test_RpeLGZo249pZ3k';

const DonationModal = ({ visible, onClose }) => {
    const [amount, setAmount] = useState('100');
    const [customAmount, setCustomAmount] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [showCustom, setShowCustom] = useState(false);
    const [userEmail, setUserEmail] = useState('anonymous');
    const [isSuccess, setIsSuccess] = useState(false);
    const [toast, setToast] = useState(null); // { title, message, type: 'error' | 'cancel' }

    React.useEffect(() => {
        const getEmail = async () => {
             try {
                const stored = await AsyncStorage.getItem('@kwiq_bill_customize_order');
                if (stored) {
                    const { email } = JSON.parse(stored);
                    if (email) setUserEmail(email);
                }
             } catch (e) {}
        };
        getEmail();
    }, [visible]);

    const showToast = (title, message, type = 'error') => {
        setToast({ title, message, type });
        setTimeout(() => setToast(null), 4000);
    };

    const presetAmounts = ['10', '50', '100', '500'];

    const handleDonation = async () => {
        if (!amount && !customAmount) return;

        let finalAmount = showCustom ? customAmount : amount;
        
        if (parseFloat(finalAmount) < 10) {
            showToast('Invalid Amount', 'Minimum donation amount is ₹10.');
            return;
        }

        setIsProcessing(true);
        setToast(null);

            try {
            // 1. Create Order via Backend API
            const orderRes = await services.payment.createOrder({
                amount: parseFloat(finalAmount),
                email: userEmail
            });

            const order = orderRes.data.order;

            console.log("[PAYMENT-RES] Received Order ID:", order.id);

            // 2. Open Native Razorpay Checkout
            const options = {
                description: 'Support Kwiq Bill',
                image: 'https://res.cloudinary.com/ddnxhn442/image/upload/v1742644264/branding/kwiq_bill_payment_logo.jpg', 
                currency: String(order.currency || 'INR'),
                key: String(RAZORPAY_KEY_ID).trim(),
                amount: order.amount, 
                name: 'KWIQ BILL',
                order_id: String(order.id), 
                prefill: {
                    email: userEmail.includes('@') ? userEmail : 'donor@kwiqbill.com',
                    contact: '9876543210',  // Dummy required for test networks, safe from recurring digits error
                    name: userEmail !== 'anonymous' ? userEmail.split('@')[0] : 'Kwiq Supporter'
                },
                theme: { color: '#000000' },
                retry: { enabled: true, max_count: 3 }
            };

            console.log("[PAYMENT-CHECKOUT] Final Sync - Order ID:", options.order_id);

            RazorpayCheckout.open(options).then(async (data) => {
                // 3. Verify Payment on Backend
                try {
                    const verifyRes = await services.payment.verifyPayment({
                        razorpay_order_id: data.razorpay_order_id,
                        razorpay_payment_id: data.razorpay_payment_id,
                        razorpay_signature: data.razorpay_signature
                    });

                    if (verifyRes.data.success) {
                        setIsSuccess(true);
                        // Auto close after 4 seconds
                        setTimeout(() => {
                            if (isSuccess) handleClose();
                        }, 4000);
                    }
                } catch (err) {
                    showToast('Verification Failed', 'Payment was successful but verification failed.');
                }
            }).catch((error) => {
                // Handle payment failure or user dismissal
                console.log("Razorpay Checkout Error payload:", JSON.stringify(error));
                
                // Razorpay native SDK sometimes sends '0' or '2' for user cancellations
                if (error.code === 2 || error.code === 0) { 
                     showToast('Payment Cancelled', 'You exited the payment process securely.', 'cancel');
                } else {
                     showToast('Payment Error', error.description || 'Could not connect to payment gateway.', 'error');
                }
            });

        } catch (error) {
            console.error("Payment Init Error:", error);
            showToast('System Error', 'Could not initialize payment gateway.', 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleClose = () => {
        setIsSuccess(false);
        setToast(null);
        onClose();
    };

    return (
        <Modal visible={visible} animationType="fade" transparent={true} onRequestClose={handleClose}>
            <View style={styles.overlay}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'padding'} style={styles.modalContainer}>
                    <View style={styles.modalContent}>
                        {/* Success View */}
                        {isSuccess ? (
                            <View style={styles.successContainer}>
                                <View style={styles.successIconCircle}>
                                    <CheckCircle color="#10b981" size={60} strokeWidth={3} />
                                </View>
                                <Text style={styles.successTitle}>Payment Successful!</Text>
                                <Text style={styles.successSubtitle}>
                                    Your support means the world to us. This donation helps Kwiq Bill stay fast, secure, and free for businesses like yours.
                                </Text>
                                <View style={styles.heartRow}>
                                    <Heart color="#ef4444" size={24} fill="#ef4444" />
                                    <Heart color="#ef4444" size={16} fill="#ef4444" />
                                    <Heart color="#ef4444" size={20} fill="#ef4444" />
                                </View>
                                <TouchableOpacity style={styles.doneBtn} onPress={handleClose}>
                                    <Text style={styles.doneBtnText}>Great!</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <>
                                {/* Header */}
                                <View style={styles.header}>
                                    <View style={styles.iconCircle}>
                                        <Heart color="#000" size={24} fill="#000" />
                                    </View>
                                    <TouchableOpacity onPress={handleClose} style={styles.closeAction}>
                                        <X color="#64748b" size={24} />
                                    </TouchableOpacity>
                                </View>

                                {/* Custom Elegant Toast */}
                                {toast && (
                                    <View style={[styles.customToast, toast.type === 'cancel' ? styles.toastCancel : styles.toastError]}>
                                        <Text style={styles.toastTitle}>{toast.title}</Text>
                                        <Text style={styles.toastMessage}>{toast.message}</Text>
                                    </View>
                                )}

                        <Text style={styles.title}>Support Kwiq Bill</Text>
                        <Text style={styles.subtitle}>Help us keep the servers running and build more creative tools for your business.</Text>

                        <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false} contentContainerStyle={{ alignItems: 'center' }}>
                            {/* Amount Selection */}
                            <View style={styles.amountGrid}>
                            {presetAmounts.map(a => (
                                <TouchableOpacity 
                                    key={a}
                                    style={[styles.amountBtn, !showCustom && amount === a && styles.amountBtnActive]}
                                    onPress={() => { setShowCustom(false); setAmount(a); }}
                                >
                                    <Text style={[styles.amountText, !showCustom && amount === a && styles.amountTextActive]}>₹{a}</Text>
                                </TouchableOpacity>
                            ))}
                            <TouchableOpacity 
                                style={[styles.amountBtn, showCustom && styles.amountBtnActive]}
                                onPress={() => setShowCustom(true)}
                            >
                                <Text style={[styles.amountText, showCustom && styles.amountTextActive]}>Custom</Text>
                            </TouchableOpacity>
                        </View>

                        {showCustom && (
                            <View style={styles.customInputContainer}>
                                <Text style={styles.currencyPrefix}>₹</Text>
                                <TextInput 
                                    style={styles.customInput}
                                    placeholder="Enter amount"
                                    keyboardType="numeric"
                                    autoFocus
                                    value={customAmount}
                                    onChangeText={setCustomAmount}
                                />
                            </View>
                        )}

                        <View style={styles.infoBox}>
                            <Coffee size={16} color="#64748b" />
                            <Text style={styles.infoText}>Donations help us build awesome updates!</Text>
                        </View>
                    </ScrollView>

                        {/* Submit Button */}
                        <TouchableOpacity 
                            style={styles.payBtn} 
                            activeOpacity={0.8}
                            onPress={handleDonation}
                            disabled={isProcessing}
                        >
                            {isProcessing ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <>
                                    <Text style={styles.payBtnText}>Donate ₹{showCustom ? (customAmount || '0') : amount}</Text>
                                    <ShieldCheck color="#fff" size={20} />
                                </>
                            )}
                        </TouchableOpacity>

                        <Text style={styles.secureBadge}>
                            <ShieldCheck size={10} color="#94a3b8" /> Secure 256-bit encrypted checkout
                        </Text>
                            </>
                        )}
                    </View>
                </KeyboardAvoidingView>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    modalContainer: {
        width: '100%',
        maxWidth: 400,
    },
    modalContent: {
        backgroundColor: '#fff',
        borderRadius: 32,
        padding: 24,
        alignItems: 'center',
        maxHeight: height * 0.8,
        width: width * 0.9,
    },
    scrollContent: {
        width: '100%',
    },
    header: {
        width: '100%',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 10,
    },
    iconCircle: {
        width: 54,
        height: 54,
        backgroundColor: '#f8fafc',
        borderRadius: 27,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    closeAction: {
        padding: 4,
    },
    title: {
        fontSize: 24,
        fontWeight: '900',
        color: '#000',
        marginBottom: 8,
        letterSpacing: -0.5,
    },
    subtitle: {
        fontSize: 14,
        color: '#64748b',
        textAlign: 'center',
        lineHeight: 20,
        fontWeight: '500',
        marginBottom: 24,
    },
    amountGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        justifyContent: 'center',
        marginBottom: 20,
    },
    amountBtn: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 14,
        borderWidth: 1.5,
        borderColor: '#e2e8f0',
        minWidth: 70,
        alignItems: 'center',
    },
    amountBtnActive: {
        backgroundColor: '#000',
        borderColor: '#000',
    },
    amountText: {
        fontSize: 14,
        fontWeight: '800',
        color: '#475569',
    },
    amountTextActive: {
        color: '#fff',
    },
    customInputContainer: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        borderRadius: 14,
        borderWidth: 1.5,
        borderColor: '#000',
        paddingHorizontal: 16,
        marginBottom: 20,
    },
    currencyPrefix: {
        fontSize: 18,
        fontWeight: '900',
        color: '#000',
        marginRight: 8,
    },
    customInput: {
        flex: 1,
        height: 50,
        fontSize: 18,
        fontWeight: '700',
        color: '#000',
    },
    infoBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#f1f5f9',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 12,
        marginBottom: 24,
    },
    infoText: {
        fontSize: 12,
        color: '#64748b',
        fontWeight: '700',
    },
    payBtn: {
        width: '100%',
        height: 56,
        backgroundColor: '#000',
        borderRadius: 18,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 6,
    },
    payBtnText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    secureBadge: {
        marginTop: 16,
        fontSize: 10,
        color: '#94a3b8',
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    // Success View Styles
    successContainer: {
        alignItems: 'center',
        paddingVertical: 20,
        width: '100%',
    },
    successIconCircle: {
        width: 100,
        height: 100,
        backgroundColor: '#f0fdf4',
        borderRadius: 50,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
        borderWidth: 1,
        borderColor: '#dcfce7',
    },
    successTitle: {
        fontSize: 26,
        fontWeight: '900',
        color: '#000',
        marginBottom: 12,
        letterSpacing: -0.5,
    },
    successSubtitle: {
        fontSize: 15,
        color: '#64748b',
        textAlign: 'center',
        lineHeight: 22,
        fontWeight: '600',
        marginBottom: 30,
        paddingHorizontal: 10,
    },
    heartRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 40,
    },
    doneBtn: {
        width: '100%',
        height: 56,
        backgroundColor: '#10b981',
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#10b981',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 10,
        elevation: 6,
    },
    doneBtnText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '900',
    },
    // Custom Toast Styles
    customToast: {
        width: '100%',
        padding: 12,
        borderRadius: 12,
        marginBottom: 16,
        borderWidth: 1,
    },
    toastError: {
        backgroundColor: '#fef2f2',
        borderColor: '#fecaca',
    },
    toastCancel: {
        backgroundColor: '#f8fafc',
        borderColor: '#e2e8f0',
    },
    toastTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#0f172a',
        marginBottom: 2,
    },
    toastMessage: {
        fontSize: 12,
        color: '#475569',
    }
});

export default DonationModal;
