import React, { useState, useEffect, useRef } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { DollarSign, TrendingUp, TrendingDown, Check, Percent } from 'lucide-react';

const PriceModal = ({ isOpen, onClose, onApply, selectedItems, cart, isMultiple = false }) => {
    const [newPrice, setNewPrice] = useState('');
    const [priceType, setPriceType] = useState('absolute'); // 'absolute' or 'percentage'
    const [adjustmentType, setAdjustmentType] = useState('set'); // 'set', 'increase', 'decrease'
    const inputRef = useRef(null);

    // Get selected items from cart
    const items = cart?.filter(i => selectedItems?.includes(i.id || i._id)) || [];
    const singleItem = items.length === 1 ? items[0] : null;

    useEffect(() => {
        if (isOpen) {
            setNewPrice('');
            setPriceType('absolute');
            setAdjustmentType('set');
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen]);

    const handleApply = () => {
        const value = parseFloat(newPrice);
        if (isNaN(value) || value < 0) return;

        onApply(items.map(i => i.id || i._id), {
            value,
            type: priceType,
            adjustment: adjustmentType
        });
        onClose();
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleApply();
        } else if (e.key === 'Escape') {
            onClose();
        }
    };

    // Calculate preview
    const getPreview = () => {
        if (!newPrice || isNaN(parseFloat(newPrice))) return null;
        const value = parseFloat(newPrice);

        return items.map(item => {
            const currentPrice = item.price || item.sellingPrice || 0;
            let newPriceValue = currentPrice;

            if (priceType === 'absolute') {
                if (adjustmentType === 'set') newPriceValue = value;
                else if (adjustmentType === 'increase') newPriceValue = currentPrice + value;
                else if (adjustmentType === 'decrease') newPriceValue = Math.max(0, currentPrice - value);
            } else {
                // percentage
                if (adjustmentType === 'increase') newPriceValue = currentPrice * (1 + value / 100);
                else if (adjustmentType === 'decrease') newPriceValue = currentPrice * (1 - value / 100);
                else newPriceValue = currentPrice * (value / 100);
            }

            return {
                name: item.name,
                currentPrice,
                newPrice: newPriceValue
            };
        });
    };

    const preview = getPreview();

    return (
        <Modal 
            isOpen={isOpen} 
            onClose={onClose} 
            title={isMultiple ? `Change Price - ${items.length} Items` : `Change Price - ${singleItem?.name || 'Item'}`}
        >
            <div className="space-y-4 p-4">
                {/* Current Info */}
                {singleItem ? (
                    <div className="bg-slate-50 rounded-lg p-3 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-slate-700">{singleItem.name}</p>
                            <p className="text-xs text-slate-500">Current Price: <span className="font-semibold text-slate-900">₹{(singleItem.price || singleItem.sellingPrice || 0).toFixed(2)}</span></p>
                        </div>
                        <DollarSign className="text-slate-400" size={24} />
                    </div>
                ) : (
                    <div className="bg-slate-50 rounded-lg p-3">
                        <p className="text-sm font-medium text-slate-700">{items.length} items selected</p>
                        <div className="mt-2 max-h-24 overflow-y-auto">
                            {items.slice(0, 5).map(item => (
                                <p key={item.id || item._id} className="text-xs text-slate-500">
                                    {item.name}: ₹{(item.price || item.sellingPrice || 0).toFixed(2)}
                                </p>
                            ))}
                            {items.length > 5 && (
                                <p className="text-xs text-slate-400">...and {items.length - 5} more</p>
                            )}
                        </div>
                    </div>
                )}

                {/* Adjustment Type */}
                <div>
                    <label className="text-sm font-medium text-slate-700 mb-2 block">Adjustment Type</label>
                    <div className="grid grid-cols-3 gap-2">
                        <button
                            type="button"
                            onClick={() => setAdjustmentType('set')}
                            className={`px-3 py-2 text-sm font-medium rounded-lg border transition-all ${
                                adjustmentType === 'set'
                                    ? 'bg-black text-white border-black'
                                    : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                            }`}
                        >
                            Set To
                        </button>
                        <button
                            type="button"
                            onClick={() => setAdjustmentType('increase')}
                            className={`px-3 py-2 text-sm font-medium rounded-lg border transition-all flex items-center justify-center gap-1 ${
                                adjustmentType === 'increase'
                                    ? 'bg-green-600 text-white border-green-600'
                                    : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                            }`}
                        >
                            <TrendingUp size={14} />
                            Increase
                        </button>
                        <button
                            type="button"
                            onClick={() => setAdjustmentType('decrease')}
                            className={`px-3 py-2 text-sm font-medium rounded-lg border transition-all flex items-center justify-center gap-1 ${
                                adjustmentType === 'decrease'
                                    ? 'bg-red-600 text-white border-red-600'
                                    : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                            }`}
                        >
                            <TrendingDown size={14} />
                            Decrease
                        </button>
                    </div>
                </div>

                {/* Price Type */}
                <div>
                    <label className="text-sm font-medium text-slate-700 mb-2 block">Value Type</label>
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            type="button"
                            onClick={() => setPriceType('absolute')}
                            className={`px-3 py-2 text-sm font-medium rounded-lg border transition-all flex items-center justify-center gap-1 ${
                                priceType === 'absolute'
                                    ? 'bg-black text-white border-black'
                                    : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                            }`}
                        >
                            <DollarSign size={14} />
                            Amount (₹)
                        </button>
                        <button
                            type="button"
                            onClick={() => setPriceType('percentage')}
                            className={`px-3 py-2 text-sm font-medium rounded-lg border transition-all flex items-center justify-center gap-1 ${
                                priceType === 'percentage'
                                    ? 'bg-black text-white border-black'
                                    : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                            }`}
                        >
                            <Percent size={14} />
                            Percentage (%)
                        </button>
                    </div>
                </div>

                {/* Price Input */}
                <div>
                    <label className="text-sm font-medium text-slate-700 mb-2 block">
                        {adjustmentType === 'set' ? 'New Price' : adjustmentType === 'increase' ? 'Increase By' : 'Decrease By'}
                    </label>
                    <div className="relative">
                        {priceType === 'absolute' && (
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">₹</span>
                        )}
                        <Input
                            ref={inputRef}
                            type="number"
                            step="0.01"
                            value={newPrice}
                            onChange={(e) => setNewPrice(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={priceType === 'absolute' ? '0.00' : '0'}
                            className={`${priceType === 'absolute' ? 'pl-7' : ''}`}
                        />
                        {priceType === 'percentage' && (
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">%</span>
                        )}
                    </div>
                </div>

                {/* Preview */}
                {preview && preview.length > 0 && (
                    <div className="bg-slate-50 rounded-lg p-3">
                        <p className="text-xs font-medium text-slate-500 mb-2">Preview</p>
                        <div className="max-h-32 overflow-y-auto space-y-1">
                            {preview.slice(0, 5).map((p, idx) => (
                                <div key={idx} className="flex justify-between text-xs">
                                    <span className="text-slate-600 truncate max-w-[60%]">{p.name}</span>
                                    <span>
                                        <span className="text-slate-400 line-through mr-1">₹{p.currentPrice.toFixed(2)}</span>
                                        <span className="font-semibold text-green-600">₹{p.newPrice.toFixed(2)}</span>
                                    </span>
                                </div>
                            ))}
                            {preview.length > 5 && (
                                <p className="text-xs text-slate-400">...and {preview.length - 5} more</p>
                            )}
                        </div>
                    </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                    <Button variant="outline" onClick={onClose} className="flex-1">
                        Cancel
                    </Button>
                    <Button 
                        onClick={handleApply} 
                        className="flex-1 bg-black hover:bg-slate-800"
                        disabled={!newPrice || isNaN(parseFloat(newPrice))}
                    >
                        <Check size={16} className="mr-1" />
                        Apply
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

export default React.memo(PriceModal);
