import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Alert,
    Platform,
    Image,
    Dimensions,
    TextInput,
    KeyboardAvoidingView,
    Modal as RNModal,
    StatusBar
} from 'react-native';
import {
    Upload,
    FileText,
    X,
    Calendar as CalendarIcon,
    Tag,
    CreditCard,
    DollarSign,
    Check,
    Image as ImageIcon,
    Camera,
    ChevronRight,
    ArrowLeft,
    Cloud,
    Trash2
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useExpenses } from '../../context/ExpenseContext';
import {
    PAYMENT_METHODS,
    SAMPLE_CATEGORIES,
} from '../../utils/expenseConstants';

const { width, height } = Dimensions.get('window');

const ExpenseModal = ({ isOpen, onClose, expense = null }) => {
    const { addExpense, updateExpense } = useExpenses();
    const isEditMode = !!expense;

    const [formData, setFormData] = useState({
        title: '',
        amount: '',
        category: '',
        date: new Date().toISOString().split('T')[0],
        description: '',
        paymentMethod: 'Cash',
        reference: '',
        tags: [],
        isRecurring: false,
        frequency: 'one-time',
        nextDueDate: ''
    });

    const [receiptUri, setReceiptUri] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [receiptPreviewVisible, setReceiptPreviewVisible] = useState(false);

    useEffect(() => {
        if (expense) {
            setFormData({
                ...expense,
                amount: expense.amount ? String(expense.amount) : '',
                date: expense.date ? new Date(expense.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            });
            // Restore existing receipt URI from the expense record
            const existingReceipt = expense.receiptUrl || expense.receipt_url || null;
            setReceiptUri(existingReceipt && existingReceipt.length > 0 ? existingReceipt : null);
        } else {
            resetForm();
            setReceiptUri(null);
        }
    }, [expense, isOpen]);

    const resetForm = () => {
        setFormData({
            title: '',
            amount: '',
            category: '',
            date: new Date().toISOString().split('T')[0],
            description: '',
            paymentMethod: 'Cash',
            reference: '',
            tags: [],
            isRecurring: false,
            frequency: 'one-time',
            nextDueDate: ''
        });
    };

    const handlePickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission Denied', 'Gallery access is needed for receipts.');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            quality: 0.7,
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
            setReceiptUri(result.assets[0].uri);
        }
    };

    const handleTakePhoto = async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission Denied', 'Camera access is needed to capture receipts.');
            return;
        }

        const result = await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            quality: 0.7,
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
            setReceiptUri(result.assets[0].uri);
        }
    };

    const handleReceiptAction = () => {
        Alert.alert(
            'Attach Receipt',
            'Choose how to add your receipt',
            [
                { text: 'Take Photo', onPress: handleTakePhoto },
                { text: 'Choose from Gallery', onPress: handlePickImage },
                ...(receiptUri ? [{ text: 'Remove Receipt', style: 'destructive', onPress: () => setReceiptUri(null) }] : []),
                { text: 'Cancel', style: 'cancel' },
            ]
        );
    };

    const handleChange = (name, value) => {
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async () => {
        if (!formData.title || !formData.amount || !formData.category) {
            Alert.alert('Missing Fields', 'Please fill in the Amount, Title, and Category.');
            return;
        }

        setIsSubmitting(true);
        try {
            // BUG FIX: Pass receipt as `receiptUrl` (the key ExpenseContext expects),
            // not as `receiptFile` which was being silently ignored.
            const submissionData = {
                ...formData,
                receiptUrl: receiptUri || '',
            };

            if (isEditMode) {
                await updateExpense(expense.id, submissionData);
            } else {
                await addExpense(submissionData);
            }
            onClose();
        } catch (error) {
            console.error("Expense Save Error:", error);
            Alert.alert('Error', 'Failed to save expense.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const setQuickDate = (type) => {
        const now = new Date();
        if (type === 'yesterday') {
            now.setDate(now.getDate() - 1);
        }
        handleChange('date', now.toISOString().split('T')[0]);
    };

    return (
        <RNModal
            visible={isOpen}
            animationType="slide"
            onRequestClose={onClose}
            presentationStyle="pageSheet"
        >
            <View style={styles.container}>
                <StatusBar barStyle="dark-content" backgroundColor="#fff" />

                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                        <X size={22} color="#1e293b" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>{isEditMode ? 'Edit Expense' : 'New Expense'}</Text>
                    <View style={{ width: 40 }} />
                </View>

                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={{ flex: 1 }}
                >
                    <ScrollView
                        style={styles.content}
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={{ paddingBottom: 120 }}
                    >
                        {/* Hero Amount Input */}
                        <View style={styles.amountSection}>
                            <Text style={styles.currencySymbol}>₹</Text>
                            <TextInput
                                value={formData.amount}
                                onChangeText={(val) => handleChange('amount', val)}
                                placeholder="0"
                                placeholderTextColor="#cbd5e1"
                                keyboardType="numeric"
                                style={styles.amountInput}
                                autoFocus={!isEditMode}
                            />
                        </View>

                        {/* Main Form Fields */}
                        <View style={styles.formSection}>

                            {/* Title Input */}
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>WHAT IS THIS FOR?</Text>
                                <TextInput
                                    value={formData.title}
                                    onChangeText={(val) => handleChange('title', val)}
                                    placeholder="e.g. Office Supplies, Client Lunch"
                                    placeholderTextColor="#94a3b8"
                                    style={styles.textInput}
                                />
                            </View>

                            {/* Category Selector */}
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>CATEGORY</Text>
                                <ScrollView
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    contentContainerStyle={styles.categoryScroll}
                                >
                                    {SAMPLE_CATEGORIES.map((cat, index) => {
                                        const isSelected = formData.category === cat;
                                        return (
                                            <TouchableOpacity
                                                key={index}
                                                onPress={() => handleChange('category', cat)}
                                                style={[styles.categoryChip, isSelected && styles.categoryChipSelected]}
                                            >
                                                <Text style={[styles.categoryText, isSelected && styles.categoryTextSelected]}>
                                                    {cat}
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </ScrollView>
                            </View>

                            {/* Payment Method */}
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>PAYMENT METHOD</Text>
                                <View style={styles.paymentMethodsRow}>
                                    {PAYMENT_METHODS.map((method) => {
                                        const isSelected = formData.paymentMethod === method;
                                        return (
                                            <TouchableOpacity
                                                key={method}
                                                onPress={() => handleChange('paymentMethod', method)}
                                                style={[styles.paymentChip, isSelected && styles.paymentChipSelected]}
                                            >
                                                <Text style={[styles.paymentText, isSelected && styles.paymentTextSelected]}>
                                                    {method}
                                                </Text>
                                                {isSelected && <Check size={14} color="#fff" />}
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            </View>

                            {/* Date Selection */}
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>DATE</Text>
                                <View style={styles.dateControlRow}>
                                    <View style={styles.dateInputWrapper}>
                                        <CalendarIcon size={18} color="#64748b" />
                                        <TextInput
                                            value={formData.date}
                                            onChangeText={(val) => handleChange('date', val)}
                                            placeholder="YYYY-MM-DD"
                                            placeholderTextColor="#94a3b8"
                                            style={styles.dateInput}
                                        />
                                    </View>
                                    <View style={styles.quickDateRow}>
                                        <TouchableOpacity onPress={() => setQuickDate('today')} style={styles.quickDateBtn}>
                                            <Text style={styles.quickDateText}>Today</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity onPress={() => setQuickDate('yesterday')} style={styles.quickDateBtn}>
                                            <Text style={styles.quickDateText}>Yesterday</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </View>

                            {/* Receipt Upload — Enhanced with preview */}
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>RECEIPT ATTACHMENT</Text>

                                {receiptUri ? (
                                    <View style={styles.receiptContainer}>
                                        {/* Receipt Image Preview */}
                                        <TouchableOpacity
                                            onPress={() => setReceiptPreviewVisible(true)}
                                            activeOpacity={0.9}
                                            style={styles.receiptImageWrapper}
                                        >
                                            <Image
                                                source={{ uri: receiptUri }}
                                                style={styles.receiptImage}
                                                resizeMode="cover"
                                            />
                                            <View style={styles.receiptImageOverlay}>
                                                <Text style={styles.receiptOverlayText}>Tap to enlarge</Text>
                                            </View>
                                        </TouchableOpacity>

                                        {/* Receipt Actions */}
                                        <View style={styles.receiptActions}>
                                            <TouchableOpacity onPress={handleReceiptAction} style={styles.receiptActionBtn}>
                                                <Camera size={16} color="#0f172a" />
                                                <Text style={styles.receiptActionText}>Replace</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity onPress={() => setReceiptUri(null)} style={styles.receiptRemoveBtn}>
                                                <Trash2 size={16} color="#fff" />
                                                <Text style={styles.receiptActionText}>Remove</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                ) : (
                                    <TouchableOpacity onPress={handleReceiptAction} style={styles.receiptUploadCard}>
                                        <View style={styles.uploadIconCircle}>
                                            <Camera size={28} color="#64748b" />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.uploadText}>Attach Receipt</Text>
                                            <Text style={styles.uploadSubText}>Camera or Gallery</Text>
                                        </View>
                                        <ChevronRight size={20} color="#94a3b8" />
                                    </TouchableOpacity>
                                )}
                            </View>

                            {/* Notes */}
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>NOTES (OPTIONAL)</Text>
                                <TextInput
                                    value={formData.description}
                                    onChangeText={(val) => handleChange('description', val)}
                                    placeholder="Add any additional details..."
                                    placeholderTextColor="#94a3b8"
                                    multiline
                                    style={styles.notesInput}
                                />
                            </View>
                        </View>
                    </ScrollView>
                </KeyboardAvoidingView>

                {/* Footer */}
                <View style={styles.footer}>
                    <TouchableOpacity
                        style={[styles.saveBtn, isSubmitting && { opacity: 0.6 }]}
                        onPress={handleSubmit}
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? (
                            <Text style={styles.saveBtnText}>Saving...</Text>
                        ) : (
                            <Text style={styles.saveBtnText}>{isEditMode ? 'Update Expense' : 'Save Expense'}</Text>
                        )}
                        {!isSubmitting && <ChevronRight size={20} color="#fff" />}
                    </TouchableOpacity>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 12 }}>
                        <Cloud size={10} color="#94a3b8" />
                        <Text style={{ fontSize: 10, color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                            Synced to Google Drive
                        </Text>
                    </View>
                </View>
            </View>

            {/* Full-Screen Receipt Preview Modal */}
            <RNModal
                visible={receiptPreviewVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setReceiptPreviewVisible(false)}
            >
                <View style={styles.previewOverlay}>
                    <TouchableOpacity
                        style={styles.previewCloseBtn}
                        onPress={() => setReceiptPreviewVisible(false)}
                    >
                        <X size={28} color="#fff" />
                    </TouchableOpacity>
                    {receiptUri && (
                        <Image
                            source={{ uri: receiptUri }}
                            style={styles.previewImage}
                            resizeMode="contain"
                        />
                    )}
                </View>
            </RNModal>
        </RNModal>
    );
};

const styles = StyleSheet.create({
    // ─── Base ───
    container: { flex: 1, backgroundColor: '#fff' },

    // ─── Header ───
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: Platform.OS === 'ios' ? 56 : 20,
        paddingBottom: 15,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    closeBtn: {
        padding: 8,
        borderRadius: 12,
        backgroundColor: '#f1f5f9',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#0f172a',
        letterSpacing: -0.3,
    },

    content: { flex: 1 },

    // ─── Amount Section ───
    amountSection: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 40,
        backgroundColor: '#fff',
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    currencySymbol: {
        fontSize: 36,
        fontWeight: '300',
        color: '#94a3b8',
        marginRight: 4,
        marginTop: -8,
    },
    amountInput: {
        fontSize: 56,
        fontWeight: '200',
        color: '#0f172a',
        minWidth: 100,
        padding: 0,
        letterSpacing: -2,
    },

    // ─── Form Section ───
    formSection: {
        paddingHorizontal: 24,
        paddingTop: 28,
        gap: 28,
    },
    inputGroup: {
        gap: 12,
    },
    label: {
        fontSize: 11,
        fontWeight: '700',
        color: '#64748b',
        letterSpacing: 1.5,
    },

    textInput: {
        fontSize: 17,
        color: '#0f172a',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
        paddingVertical: 10,
        fontWeight: '500',
    },

    // ─── Category Chips ───
    categoryScroll: {
        gap: 10,
        paddingRight: 20,
    },
    categoryChip: {
        paddingHorizontal: 18,
        paddingVertical: 10,
        borderRadius: 100,
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    categoryChipSelected: {
        backgroundColor: '#0f172a',
        borderColor: '#0f172a',
    },
    categoryText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#64748b',
    },
    categoryTextSelected: {
        color: '#fff',
        fontWeight: '700',
    },

    // ─── Date ───
    dateControlRow: {
        flexDirection: 'row',
        gap: 12,
    },
    dateInputWrapper: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 12,
        paddingHorizontal: 16,
        backgroundColor: '#f8fafc',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    dateInput: {
        flex: 1,
        fontSize: 15,
        fontWeight: '600',
        color: '#0f172a',
    },
    quickDateRow: {
        flexDirection: 'row',
        gap: 8,
    },
    quickDateBtn: {
        paddingHorizontal: 16,
        paddingVertical: 6,
        backgroundColor: '#f1f5f9',
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    quickDateText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#475569',
    },

    // ─── Payment Methods ───
    paymentMethodsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    paymentChip: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 12,
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    paymentChipSelected: {
        borderColor: '#0f172a',
        backgroundColor: '#0f172a',
    },
    paymentText: {
        fontSize: 14,
        fontWeight: '500',
        color: '#64748b',
    },
    paymentTextSelected: {
        color: '#fff',
        fontWeight: '700',
    },

    // ─── Receipt Upload ───
    receiptUploadCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 16,
        borderStyle: 'dashed',
        padding: 20,
    },
    uploadIconCircle: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: '#f1f5f9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    uploadText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#0f172a',
    },
    uploadSubText: {
        fontSize: 12,
        color: '#94a3b8',
        marginTop: 3,
    },

    // ─── Receipt Preview (Inline) ───
    receiptContainer: {
        borderRadius: 16,
        overflow: 'hidden',
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    receiptImageWrapper: {
        width: '100%',
        height: 200,
        position: 'relative',
    },
    receiptImage: {
        width: '100%',
        height: '100%',
    },
    receiptImageOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        paddingVertical: 8,
        alignItems: 'center',
    },
    receiptOverlayText: {
        fontSize: 12,
        color: '#fff',
        fontWeight: '600',
        letterSpacing: 0.5,
    },
    receiptActions: {
        flexDirection: 'row',
        gap: 10,
        padding: 12,
    },
    receiptActionBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 10,
        backgroundColor: '#0f172a',
        borderRadius: 10,
    },
    receiptRemoveBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 10,
        backgroundColor: '#ef4444',
        borderRadius: 10,
    },
    receiptActionText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#fff',
    },

    // ─── Notes ───
    notesInput: {
        backgroundColor: '#f8fafc',
        borderRadius: 16,
        padding: 16,
        height: 100,
        textAlignVertical: 'top',
        fontSize: 15,
        color: '#0f172a',
        lineHeight: 22,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },

    // ─── Footer ───
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#fff',
        paddingHorizontal: 24,
        paddingVertical: 16,
        paddingBottom: Platform.OS === 'ios' ? 36 : 16,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
    },
    saveBtn: {
        backgroundColor: '#0f172a',
        height: 56,
        borderRadius: 20,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 16,
        elevation: 6,
    },
    saveBtnText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#fff',
    },

    // ─── Full Screen Preview ───
    previewOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.95)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    previewCloseBtn: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 60 : 40,
        right: 20,
        zIndex: 10,
        padding: 10,
        backgroundColor: 'rgba(255,255,255,0.15)',
        borderRadius: 20,
    },
    previewImage: {
        width: width - 40,
        height: height * 0.7,
    },
});

export default ExpenseModal;
