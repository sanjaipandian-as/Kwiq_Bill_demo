import React, { useState, useEffect } from 'react';
import { Modal } from '../../../../components/ui/Modal';
import { Input } from '../../../../components/ui/Input';

export const DiscountModal = ({ isOpen, onClose, onApply, title = "Apply Discount", initialValue = 0, isPercentage = false, totalAmount = 0 }) => {
    const [value, setValue] = useState(initialValue === 0 ? '' : initialValue);
    const [mode, setMode] = useState(isPercentage ? 'percent' : 'amount'); // 'percent' or 'amount'

    // Reset on open
    useEffect(() => {
        if (isOpen) {
            setValue(initialValue === 0 ? '' : initialValue);
            setMode(isPercentage ? 'percent' : 'amount');
        }
    }, [isOpen, initialValue, isPercentage]);

    const handleSubmit = (e) => {
        e.preventDefault();
        onApply(parseFloat(value) || 0, mode === 'percent');
        onClose();
    };

    // Calculate details
    const discountAmount = mode === 'percent'
        ? (totalAmount * (parseFloat(value) || 0) / 100)
        : (parseFloat(value) || 0);

    const finalPayable = Math.max(0, totalAmount - discountAmount);
    const isValid = discountAmount <= totalAmount;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title} className="w-full max-w-3xl">
            <form onSubmit={handleSubmit} className="space-y-4">

                {/* 1. Mode Selection Cards */}
                <div className="grid grid-cols-2 gap-4">
                    <button
                        type="button"
                        onClick={() => { setMode('amount'); setValue(''); }}
                        className={`p-4 rounded-xl border-2 flex flex-col items-center justify-center gap-2 transition-all ${mode === 'amount'
                            ? 'border-black bg-zinc-50 text-black shadow-md ring-2 ring-zinc-200'
                            : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                            }`}
                    >
                        <span className="text-3xl font-bold">₹</span>
                        <span className="font-semibold">In Money</span>
                        <span className="text-xs opacity-75">e.g. ₹50 off</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => { setMode('percent'); setValue(''); }}
                        className={`p-4 rounded-xl border-2 flex flex-col items-center justify-center gap-2 transition-all ${mode === 'percent'
                            ? 'border-black bg-zinc-50 text-black shadow-md ring-2 ring-zinc-200'
                            : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                            }`}
                    >
                        <span className="text-3xl font-bold">%</span>
                        <span className="font-semibold">In Percent</span>
                        <span className="text-xs opacity-75">e.g. 10% off</span>
                    </button>
                </div>

                {/* 2. Manual Input */}
                <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">
                        Enter {mode === 'percent' ? 'Percentage' : 'Amount'}
                    </label>
                    <Input
                        type="number"
                        step="0.01"
                        min="0"
                        max={mode === 'percent' ? 100 : totalAmount}
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        className="text-right text-4xl font-extrabold h-16 border-2 border-slate-200 focus:border-black rounded-xl shadow-sm placeholder:text-slate-300 placeholder:font-normal"
                        placeholder="0.00"
                        autoFocus
                    />
                </div>

                {/* 3. Real-time Result Card */}
                <div className="bg-zinc-50 rounded-xl p-4 border border-zinc-100 flex flex-col gap-2">
                    <div className="flex justify-between text-base font-semibold text-slate-700">
                        <span>Original Bill:</span>
                        <span className="text-lg">₹{totalAmount.toFixed(2)}</span>
                    </div>

                    <div className="flex justify-between items-center text-green-600 py-1 border-b border-zinc-200">
                        <span className="font-medium flex items-center gap-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                            You Save
                        </span>
                        <span className="font-bold text-lg">- ₹{discountAmount.toFixed(2)}</span>
                    </div>

                    <div className="flex justify-between items-center pt-2">
                        <span className="font-bold text-slate-700">Customer Pays</span>
                        <span className="font-extrabold text-2xl text-black">₹{finalPayable.toFixed(2)}</span>
                    </div>
                </div>

                {/* Error Message */}
                {!isValid && (
                    <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-center gap-2">
                        <span className="font-bold">Error:</span> Discount cannot be more than the bill amount!
                    </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 py-3 text-slate-600 font-bold bg-white border-2 border-slate-200 rounded-xl hover:bg-slate-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={!isValid}
                        className={`flex-1 py-3 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 ${isValid
                            ? 'bg-black hover:bg-zinc-800'
                            : 'bg-slate-300 cursor-not-allowed'
                            }`}
                    >
                        Apply Discount
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default React.memo(DiscountModal);
