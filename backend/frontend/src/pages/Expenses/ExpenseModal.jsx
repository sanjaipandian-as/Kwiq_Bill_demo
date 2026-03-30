import { syncService } from '../../services/syncService';
import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { TagsInput } from '../../components/ui/TagsInput';
import { FileUpload } from '../../components/ui/FileUpload';
import { PAYMENT_METHODS, RECURRING_FREQUENCIES, SAMPLE_CATEGORIES, COMMON_TAGS } from '../../utils/expenseConstants';
import { useExpenses } from '../../context/ExpenseContext';
import ConfirmationModal from '../../components/ui/ConfirmationModal';
import { Upload, X, FileText, ExternalLink, Image as ImageIcon, AlertCircle, Calendar, Activity } from 'lucide-react';

const ExpenseModal = ({ isOpen, onClose, expense = null, readOnly = false }) => {
    const { addExpense, updateExpense, uploadReceipt } = useExpenses();
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
    const [showReceiptConfirmation, setShowReceiptConfirmation] = useState(false);

    // Populate form when editing
    useEffect(() => {
        if (expense) {
            setFormData({
                title: expense.title || '',
                amount: expense.amount || '',
                category: expense.category || '',
                date: expense.date ? new Date(expense.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                description: expense.description || '',
                paymentMethod: expense.paymentMethod || 'Cash',
                reference: expense.reference || '',
                tags: expense.tags || [],
                isRecurring: expense.isRecurring || false,
                frequency: expense.frequency || 'one-time',
                nextDueDate: expense.nextDueDate ? new Date(expense.nextDueDate).toISOString().split('T')[0] : ''
            });
        } else {
            // Reset form for new expense
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
            setReceiptFile(null);
        }
    }, [expense, isOpen]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleReceiptChange = () => {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*,.pdf';
        fileInput.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                setReceiptFile(file);
            }
        };
        fileInput.click();
    };

    const handleSubmit = async () => {
        if (!formData.title || !formData.amount || !formData.category) {
            if (window.electron && window.electron.showAlert) {
                await window.electron.showAlert('Please fill in all required fields', 'warning');
            } else {
                alert('Please fill in all required fields');
            }
            return;
        }

        setIsSubmitting(true);
        try {
            // Clean data - convert empty strings to undefined for optional fields
            const cleanedData = {
                title: formData.title,
                amount: formData.amount,
                category: formData.category,
                date: formData.date,
                description: formData.description || '',
                paymentMethod: formData.paymentMethod,
                reference: formData.reference || '',
                tags: formData.tags.length > 0 ? formData.tags : [],
                isRecurring: formData.isRecurring,
                frequency: formData.frequency,
                nextDueDate: formData.nextDueDate || '',
            };

            let finalExpense = null;
            let eventType = '';

            if (isEditMode) {
                // Update existing expense
                const updated = await updateExpense(expense.id, cleanedData);
                finalExpense = updated;

                // Check if we need to emit an adjustment event
                if (updated._syncInfo && Math.abs(updated._syncInfo.delta) > 0.001) {
                    eventType = 'EXPENSE_ADJUSTED';
                    // Re-structure payload for the event
                    finalExpense = {
                        expenseId: updated.id,
                        delta: updated._syncInfo.delta,
                        reason: updated._syncInfo.reason || 'Edit'
                    };
                } else {
                    // Metadata update only - strict mode says REMOVE EXPENSE_UPDATED.
                    // We will NOT emit an event for pure metadata changes to be safe with "Removal".
                    // Or we could verify if user wants metadata sync. 
                    // Given "Offline-first billing app... expense updates overwrite ... unsafe for accounting",
                    // The focus is accounting safety. 
                    // I will Skip emitting event if no amount change, or emit dummy adjustment?
                    // "Edit Expense" UI is kept.
                    // For now, I'll set eventType to null to skip upload if no financial change.
                    eventType = null;
                }

                // Upload receipt if new file selected
                if (receiptFile) {
                    const uploadRes = await uploadReceipt(updated.id, receiptFile);
                    // Receipt upload isn't part of event connection yet
                }
            } else {
                // Create new expense
                const newExpense = await addExpense(cleanedData);
                finalExpense = newExpense;
                eventType = 'EXPENSE_CREATED';

                // Upload receipt if file selected
                if (receiptFile) {
                    const uploadRes = await uploadReceipt(newExpense.id, receiptFile);
                    finalExpense = { ...newExpense, receiptUrl: uploadRes.receiptUrl };
                }
            }

            // TRIGGER SYNC EVENT
            try {
                if (finalExpense) {
                    await syncService.uploadEvent(eventType, finalExpense);
                    console.log(`Expense Sync Event (${eventType}) Uploaded`);
                }
            } catch (syncError) {
                console.error("Failed to upload sync event (Expense saved locally):", syncError);
            }

            onClose();
        } catch (error) {
            if (window.electron && window.electron.showAlert) {
                await window.electron.showAlert(`Failed to ${isEditMode ? 'update' : 'save'} expense: ${error.message}`, 'error');
            } else {
                alert(`Failed to ${isEditMode ? 'update' : 'save'} expense: ${error.message}`);
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
            <Modal
                isOpen={isOpen}
                onClose={onClose}
                title={readOnly ? 'Expense Details' : (isEditMode ? 'Edit Expense' : 'Add New Expense')}
            >
                {readOnly ? (
                    /* Modern Read-Only View */
                    <div className="space-y-6 max-h-[75vh] overflow-y-auto pr-2 scrollbar-hide">
                        {/* Hero Section with Amount */}
                        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-red-600 via-red-500 to-orange-500 p-6 text-white shadow-lg">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16" />
                            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full -ml-12 -mb-12" />
                            <div className="relative">
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex-1">
                                        <p className="text-white/80 text-sm font-medium mb-1">Expense Amount</p>
                                        <h2 className="text-4xl font-bold">₹{parseFloat(formData.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h2>
                                    </div>
                                    <div className="bg-white/20 backdrop-blur-sm px-3 py-1.5 rounded-full">
                                        <span className="text-xs font-semibold">{formData.paymentMethod}</span>
                                    </div>
                                </div>
                                <h3 className="text-xl font-semibold">{formData.title}</h3>
                            </div>
                        </div>

                        {/* Details Grid */}
                        <div className="grid grid-cols-2 gap-4">
                            {/* Category */}
                            <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-4 border border-slate-200">
                                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Category</p>
                                <div className="flex items-center gap-2">
                                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-700">
                                        {formData.category || 'Uncategorized'}
                                    </span>
                                </div>
                            </div>

                            {/* Date */}
                            <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-4 border border-slate-200">
                                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Date</p>
                                <div className="flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-slate-600" />
                                    <span className="text-slate-900 font-medium text-sm">
                                        {new Date(formData.date).toLocaleDateString('en-IN', {
                                            day: 'numeric',
                                            month: 'short',
                                            year: 'numeric'
                                        })}
                                    </span>
                                </div>
                            </div>

                            {/* Reference */}
                            {formData.reference && (
                                <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-4 border border-slate-200 col-span-2">
                                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Reference / Bill No.</p>
                                    <p className="text-slate-900 font-mono text-sm">{formData.reference}</p>
                                </div>
                            )}
                        </div>

                        {/* Tags */}
                        {formData.tags && formData.tags.length > 0 && (
                            <div className="bg-white rounded-xl p-4 border border-slate-200">
                                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Tags</p>
                                <div className="flex flex-wrap gap-2">
                                    {formData.tags.map((tag, idx) => (
                                        <span key={idx} className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700 border border-purple-200">
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Recurring Badge */}
                        {formData.isRecurring && (
                            <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl p-4 border border-emerald-200">
                                <div className="flex items-center gap-3">
                                    <div className="bg-emerald-500 rounded-full p-2">
                                        <Activity className="w-5 h-5 text-white" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm font-semibold text-emerald-900">Recurring Expense</p>
                                        <p className="text-xs text-emerald-700">
                                            Frequency: <span className="font-medium">{formData.frequency}</span>
                                            {formData.nextDueDate && (
                                                <> • Next due: <span className="font-medium">{new Date(formData.nextDueDate).toLocaleDateString('en-IN')}</span></>
                                            )}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Description */}
                        {formData.description && (
                            <div className="bg-white rounded-xl p-4 border border-slate-200">
                                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Notes</p>
                                <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-wrap">{formData.description}</p>
                            </div>
                        )}

                        {/* Receipt Preview */}
                        <div className="bg-white rounded-xl p-4 border border-slate-200">
                            <div className="flex items-center gap-2 mb-3">
                                <FileText className="w-4 h-4 text-slate-600" />
                                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Receipt Attachment</p>
                            </div>

                            {expense?.receiptUrl ? (
                                <div className="space-y-3">
                                    <div className="aspect-video bg-slate-50 rounded-lg border border-slate-200 overflow-hidden group relative">
                                        {(() => {
                                            const fullUrl = expense.receiptUrl.startsWith('http') || expense.receiptUrl.startsWith('data:')
                                                ? expense.receiptUrl
                                                : `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}${expense.receiptUrl.startsWith('/') ? '' : '/'}${expense.receiptUrl}`;
                                            const isPdf = expense.receiptUrl.toLowerCase().includes('.pdf') || expense.receiptUrl.startsWith('data:application/pdf');

                                            if (isPdf) {
                                                return (
                                                    <embed
                                                        src={fullUrl}
                                                        type="application/pdf"
                                                        title="Receipt PDF"
                                                        className="w-full h-full border-0"
                                                    />
                                                );
                                            }

                                            return (
                                                <>
                                                    <img
                                                        src={fullUrl}
                                                        alt="Receipt"
                                                        className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105"
                                                        onError={(e) => {
                                                            e.currentTarget.style.display = 'none';
                                                            e.currentTarget.nextSibling.style.display = 'flex';
                                                        }}
                                                    />
                                                    <div className="hidden absolute inset-0 flex-col items-center justify-center gap-2 text-slate-400 bg-slate-50">
                                                        <ImageIcon className="w-12 h-12 opacity-20" />
                                                        <span className="text-sm">Preview not available</span>
                                                    </div>
                                                </>
                                            );
                                        })()}
                                    </div>
                                    {(() => {
                                        const fullUrl = expense.receiptUrl.startsWith('http') || expense.receiptUrl.startsWith('data:')
                                            ? expense.receiptUrl
                                            : `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001'}${expense.receiptUrl.startsWith('/') ? '' : '/'}${expense.receiptUrl}`;

                                        if (fullUrl.startsWith('data:')) {
                                            return (
                                                <a
                                                    href={fullUrl}
                                                    download={`Receipt-${Date.now()}`}
                                                    className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors"
                                                >
                                                    <Upload className="w-4 h-4 rotate-180" />
                                                    Download Receipt
                                                </a>
                                            );
                                        }
                                        return (
                                            <a
                                                href={fullUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors"
                                            >
                                                <ExternalLink className="w-4 h-4" />
                                                Open in New Tab
                                            </a>
                                        );
                                    })()}
                                </div>
                            ) : (
                                <div className="text-center p-8 bg-slate-50 rounded-lg border border-dashed border-slate-300">
                                    <ImageIcon className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                                    <span className="text-sm text-slate-400">No receipt attached</span>
                                </div>
                            )}
                        </div>

                        {/* Close Button */}
                        <div className="pt-2 flex justify-end">
                            <Button
                                variant="ghost"
                                onClick={onClose}
                                className="px-6"
                            >
                                Close
                            </Button>
                        </div>
                    </div>
                ) : (
                    /* Existing Edit/Create Form */
                    <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2 scrollbar-hide">
                        {/* Title */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">
                                Expense Title <span className="text-red-500">*</span>
                            </label>
                            <Input
                                name="title"
                                value={formData.title}
                                onChange={handleChange}
                                placeholder="e.g. Office Rent, Electricity Bill"
                                disabled={readOnly}
                            />
                        </div>

                        {/* Amount and Category */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">
                                    Amount <span className="text-red-500">*</span>
                                </label>
                                <Input
                                    name="amount"
                                    type="number"
                                    step="0.01"
                                    value={formData.amount}
                                    onChange={handleChange}
                                    placeholder="0.00"
                                    disabled={readOnly}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">
                                    Category <span className="text-red-500">*</span>
                                </label>
                                <select
                                    name="category"
                                    value={formData.category}
                                    onChange={handleChange}
                                    className="flex w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                                    disabled={readOnly}
                                >
                                    <option value="">Select Category</option>
                                    {SAMPLE_CATEGORIES.map(cat => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Date */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">Date</label>
                            <Input
                                name="date"
                                type="date"
                                value={formData.date}
                                onChange={handleChange}
                                disabled={readOnly}
                            />
                        </div>

                        {/* Payment Method and Reference */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">Payment Method</label>
                                <select
                                    name="paymentMethod"
                                    value={formData.paymentMethod}
                                    onChange={handleChange}
                                    className="flex w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                                    disabled={readOnly}
                                >
                                    {PAYMENT_METHODS.map(method => (
                                        <option key={method} value={method}>{method}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">Reference / Bill No.</label>
                                <Input
                                    name="reference"
                                    value={formData.reference}
                                    onChange={handleChange}
                                    placeholder="e.g. TXN123456, INV-001"
                                    disabled={readOnly}
                                />
                            </div>
                        </div>

                        {/* Tags */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">Tags</label>
                            <TagsInput
                                value={formData.tags}
                                onChange={(tags) => setFormData(prev => ({ ...prev, tags }))}
                                suggestions={COMMON_TAGS}
                                disabled={readOnly}
                                placeholder="Add tags to categorize (e.g. urgent, monthly)"
                            />
                        </div>


                        {/* Recurring Expense */}
                        <div className="space-y-3 p-4 bg-slate-50 rounded-lg border border-slate-200">
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="isRecurring"
                                    name="isRecurring"
                                    checked={formData.isRecurring}
                                    onChange={handleChange}
                                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                                    disabled={readOnly}
                                />
                                <label htmlFor="isRecurring" className="text-sm font-medium text-slate-700">
                                    Mark as Recurring Expense
                                </label>
                            </div>

                            {formData.isRecurring && (
                                <div className="grid grid-cols-2 gap-4 mt-3">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-slate-700">Frequency</label>
                                        <select
                                            name="frequency"
                                            value={formData.frequency}
                                            onChange={handleChange}
                                            className="flex w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:border-blue-500"
                                            disabled={readOnly}
                                        >
                                            {RECURRING_FREQUENCIES.map(freq => (
                                                <option key={freq.value} value={freq.value}>{freq.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-slate-700">Next Due Date</label>
                                        <Input
                                            name="nextDueDate"
                                            type="date"
                                            value={formData.nextDueDate}
                                            onChange={handleChange}
                                            disabled={readOnly}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Notes */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">Notes</label>
                            <textarea
                                name="description"
                                value={formData.description}
                                onChange={handleChange}
                                className="flex w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50 min-h-[100px]"
                                placeholder="Add additional details..."
                                disabled={readOnly}
                            />
                        </div>

                        {/* Receipt Upload */}
                        <div className="space-y-3">
                            <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                                <FileText className="w-4 h-4 text-slate-500" />
                                Receipt Attachment
                            </label>

                            {/* Show existing receipt in edit mode */}
                            {isEditMode && expense?.receiptUrl && !receiptFile ? (
                                <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                                    <div className="p-4">
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center gap-2 text-slate-700">
                                                <AlertCircle className="w-4 h-4 text-blue-500" />
                                                <span className="text-sm font-medium">Currently Attached</span>
                                            </div>
                                            {(() => {
                                                const fullUrl = expense.receiptUrl.startsWith('http') || expense.receiptUrl.startsWith('data:')
                                                    ? expense.receiptUrl
                                                    : `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001'}${expense.receiptUrl.startsWith('/') ? '' : '/'}${expense.receiptUrl}`;

                                                if (fullUrl.startsWith('data:')) {
                                                    return (
                                                        <a
                                                            href={fullUrl}
                                                            download={`Receipt-${Date.now()}`}
                                                            className="text-xs text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1"
                                                        >
                                                            <Upload className="w-3 h-3 rotate-180" />
                                                            Download
                                                        </a>
                                                    );
                                                }
                                                return (
                                                    <a
                                                        href={fullUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-xs text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1"
                                                    >
                                                        <ExternalLink className="w-3 h-3" />
                                                        View Original
                                                    </a>
                                                );
                                            })()}
                                        </div>

                                        {/* Preview */}
                                        <div className="aspect-video bg-slate-50 rounded-md border border-slate-100 flex items-center justify-center overflow-hidden mb-4 relative group">
                                            {(() => {
                                                const fullUrl = expense.receiptUrl.startsWith('http') || expense.receiptUrl.startsWith('data:')
                                                    ? expense.receiptUrl
                                                    : `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001'}${expense.receiptUrl.startsWith('/') ? '' : '/'}${expense.receiptUrl}`;

                                                const isPdf = expense.receiptUrl.toLowerCase().includes('.pdf') || expense.receiptUrl.startsWith('data:application/pdf');

                                                if (isPdf) {
                                                    return (
                                                        <embed
                                                            src={fullUrl}
                                                            type="application/pdf"
                                                            title="Receipt PDF"
                                                            className="w-full h-full border-0 rounded-md"
                                                        />
                                                    );
                                                }

                                                return (
                                                    <>
                                                        <img
                                                            src={fullUrl}
                                                            alt="Receipt preview"
                                                            className="w-full h-full object-contain transition-opacity duration-300"
                                                            onLoad={(e) => {
                                                                e.currentTarget.style.opacity = '1';
                                                            }}
                                                            onError={(e) => {
                                                                e.currentTarget.style.display = 'none';
                                                                e.currentTarget.nextSibling.style.display = 'flex';
                                                            }}
                                                            style={{ opacity: 0 }}
                                                        />
                                                        <div className="hidden absolute inset-0 flex-col items-center justify-center gap-2 text-slate-400 bg-slate-50">
                                                            <ImageIcon className="w-12 h-12 opacity-20" />
                                                            <span className="text-sm">Preview not available</span>
                                                        </div>
                                                    </>
                                                );
                                            })()}
                                        </div>

                                        {/* Actions */}
                                        {!readOnly && (
                                            <Button
                                                type="button"
                                                variant="outline"
                                                onClick={() => setShowReceiptConfirmation(true)}
                                                className="w-full flex items-center justify-center gap-2 text-slate-600 hover:text-slate-800"
                                            >
                                                <Upload className="w-4 h-4" />
                                                Replace Receipt
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                /* File Upload Component */
                                <div className={`transition-all duration-200 ${receiptFile ? 'scale-100 opacity-100' : 'scale-[0.99] opacity-100'}`}>
                                    <FileUpload
                                        value={receiptFile}
                                        onChange={setReceiptFile}
                                        accept="image/*,.pdf"
                                        maxSize={5 * 1024 * 1024}
                                    />
                                    {receiptFile && (
                                        <div className="mt-2 flex justify-end">
                                            <button
                                                type="button"
                                                onClick={() => setReceiptFile(null)}
                                                className="text-xs text-red-600 hover:text-red-700 flex items-center gap-1"
                                            >
                                                <X className="w-3 h-3" />
                                                Cancel Change
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                            {!receiptFile && !expense?.receiptUrl && readOnly && (
                                <div className="text-center p-6 bg-slate-50 rounded-lg border border-dashed border-slate-300 text-slate-400">
                                    <span className="text-sm">No Receipt Attached</span>
                                </div>
                            )}
                        </div>

                        {/* Action Buttons */}
                        <div className="pt-4 flex justify-end gap-2 border-t border-slate-200">
                            <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
                                {readOnly ? 'Close' : 'Cancel'}
                            </Button>
                            {!readOnly && (
                                <Button
                                    onClick={handleSubmit}
                                    className="bg-red-600 hover:bg-red-700"
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? 'Saving...' : (isEditMode ? 'Update Expense' : 'Save Expense')}
                                </Button>
                            )}
                        </div>
                    </div>
                )}
            </Modal>

            {/* Confirmation Modal for Receipt Change */}
            <ConfirmationModal
                isOpen={showReceiptConfirmation}
                onClose={() => setShowReceiptConfirmation(false)}
                onConfirm={handleReceiptChange}
                title="Replace Receipt?"
                message="Are you sure you want to replace the current receipt? The existing file will be overwritten."
                variant="danger"
            />
        </>
    );
};

export default ExpenseModal;