import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal as RNModal, TouchableWithoutFeedback, Dimensions } from 'react-native';
import { AlertTriangle, Info, X } from 'lucide-react-native';

const { width } = Dimensions.get('window');

const ConfirmationModal = ({
    isOpen,
    onClose,
    onConfirm,
    title = "Confirm Action",
    message = "Are you sure you want to proceed?",
    variant = "danger", // Kept for API compatibility, but styling will be B&W
    confirmLabel = "Confirm",
    cancelLabel = "Cancel"
}) => {
    if (!isOpen) return null;

    return (
        <RNModal
            visible={isOpen}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <TouchableWithoutFeedback onPress={onClose}>
                <View style={styles.overlay}>
                    <TouchableWithoutFeedback>
                        <View style={styles.content}>
                            {/* Icon Header */}
                            <View style={styles.iconWrapper}>
                                {variant === 'danger' ? (
                                    <AlertTriangle size={36} color="#000" strokeWidth={2.5} />
                                ) : (
                                    <Info size={36} color="#000" strokeWidth={2.5} />
                                )}
                            </View>

                            <Text style={styles.titleText}>{title}</Text>
                            <Text style={styles.message}>{message}</Text>

                            <View style={styles.footer}>
                                <TouchableOpacity
                                    style={styles.cancelButton}
                                    onPress={onClose}
                                    activeOpacity={0.7}
                                >
                                    <Text style={styles.cancelButtonText}>{cancelLabel}</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.confirmButton}
                                    onPress={() => {
                                        onConfirm();
                                        onClose();
                                    }}
                                    activeOpacity={0.8}
                                >
                                    <Text style={styles.confirmButtonText}>{confirmLabel}</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </TouchableWithoutFeedback>
                </View>
            </TouchableWithoutFeedback>
        </RNModal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.75)', // Darker overlay for focus
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    content: {
        width: '100%',
        maxWidth: 340,
        backgroundColor: '#fff',
        borderRadius: 24,
        padding: 24,
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10,
    },
    iconWrapper: {
        width: 72,
        height: 72,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
        backgroundColor: '#f3f4f6', // Light gray background
        borderWidth: 1,
        borderColor: '#e5e7eb'
    },
    titleText: {
        fontSize: 20,
        fontWeight: '900',
        color: '#000',
        marginBottom: 10,
        textAlign: 'center',
        letterSpacing: -0.5,
        textTransform: 'uppercase'
    },
    message: {
        fontSize: 14,
        color: '#444',
        textAlign: 'left',
        width: '100%',
        lineHeight: 22,
        marginBottom: 28,
        fontWeight: '600',
        paddingHorizontal: 10
    },
    footer: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
    },
    cancelButton: {
        flex: 1,
        height: 50,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fff',
        borderWidth: 2,
        borderColor: '#000'
    },
    cancelButtonText: {
        fontSize: 13,
        fontWeight: '800',
        color: '#000',
        letterSpacing: 0.5
    },
    confirmButton: {
        flex: 1,
        height: 50,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#000',
    },
    confirmButtonText: {
        fontSize: 13,
        fontWeight: '800',
        color: '#fff',
        letterSpacing: 0.5
    }
});

export default ConfirmationModal;
