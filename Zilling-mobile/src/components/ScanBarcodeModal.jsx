import React, { useState, useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    Pressable,
    Vibration
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Maximize2, X, Camera, AlertCircle } from 'lucide-react-native';
import { useProducts } from '../context/ProductContext';
import { addToBillingQueue } from '../services/billingQueue';
import { useToast } from '../context/ToastContext';

export default function ScanBarcodeModal({ visible, onClose, onScanned }) {
    const { products } = useProducts();
    const { showToast } = useToast();

    // Camera State
    const [permission, requestPermission] = useCameraPermissions();
    const [scanned, setScanned] = useState(false);

    useEffect(() => {
        if (visible) {
            setScanned(false);
            if (!permission) {
                requestPermission();
            }
        }
    }, [visible, permission]);

    const handleBarCodeScanned = ({ type, data }) => {
        if (scanned) return;
        setScanned(true);
        console.log(`[Scanner] Scanned: ${data} (${type})`);

        // Feedback
        try {
            Vibration.vibrate();
        } catch (e) { }

        // Check if product exists - Normalized check
        const normalizedData = data.trim().toLowerCase();

        // Debug
        console.log(`[Scanner] Searching in ${products.length} products...`);

        const matchedProduct = products.find(p => {
            const sku = (p.sku || '').toLowerCase();
            const barcode = (p.barcode || '').toLowerCase(); // Ensure barcode field is checked
            return sku === normalizedData || barcode === normalizedData || p.id.toString() === data;
        });

        if (matchedProduct) {
            console.log(`[Scanner] Match found: ${matchedProduct.name}`);
            if (onScanned) {
                onScanned(matchedProduct);
            } else {
                addToBillingQueue(matchedProduct);
                showToast(`Added "${matchedProduct.name}"`, 'success');
            }

            // Auto-resume
            setTimeout(() => setScanned(false), 1500);

        } else {
            console.log(`[Scanner] No match found for: ${data}`);
            showToast(`Product not found: ${data}`, 'error');
            // Auto-resume
            setTimeout(() => setScanned(false), 2000);
        }
    };

    if (!visible) return null;

    if (!permission) {
        // Loading permission status
        return <View />;
    }

    if (!permission.granted) {
        return (
            <Modal visible={visible} animationType="fade" transparent={true} onRequestClose={onClose}>
                <View style={styles.permissionOverlay}>
                    <View style={styles.permissionCard}>
                        <View style={styles.permissionIconContainer}>
                            <Camera size={40} color="#000" />
                            <View style={styles.permissionBadge}>
                                <AlertCircle size={14} color="#fff" fill="#000" />
                            </View>
                        </View>

                        <Text style={styles.permissionTitle}>Camera Access Required</Text>
                        <Text style={styles.permissionSubTitle}>
                            Kwiq Bill needs camera access to scan product barcodes and add items quickly to your bill.
                        </Text>

                        <View style={styles.permissionActionContainer}>
                            <Pressable
                                onPress={requestPermission}
                                style={({ pressed }) => [
                                    styles.permitBtn,
                                    pressed && { opacity: 0.8 }
                                ]}
                            >
                                <Text style={styles.permitBtnText}>Allow Camera Access</Text>
                            </Pressable>

                            <Pressable
                                onPress={onClose}
                                style={({ pressed }) => [
                                    styles.denyBtn,
                                    pressed && { opacity: 0.7 }
                                ]}
                            >
                                <Text style={styles.denyBtnText}>Maybe Later</Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>
        );
    }

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="fullScreen"
            statusBarTranslucent
            onRequestClose={onClose}
        >
            <View style={styles.cameraContainer}>
                <CameraView
                    key={visible ? 'active-cam' : 'inactive-cam'}
                    style={StyleSheet.absoluteFill}
                    facing="back"
                    onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
                    barcodeScannerSettings={{
                        barcodeTypes: ["qr", "ean13", "ean8", "code128", "code39"],
                    }}
                    onMountError={(error) => {
                        console.error('[Scanner] Mount Error:', error);
                        showToast('Camera failed to start', 'error');
                    }}
                />

                <SafeAreaView style={styles.cameraUi} edges={['top', 'left', 'right', 'bottom']}>
                    <View style={styles.camHeader}>
                        <Pressable onPress={onClose} style={styles.camCloseBtn}>
                            <X size={24} color="white" />
                        </Pressable>
                        <Text style={styles.camTitle}>Scan Product</Text>
                        <View style={{ width: 44 }} />
                    </View>

                    <View style={styles.camFocusArea}>
                        <View style={styles.laserLine} />
                        <Maximize2 size={260} color="rgba(255,255,255,0.5)" strokeWidth={1} />
                    </View>

                    <View style={styles.camFooter}>
                        <Text style={styles.camInstruction}>Align code within frame</Text>
                    </View>
                </SafeAreaView>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    permissionOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24
    },
    permissionCard: {
        backgroundColor: '#ffffff',
        width: '100%',
        maxWidth: 340,
        borderRadius: 32,
        padding: 32,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 10,
    },
    permissionIconContainer: {
        width: 80,
        height: 80,
        borderRadius: 24,
        backgroundColor: '#f8fafc',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    permissionBadge: {
        position: 'absolute',
        top: -4,
        right: -4,
        backgroundColor: '#000',
        width: 24,
        height: 24,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: '#fff',
    },
    permissionTitle: {
        fontSize: 22,
        fontWeight: '800',
        color: '#000',
        textAlign: 'center',
        marginBottom: 12,
        letterSpacing: -0.5,
    },
    permissionSubTitle: {
        fontSize: 15,
        fontWeight: '500',
        color: '#64748b',
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 32,
    },
    permissionActionContainer: {
        width: '100%',
        gap: 12,
    },
    permitBtn: {
        backgroundColor: '#000',
        width: '100%',
        paddingVertical: 16,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    permitBtnText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
    denyBtn: {
        backgroundColor: 'transparent',
        width: '100%',
        paddingVertical: 12,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    denyBtnText: {
        color: '#94a3b8',
        fontSize: 14,
        fontWeight: '600',
    },
    cameraContainer: {
        flex: 1,
        backgroundColor: 'black',
    },
    cameraUi: {
        flex: 1,
        justifyContent: 'space-between',
    },
    camHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 20,
    },
    camCloseBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    camTitle: {
        color: 'white',
        fontSize: 18,
        fontWeight: '800',
    },
    camFocusArea: {
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
    },
    laserLine: {
        width: '80%',
        height: 2,
        backgroundColor: '#ef4444',
        marginBottom: -1,
        zIndex: 10,
        shadowColor: '#ef4444',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 10,
        elevation: 5,
    },
    camFooter: {
        padding: 40,
        alignItems: 'center',
    },
    camInstruction: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 16,
        fontWeight: '600',
    },
});
