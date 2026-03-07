import React from 'react';
import {
    Modal as RNModal,
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    TouchableWithoutFeedback,
    Dimensions, ScrollView
} from 'react-native';
import { X } from 'lucide-react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export const Modal = ({ isOpen, onClose, title, children, scrollable = true }) => {
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
                        <KeyboardAvoidingView
                            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                            style={styles.keyboardView}
                        >
                            <View style={styles.content}>
                                <View style={styles.header}>
                                    <Text style={styles.title}>{title}</Text>
                                    <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                                        <X size={20} color="#000" />
                                    </TouchableOpacity>
                                </View>
                                {scrollable ? (
                                    <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
                                        {children}
                                    </ScrollView>
                                ) : (
                                    <View style={[styles.body, styles.bodyContent, { flex: 1 }]}>
                                        {children}
                                    </View>
                                )}
                            </View>
                        </KeyboardAvoidingView>
                    </TouchableWithoutFeedback>
                </View>
            </TouchableWithoutFeedback>
        </RNModal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    keyboardView: {
        width: '100%',
        maxWidth: 500,
        maxHeight: SCREEN_HEIGHT * 0.85, // Constraints height to avoid overflowing screen
    },
    content: {
        width: SCREEN_WIDTH * 0.9,
        maxWidth: 500,
        backgroundColor: '#fff',
        borderRadius: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 15,
        elevation: 10,
        overflow: 'hidden',
        minHeight: 200, // Ensure it doesn't collapse
    },

    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingTop: 24,
        paddingBottom: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    title: {
        fontSize: 20,
        fontWeight: '800',
        color: '#0f172a',
    },
    closeBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    body: {
        flexShrink: 1,
    },
    bodyContent: {
        paddingHorizontal: 24,
        paddingBottom: 24,
    },
});

