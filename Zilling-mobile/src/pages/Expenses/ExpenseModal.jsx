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
    Cloud
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
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

    const [receiptFile, setReceiptFile] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (expense) {
            setFormData({
                ...expense,
                amount: expense.amount ? String(expense.amount) : '',
                date: expense.date ? new Date(expense.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            });
        } else {
            resetForm();
        }
        setReceiptFile(null);
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
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 0.7,
        });

        if (!result.canceled) {
            setReceiptFile(result.assets[0].uri);
        }
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
            const submissionData = { ...formData, receiptFile };
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
                        <X size={24} color="#1e293b" />
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
                        contentContainerStyle={{ paddingBottom: 100 }}
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
                                <Text style={styles.label}>What is this for?</Text>
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
                                <Text style={styles.label}>Category</Text>
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
                                                <View style={[styles.catIcon, isSelected && styles.catIconSelected]}>
                                                    <Tag size={14} color={isSelected ? '#fff' : '#64748b'} />
                                                </View>
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
                                <Text style={styles.label}>Payment Method</Text>
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
                                                {isSelected && <Check size={14} color="#2563eb" />}
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            </View>

                            {/* Date Selection */}
                            <View style={[styles.inputGroup, { marginTop: 10 }]}>
                                <Text style={styles.label}>Date</Text>
                                <View style={styles.dateControlRow}>
                                    <View style={styles.dateInputWrapper}>
                                        <CalendarIcon size={18} color="#64748b" />
                                        <TextInput
                                            value={formData.date}
                                            onChangeText={(val) => handleChange('date', val)}
                                            placeholder="YYYY-MM-DD"
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

                            {/* Receipt Upload */}
                            <View style={[styles.inputGroup, { marginTop: 10 }]}>
                                <Text style={styles.label}>Receipt Attachment</Text>
                                <TouchableOpacity onPress={handlePickImage} style={styles.receiptCard}>
                                    {receiptFile || (isEditMode && expense?.receiptUrl) ? (
                                        <View style={styles.receiptPreview}>
                                            <View style={styles.receiptIconBg}>
                                                <FileText size={24} color="#2563eb" />
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.receiptName}>
                                                    {receiptFile ? 'New Receipt Selected' : 'Existing Receipt Attached'}
                                                </Text>
                                                <Text style={styles.receiptSub}>Tap to replace</Text>
                                            </View>
                                            <View style={styles.checkCircle}>
                                                <Check size={14} color="#fff" />
                                            </View>
                                        </View>
                                    ) : (
                                        <View style={styles.uploadPlaceholder}>
                                            <View style={styles.uploadIconCircle}>
                                                <Camera size={24} color="#64748b" />
                                            </View>
                                            <View>
                                                <Text style={styles.uploadText}>Upload Receipt</Text>
                                                <Text style={styles.uploadSubText}>From Gallery</Text>
                                            </View>
                                        </View>
                                    )}
                                </TouchableOpacity>
                            </View>

                            {/* Notes */}
                            <View style={[styles.inputGroup, { marginTop: 10 }]}>
                                <Text style={styles.label}>Notes (Optional)</Text>
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
                        style={styles.saveBtn}
                        onPress={handleSubmit}
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? (
                            <Text style={styles.saveBtnText}>Syncing to Drive...</Text>
                        ) : (
                            <Text style={styles.saveBtnText}>{isEditMode ? 'Update Expense' : 'Save Expense'}</Text>
                        )}
                        {!isSubmitting && <ChevronRight size={20} color="#fff" />}
                    </TouchableOpacity>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 12 }}>
                        <Cloud size={10} color="#94a3b8" />
                        <Text style={{ fontSize: 10, color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                            Encrypted & Synced to Google Drive
                        </Text>
                    </View>
                </View>
            </View>
        </RNModal>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#ffffff' },

    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 15,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#f8fafc',
    },
    closeBtn: {
        padding: 8,
        borderRadius: 12,
        backgroundColor: '#f1f5f9',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1e293b',
    },

    content: { flex: 1 },

    // Amount Section
    amountSection: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 35,
        backgroundColor: '#fff',
        flexDirection: 'row',
    },
    currencySymbol: {
        fontSize: 32,
        fontWeight: '600',
        color: '#94a3b8',
        marginRight: 4,
        marginTop: -6
    },
    amountInput: {
        fontSize: 48,
        fontWeight: '800',
        color: '#0f172a',
        minWidth: 100,
        padding: 0,
    },

    // Form Section
    formSection: {
        paddingHorizontal: 24,
        gap: 24,
    },
    inputGroup: {
        gap: 12,
    },
    label: {
        fontSize: 12,
        fontWeight: '700',
        color: '#64748b',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },

    textInput: {
        fontSize: 18,
        color: '#0f172a',
        borderBottomWidth: 2,
        borderBottomColor: '#f1f5f9',
        paddingVertical: 8,
        fontWeight: '600',
    },

    // Category Chips
    categoryScroll: {
        gap: 10,
        paddingRight: 20,
    },
    categoryChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 14,
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    categoryChipSelected: {
        backgroundColor: '#1e293b',
        borderColor: '#1e293b',
        elevation: 2,
        shadowColor: '#1e293b',
        shadowOpacity: 0.2,
        shadowRadius: 4,
    },
    catIcon: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#e2e8f0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    catIconSelected: {
        backgroundColor: 'rgba(255,255,255,0.2)',
    },
    categoryText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#64748b',
    },
    categoryTextSelected: {
        color: '#fff',
    },

    // Date
    dateControlRow: {
        flexDirection: 'row',
        gap: 12
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
        borderColor: '#f1f5f9',
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
        borderColor: '#f1f5f9'
    },
    quickDateText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#475569',
    },

    // Payment Methods
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
        borderColor: '#2563eb',
        backgroundColor: '#eff6ff',
    },
    paymentText: {
        fontSize: 14,
        fontWeight: '500',
        color: '#64748b',
    },
    paymentTextSelected: {
        color: '#2563eb',
        fontWeight: '600',
    },

    // Receipt
    receiptCard: {
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 16,
        padding: 16,
        borderStyle: 'dashed',
    },
    uploadPlaceholder: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    uploadIconCircle: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#f1f5f9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    uploadText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1e293b',
    },
    uploadSubText: {
        fontSize: 12,
        color: '#94a3b8',
        marginTop: 2
    },
    receiptPreview: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    receiptIconBg: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: '#eff6ff',
        alignItems: 'center',
        justifyContent: 'center',
    },
    receiptName: {
        fontSize: 15,
        fontWeight: '700',
        color: '#0f172a',
    },
    receiptSub: {
        fontSize: 12,
        color: '#64748b',
    },
    checkCircle: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#10b981',
        alignItems: 'center',
        justifyContent: 'center'
    },

    // Notes
    notesInput: {
        backgroundColor: '#f8fafc',
        borderRadius: 16,
        padding: 16,
        height: 100,
        textAlignVertical: 'top',
        fontSize: 15,
        color: '#0f172a',
        lineHeight: 22
    },

    // Footer
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#fff',
        paddingHorizontal: 24,
        paddingVertical: 16,
        paddingBottom: Platform.OS === 'ios' ? 32 : 16,
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
});

export default ExpenseModal;
