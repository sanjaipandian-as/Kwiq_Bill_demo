import React, { useState, useEffect, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Alert,
    Platform,
    Dimensions,
    TextInput,
    KeyboardAvoidingView,
    Modal,
    StatusBar,
    SafeAreaView
} from 'react-native';
import {
    FileText,
    X,
    Calendar as CalendarIcon,
    CreditCard,
    IndianRupee,
    ChevronRight,
    ArrowRight,
    Hash,
    Landmark,
    Wallet,
    Plus,
    Tag,
    ChevronDown
} from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useExpenses } from '../../context/ExpenseContext';
import {
    SAMPLE_CATEGORIES,
} from '../../utils/expenseConstants';

const { width, height } = Dimensions.get('window');

const ExpenseModal = ({ isOpen, onClose, expense = null }) => {
    const { addExpense, updateExpense, expenses, categories, addCategory } = useExpenses();
    const isEditMode = !!expense;

    const [formData, setFormData] = useState({
        title: '',
        amount: '',
        category: '',
        date: new Date(),
        description: '',
        paymentMethod: 'Cash',
    });

    const [showDatePicker, setShowDatePicker] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isPickerVisible, setIsPickerVisible] = useState(false);
    const [isAddingCategory, setIsAddingCategory] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');

    // Calculate stats for the hero section
    const handleAddCategory = async () => {
        if (!newCategoryName.trim()) return;
        if (categories.includes(newCategoryName.trim())) {
            handleChange('category', newCategoryName.trim());
            setIsAddingCategory(false);
            setNewCategoryName('');
            return;
        }
        await addCategory(newCategoryName.trim());
        handleChange('category', newCategoryName.trim());
        setIsAddingCategory(false);
        setNewCategoryName('');
    };

    const stats = useMemo(() => {
        if (!expense || !expenses) return { total: 0, count: 0 };
        const categoryExpenses = expenses.filter(e => e.category === expense.category);
        const total = categoryExpenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
        return { total, count: categoryExpenses.length };
    }, [expense, expenses]);

    useEffect(() => {
        if (expense) {
            setFormData({
                ...expense,
                amount: expense.amount ? String(expense.amount) : '',
                date: expense.date ? new Date(expense.date) : new Date(),
                paymentMethod: expense.paymentMethod || 'Cash',
            });
        } else {
            resetForm();
        }
    }, [expense, isOpen]);

    const resetForm = () => {
        setFormData({
            title: '',
            amount: '',
            category: '',
            date: new Date(),
            description: '',
            paymentMethod: 'Cash',
        });
    };

    const handleChange = (name, value) => {
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const onDateChange = (event, selectedDate) => {
        const currentDate = selectedDate || formData.date;
        setShowDatePicker(false);
        handleChange('date', currentDate);
    };

    const handleSubmit = async () => {
        if (!formData.title || !formData.amount || !formData.category) {
            Alert.alert('Required Fields', 'Please fill in the Amount, Title, and Category.');
            return;
        }

        setIsSubmitting(true);
        try {
            const submissionData = {
                ...formData,
                amount: parseFloat(formData.amount) || 0,
                date: formData.date.toISOString(),
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

    return (
        <>
            <Modal
            visible={isOpen}
            animationType="slide"
            onRequestClose={onClose}
            presentationStyle="pageSheet"
        >
            <View style={styles.container}>
                <StatusBar barStyle="dark-content" />

                {/* Header - Matching CustomerModal */}
                <View style={styles.topHeader}>
                    <View style={styles.dragHandle} />
                    <View style={styles.headerTitleRow}>
                        <View style={styles.titleContent}>
                            <Text style={styles.mainTitle}>{isEditMode ? 'Edit Expense' : 'Register Expense'}</Text>
                            <Text style={styles.subSubtitle}>{isEditMode ? 'Update transaction details' : 'Record a new business expenditure'}</Text>
                        </View>
                        <TouchableOpacity onPress={onClose} style={styles.headerX}>
                            <X size={20} color="#000" />
                        </TouchableOpacity>
                    </View>
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
                        {/* Hero Stats Section - Matching CustomerModal */}
                        {isEditMode && (
                            <View style={styles.formHero}>
                                <View style={styles.heroStatItem}>
                                    <Text style={styles.heroStatLabel}>CATEGORY TOTAL</Text>
                                    <Text style={styles.heroStatValue}>₹{stats.total.toLocaleString()}</Text>
                                </View>
                                <View style={styles.heroStatDivider} />
                                <View style={styles.heroStatItem}>
                                    <Text style={styles.heroStatLabel}>RECORDS</Text>
                                    <Text style={styles.heroStatValue}>{stats.count}</Text>
                                </View>
                            </View>
                        )}

                        <View style={styles.formContent}>
                            {/* Amount Section */}
                            <View style={styles.inputGroup}>
                                <Text style={styles.groupTitle}>Primary Information</Text>
                                
                                <View style={styles.fieldContainer}>
                                    <Text style={styles.fieldLabel}>AMOUNT SPENT <Text style={styles.reqText}>*</Text></Text>
                                    <View style={styles.inputWrapper}>
                                        <IndianRupee size={18} color="#777" />
                                        <TextInput
                                            style={styles.fieldInput}
                                            value={formData.amount}
                                            onChangeText={(val) => handleChange('amount', val)}
                                            placeholder="0.00"
                                            placeholderTextColor="#bbb"
                                            keyboardType="numeric"
                                            autoFocus={!isEditMode}
                                        />
                                    </View>
                                </View>

                                <View style={styles.fieldContainer}>
                                    <Text style={styles.fieldLabel}>EXPENSE TITLE <Text style={styles.reqText}>*</Text></Text>
                                    <View style={styles.inputWrapper}>
                                        <FileText size={18} color="#777" />
                                        <TextInput
                                            style={styles.fieldInput}
                                            value={formData.title}
                                            onChangeText={(val) => handleChange('title', val)}
                                            placeholder="e.g. Office Supplies, Rent"
                                            placeholderTextColor="#bbb"
                                        />
                                    </View>
                                </View>

                                 <View style={styles.fieldContainer}>
                                    <Text style={styles.fieldLabel}>CATEGORY <Text style={styles.reqText}>*</Text></Text>
                                    <TouchableOpacity style={styles.inputWrapper} onPress={() => setIsPickerVisible(true)}>
                                        <Tag size={18} color="#777" />
                                        <Text style={styles.dateDisplayValue}>
                                            {formData.category || 'Select Category'}
                                        </Text>
                                        <ChevronDown size={18} color="#777" />
                                    </TouchableOpacity>
                                </View>
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.groupTitle}>Payment Details</Text>

                                <View style={styles.fieldContainer}>
                                    <Text style={styles.fieldLabel}>TRANSACTION DATE</Text>
                                    <TouchableOpacity style={styles.inputWrapper} onPress={() => setShowDatePicker(true)}>
                                        <CalendarIcon size={18} color="#777" />
                                        <Text style={styles.dateDisplayValue}>
                                            {formData.date.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
                                        </Text>
                                        <ChevronRight size={18} color="#777" />
                                    </TouchableOpacity>
                                    
                                    {showDatePicker && (
                                        <DateTimePicker
                                            value={formData.date}
                                            mode="date"
                                            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                            onChange={onDateChange}
                                            maximumDate={new Date()}
                                        />
                                    )}
                                </View>

                                <View style={styles.fieldContainer}>
                                    <Text style={styles.fieldLabel}>PAYMENT METHOD</Text>
                                    <View style={styles.typeSelectorRow}>
                                        {['Cash', 'Online', 'Card'].map(type => (
                                            <TouchableOpacity
                                                key={type}
                                                onPress={() => handleChange('paymentMethod', type)}
                                                style={[styles.typeOption, formData.paymentMethod === type && styles.typeOptionActive]}
                                            >
                                                <View style={[styles.typeRadio, formData.paymentMethod === type && styles.typeRadioActive]}>
                                                    {formData.paymentMethod === type && <View style={styles.radioInner} />}
                                                </View>
                                                <Text style={[styles.typeOptionText, formData.paymentMethod === type && styles.typeOptionTextActive]}>
                                                    {type}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.groupTitle}>Internal Notes</Text>
                                <TextInput
                                    style={styles.textArea}
                                    value={formData.description}
                                    onChangeText={(text) => handleChange('description', text)}
                                    placeholder="Add any additional details or remarks..."
                                    placeholderTextColor="#bbb"
                                    multiline
                                    numberOfLines={4}
                                />
                            </View>
                        </View>
                    </ScrollView>

                    <View style={styles.modalFooter}>
                        <TouchableOpacity
                            onPress={handleSubmit}
                            style={[styles.saveBtn, isSubmitting && styles.loading]}
                            disabled={isSubmitting}
                        >
                            <ArrowRight size={18} color="#fff" strokeWidth={3} />
                            <Text style={styles.saveText}>{isSubmitting ? 'PROCESSING' : (isEditMode ? 'UPDATE TRANSACTION' : 'CONFIRM EXPENSE')}</Text>
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </View>
        </Modal>

                {/* Category Picker Sheet */}
                <Modal visible={isPickerVisible} transparent animationType="slide">
                    <TouchableOpacity 
                        style={styles.pickerOverlay} 
                        activeOpacity={1} 
                        onPress={() => setIsPickerVisible(false)}
                    >
                        <View style={styles.pickerSheet}>
                            <View style={styles.pickerHeader}>
                                <Text style={styles.pickerTitle}>SELECT CATEGORY</Text>
                                <TouchableOpacity onPress={() => setIsPickerVisible(false)}>
                                    <X size={20} color="#000" />
                                </TouchableOpacity>
                            </View>
                            <ScrollView style={styles.pickerList} showsVerticalScrollIndicator={false}>
                                <TouchableOpacity 
                                    style={styles.addCategoryOption}
                                    onPress={() => {
                                        setIsPickerVisible(false);
                                        setTimeout(() => setIsAddingCategory(true), 300);
                                    }}
                                >
                                    <View style={styles.addIconBox}>
                                        <Plus size={16} color="#000" />
                                    </View>
                                    <Text style={styles.addCategoryText}>Add New Category</Text>
                                </TouchableOpacity>

                                {(categories && categories.length > 0 ? categories : SAMPLE_CATEGORIES).map((cat, idx) => (
                                    <TouchableOpacity 
                                        key={idx} 
                                        style={styles.pickerOption}
                                        onPress={() => {
                                            handleChange('category', cat);
                                            setIsPickerVisible(false);
                                        }}
                                    >
                                        <Text style={[
                                            styles.optionLabel, 
                                            formData.category === cat && styles.optionLabelSelected
                                        ]}>{cat}</Text>
                                        {formData.category === cat && <View style={styles.selectedDot} />}
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>
                    </TouchableOpacity>
                </Modal>

                {/* Individual Add Category Modal */}
                <Modal visible={isAddingCategory} transparent animationType="fade">
                    <KeyboardAvoidingView 
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                        style={styles.addCatOverlay}
                    >
                        <View style={styles.addCatBox}>
                            <Text style={styles.addCatTitle}>New Category</Text>
                            <TextInput
                                style={styles.addCatInput}
                                value={newCategoryName}
                                onChangeText={setNewCategoryName}
                                placeholder="Category Name"
                                autoFocus
                                returnKeyType="done"
                                onSubmitEditing={handleAddCategory}
                            />
                            <View style={styles.addCatActions}>
                                <TouchableOpacity 
                                    style={styles.addCatCancel} 
                                    onPress={() => {
                                        setIsAddingCategory(false);
                                        setNewCategoryName('');
                                    }}
                                >
                                    <Text style={styles.cancelText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity 
                                    style={styles.addCatConfirm}
                                    onPress={handleAddCategory}
                                >
                                    <Text style={styles.confirmText}>Create</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </KeyboardAvoidingView>
                </Modal>
            </>
        );
    };

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
    
    // Header - Matching CustomerModal
    topHeader: { backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#efefef' },
    dragHandle: { width: 36, height: 4, backgroundColor: '#e2e8f0', borderRadius: 2, alignSelf: 'center', marginTop: 10 },
    headerTitleRow: { flexDirection: 'row', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 14, alignItems: 'center', justifyContent: 'space-between' },
    titleContent: { gap: 2 },
    mainTitle: { fontSize: 22, fontWeight: '900', color: '#000', letterSpacing: -0.5 },
    subSubtitle: { fontSize: 13, fontWeight: '600', color: '#999' },
    headerX: { width: 38, height: 38, borderRadius: 11, backgroundColor: '#f3f3f3', alignItems: 'center', justifyContent: 'center' },

    content: { flex: 1 },
    formContent: { paddingHorizontal: 20, paddingTop: 20 },

    // Hero Stats Section (Matching CustomerModal)
    formHero: {
        flexDirection: 'row',
        backgroundColor: '#fafafa',
        marginHorizontal: 20,
        marginTop: 20,
        borderRadius: 16,
        paddingVertical: 14,
        borderWidth: 1,
        borderColor: '#f0f0f0',
    },
    heroStatItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    heroStatDivider: { width: 1, height: '70%', backgroundColor: '#eee', alignSelf: 'center' },
    heroStatLabel: { fontSize: 9, fontWeight: '800', color: '#999', letterSpacing: 1, marginBottom: 4 },
    heroStatValue: { fontSize: 16, fontWeight: '900', color: '#000' },

    // Input Group Styles (Matching CustomerModal)
    inputGroup: { paddingBottom: 24, gap: 16 },
    groupTitle: { fontSize: 14, fontWeight: '900', color: '#000', letterSpacing: -0.2 },
    
    fieldContainer: { gap: 8 },
    fieldLabel: { fontSize: 11, fontWeight: '800', color: '#94a3b8', letterSpacing: 0.5 },
    reqText: { color: '#ef4444' },
    
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fafafa',
        borderRadius: 14,
        paddingHorizontal: 16,
        height: 54,
        borderWidth: 1,
        borderColor: '#f0f0f0',
        gap: 12,
    },
    fieldInput: { flex: 1, fontSize: 16, fontWeight: '600', color: '#000' },
    dateDisplayValue: { flex: 1, fontSize: 16, fontWeight: '600', color: '#000', textAlign: 'left' },

    textArea: {
        backgroundColor: '#fafafa',
        borderRadius: 14,
        padding: 16,
        height: 110,
        textAlignVertical: 'top',
        fontSize: 15,
        color: '#000',
        lineHeight: 22,
        borderWidth: 1,
        borderColor: '#f0f0f0',
        fontWeight: '500',
    },

    // Category Selector
    categoryScroll: { gap: 10, paddingRight: 20 },
    categoryChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: '#f8fafc', borderWidth: 1.5, borderColor: '#f1f5f9' },
    categoryChipSelected: { backgroundColor: '#000', borderColor: '#000' },
    categoryText: { fontSize: 14, fontWeight: '700', color: '#64748b' },
    categoryTextSelected: { color: '#fff' },

    // Type Selector (Matching CustomerModal)
    typeSelectorRow: { flexDirection: 'row', gap: 10 },
    typeOption: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderRadius: 14,
        borderWidth: 1.5,
        borderColor: '#f0f0f0',
        backgroundColor: '#fff',
    },
    typeOptionActive: { borderColor: '#000', backgroundColor: '#fafafa' },
    typeRadio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#ddd', alignItems: 'center', justifyContent: 'center' },
    typeRadioActive: { borderColor: '#000' },
    radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#000' },
    typeOptionText: { fontSize: 14, fontWeight: '800', color: '#888' },
    typeOptionTextActive: { color: '#000' },

    // Footer (Cleaned Up Padding)
    modalFooter: {
        backgroundColor: '#fff',
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: Platform.OS === 'ios' ? 34 : 16,
        borderTopWidth: 1,
        borderColor: '#efefef',
    },
    saveBtn: {
        backgroundColor: '#000',
        height: 58,
        borderRadius: 18,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
        elevation: 6,
    },
    loading: { opacity: 0.7 },
    saveText: { fontSize: 15, fontWeight: '900', color: '#fff', letterSpacing: 1 },

    // Picker Styles
    pickerOverlay: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    pickerSheet: {
        backgroundColor: '#fff', borderTopLeftRadius: 32, borderTopRightRadius: 32,
        paddingHorizontal: 24, paddingBottom: 40, paddingTop: 20,
        maxHeight: height * 0.7,
    },
    pickerHeader: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 20,
    },
    pickerTitle: { fontSize: 11, fontWeight: '900', color: '#cbd5e1', letterSpacing: 1 },
    pickerList: { marginBottom: 10 },
    pickerOption: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: '#f8fafc',
    },
    optionLabel: { fontSize: 13, fontWeight: '800', color: '#000' },
    optionLabelSelected: { color: '#000', fontWeight: '900' },
    selectedDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#000' },
    addCategoryOption: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: '#f8fafc',
    },
    addIconBox: {
        width: 28, height: 28, borderRadius: 8,
        backgroundColor: '#f3f3f3', alignItems: 'center', justifyContent: 'center',
    },
    addCategoryText: { fontSize: 15, fontWeight: '900', color: '#000' },

    // Add Category Modal
    addCatOverlay: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
        alignItems: 'center', justifyContent: 'center', padding: 24,
    },
    addCatBox: {
        width: '100%', backgroundColor: '#fff', borderRadius: 24,
        padding: 24, gap: 16,
    },
    addCatTitle: { fontSize: 17, fontWeight: '900', color: '#000' },
    addCatInput: {
        height: 54, backgroundColor: '#f9f9f9', borderRadius: 16,
        paddingHorizontal: 16, fontSize: 16, fontWeight: '700', color: '#000',
        borderWidth: 1, borderColor: '#eee',
    },
    addCatActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
    addCatCancel: { flex: 1, height: 50, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    addCatConfirm: { flex: 1, height: 50, borderRadius: 12, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
    cancelText: { fontSize: 14, fontWeight: '800', color: '#94a3b8' },
    confirmText: { fontSize: 14, fontWeight: '900', color: '#fff' },
});

export default ExpenseModal;
