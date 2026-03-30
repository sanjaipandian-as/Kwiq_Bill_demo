import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import services from '../../services/api';
import { useToast } from '../../context/ToastContext';

const RecordPaymentModal = ({ isOpen, onClose, invoice, onPaymentAdded }) => {
    const { addToast } = useToast();
    const [amount, setAmount] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('Cash');
    const [note, setNote] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen && invoice) {
            setAmount(invoice.balance ? invoice.balance.toString() : '0');
            setPaymentMethod('Cash');
            setNote('');
        }
    }, [isOpen, invoice]);

    if (!invoice) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();

        const payAmount = parseFloat(amount);
        if (isNaN(payAmount) || payAmount <= 0) {
            addToast('Please enter a valid amount', 'error');
            return;
        }

        if (payAmount > (invoice.balance + 1)) { // Allow small float margin
            addToast(`Amount cannot exceed pending balance (₹${invoice.balance.toFixed(2)})`, 'error');
            return;
        }

        setIsSubmitting(true);
        try {
            // We'll use a specific endpoint if available, or update the invoice
            // improved: append to payments array
            const newPayment = {
                amount: payAmount,
                method: paymentMethod,
                date: new Date().toISOString(),
                note: note
            };

            const updatedPayments = [...(invoice.payments || []), newPayment];

            // Calculate new status
            const totalPaid = updatedPayments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
            const total = parseFloat(invoice.total || 0);
            let newStatus = invoice.status;

            if (totalPaid >= (total - 1)) { // Small margin for float issues
                newStatus = 'Paid';
            } else if (totalPaid > 0) {
                newStatus = 'Partially Paid';
            }

            const updateData = {
                payments: updatedPayments,
                status: newStatus,
                balance: Math.max(0, total - totalPaid)
            };

            await services.invoices.update(invoice.id, updateData);

            addToast('Payment recorded successfully', 'success');
            if (onPaymentAdded) onPaymentAdded();
            onClose();
        } catch (error) {
            console.error(error);
            addToast('Failed to record payment', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Record Payment" size="lg">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-2">
                {/* Left Side: Invoice Details & Summary */}
                <div className="space-y-4">
                    <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6 rounded-2xl shadow-lg">
                        <p className="text-slate-400 text-sm font-medium mb-1">Invoice Amount</p>
                        <p className="text-3xl font-bold mb-4">₹{parseFloat(invoice.total || 0).toFixed(2)}</p>

                        <div className="flex justify-between items-center py-3 border-t border-slate-700/50">
                            <span className="text-slate-300 text-sm">Invoice No.</span>
                            <span className="font-mono bg-slate-700/50 px-2 py-0.5 rounded text-sm">{invoice.invoiceNumber || invoice.id.slice(-6).toUpperCase()}</span>
                        </div>

                        <div className="flex justify-between items-center pt-2">
                            <span className="text-rose-300 text-sm font-medium">Balance Due</span>
                            <span className="text-xl font-bold text-rose-400">₹{parseFloat(invoice.balance || 0).toFixed(2)}</span>
                        </div>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Previous Payments</p>
                        {(!invoice.payments || invoice.payments.length === 0) ? (
                            <p className="text-sm text-slate-400 text-center py-2">No payments recorded yet.</p>
                        ) : (
                            <div className="space-y-2 max-h-[120px] overflow-y-auto pr-1">
                                {invoice.payments.map((p, i) => (
                                    <div key={i} className="flex justify-between text-sm">
                                        <span className="text-slate-600">{new Date(p.date).toLocaleDateString()} ({p.method})</span>
                                        <span className="font-medium">₹{parseFloat(p.amount).toFixed(2)}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Side: Payment Form */}
                <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Amount Received</label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xl">₹</span>
                            <input
                                type="number"
                                value={amount}
                                onChange={e => setAmount(e.target.value)}
                                max={invoice.balance}
                                min={0}
                                step="0.01"
                                placeholder="0.00"
                                required
                                className="w-full pl-10 pr-4 py-4 text-3xl font-bold text-slate-900 bg-white border-2 border-slate-200 rounded-xl focus:border-black focus:ring-0 outline-none transition-all placeholder:text-slate-300"
                                autoFocus
                            />
                        </div>
                        <div className="flex gap-2 mt-2">
                            <button
                                type="button"
                                onClick={() => setAmount(invoice.balance.toString())}
                                className="text-xs font-semibold bg-blue-50 text-blue-600 px-3 py-1 rounded-full hover:bg-blue-100 transition-colors"
                            >
                                Pay Full Balance
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Payment Method</label>
                        <div className="grid grid-cols-3 gap-2">
                            {['Cash', 'UPI', 'Card', 'Bank Transfer', 'Cheque', 'Credit'].map((method) => (
                                <button
                                    key={method}
                                    type="button"
                                    onClick={() => setPaymentMethod(method)}
                                    className={`py-2 px-1 text-xs font-bold rounded-lg border transition-all ${paymentMethod === method
                                            ? 'bg-black text-white border-black shadow-md transform scale-[1.02]'
                                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                        }`}
                                >
                                    {method === 'Bank Transfer' ? 'Bank' : method}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Note <span className="text-slate-400 font-normal">(Optional)</span></label>
                        <Input
                            value={note}
                            onChange={e => setNote(e.target.value)}
                            placeholder="Transaction ID, Cheque No, etc."
                            className="bg-slate-50 border-slate-200 focus:bg-white transition-all"
                        />
                    </div>

                    <div className="flex gap-3 pt-2 mt-auto">
                        <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting} className="flex-1 h-12 text-base">
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isSubmitting} className="flex-[2] h-12 text-base font-bold shadow-lg hover:shadow-xl transition-all">
                            {isSubmitting ? 'Recording...' : 'Record Payment'}
                        </Button>
                    </div>
                </form>
            </div>
        </Modal>
    );
};

export default RecordPaymentModal;
