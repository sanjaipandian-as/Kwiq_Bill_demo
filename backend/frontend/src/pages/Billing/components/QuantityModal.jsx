import React, { useState, useEffect, useRef } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { Package, AlertTriangle } from 'lucide-react';

const QuantityModal = ({ isOpen, onClose, item, onApply, allowNegativeStock }) => {
    const [quantity, setQuantity] = useState('');
    const [error, setError] = useState('');
    const inputRef = useRef(null);

    useEffect(() => {
        if (isOpen && item) {
            setQuantity(item.quantity?.toString() || '');
            setError('');
            // Focus input when modal opens
            setTimeout(() => {
                inputRef.current?.focus();
                inputRef.current?.select();
            }, 100);
        }
    }, [isOpen, item]);

    const handleSubmit = (e) => {
        e?.preventDefault();
        const qty = parseFloat(quantity);
        
        if (isNaN(qty) || qty <= 0) {
            setError('Please enter a valid quantity greater than 0');
            return;
        }
        
        // Check stock limit
        if (item?.stock !== undefined && item?.stock !== null && qty > item.stock && !allowNegativeStock) {
            setError(`Cannot set quantity to ${qty}. Only ${item.stock} available in stock.`);
            return;
        }
        
        onApply(qty);
        onClose();
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            handleSubmit(e);
        } else if (e.key === 'Escape') {
            onClose();
        }
    };

    const quickActions = ['+1', '+5', '+10', '×2', '÷2'];

    const handleQuickAction = (action) => {
        const currentQty = parseFloat(quantity) || 0;
        let newQty = currentQty;

        if (action === '+1') newQty = currentQty + 1;
        else if (action === '+5') newQty = currentQty + 5;
        else if (action === '+10') newQty = currentQty + 10;
        else if (action === '×2') newQty = currentQty * 2;
        else if (action === '÷2') newQty = currentQty / 2;

        const finalQty = Math.max(1, Math.floor(newQty));
        
        // Check stock limit for quick actions
        if (item?.stock !== undefined && item?.stock !== null && finalQty > item.stock && !allowNegativeStock) {
            setError(`Cannot set quantity to ${finalQty}. Only ${item.stock} available in stock.`);
            setQuantity(item.stock.toString());
            return;
        }
        
        setQuantity(finalQty.toString());
        setError('');
        inputRef.current?.focus();
    };

    const handleQuantityChange = (e) => {
        const val = e.target.value;
        if (val === '' || /^[0-9]+$/.test(val)) {
            setQuantity(val);
            setError('');
        }
    };

    if (!item) return null;
    
    const hasStockLimit = item.stock !== undefined && item.stock !== null;
    const availableStock = item.stock ?? 0;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Change Quantity"
        >
            <div className="space-y-4">
                {/* Item Info */}
                <div className="flex items-center gap-3 p-3 bg-zinc-50 rounded-lg border border-zinc-200">
                    <div className="p-2 bg-zinc-100 rounded-md">
                        <Package className="w-5 h-5 text-black" />
                    </div>
                    <div className="flex-1">
                        <h4 className="font-semibold text-slate-800">{item.name}</h4>
                        <p className="text-xs text-slate-500">
                            ₹{item.price || item.sellingPrice} × {item.quantity} = ₹{((item.price || item.sellingPrice) * item.quantity).toFixed(2)}
                        </p>
                    </div>
                </div>

                {/* Stock Info */}
                {hasStockLimit && (
                    <div className={`flex items-center gap-2 p-2 rounded-lg ${availableStock <= 5 ? 'bg-amber-50 border border-amber-200' : 'bg-blue-50 border border-blue-200'}`}>
                        <AlertTriangle className={`w-4 h-4 ${availableStock <= 5 ? 'text-amber-600' : 'text-blue-600'}`} />
                        <span className={`text-sm font-medium ${availableStock <= 5 ? 'text-amber-700' : 'text-blue-700'}`}>
                            Available Stock: {availableStock} units
                        </span>
                    </div>
                )}

                {/* Quantity Input */}
                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">
                        New Quantity <span className="text-red-500">*</span>
                    </label>
                    <Input
                        ref={inputRef}
                        type="number"
                        step="1"
                        min="1"
                        max={hasStockLimit && !allowNegativeStock ? availableStock : undefined}
                        value={quantity}
                        onChange={handleQuantityChange}
                        onKeyDown={handleKeyDown}
                        placeholder="Enter quantity..."
                        className={`text-lg font-semibold text-center focus:ring-black focus:border-black ${error ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : ''}`}
                    />
                    {error && (
                        <p className="text-xs text-red-500 flex items-center gap-1">
                            <AlertTriangle size={12} /> {error}
                        </p>
                    )}
                    {!error && (
                        <p className="text-xs text-slate-500 text-center">
                            Press <kbd className="px-1.5 py-0.5 bg-slate-200 rounded text-slate-700 font-mono">Enter</kbd> to apply or <kbd className="px-1.5 py-0.5 bg-slate-200 rounded text-slate-700 font-mono">Esc</kbd> to cancel
                        </p>
                    )}
                </div>

                {/* Quick Actions */}
                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Quick Actions</label>
                    <div className="grid grid-cols-5 gap-2">
                        {quickActions.map(action => (
                            <Button
                                key={action}
                                type="button"
                                variant="outline"
                                onClick={() => handleQuickAction(action)}
                                className="text-sm font-semibold hover:bg-zinc-100 hover:border-black hover:text-black"
                            >
                                {action}
                            </Button>
                        ))}
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 pt-4 border-t">
                    <Button
                        variant="ghost"
                        onClick={onClose}
                        className="flex-1"
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        className="flex-1 bg-black hover:bg-zinc-800 text-white"
                    >
                        Apply Quantity
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

export default QuantityModal;