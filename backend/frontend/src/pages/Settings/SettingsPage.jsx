import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import {
    Store, Receipt, Calculator, Printer, Globe, Layout,
    Save, RotateCcw, Plus, Trash2, Eye, CheckCircle, FileText, Cloud, Upload, Image as ImageIcon, Landmark,
    Clock, Calendar, History, Download, RefreshCw, AlertTriangle
} from 'lucide-react';
import { useSettings } from '../../context/SettingsContext';
import { useToast } from '../../context/ToastContext';
import { cn } from '../../lib/utils';
import services from '../../services/api';
import { printReceipt } from '../../utils/printReceipt'
import { X } from 'lucide-react';
import PrinterList from './PrinterList';
import ConfirmationModal from '../../components/ui/ConfirmationModal';
import logoImage from '../../assets/logo.png';

const LivePreviewModal = ({ isOpen, onClose, settings }) => {
    // ESC key closes preview
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') { e.preventDefault(); onClose(); }
        };
        window.addEventListener('keydown', handleKeyDown, true);
        return () => window.removeEventListener('keydown', handleKeyDown, true);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const mockInvoice = {
        id: 'PRE-2024-001',
        date: new Date(),
        customerName: 'Rahul Sharma',
        customerPhone: '9876543210',
        customerAddress: '12, M.G. Road, Indiranagar, Bangalore',
        customerGstin: '29ABCDE1234F1Z5',
        items: [
            { name: 'Cotton Polo T-Shirt', quantity: 2, price: 799, total: 1598, taxRate: 5, hsnCode: '6105' },
            { name: 'Denim Jeans Slim Fit', quantity: 1, price: 1999, total: 1999, taxRate: 12, hsnCode: '6203' },
            { name: 'Leather Belt', quantity: 1, price: 499, total: 499, taxRate: 18, hsnCode: '4203' }
        ],
        subtotal: 4096,
        discount: 0,
        taxType: 'Intra-State',
        tax: 418.66, // Approx tax
        total: 4514.66,
        cgst: 209.33,
        sgst: 209.33
    };

    const isThermal = settings?.invoice?.paperSize === '80mm';
    const iframeWidth = isThermal ? "320px" : "850px";

    const htmlContent = printReceipt(mockInvoice, settings?.invoice?.paperSize || 'A4', settings, { preview: true });

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className={`bg-white rounded-lg shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col border border-slate-200 transition-all duration-300`}>
                <div className="flex justify-between items-center p-4 border-b bg-slate-50 rounded-t-lg">
                    <div>
                        <h3 className="font-bold text-lg text-slate-800">Invoice Preview</h3>
                        <p className="text-xs text-slate-500">Live preview of <b>{settings?.invoice?.template}</b> template</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500 hover:text-red-500">
                        <X size={20} />
                    </button>
                </div>
                <div className="flex-1 bg-slate-100/50 p-6 overflow-auto overflow-x-hidden flex justify-center">
                    <div className={`${isThermal ? '' : 'bg-white shadow-xl'}`}>
                        <iframe
                            title="Invoice Preview"
                            srcDoc={htmlContent}
                            style={{
                                border: 'none',
                                minHeight: '800px',
                                width: iframeWidth,
                                display: 'block'
                            }}
                            className="bg-transparent"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

const SettingsPage = () => {
    const { settings, updateSettings, saveSettings, refreshSettings, loading } = useSettings();
    const [activeTab, setActiveTab] = useState('store');
    const [unsavedChanges, setUnsavedChanges] = useState(false);
    const [showPreview, setShowPreview] = useState(false);

    const [taxGroups, setTaxGroups] = useState([]);
    const [logoPreview, setLogoPreview] = useState(null);
    const [showNavigationModal, setShowNavigationModal] = useState(false);
    const [pendingNavigationPath, setPendingNavigationPath] = useState(null);
    const toast = useToast();

    useEffect(() => {
        if (settings?.store?.logo) {
            setLogoPreview(settings.store.logo);
        }
    }, [settings?.store?.logo]);

    const handleLogoUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            // Validate size (2MB limit)
            if (file.size > 2 * 1024 * 1024) {
                toast.error("File is too large. Max size is 2MB.");
                return;
            }
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64String = reader.result;
                setLogoPreview(base64String);
                handleChange('store', 'logo', base64String);
            };
            reader.readAsDataURL(file);
        }
    };

    // Sync local state when settings load
    useEffect(() => {
        // Only sync if there are no unsaved changes locally
        // or if it's the initial load
        if (settings?.tax?.taxGroups && (!unsavedChanges || taxGroups.length === 0)) {
            setTaxGroups(settings.tax.taxGroups);
        }
    }, [settings, unsavedChanges]);

    // Navigation Guard for browser reload/close
    useEffect(() => {
        const handleBeforeUnload = (e) => {
            if (unsavedChanges) {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [unsavedChanges]);

    // Robust navigation guard for HashRouter settings
    const navigate = useNavigate();

    useEffect(() => {
        const handleNavigation = (e) => {
            if (!unsavedChanges) return;

            // Find the closest link or button
            const target = e.target.closest('a, button');
            if (!target) return;

            // Get the destination path
            const href = target.getAttribute('href') || target.getAttribute('data-to');
            if (!href) return;

            // Normalize path for HashRouter (#/billing -> /billing)
            const cleanPath = href.replace(/^#/, '');

            // Check if it's an external navigation (not within settings or empty)
            const isExternalNavigation = !cleanPath.includes('settings') && (
                cleanPath === '/' ||
                cleanPath.startsWith('/dashboard') ||
                cleanPath.startsWith('/billing') ||
                cleanPath.startsWith('/products') ||
                cleanPath.startsWith('/customers') ||
                cleanPath.startsWith('/invoices') ||
                cleanPath.startsWith('/reports') ||
                cleanPath.startsWith('/gst') ||
                cleanPath.startsWith('/expenses') ||
                cleanPath.startsWith('/barcode')
            );

            if (isExternalNavigation) {
                e.preventDefault();
                e.stopPropagation();
                setPendingNavigationPath(cleanPath);
                setShowNavigationModal(true);
            }
        };

        document.addEventListener('click', handleNavigation, true);
        return () => document.removeEventListener('click', handleNavigation, true);
    }, [unsavedChanges]);

    const handleSave = async () => {
        // Prepare payload (merge local states like taxGroups back into settings update)
        const payload = {
            ...settings,
            tax: {
                ...settings.tax,
                taxGroups: taxGroups
            },
            lastUpdatedAt: new Date()
        };

        try {
            await saveSettings(payload);
            setUnsavedChanges(false);
            toast.success("Settings saved successfully");
        } catch (error) {
            console.error("Failed to save settings", error);
            toast.error("Failed to save settings");
        }
    };

    // Helper to update deeply nested state in Context
    const handleChange = (section, field, value, subField = null) => {
        setUnsavedChanges(true);
        if (subField) {
            // e.g. store.address.city
            updateSettings(section, {
                [field]: {
                    ...(settings[section]?.[field] || {}),
                    [subField]: value
                }
            });
        } else {
            updateSettings(section, { [field]: value });
        }
    };

    // Tax Matrix Helpers
    const addTaxGroup = () => {
        const newGroup = {
            id: Date.now().toString(),
            name: 'New Tax Group',
            rate: 0,
            cgst: 0,
            sgst: 0,
            igst: 0,
            active: true
        };
        setTaxGroups([...taxGroups, newGroup]);
        setUnsavedChanges(true);
    };

    const updateTaxGroup = (id, field, value) => {
        const updated = taxGroups.map(g => {
            if (g.id === id) {
                const updatedGroup = { ...g, [field]: value };
                // Auto-calc breakdown if rate changes
                if (field === 'rate') {
                    const rate = parseFloat(value) || 0;
                    updatedGroup.igst = rate;
                    updatedGroup.cgst = rate / 2;
                    updatedGroup.sgst = rate / 2;
                }
                return updatedGroup;
            }
            return g;
        });
        setTaxGroups(updated);
        setUnsavedChanges(true);
    };

    const removeTaxGroup = (id) => {
        setTaxGroups(taxGroups.filter(g => g.id !== id));
        setUnsavedChanges(true);
    };

    const tabs = [
        { id: 'store', label: 'Store Profile', icon: Store },
        { id: 'tax', label: 'Tax & GST', icon: Calculator },
        { id: 'invoice', label: 'Invoice Design', icon: Layout },
        { id: 'print', label: 'Printer & Local', icon: Printer },
        { id: 'backup', label: 'Data Backup', icon: Cloud },
    ];

    const [backupLoading, setBackupLoading] = useState(false);
    const [backupStatus, setBackupStatus] = useState(null);
    const [backupHistory, setBackupHistory] = useState([
        { id: 1, timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), status: 'success', size: '2.4 MB' },
        { id: 2, timestamp: new Date(Date.now() - 26 * 60 * 60 * 1000), status: 'success', size: '2.3 MB' },
        { id: 3, timestamp: new Date(Date.now() - 50 * 60 * 60 * 1000), status: 'success', size: '2.2 MB' },
    ]);

    const handleBackup = async () => {
        setBackupLoading(true);
        try {
            const res = await services.backup.trigger();
            setBackupStatus({ success: true, timestamp: res.data.timestamp });
        } catch (err) {
            // Check for authentication errors
            const isAuthError = err.response?.status === 401 || err.response?.data?.authRequired;
            const errorMessage = err.response?.data?.error || err.message;

            setBackupStatus({
                success: false,
                error: errorMessage,
                authRequired: isAuthError
            });
        } finally {
            setBackupLoading(false);
        }
    };

    if (!settings) {
        return (
            <div className="flex flex-col items-center justify-center p-20 min-h-[50vh] animate-in fade-in duration-500">
                <div className="relative flex justify-center mb-6">
                    <img src={logoImage} alt="Kwiq Bill Logo" className="w-40 h-auto object-contain drop-shadow-md animate-pulse" />
                </div>
                <div className="flex gap-2 mb-2 text-slate-400">
                    <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)] animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.6)] animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 rounded-full bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.6)] animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
                <p className="text-slate-500 font-medium text-xs tracking-widest uppercase mt-4">
                    Loading Settings...
                </p>
            </div>
        );
    }
    const renderTabContent = () => {
        switch (activeTab) {
            case 'store':
                return (
                    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                        <Card>
                            <CardContent className="p-6 space-y-4">
                                <h3 className="text-lg font-semibold text-slate-800 border-b pb-2 mb-4">Basic Details</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Store Display Name</label>
                                        <Input value={settings.store.name || ''} onChange={(e) => handleChange('store', 'name', e.target.value)} />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Legal Business Name</label>
                                        <Input value={settings.store.legalName || ''} onChange={(e) => handleChange('store', 'legalName', e.target.value)} placeholder="As per GST Certificate" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Business Type</label>
                                        <select
                                            className="w-full h-10 rounded-md border border-slate-200 px-3 bg-white text-sm focus:ring-2 focus:ring-indigo-500"
                                            value={settings.store.businessType || 'Proprietorship'}
                                            onChange={(e) => handleChange('store', 'businessType', e.target.value)}
                                        >
                                            <option value="Proprietorship">Proprietorship</option>
                                            <option value="Partnership">Partnership</option>
                                            <option value="LLP">LLP</option>
                                            <option value="Private Limited">Private Limited</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Contact Number</label>
                                        <Input value={settings.store.contact || ''} onChange={(e) => handleChange('store', 'contact', e.target.value)} />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Email Address</label>
                                        <Input value={settings.store.email || ''} onChange={(e) => handleChange('store', 'email', e.target.value)} />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Website</label>
                                        <Input value={settings.store.website || ''} onChange={(e) => handleChange('store', 'website', e.target.value)} />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="p-6 space-y-4">
                                <h3 className="text-lg font-semibold text-slate-800 border-b pb-2 mb-4">Location & Address</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="col-span-2 space-y-2">
                                        <label className="text-sm font-medium">Street Address / Building</label>
                                        <Input value={settings.store.address?.street || ''} onChange={(e) => handleChange('store', 'address', e.target.value, 'street')} />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Area / Locality</label>
                                        <Input value={settings.store.address?.area || ''} onChange={(e) => handleChange('store', 'address', e.target.value, 'area')} />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">City</label>
                                        <Input value={settings.store.address?.city || ''} onChange={(e) => handleChange('store', 'address', e.target.value, 'city')} />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">State</label>
                                        <Input value={settings.store.address?.state || ''} onChange={(e) => handleChange('store', 'address', e.target.value, 'state')} />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Pincode</label>
                                        <Input value={settings.store.address?.pincode || ''} onChange={(e) => handleChange('store', 'address', e.target.value, 'pincode')} />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="p-6 space-y-4">
                                <h3 className="text-lg font-semibold text-slate-800 border-b pb-2 mb-4">Owner / User Profile</h3>
                                <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 mb-4">
                                    <p className="text-sm text-blue-800">
                                        👤 Information about the person using this software (you), not the store.
                                    </p>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Full Name</label>
                                        <Input
                                            value={settings.user?.fullName || ''}
                                            onChange={(e) => handleChange('user', 'fullName', e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Mobile Number</label>
                                        <Input
                                            value={settings.user?.mobile || ''}
                                            onChange={(e) => handleChange('user', 'mobile', e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Email Address</label>
                                        <Input
                                            type="email"
                                            value={settings.user?.email || ''}
                                            onChange={(e) => handleChange('user', 'email', e.target.value)}
                                        />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="p-6 space-y-4">
                                <h3 className="text-lg font-semibold text-slate-800 border-b pb-2 mb-4">Statutory Identifiers</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">FSSAI License No</label>
                                        <Input value={settings.store.fssai || ''} onChange={(e) => handleChange('store', 'fssai', e.target.value)} />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>


                        <Card>
                            <CardContent className="p-6 space-y-4">
                                <h3 className="text-lg font-semibold text-slate-800 border-b pb-2 mb-4">Bank Details</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Bank Name</label>
                                        <div className="relative">
                                            <Landmark className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                                            <Input
                                                className="pl-9"
                                                placeholder="e.g. HDFC Bank"
                                                value={settings.store.bankDetails?.bankName || ''}
                                                onChange={(e) => handleChange('store', 'bankDetails', e.target.value, 'bankName')}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Account Number</label>
                                        <Input
                                            value={settings.store.bankDetails?.accountNumber || ''}
                                            onChange={(e) => handleChange('store', 'bankDetails', e.target.value, 'accountNumber')}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">IFSC Code</label>
                                        <Input
                                            className="uppercase"
                                            value={settings.store.bankDetails?.ifscCode || ''}
                                            onChange={(e) => handleChange('store', 'bankDetails', e.target.value, 'ifscCode')}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Branch Name</label>
                                        <Input
                                            value={settings.store.bankDetails?.branch || ''}
                                            onChange={(e) => handleChange('store', 'bankDetails', e.target.value, 'branch')}
                                        />
                                    </div>
                                    <div className="space-y-2 col-span-2">
                                        <label className="text-sm font-medium">Account Holder Name</label>
                                        <Input
                                            placeholder="As per bank records"
                                            value={settings.store.bankDetails?.accountHolder || ''}
                                            onChange={(e) => handleChange('store', 'bankDetails', e.target.value, 'accountHolder')}
                                        />
                                    </div>
                                    <div className="space-y-2 col-span-2 border-t pt-2 mt-2">
                                        <label className="text-sm font-medium">Authorized Signatory Label</label>
                                        <Input
                                            placeholder="e.g. For My Store Name"
                                            value={settings.store.signatoryLabel || settings.store.name || ''}
                                            onChange={(e) => handleChange('store', 'signatoryLabel', e.target.value)}
                                        />
                                        <p className="text-xs text-slate-500">This will appear above the signature area on the invoice.</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div >
                );

            case 'tax':
                return (
                    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                        <Card>
                            <CardContent className="p-6 space-y-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="text-lg font-semibold text-slate-800">GST Configuration</h3>
                                        <p className="text-sm text-slate-500">Enable tax calculations and define your GSTIN</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" className="sr-only peer" checked={settings.tax.gstEnabled} onChange={(e) => handleChange('tax', 'gstEnabled', e.target.checked)} />
                                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-slate-900"></div>
                                    </label>
                                </div>

                                {settings.tax.gstEnabled && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t">
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">GSTIN</label>
                                            <Input className="uppercase font-mono" placeholder="22AAAAA0000A1Z5" value={settings.store.gstin || ''} onChange={(e) => handleChange('store', 'gstin', e.target.value)} />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Default Tax Preference</label>
                                            <div className="flex bg-slate-100 p-1 rounded-lg">
                                                {['Inclusive', 'Exclusive'].map(mode => (
                                                    <button
                                                        key={mode}
                                                        onClick={() => handleChange('tax', 'defaultType', mode)}
                                                        className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${settings.tax.defaultType === mode ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}
                                                    >
                                                        {mode} (Prices)
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Tax Matrix Editor */}
                        <Card>
                            <CardContent className="p-6">
                                <div className="flex justify-between items-center mb-4">
                                    <div>
                                        <h3 className="text-lg font-semibold text-slate-800">Tax Matrix</h3>
                                        <p className="text-sm text-slate-500">Define tax slabs used in products</p>
                                    </div>
                                    <Button size="sm" onClick={addTaxGroup} variant="outline"><Plus className="h-4 w-4 mr-2" /> Add Group</Button>
                                </div>

                                <div className="overflow-x-auto border rounded-xl">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-slate-50 text-slate-700 font-medium">
                                            <tr>
                                                <th className="px-4 py-3">Group Name</th>
                                                <th className="px-4 py-3 w-24">Rate (%)</th>
                                                <th className="px-4 py-3 w-24">CGST</th>
                                                <th className="px-4 py-3 w-24">SGST</th>
                                                <th className="px-4 py-3 w-24">IGST</th>
                                                <th className="px-4 py-3 w-16">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {taxGroups.map((group) => (
                                                <tr key={group.id} className="group hover:bg-slate-50/50">
                                                    <td className="px-4 py-2">
                                                        <Input className="h-8" value={group.name} onChange={(e) => updateTaxGroup(group.id, 'name', e.target.value)} />
                                                    </td>
                                                    <td className="px-4 py-2">
                                                        <Input className="h-8" type="number" value={group.rate} onChange={(e) => updateTaxGroup(group.id, 'rate', e.target.value)} />
                                                    </td>
                                                    <td className="px-4 py-2 text-slate-500">{group.cgst}%</td>
                                                    <td className="px-4 py-2 text-slate-500">{group.sgst}%</td>
                                                    <td className="px-4 py-2 text-slate-500">{group.igst}%</td>
                                                    <td className="px-4 py-2">
                                                        <button onClick={() => removeTaxGroup(group.id)} className="text-rose-400 hover:text-rose-600 transition-colors p-1">
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                            {taxGroups.length === 0 && (
                                                <tr><td colSpan="6" className="text-center py-6 text-slate-400">No tax groups defined. Add one to get started.</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                );

            case 'invoice':
                const templates = [
                    { id: 'Express', name: 'Express Receipt', type: 'Receipt', desc: 'Quick, bold receipts.' },
                    { id: 'Streamlined', name: 'Streamlined Receipt', type: 'Receipt', desc: 'Ultra-compact, minimal.' },
                    { id: 'Classic', name: 'Classic A4', type: 'A4', desc: 'Standard business layout.' },
                    { id: 'Compact', name: 'Professional', type: 'A4', desc: 'Corporate & elegant.' },
                    { id: 'GST-Detailed', name: 'GST Detailed', type: 'A4', desc: 'Detailed tax breakdown.' }
                ];

                return (
                    <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">

                        {/* Compact Header Banner */}
                        <div className="relative overflow-hidden rounded-xl bg-black p-5 text-white mb-4">
                            <div className="relative z-10 flex justify-between items-center">
                                <div>
                                    <h2 className="text-lg font-bold mb-1">Invoice Design</h2>
                                    <p className="text-xs text-slate-400">Choose a template and customize your brand.</p>
                                </div>
                                <Button variant="secondary" size="sm" onClick={() => setShowPreview(true)} className="bg-white text-slate-900 hover:bg-slate-100 border-0 h-8 text-xs">
                                    <Eye className="h-3 w-3 mr-2" /> Live Preview
                                </Button>
                            </div>
                            <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-indigo-500 rounded-full blur-3xl opacity-20"></div>
                        </div>

                        {/* Compact Store Logo */}
                        <Card className="mb-4">
                            <CardContent className="p-4">
                                <div className="flex flex-col md:flex-row items-center md:items-start gap-4">
                                    <div className="h-16 w-16 md:h-20 md:w-20 bg-slate-50 border-2 border-dashed border-slate-300 rounded-lg flex items-center justify-center overflow-hidden relative group shrink-0">
                                        {logoPreview ? (
                                            <img src={logoPreview} alt="Store Logo" className="w-full h-full object-contain p-1" />
                                        ) : (
                                            <div className="text-center p-1">
                                                <ImageIcon className="h-6 w-6 text-slate-300 mx-auto mb-0.5" />
                                                <span className="text-[9px] text-slate-400">No Logo</span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 text-center md:text-left">
                                        <h3 className="text-sm font-semibold text-slate-800">Store Logo</h3>
                                        <p className="text-xs text-slate-500 mb-3">Upload your store logo to display on invoices. Max 2MB.</p>
                                        <div className="flex flex-wrap justify-center md:justify-start gap-2">
                                            <label className="cursor-pointer bg-white border border-slate-300 px-3 py-1.5 rounded-md text-xs font-medium hover:bg-slate-50 text-slate-700 shadow-sm inline-flex items-center gap-1.5 transition-all">
                                                <Upload size={14} /> Upload
                                                <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} />
                                            </label>
                                            {logoPreview && (
                                                <button
                                                    onClick={() => { setLogoPreview(null); handleChange('store', 'logo', null); }}
                                                    className="px-3 py-1.5 text-xs font-medium text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-md transition-colors"
                                                >
                                                    Remove
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Compact Template Selection */}
                        <div className="mb-4">
                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">SELECT TEMPLATE</h3>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                                {templates.map((tmpl) => (
                                    <div
                                        key={tmpl.id}
                                        onClick={() => handleChange('invoice', 'template', tmpl.id)}
                                        className={`
                                            cursor-pointer border rounded-lg p-2.5 flex flex-col gap-2 transition-all relative overflow-hidden group
                                            ${settings.invoice.template === tmpl.id ? 'border-indigo-600 bg-indigo-50/50 ring-1 ring-indigo-600' : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'}
                                        `}
                                    >
                                        <div className="aspect-square bg-slate-50 rounded border border-slate-200 flex items-center justify-center mb-0.5 relative overflow-hidden group-hover:bg-slate-100 transition-colors">
                                            {/* Abstract Template Representation */}
                                            <div className="w-[40%] h-[40%] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.05)] flex flex-col p-[2px] gap-[1.5px]">
                                                <div className="h-[1.5px] w-1/3 bg-slate-200 rounded-full mb-[0.5px]"></div>
                                                <div className="space-y-[1px]">
                                                    <div className="h-[0.5px] w-full bg-slate-100 rounded-full"></div>
                                                    <div className="h-[0.5px] w-5/6 bg-slate-100 rounded-full"></div>
                                                    <div className="h-[0.5px] w-full bg-slate-100 rounded-full"></div>
                                                    <div className="h-[0.5px] w-4/6 bg-slate-100 rounded-full"></div>
                                                </div>
                                            </div>
                                            {settings.invoice.template === tmpl.id && (
                                                <div className="absolute inset-0 bg-indigo-500/10 flex items-center justify-center">
                                                    <div className="bg-indigo-600 rounded-full p-1 shadow-sm">
                                                        <CheckCircle className="h-3 w-3 text-white" />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        <div>
                                            <h4 className={`font-semibold text-xs ${settings.invoice.template === tmpl.id ? 'text-indigo-900' : 'text-slate-700'}`}>{tmpl.name}</h4>
                                            <p className="text-[9px] text-slate-500 mt-0.5 leading-tight">{tmpl.desc}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Bill Numbering */}
                        <Card>
                            <CardContent className="p-6">
                                <h3 className="text-lg font-semibold text-slate-800 mb-4">Bill Numbering</h3>
                                <div className="flex gap-6">
                                    <label className="flex items-center gap-2 cursor-pointer group">
                                        <div className="relative flex items-center">
                                            <input
                                                type="radio"
                                                name="billNumberResetPeriod"
                                                checked={settings.invoice?.billNumberResetPeriod === 'Daily'}
                                                onChange={() => handleChange('invoice', 'billNumberResetPeriod', 'Daily')}
                                                className="peer h-4 w-4 border-slate-300 text-slate-900 focus:ring-slate-900"
                                            />
                                        </div>
                                        <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900">Reset Daily</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer group">
                                        <div className="relative flex items-center">
                                            <input
                                                type="radio"
                                                name="billNumberResetPeriod"
                                                checked={settings.invoice?.billNumberResetPeriod === 'Monthly'}
                                                onChange={() => handleChange('invoice', 'billNumberResetPeriod', 'Monthly')}
                                                className="peer h-4 w-4 border-slate-300 text-slate-900 focus:ring-slate-900"
                                            />
                                        </div>
                                        <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900">Reset Monthly</span>
                                    </label>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Visual Options - 3 Column Layout */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* Header & Branding */}
                            <Card className="md:col-span-1">
                                <CardContent className="p-5 space-y-4">
                                    <div className="flex items-center gap-2 mb-2 text-slate-800 font-semibold border-b pb-2">
                                        <Store size={18} /> Header & Branding
                                    </div>



                                    {[
                                        { key: 'showLogo', label: 'Show Store Logo' },
                                        { key: 'showStoreAddress', label: 'Show Store Address' },
                                        { key: 'showCustomerGstin', label: "Show Customer's GSTIN" },
                                    ].map(opt => (
                                        <div key={opt.key} className="flex items-center justify-between">
                                            <span className="text-slate-600 text-sm">{opt.label}</span>
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    className="sr-only peer"
                                                    checked={settings.invoice[opt.key]}
                                                    onChange={(e) => handleChange('invoice', opt.key, e.target.checked)}
                                                />
                                                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-slate-900"></div>
                                            </label>
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>

                            {/* Item Details */}
                            <Card className="md:col-span-1">
                                <CardContent className="p-5 space-y-4">
                                    <div className="flex items-center gap-2 mb-2 text-slate-800 font-semibold border-b pb-2">
                                        <FileText size={18} /> Item Details
                                    </div>

                                    {[
                                        { key: 'showTaxGroupHeaders', label: 'Show Item Tax Group Headers' },
                                        { key: 'showHsn', label: 'Show HSN/SAC Codes' },
                                        { key: 'showMrp', label: 'Show MRP column' },
                                        { key: 'showDiscount', label: 'Show Discount column' },
                                        { key: 'showTaxBreakup', label: 'Show Tax Breakup' },
                                    ].map(opt => (
                                        <div key={opt.key} className="flex items-center justify-between">
                                            <span className="text-slate-600 text-sm">{opt.label}</span>
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    className="sr-only peer"
                                                    checked={settings.invoice[opt.key]}
                                                    onChange={(e) => handleChange('invoice', opt.key, e.target.checked)}
                                                />
                                                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-slate-900"></div>
                                            </label>
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>

                            {/* Footer & Misc */}
                            <Card className="md:col-span-1">
                                <CardContent className="p-5 space-y-4">
                                    <div className="flex items-center gap-2 mb-2 text-slate-800 font-semibold border-b pb-2">
                                        <Layout size={18} /> Footer & Misc
                                    </div>

                                    {[
                                        { key: 'showTerms', label: 'Terms & Conditions' },
                                        { key: 'showBankDetails', label: 'Show Bank Details' },
                                        { key: 'showSignature', label: 'Auth. Signature Box' },
                                    ].map(opt => (
                                        <div key={opt.key} className="flex items-center justify-between">
                                            <span className="text-slate-600 text-sm">{opt.label}</span>
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    className="sr-only peer"
                                                    checked={settings.invoice[opt.key]}
                                                    onChange={(e) => handleChange('invoice', opt.key, e.target.checked)}
                                                />
                                                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-slate-900"></div>
                                            </label>
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>
                        </div>

                        {/* GST Detailed Template Specifics */}
                        {settings.invoice.template === 'GST-Detailed' && (
                            <Card className="mb-6 animate-in slide-in-from-top-4 duration-300">
                                <CardContent className="p-6 space-y-4">
                                    <div className="flex items-center gap-2 mb-2 text-indigo-900 font-semibold border-b border-indigo-100 pb-2">
                                        <div className="p-1 bg-indigo-100 rounded">
                                            <FileText size={16} className="text-indigo-700" />
                                        </div>
                                        GST Detailed Settings
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-slate-700">Transport Mode</label>
                                            <select
                                                className="w-full h-10 rounded-md border border-slate-200 px-3 bg-white text-sm focus:ring-2 focus:ring-indigo-500"
                                                value={settings.invoice.transportMode || ''}
                                                onChange={(e) => handleChange('invoice', 'transportMode', e.target.value)}
                                            >
                                                <option value="">Select Mode</option>
                                                <option value="Road">Road</option>
                                                <option value="Rail">Rail</option>
                                                <option value="Air">Air</option>
                                                <option value="Ship">Ship</option>
                                            </select>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-slate-700">Vehicle Number</label>
                                            <Input
                                                placeholder="e.g. KA-01-AB-1234"
                                                value={settings.invoice.vehicleNumber || ''}
                                                onChange={(e) => handleChange('invoice', 'vehicleNumber', e.target.value)}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-slate-700">Place of Supply (Default)</label>
                                            <Input
                                                placeholder="e.g. 29-Karnataka"
                                                value={settings.invoice.placeOfSupply || ''}
                                                onChange={(e) => handleChange('invoice', 'placeOfSupply', e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Footer & Terms Input Section */}
                        <Card>
                            <CardContent className="p-6 space-y-6">
                                <h3 className="text-lg font-semibold text-slate-800 border-b pb-2">Footer & Terms</h3>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700">Terms & Conditions</label>
                                    <textarea
                                        className="w-full rounded-md border border-slate-200 p-3 text-sm focus:ring-2 focus:ring-slate-900 h-28 resize-none"
                                        value={settings.invoice.termsAndConditions || ''}
                                        onChange={(e) => handleChange('invoice', 'termsAndConditions', e.target.value)}
                                        placeholder="1. Goods once sold will not be taken back..."
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-slate-700">Footer Note</label>
                                        <Input
                                            value={settings.invoice.footerNote || ''}
                                            onChange={(e) => handleChange('invoice', 'footerNote', e.target.value)}
                                            placeholder="Thank you for your business!"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-slate-700">Authorized Signatory Label</label>
                                        <Input
                                            value={settings.store.signatoryLabel || ''}
                                            onChange={(e) => handleChange('store', 'signatoryLabel', e.target.value)}
                                            placeholder="e.g. For My Store"
                                        />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                );

            case 'print':
                const MOCK_INVOICE_FOR_PREVIEW = {
                    id: 'PRE-2024-001',
                    date: new Date(),
                    customerName: 'Rahul Sharma',
                    customerPhone: '9876543210',
                    customerAddress: '12, M.G. Road, Indiranagar, Bangalore',
                    customerGstin: '29ABCDE1234F1Z5',
                    items: [
                        { name: 'Cotton Polo T-Shirt', quantity: 2, price: 799, total: 1598, taxRate: 5, hsnCode: '6105' },
                        { name: 'Denim Jeans Slim Fit', quantity: 1, price: 1999, total: 1999, taxRate: 12, hsnCode: '6203' },
                        { name: 'Leather Belt', quantity: 1, price: 499, total: 499, taxRate: 18, hsnCode: '4203' }
                    ],
                    subtotal: 4096,
                    discount: 0,
                    taxType: 'Intra-State',
                    tax: 418.66,
                    total: 4514.66,
                    cgst: 209.33,
                    sgst: 209.33
                };

                const printSettings = settings.print || {};
                const invoiceSettings = settings.invoice || {};

                // Use printReceipt in preview mode
                // We pass merged settings to simulate the final print output
                const previewHtml = printReceipt(
                    MOCK_INVOICE_FOR_PREVIEW,
                    invoiceSettings.paperSize || 'A4',
                    { ...settings, print: printSettings, invoice: invoiceSettings },
                    { preview: true }
                );

                return (
                    <div className="h-[calc(100vh-140px)] flex animate-in slide-in-from-right-4 duration-300">
                        {/* Sidebar: Settings Controls (Left - 350px fixed) */}
                        <div className="w-[350px] bg-slate-50 border-r border-slate-200 flex flex-col h-full overflow-y-auto">
                            <div className="p-4 border-b border-slate-200 bg-white sticky top-0 z-10">
                                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-1">
                                    <Printer className="h-5 w-5 text-black" />
                                    Print
                                </h3>
                                <p className="text-xs text-slate-500">Configure layout & printer defaults</p>
                            </div>

                            <div className="p-4 space-y-6">
                                {/* Main Action: PROPOSE PRINT */}
                                <div className="space-y-2">
                                    <Button
                                        className="w-full bg-black hover:bg-slate-800 text-white h-12 text-lg shadow-lg shadow-slate-200"
                                        onClick={() => window.print()}
                                    >
                                        <Printer className="mr-2 h-5 w-5" /> Test Print
                                    </Button>
                                    <p className="text-[10px] text-slate-500 text-center leading-tight px-2">
                                        Use this button to <b>test</b> your current layout settings. <br />
                                        These settings (Paper Size, Margins, etc.) will be automatically applied to <b>all future bills</b> generated in the Billing section.
                                    </p>
                                </div>

                                {/* Printer Selection */}
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-slate-700">Printer</label>
                                    {/* Printer List Component */}
                                    <PrinterList
                                        selectedPrinter={printSettings.printerName}
                                        onSelect={(name) => handleChange('print', 'printerName', name)}
                                        settings={settings}
                                        saveSettings={saveSettings}
                                    />
                                    <div className="mt-2 flex items-center justify-between">
                                        <label className="text-xs text-slate-600 cursor-pointer flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                checked={printSettings.silentPrint || false}
                                                onChange={(e) => handleChange('print', 'silentPrint', e.target.checked)}
                                                className="rounded border-slate-300 text-black focus:ring-black w-3.5 h-3.5"
                                            />
                                            Silent Print
                                        </label>
                                    </div>
                                </div>
                                <p className="text-[10px] text-slate-400">
                                    *Silent print skips dialog. Configure default printer in OS settings.
                                </p>
                            </div>

                            <div className="border-t border-slate-200 my-2"></div>

                            {/* Settings Group */}
                            <div className="space-y-4">
                                {/* Copies */}
                                {/* <div className="space-y-1">
                                        <label className="text-xs font-semibold text-slate-500 uppercase">Copies</label>
                                        <div className="flex items-center border border-slate-200 rounded-md bg-white">
                                            <input
                                                type="number"
                                                min="1"
                                                max="10"
                                                className="w-full h-9 px-3 text-sm focus:outline-none focus:ring-0 border-0"
                                                value={1}
                                                disabled
                                            />
                                            <span className="px-3 text-xs text-slate-400 bg-slate-50 h-9 flex items-center border-l">Default</span>
                                        </div>
                                    </div> */}

                                {/* Paper Size */}
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-slate-500 uppercase">Paper Size</label>
                                    <select
                                        className="w-full h-9 rounded-md border border-slate-200 px-3 bg-white text-sm focus:ring-2 focus:ring-black shadow-sm"
                                        value={invoiceSettings.paperSize || 'A4'}
                                        onChange={(e) => handleChange('invoice', 'paperSize', e.target.value)}
                                    >
                                        <option value="A4">A4 (210mm x 297mm)</option>
                                        <option value="A5">A5 (148mm x 210mm)</option>
                                        <option value="Thermal-3inch">Thermal 3" (80mm)</option>
                                        <option value="Thermal-2inch">Thermal 2" (58mm)</option>
                                    </select>
                                </div>

                                {/* Orientation */}
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-slate-500 uppercase">Orientation</label>
                                    <select
                                        className="w-full h-9 rounded-md border border-slate-200 px-3 bg-white text-sm focus:ring-2 focus:ring-black shadow-sm"
                                        value={printSettings.orientation || 'portrait'}
                                        onChange={(e) => handleChange('print', 'orientation', e.target.value)}
                                    >
                                        <option value="portrait">Portrait (Vertical)</option>
                                        <option value="landscape">Landscape (Horizontal)</option>
                                    </select>
                                </div>

                                {/* Margins */}
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <label className="text-xs font-semibold text-slate-500 uppercase">Margins (mm)</label>
                                        {/* <span className="text-[10px] text-black cursor-pointer hover:underline" onClick={() => handleChange('print', 'margins', { top: 0, right: 0, bottom: 0, left: 0 })}>Reset</span> */}
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
                                        <div className="space-y-1">
                                            <span className="text-[10px] text-slate-400 block text-center">Top</span>
                                            <Input
                                                type="number"
                                                className="h-7 text-center text-sm px-1 focus:ring-black"
                                                value={printSettings.margins?.top || 0}
                                                onChange={(e) => handleChange('print', 'margins', e.target.value, 'top')}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-[10px] text-slate-400 block text-center">Bottom</span>
                                            <Input
                                                type="number"
                                                className="h-7 text-center text-sm px-1 focus:ring-black"
                                                value={printSettings.margins?.bottom || 0}
                                                onChange={(e) => handleChange('print', 'margins', e.target.value, 'bottom')}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-[10px] text-slate-400 block text-center">Left</span>
                                            <Input
                                                type="number"
                                                className="h-7 text-center text-sm px-1 focus:ring-black"
                                                value={printSettings.margins?.left || 0}
                                                onChange={(e) => handleChange('print', 'margins', e.target.value, 'left')}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-[10px] text-slate-400 block text-center">Right</span>
                                            <Input
                                                type="number"
                                                className="h-7 text-center text-sm px-1 focus:ring-black"
                                                value={printSettings.margins?.right || 0}
                                                onChange={(e) => handleChange('print', 'margins', e.target.value, 'right')}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Scale */}
                                <div className="space-y-1">
                                    <div className="flex justify-between">
                                        <label className="text-xs font-semibold text-slate-500 uppercase">Scale</label>
                                        <span className="text-xs text-slate-600">{printSettings.scale || 100}%</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="50"
                                        max="150"
                                        step="5"
                                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-black"
                                        value={printSettings.scale || 100}
                                        onChange={(e) => handleChange('print', 'scale', e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>


                        {/* Preview Area (Right - Fluid flex-1) */}
                        <div className="flex-1 bg-slate-200/50 flex flex-col h-full overflow-hidden relative">
                            {/* Preview Header / Pagination (fake) */}
                            <div className="h-10 bg-white border-b border-slate-200 flex items-center justify-between px-4">
                                <span className="text-xs font-medium text-slate-500">Preview: Page 1 of 1</span>
                                <div className="flex items-center gap-2">
                                    <button className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600"><Printer size={14} /></button>
                                </div>
                            </div>

                            {/* The actual "Paper" canvas area */}
                            <div className="flex-1 overflow-auto p-8 flex justify-center items-start">
                                <div
                                    className="bg-white shadow-xl transition-all duration-300 origin-top"
                                    style={{
                                        // Dynamic sizing based on selection
                                        width: invoiceSettings.paperSize === 'A4' ? '210mm' :
                                            invoiceSettings.paperSize === 'A5' ? '148mm' :
                                                invoiceSettings.paperSize?.includes('Thermal-3inch') ? '80mm' : '58mm',
                                        minHeight: invoiceSettings.paperSize === 'A4' ? '297mm' :
                                            invoiceSettings.paperSize === 'A5' ? '210mm' : 'auto',
                                        // transform: `scale(${printSettings.scale ? printSettings.scale / 100 : 1})`, // Visual scaling only
                                        paddingTop: `${printSettings.margins?.top || 0}mm`,
                                        paddingBottom: `${printSettings.margins?.bottom || 0}mm`,
                                        paddingLeft: `${printSettings.margins?.left || 0}mm`,
                                        paddingRight: `${printSettings.margins?.right || 0}mm`,
                                        // Orientation visual hack (simple rotation or width swap)
                                        // For true print orientation, @media print CSS is needed.
                                    }}
                                >
                                    {/* Render the HTML content safely */}
                                    <iframe
                                        srcDoc={previewHtml}
                                        title="Print Preview"
                                        className="w-full h-full min-h-[500px] border-none"
                                        style={{
                                            // Ensure iframe content scales if needed or just fits
                                            pointerEvents: 'none', // Prevent interaction inside preview
                                            overflow: 'hidden'
                                        }}
                                    // We use scrolling="no" and let the container handle scroll?
                                    // Actually better to let iframe expand to content height if thermal
                                    />
                                </div>
                            </div>
                        </div>
                    </div >
                );
            case 'backup':
                // Calculate next backup time based on settings
                const calculateNextBackup = () => {
                    const backupSettings = settings.backup || { enabled: false, frequency: 'Daily', time: '02:00' };
                    if (!backupSettings.enabled) return null;
                    const now = new Date();
                    const [hours, minutes] = (backupSettings.time || '02:00').split(':');
                    const next = new Date();
                    next.setHours(parseInt(hours), parseInt(minutes), 0, 0);

                    if (backupSettings.frequency === 'Daily') {
                        if (next <= now) next.setDate(next.getDate() + 1);
                    } else if (backupSettings.frequency === 'Weekly') {
                        if (next <= now) next.setDate(next.getDate() + 7);
                    } else if (backupSettings.frequency === 'Every 12 hours') {
                        next.setHours(now.getHours() + 12);
                    } else if (backupSettings.frequency === 'Every 6 hours') {
                        next.setHours(now.getHours() + 6);
                    }

                    return next;
                };

                const nextBackup = calculateNextBackup();
                const formatRelativeTime = (date) => {
                    if (!date) return '';
                    const now = new Date();
                    const diff = date - now;
                    const hours = Math.floor(diff / (1000 * 60 * 60));
                    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

                    if (hours < 1) return `in ${minutes} minutes`;
                    if (hours < 24) return `in ${hours} hour${hours > 1 ? 's' : ''}`;
                    const days = Math.floor(hours / 24);
                    return `in ${days} day${days > 1 ? 's' : ''}`;
                };

                return (
                    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                        {/* Header Banner */}
                        <div className="relative overflow-hidden rounded-xl bg-black p-6 text-white">
                            <div className="relative z-10">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                                        <Cloud className="h-6 w-6" />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold">Data Backup & Recovery</h2>
                                        <p className="text-sm text-emerald-50">Secure your business data automatically</p>
                                    </div>
                                </div>
                            </div>
                            <div className="absolute top-0 right-0 -mt-4 -mr-4 w-32 h-32 bg-emerald-400 rounded-full blur-3xl opacity-30"></div>
                        </div>

                        {/* Automatic Backup Configuration */}
                        <Card>
                            <CardContent className="p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-emerald-50 rounded-lg">
                                            <RefreshCw className="h-5 w-5 text-emerald-600" />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-semibold text-slate-800">Automatic Backup</h3>
                                            <p className="text-sm text-slate-500">Schedule regular backups to Google Drive</p>
                                        </div>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            className="sr-only peer"
                                            checked={settings.backup?.enabled}
                                            onChange={(e) => handleChange('backup', 'enabled', e.target.checked)}
                                        />
                                        <div className="w-14 h-7 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-emerald-600"></div>
                                    </label>
                                </div>

                                {settings.backup?.enabled && (
                                    <div className="space-y-4 pt-4 border-t animate-in slide-in-from-top-2 duration-300">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {/* Frequency Selector */}
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                                                    <Calendar className="h-4 w-4 text-slate-400" />
                                                    Backup Frequency
                                                </label>
                                                <select
                                                    className="w-full h-10 rounded-lg border border-slate-200 px-3 bg-white text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 shadow-sm"
                                                    value={settings.backup?.frequency || 'Daily'}
                                                    onChange={(e) => handleChange('backup', 'frequency', e.target.value)}
                                                >
                                                    <option value="Every 6 hours">Every 6 hours</option>
                                                    <option value="Every 12 hours">Every 12 hours</option>
                                                    <option value="Daily">Daily</option>
                                                    <option value="Weekly">Weekly</option>
                                                </select>
                                            </div>

                                            {/* Time Picker */}
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                                                    <Clock className="h-4 w-4 text-slate-400" />
                                                    Preferred Time
                                                </label>
                                                <input
                                                    type="time"
                                                    className="w-full h-10 rounded-lg border border-slate-200 px-3 bg-white text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 shadow-sm"
                                                    value={settings.backup?.time || '02:00'}
                                                    onChange={(e) => handleChange('backup', 'time', e.target.value)}
                                                />
                                            </div>
                                        </div>

                                        {/* Next Backup Info */}
                                        {nextBackup && (
                                            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-center gap-3">
                                                <Clock className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                                                <div className="flex-1">
                                                    <p className="text-sm font-medium text-emerald-900">Next Backup Scheduled</p>
                                                    <p className="text-xs text-emerald-700 mt-0.5">
                                                        {nextBackup.toLocaleString()} ({formatRelativeTime(nextBackup)})
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Manual Backup */}
                        <Card>
                            <CardContent className="p-6">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="p-2 bg-blue-50 rounded-lg">
                                        <Download className="h-5 w-5 text-blue-600" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-semibold text-slate-800">Manual Backup</h3>
                                        <p className="text-sm text-slate-500">Create an immediate backup to Google Drive</p>
                                    </div>
                                </div>

                                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <p className={`text-sm font-medium ${backupStatus?.success ? 'text-emerald-700' : 'text-slate-700'}`}>
                                                    {backupStatus?.success ? '✓ Last Backup Successful' : 'Ready to Backup'}
                                                </p>
                                            </div>
                                            <p className="text-xs text-slate-500">
                                                {backupStatus?.timestamp
                                                    ? `${new Date(backupStatus.timestamp).toLocaleString()}`
                                                    : 'No recent backup'}
                                            </p>
                                        </div>
                                        <Button
                                            onClick={handleBackup}
                                            disabled={backupLoading}
                                            className="bg-black text-white shadow-sm min-w-[140px]"
                                        >
                                            {backupLoading ? (
                                                <>
                                                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                                    Backing up...
                                                </>
                                            ) : (
                                                <>
                                                    <Download className="h-4 w-4 mr-2" />
                                                    Backup Now
                                                </>
                                            )}
                                        </Button>
                                    </div>

                                    {/* Error Display */}
                                    {backupStatus?.success === false && (
                                        <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-lg animate-in slide-in-from-top-2 duration-200">
                                            <p className="text-sm font-medium text-rose-800 flex items-center gap-2">
                                                {backupStatus.authRequired ? '⚠️ Authentication Required' : '❌ Backup Failed'}
                                            </p>
                                            <p className="text-xs text-rose-600 mt-1">
                                                {backupStatus.error || "Check internet connection or re-login."}
                                            </p>
                                            {backupStatus.authRequired && (
                                                <p className="text-xs text-rose-700 mt-2 font-medium">
                                                    → Please log out and log back in to restore backup functionality.
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Backup History */}
                        <Card>
                            <CardContent className="p-6">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="p-2 bg-indigo-50 rounded-lg">
                                        <History className="h-5 w-5 text-indigo-600" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-semibold text-slate-800">Backup History</h3>
                                        <p className="text-sm text-slate-500">Recent backup activity</p>
                                    </div>
                                </div>

                                <div className="border border-slate-200 rounded-lg overflow-hidden">
                                    <table className="w-full text-sm">
                                        <thead className="bg-slate-50 border-b border-slate-200">
                                            <tr>
                                                <th className="text-left px-4 py-3 font-medium text-slate-700">Date & Time</th>
                                                <th className="text-left px-4 py-3 font-medium text-slate-700">Status</th>
                                                <th className="text-right px-4 py-3 font-medium text-slate-700">Size</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {backupHistory.length > 0 ? (
                                                backupHistory.map((backup) => (
                                                    <tr key={backup.id} className="hover:bg-slate-50 transition-colors">
                                                        <td className="px-4 py-3 text-slate-700">
                                                            {new Date(backup.timestamp).toLocaleString()}
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            {backup.status === 'success' ? (
                                                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-700 rounded-md text-xs font-medium">
                                                                    <CheckCircle className="h-3 w-3" />
                                                                    Success
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-rose-50 text-rose-700 rounded-md text-xs font-medium">
                                                                    ✕ Failed
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3 text-right text-slate-600 font-mono text-xs">
                                                            {backup.size}
                                                        </td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan="3" className="px-4 py-8 text-center text-slate-400">
                                                        No backup history available
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Info Card */}
                        <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg flex gap-3 text-sm text-blue-900">
                            <CheckCircle className="h-5 w-5 flex-shrink-0 text-blue-600" />
                            <div>
                                <p className="font-semibold mb-1">Local-First Security</p>
                                <p className="text-blue-800 leading-relaxed">
                                    Your main database is always on this computer. Google Drive only holds encrypted JSON copies for emergency recovery.
                                    Backups are stored in the <code className="bg-blue-100 px-1.5 py-0.5 rounded text-xs font-mono">/BillingSoftware</code> folder.
                                </p>
                            </div>
                        </div>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="min-h-screen bg-slate-50/50 pb-10">
            {/* Header - Sticky */}
            <div className="sticky top-0 z-50 bg-white border-b border-slate-200 px-4 sm:px-6 py-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shadow-sm ">
                <div className="flex items-center gap-3 flex-wrap">
                    <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Settings</h1>
                    {settings.onboardingCompletedAt && (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                            Profile completed
                        </Badge>
                    )}
                    {unsavedChanges && (
                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] uppercase font-bold tracking-wider animate-pulse flex items-center gap-1">
                            <AlertTriangle size={10} /> Unsaved Changes
                        </Badge>
                    )}
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                    <Button variant="ghost" onClick={refreshSettings} className="flex-1 sm:flex-none hover:bg-slate-100 text-slate-600">
                        <RotateCcw className="h-4 w-4 mr-2" /> Reset
                    </Button>
                    <Button onClick={handleSave} className="bg-slate-900 hover:bg-slate-800 text-white shadow-md shadow-slate-200 flex-1 sm:flex-none">
                        <Save className="h-4 w-4 mr-2" /> Save Changes
                    </Button>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-6">
                {/* Horizontal Navigation - Now Not Sticky (Header above is sticky) */}
                <div className="bg-slate-100/50 border-b border-slate-200 px-4 sm:px-6 pt-4 pb-0 -mx-4 sm:-mx-6 mb-6">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4 max-w-7xl mx-auto">
                        <div className="flex flex-row gap-1 overflow-x-auto w-full md:w-auto no-scrollbar">
                            {tabs.map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`
                                    flex items-center gap-2 px-4 py-2.5 rounded-t-lg text-sm font-medium transition-all whitespace-nowrap border-b-2
                                    ${activeTab === tab.id
                                            ? 'border-slate-900 text-slate-900 bg-white'
                                            : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'}
                                `}
                                >
                                    <tab.icon size={16} />
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                        <div className="hidden md:block text-right pb-2">
                            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">System v2.4.0</p>
                        </div>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="min-h-[600px]">
                    {renderTabContent()}
                </div>
            </div>
            <LivePreviewModal isOpen={showPreview} onClose={() => setShowPreview(false)} settings={settings} />

            {/* Navigation Confirmation Modal */}
            <ConfirmationModal
                isOpen={showNavigationModal}
                onClose={() => {
                    setShowNavigationModal(false);
                    setPendingNavigationPath(null);
                }}
                onConfirm={async () => {
                    // Save changes and navigate
                    try {
                        const payload = {
                            ...settings,
                            tax: {
                                ...settings.tax,
                                taxGroups: taxGroups
                            },
                            lastUpdatedAt: new Date()
                        };
                        await saveSettings(payload);
                        setUnsavedChanges(false);
                        toast.success("Settings saved successfully");

                        // Proceed with navigation
                        if (pendingNavigationPath) {
                            navigate(pendingNavigationPath);
                        }

                    } catch (error) {
                        console.error("Failed to save settings", error);
                        toast.error("Failed to save settings");
                    } finally {
                        setShowNavigationModal(false);
                        setPendingNavigationPath(null);
                    }
                }}
                onCancel={async () => {
                    // Discard changes and stay on settings page
                    try {
                        await refreshSettings();
                        setUnsavedChanges(false);
                        setShowNavigationModal(false);
                        setPendingNavigationPath(null);
                        // Do NOT navigate - stay on settings page
                    } catch (error) {
                        console.error("Failed to discard changes", error);
                        toast.error("Failed to discard changes properly");
                    }
                }}

                title="Unsaved Changes"
                message="You have unsaved changes. What would you like to do?"
                confirmText="Save & Leave"
                cancelText="Discard Changes"
                showCancel={true}
                variant="primary"
            />

        </div>
    );
};

export default SettingsPage;

