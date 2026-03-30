import React, { useState, useEffect, useCallback } from 'react';
import { Drawer } from '../../components/ui/Drawer';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { ShoppingBag, Calendar, Check, AlertCircle, X, Printer, ChevronDown, ChevronUp, Eye } from 'lucide-react';
import services from '../../services/api';
import { useSettings } from '../../context/SettingsContext';
import { useToast } from '../../context/ToastContext';
import { printReceipt } from '../../utils/printReceipt';
import InvoicePreviewModal from '../Invoices/InvoicePreviewModal';

// Indian States
const INDIAN_STATES = [
    'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
    'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
    'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
    'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
    'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
    'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu',
    'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'
];

const SOURCE_OPTIONS = ['Walk-in', 'Instagram', 'Referral', 'Other'];
const TAG_OPTIONS = ['VIP', 'Wholesale', 'Credit'];

// Debounce hook
const useDebounce = (value, delay) => {
    const [debouncedValue, setDebouncedValue] = useState(value);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);

    return debouncedValue;
};

const CustomerDrawer = ({ isOpen, onClose, customer, onSave, initialTab = 'details' }) => {
    const title = customer ? 'Customer Details' : 'Add New Customer';
    const { settings } = useSettings();
    const toast = useToast();
    const [activeTab, setActiveTab] = useState('details');
    const [expandedOrder, setExpandedOrder] = useState(null);
    const [selectedInvoice, setSelectedInvoice] = useState(null);
    const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
    const [formData, setFormData] = useState({
        fullName: '',
        phone: '',
        email: '',
        customerType: 'Individual',
        gstin: '',
        address: {
            street: '',
            area: '',
            city: '',
            pincode: '',
            state: ''
        },
        source: 'Walk-in',
        tags: [],
        loyaltyPoints: 0,
        notes: ''
    });
    const [orders, setOrders] = useState([]);
    const [loadingOrders, setLoadingOrders] = useState(false);
    const [duplicates, setDuplicates] = useState([]);
    const [searchingDuplicates, setSearchingDuplicates] = useState(false);
    const [validation, setValidation] = useState({});
    const [touched, setTouched] = useState({});

    const debouncedPhone = useDebounce(formData.phone, 300);
    const debouncedEmail = useDebounce(formData.email, 300);

    useEffect(() => {
        if (customer) {
            setFormData({
                fullName: customer.fullName || `${customer.firstName || ''} ${customer.lastName || ''}`.trim(),
                phone: customer.phone || '',
                email: customer.email || '',
                customerType: customer.customerType || 'Individual',
                gstin: customer.gstin || '',
                address: customer.address || {
                    street: '',
                    area: '',
                    city: '',
                    pincode: '',
                    state: ''
                },
                source: customer.source || 'Walk-in',
                tags: customer.tags || [],
                loyaltyPoints: customer.loyaltyPoints || 0,
                notes: customer.notes || ''
            });
        } else {
            setFormData({
                fullName: '',
                phone: '',
                email: '',
                customerType: 'Individual',
                gstin: '',
                address: {
                    street: '',
                    area: '',
                    city: '',
                    pincode: '',
                    state: ''
                },
                source: 'Walk-in',
                tags: [],
                loyaltyPoints: 0,
                notes: ''
            });
        }
        setActiveTab(initialTab || 'details');
        setValidation({});
        setTouched({});
        setDuplicates([]);
    }, [customer, isOpen]);

    useEffect(() => {
        if (customer && activeTab === 'history' && isOpen) {
            const fetchOrders = async () => {
                setLoadingOrders(true);
                try {
                    const response = await services.invoices.getAll({ customerId: customer.id });
                    setOrders(response.data.data || []);
                } catch (error) {
                    console.error("Failed to fetch customer orders", error);
                } finally {
                    setLoadingOrders(false);
                }
            };
            fetchOrders();
        }
    }, [customer, activeTab, isOpen]);

    // Duplicate detection
    useEffect(() => {
        const searchDuplicates = async () => {
            const query = debouncedPhone || debouncedEmail;
            if (!query || query.length < 3 || customer) return;

            setSearchingDuplicates(true);
            try {
                const response = await services.customers.searchDuplicates(query);
                setDuplicates(response.data || []);
            } catch (error) {
                console.error("Failed to search duplicates", error);
                setDuplicates([]);
            } finally {
                setSearchingDuplicates(false);
            }
        };

        searchDuplicates();
    }, [debouncedPhone, debouncedEmail, customer]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        if (name.startsWith('address.')) {
            const addressField = name.split('.')[1];
            setFormData(prev => ({
                ...prev,
                address: { ...prev.address, [addressField]: value }
            }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
        setTouched(prev => ({ ...prev, [name]: true }));
        validateField(name, value);
    };

    const validateField = (name, value) => {
        const newValidation = { ...validation };

        switch (name) {
            case 'fullName':
                if (!value.trim()) {
                    newValidation.fullName = { valid: false, message: 'Name is required' };
                } else {
                    newValidation.fullName = { valid: true };
                }
                break;
            case 'phone':
                if (!value.trim()) {
                    newValidation.phone = { valid: false, message: 'Phone is required' };
                } else if (!/^\+?[\d\s-]{10,}$/.test(value)) {
                    newValidation.phone = { valid: false, message: 'Invalid phone format' };
                } else {
                    newValidation.phone = { valid: true };
                }
                break;
            case 'email':
                if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
                    newValidation.email = { valid: false, message: 'Invalid email format' };
                } else {
                    newValidation.email = { valid: true };
                }
                break;
            case 'gstin':
                if (formData.customerType === 'Business' && !value) {
                    newValidation.gstin = { valid: false, message: 'GSTIN is required for business' };
                } else if (value && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(value)) {
                    newValidation.gstin = { valid: false, message: 'Invalid GSTIN format' };
                } else {
                    newValidation.gstin = { valid: true };
                }
                break;
            default:
                break;
        }

        setValidation(newValidation);
    };

    const handleTagToggle = (tag) => {
        setFormData(prev => ({
            ...prev,
            tags: prev.tags.includes(tag)
                ? prev.tags.filter(t => t !== tag)
                : [...prev.tags, tag]
        }));
    };

    const handleSave = (addAnother = false) => {
        // Validate required fields
        if (!formData.fullName || !formData.phone) {
            toast.warning("Name and Phone are required");
            return;
        }

        if (formData.customerType === 'Business' && !formData.gstin) {
            toast.warning("GSTIN is required for business customers");
            return;
        }

        onSave(formData, addAnother);

        if (addAnother) {
            // Reset form for next entry
            setFormData({
                fullName: '',
                phone: '',
                email: '',
                customerType: 'Individual',
                gstin: '',
                address: {
                    street: '',
                    area: '',
                    city: '',
                    pincode: '',
                    state: ''
                },
                source: 'Walk-in',
                tags: [],
                loyaltyPoints: 0,
                notes: ''
            });
            setValidation({});
            setTouched({});
            setDuplicates([]);
        }
    };

    const handleSelectDuplicate = (dup) => {
        // Close drawer and notify parent to edit this customer
        onClose();
        // You might want to emit an event or call a callback to edit the selected customer
        console.log("Selected duplicate:", dup);
    };

    const getValidationIcon = (fieldName) => {
        if (!touched[fieldName]) return null;
        const val = validation[fieldName];
        if (!val) return null;

        if (val.valid) {
            return <Check className="text-green-500" size={16} />;
        } else {
            return <AlertCircle className="text-red-500" size={16} />;
        }
    };

    return (
        <Drawer isOpen={isOpen} onClose={onClose} title={title} width="max-w-3xl">
            <div className="h-full flex flex-col">
                {/* Tabs */}
                {customer && (
                    <div className="flex border-b border-slate-200 mb-6">
                        <button
                            className={`px-4 py-2 text-sm font-medium ${activeTab === 'details' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-600 hover:text-slate-900'}`}
                            onClick={() => setActiveTab('details')}
                        >
                            Profile
                        </button>
                        <button
                            className={`px-4 py-2 text-sm font-medium ${activeTab === 'history' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-600 hover:text-slate-900'}`}
                            onClick={() => setActiveTab('history')}
                        >
                            Purchase History
                        </button>
                    </div>
                )}

                <div className="flex-1 overflow-y-auto">
                    {activeTab === 'details' ? (
                        <div className="space-y-6">
                            {/* Customer ID (read-only for existing customers) */}
                            {customer && customer.customerId && (
                                <div className="bg-blue-50 p-3 rounded-lg">
                                    <p className="text-xs text-slate-600">Customer ID</p>
                                    <p className="font-mono font-semibold text-blue-900">{customer.customerId}</p>
                                </div>
                            )}

                            {/* Duplicate Warning */}
                            {!customer && duplicates.length > 0 && (
                                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                                    <div className="flex items-start gap-2 mb-2">
                                        <AlertCircle className="text-amber-600 mt-0.5" size={18} />
                                        <div>
                                            <p className="font-semibold text-amber-900 text-sm">Possible Duplicates Found</p>
                                            <p className="text-xs text-amber-700">Similar customers already exist:</p>
                                        </div>
                                    </div>
                                    <div className="space-y-2 mt-3">
                                        {duplicates.map(dup => (
                                            <div key={dup.id} className="bg-white p-2 rounded border border-amber-200 flex justify-between items-center">
                                                <div>
                                                    <p className="font-medium text-sm text-slate-900">{dup.fullName}</p>
                                                    <p className="text-xs text-slate-600">{dup.phone} {dup.email && `• ${dup.email}`}</p>
                                                </div>
                                                <button
                                                    onClick={() => handleSelectDuplicate(dup)}
                                                    className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                                                >
                                                    Use This
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Basic Information */}
                            <div className="space-y-4">
                                <h4 className="font-semibold text-slate-900 border-b border-slate-100 pb-2">Basic Information</h4>

                                {/* Customer Type */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700">
                                        Type <span className="text-red-500">*</span>
                                    </label>
                                    <div className="flex gap-4">
                                        {(!customer || formData.customerType === 'Individual') && (
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="radio"
                                                    name="customerType"
                                                    value="Individual"
                                                    checked={formData.customerType === 'Individual'}
                                                    onChange={handleChange}
                                                    className="w-4 h-4 text-blue-600"
                                                />
                                                <span className="text-sm text-slate-700">Individual</span>
                                            </label>
                                        )}
                                        {(!customer || formData.customerType === 'Business') && (
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="radio"
                                                    name="customerType"
                                                    value="Business"
                                                    checked={formData.customerType === 'Business'}
                                                    onChange={handleChange}
                                                    className="w-4 h-4 text-blue-600"
                                                />
                                                <span className="text-sm text-slate-700">Business</span>
                                            </label>
                                        )}
                                    </div>
                                    <p className="text-xs text-slate-500">Select customer type for tax purposes</p>
                                </div>

                                {/* Full Name */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700">
                                        Full Name <span className="text-red-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <Input
                                            name="fullName"
                                            value={formData.fullName}
                                            onChange={handleChange}
                                            placeholder="e.g. John Doe"
                                            className={touched.fullName && validation.fullName && !validation.fullName.valid ? 'border-red-300' : ''}
                                        />
                                        <div className="absolute right-3 top-3">
                                            {getValidationIcon('fullName')}
                                        </div>
                                    </div>
                                    {touched.fullName && validation.fullName && !validation.fullName.valid && (
                                        <p className="text-xs text-red-600">{validation.fullName.message}</p>
                                    )}
                                    <p className="text-xs text-slate-500">Enter customer's full name</p>
                                </div>

                                {/* Phone & Email */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-slate-700">
                                            Phone <span className="text-red-500">*</span>
                                        </label>
                                        <div className="relative">
                                            <Input
                                                name="phone"
                                                value={formData.phone}
                                                onChange={handleChange}
                                                placeholder="+91 98765 43210"
                                                className={touched.phone && validation.phone && !validation.phone.valid ? 'border-red-300' : ''}
                                            />
                                            <div className="absolute right-3 top-3">
                                                {searchingDuplicates && formData.phone ? (
                                                    <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                                                ) : (
                                                    getValidationIcon('phone')
                                                )}
                                            </div>
                                        </div>
                                        {touched.phone && validation.phone && !validation.phone.valid && (
                                            <p className="text-xs text-red-600">{validation.phone.message}</p>
                                        )}
                                        <p className="text-xs text-slate-500">Primary contact number</p>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-slate-700">Email</label>
                                        <div className="relative">
                                            <Input
                                                name="email"
                                                type="email"
                                                value={formData.email}
                                                onChange={handleChange}
                                                placeholder="john@example.com"
                                                className={touched.email && validation.email && !validation.email.valid ? 'border-red-300' : ''}
                                            />
                                            <div className="absolute right-3 top-3">
                                                {searchingDuplicates && formData.email ? (
                                                    <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                                                ) : (
                                                    getValidationIcon('email')
                                                )}
                                            </div>
                                        </div>
                                        {touched.email && validation.email && !validation.email.valid && (
                                            <p className="text-xs text-red-600">{validation.email.message}</p>
                                        )}
                                        <p className="text-xs text-slate-500">Optional email address</p>
                                    </div>
                                </div>

                                {/* GSTIN (conditional) */}
                                {formData.customerType === 'Business' && (
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-slate-700">
                                            GSTIN <span className="text-red-500">*</span>
                                        </label>
                                        <div className="relative">
                                            <Input
                                                name="gstin"
                                                value={formData.gstin}
                                                onChange={handleChange}
                                                placeholder="22AAAAA0000A1Z5"
                                                className={`uppercase ${touched.gstin && validation.gstin && !validation.gstin.valid ? 'border-red-300' : ''}`}
                                                maxLength={15}
                                            />
                                            <div className="absolute right-3 top-3">
                                                {getValidationIcon('gstin')}
                                            </div>
                                        </div>
                                        {touched.gstin && validation.gstin && !validation.gstin.valid && (
                                            <p className="text-xs text-red-600">{validation.gstin.message}</p>
                                        )}
                                        <p className="text-xs text-slate-500">15-character GST identification number</p>
                                    </div>
                                )}
                            </div>

                            {/* Address */}
                            <div className="space-y-4">
                                <h4 className="font-semibold text-slate-900 border-b border-slate-100 pb-2">Address</h4>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700">Street</label>
                                    <Input
                                        name="address.street"
                                        value={formData.address.street}
                                        onChange={handleChange}
                                        placeholder="House/Flat No., Building Name"
                                    />
                                    <p className="text-xs text-slate-500">Building number and street name</p>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-slate-700">Area</label>
                                        <Input
                                            name="address.area"
                                            value={formData.address.area}
                                            onChange={handleChange}
                                            placeholder="Locality/Area"
                                        />
                                        <p className="text-xs text-slate-500">Neighborhood or locality</p>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-slate-700">City</label>
                                        <Input
                                            name="address.city"
                                            value={formData.address.city}
                                            onChange={handleChange}
                                            placeholder="City"
                                        />
                                        <p className="text-xs text-slate-500">City or town name</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-slate-700">Pincode</label>
                                        <Input
                                            name="address.pincode"
                                            value={formData.address.pincode}
                                            onChange={handleChange}
                                            placeholder="400001"
                                            maxLength={6}
                                        />
                                        <p className="text-xs text-slate-500">6-digit postal code</p>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-slate-700">State</label>
                                        <select
                                            name="address.state"
                                            value={formData.address.state}
                                            onChange={handleChange}
                                            className="flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                                        >
                                            <option value="">Select State</option>
                                            {INDIAN_STATES.map(state => (
                                                <option key={state} value={state}>{state}</option>
                                            ))}
                                        </select>
                                        <p className="text-xs text-slate-500">Select from dropdown</p>
                                    </div>
                                </div>
                            </div>

                            {/* Source & Tags */}
                            <div className="space-y-4">
                                <h4 className="font-semibold text-slate-900 border-b border-slate-100 pb-2">Additional Details</h4>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-slate-700">Source</label>
                                        <select
                                            name="source"
                                            value={formData.source}
                                            onChange={handleChange}
                                            className="flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                                        >
                                            {SOURCE_OPTIONS.map(source => (
                                                <option key={source} value={source}>{source}</option>
                                            ))}
                                        </select>
                                        <p className="text-xs text-slate-500">How did they find you?</p>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-slate-700">Loyalty Points</label>
                                        <Input
                                            name="loyaltyPoints"
                                            type="number"
                                            value={formData.loyaltyPoints}
                                            onChange={handleChange}
                                            placeholder="0"
                                            min="0"
                                        />
                                        <p className="text-xs text-slate-500">Reward points balance</p>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700">Tags</label>
                                    <div className="flex gap-2 flex-wrap">
                                        {TAG_OPTIONS.map(tag => (
                                            <button
                                                key={tag}
                                                type="button"
                                                onClick={() => handleTagToggle(tag)}
                                                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${formData.tags.includes(tag)
                                                    ? tag === 'VIP' ? 'bg-purple-600 text-white'
                                                        : tag === 'Wholesale' ? 'bg-blue-600 text-white'
                                                            : 'bg-orange-600 text-white'
                                                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                                    }`}
                                            >
                                                {formData.tags.includes(tag) && <Check size={12} className="inline mr-1" />}
                                                {tag}
                                            </button>
                                        ))}
                                    </div>
                                    <p className="text-xs text-slate-500">Click to add/remove tags</p>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700">Notes</label>
                                    <textarea
                                        name="notes"
                                        value={formData.notes}
                                        onChange={handleChange}
                                        placeholder="Additional notes about this customer..."
                                        rows={3}
                                        className="flex w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                                    />
                                    <p className="text-xs text-slate-500">Any special instructions or preferences</p>
                                </div>
                            </div>

                            {/* Account Summary (for existing customers) */}
                            {customer && (
                                <div className="space-y-4">
                                    <h4 className="font-semibold text-slate-900 border-b border-slate-100 pb-2">Account Summary</h4>
                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="bg-slate-50 p-4 rounded-lg text-center flex flex-col justify-between">
                                            <div>
                                                <p className="text-xs text-slate-500 uppercase">Total Visits</p>
                                                <p className="text-xl font-bold text-slate-900">{customer.totalVisits}</p>
                                            </div>
                                            <button
                                                onClick={() => setActiveTab('history')}
                                                className="mt-2 text-[10px] text-blue-600 font-semibold hover:underline"
                                            >
                                                View Detailed History →
                                            </button>
                                        </div>
                                        <div className="bg-slate-50 p-4 rounded-lg text-center">
                                            <p className="text-xs text-slate-500 uppercase">Total Spent</p>
                                            <p className="text-xl font-bold text-green-600">₹{customer.totalSpent}</p>
                                        </div>
                                        <div className="bg-slate-50 p-4 rounded-lg text-center">
                                            <p className="text-xs text-slate-500 uppercase">Due Amount</p>
                                            <p className="text-xl font-bold text-red-600">₹{customer.due}</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* Purchase History */}
                            {loadingOrders ? (
                                <div className="text-center py-8 text-slate-500">Loading history...</div>
                            ) : orders.length > 0 ? (
                                orders.map((order) => (
                                    <div key={order.id} className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                                        <div
                                            className="p-4 flex justify-between items-center cursor-pointer hover:bg-slate-50 transition-colors"
                                            onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
                                        >
                                            <div className="flex items-start gap-4">
                                                <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                                                    <ShoppingBag size={20} />
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-slate-900">Order #{order.id.slice(-6).toUpperCase()}</p>
                                                    <div className="flex items-center text-xs text-slate-500 gap-2 mt-1">
                                                        <Calendar size={12} />
                                                        <span>{new Date(order.date).toLocaleDateString()}</span>
                                                        <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                                                        <span>{order.items?.length || 0} Items</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="text-right">
                                                    {(() => {
                                                        const payments = order.payments || [];
                                                        const totalPaid = payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
                                                        const balance = Math.max(0, (order.total || 0) - totalPaid);
                                                        const isUnpaid = order.status === 'Unpaid' || order.status === 'Partially Paid' || (balance > 0 && order.status !== 'Paid');

                                                        return (
                                                            <>
                                                                <p className={`font-bold ${isUnpaid ? 'text-red-600' : 'text-slate-900'}`}>
                                                                    {isUnpaid ? `Due: ₹${balance.toFixed(2)}` : `₹${(order.total || 0).toFixed(2)}`}
                                                                </p>
                                                                <span className={`text-xs px-2 py-0.5 rounded-full ${order.status === 'Paid' ? 'bg-green-100 text-green-700' :
                                                                    order.status === 'Pending' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                                                                    }`}>
                                                                    {order.status || 'Paid'}
                                                                </span>
                                                            </>
                                                        );
                                                    })()}
                                                </div>
                                                <div className="text-slate-400">
                                                    {expandedOrder === order.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                                </div>
                                            </div>
                                        </div>

                                        {expandedOrder === order.id && (
                                            <div className="px-4 pb-4 border-t border-slate-100 bg-slate-50/50">
                                                <div className="py-3">
                                                    <table className="w-full text-sm">
                                                        <thead>
                                                            <tr className="text-slate-500 border-b border-slate-200">
                                                                <th className="text-left py-2 font-medium">Item</th>
                                                                <th className="text-center py-2 font-medium">Qty</th>
                                                                <th className="text-right py-2 font-medium">Price</th>
                                                                <th className="text-right py-2 font-medium">Total</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {order.items?.map((item, idx) => (
                                                                <tr key={idx} className="border-b border-slate-100 last:border-0">
                                                                    <td className="py-2 text-slate-700 font-medium">{item.name}</td>
                                                                    <td className="py-2 text-center text-slate-600">{item.quantity}</td>
                                                                    <td className="py-2 text-right text-slate-600">₹{item.price?.toFixed(2)}</td>
                                                                    <td className="py-2 text-right text-slate-900">₹{item.total?.toFixed(2)}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                        <tfoot>
                                                            <tr className="border-t border-slate-200">
                                                                <td colSpan="3" className="py-2 text-right text-slate-500 font-medium">Subtotal</td>
                                                                <td className="py-2 text-right text-slate-900">₹{order.subtotal?.toFixed(2)}</td>
                                                            </tr>
                                                            {order.tax > 0 && (
                                                                <tr>
                                                                    <td colSpan="3" className="py-1 text-right text-slate-500">Tax</td>
                                                                    <td className="py-1 text-right text-slate-900">₹{order.tax?.toFixed(2)}</td>
                                                                </tr>
                                                            )}
                                                            {order.discount > 0 && (
                                                                <tr>
                                                                    <td colSpan="3" className="py-1 text-right text-green-600">Discount</td>
                                                                    <td className="py-1 text-right text-green-600">-₹{order.discount?.toFixed(2)}</td>
                                                                </tr>
                                                            )}
                                                            <tr className="border-t border-slate-200">
                                                                <td colSpan="3" className="py-2 text-right font-bold text-slate-900">Grand Total</td>
                                                                <td className="py-2 text-right font-bold text-blue-600">₹{order.total?.toFixed(2)}</td>
                                                            </tr>
                                                            {(() => {
                                                                const payments = order.payments || [];
                                                                const totalPaid = payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
                                                                const balance = (order.total || 0) - totalPaid;

                                                                if (totalPaid > 0) {
                                                                    return (
                                                                        <tr>
                                                                            <td colSpan="3" className="py-1 text-right text-green-600 font-medium">Amount Paid</td>
                                                                            <td className="py-1 text-right text-green-600 font-medium">₹{totalPaid.toFixed(2)}</td>
                                                                        </tr>
                                                                    )
                                                                }
                                                                return null;
                                                            })()}
                                                            {(() => {
                                                                const payments = order.payments || [];
                                                                const totalPaid = payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
                                                                const balance = Math.max(0, (order.total || 0) - totalPaid);

                                                                // Show balance if Unpaid or Partially Paid
                                                                if (order.status === 'Unpaid' || order.status === 'Partially Paid' || balance > 0) {
                                                                    return (
                                                                        <tr className="bg-red-50">
                                                                            <td colSpan="3" className="py-2 text-right text-red-600 font-bold">Balance Due</td>
                                                                            <td className="py-2 text-right text-red-600 font-bold">₹{balance.toFixed(2)}</td>
                                                                        </tr>
                                                                    )
                                                                }
                                                                return null;
                                                            })()}
                                                        </tfoot>
                                                    </table>
                                                </div>
                                                <div className="flex justify-end pt-2">
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="h-8 text-xs border-blue-200 text-blue-600 hover:bg-blue-50 mr-2"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSelectedInvoice(order);
                                                            setIsInvoiceModalOpen(true);
                                                        }}
                                                    >
                                                        <Eye size={14} className="mr-1.5" /> View Details
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="h-8 text-xs border-blue-200 text-blue-600 hover:bg-blue-50"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            printReceipt(order, settings.invoice?.paperSize || '80mm', settings);
                                                        }}
                                                    >
                                                        <Printer size={14} className="mr-1.5" /> Print
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-10 flex flex-col items-center text-slate-500">
                                    <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-3 text-slate-400">
                                        <ShoppingBag size={24} />
                                    </div>
                                    <p>No purchase history found.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="pt-4 flex gap-3 border-t border-slate-100 mt-4">
                    {activeTab === 'details' && (
                        <>
                            <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
                            {!customer && (
                                <Button
                                    variant="outline"
                                    className="flex-1 border-blue-600 text-blue-600 hover:bg-blue-50"
                                    onClick={() => handleSave(true)}
                                >
                                    Save & Add Another
                                </Button>
                            )}
                            <Button className="flex-1" variant="primary" onClick={() => handleSave(false)}>
                                {customer ? 'Update Customer' : 'Save Customer'}
                            </Button>
                        </>
                    )}
                    {activeTab === 'history' && (
                        <Button variant="outline" className="w-full" onClick={() => setActiveTab('details')}>Back to Details</Button>
                    )}
                </div>
            </div>

            {/* Invoice Preview Modal */}
            <InvoicePreviewModal
                isOpen={isInvoiceModalOpen}
                onClose={() => setIsInvoiceModalOpen(false)}
                invoice={selectedInvoice}
            />
        </Drawer>
    );
};

export default CustomerDrawer;
