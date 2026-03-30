import React, { useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';
import { Button } from '../../../components/ui/Button';

const VariantSelectionModal = ({ isOpen, onClose, product, onAddToCart }) => {
    const [selectedVariantIndex, setSelectedVariantIndex] = useState(null);
    const [quantity, setQuantity] = useState(1);

    useEffect(() => {
        if (isOpen && product?.variants?.length > 0) {
            // Auto-select first available variant
            const firstAvailable = product.variants.findIndex(v => v.stock > 0);
            setSelectedVariantIndex(firstAvailable >= 0 ? firstAvailable : 0);
            setQuantity(1);
        }
    }, [isOpen, product]);

    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                onClose();
            } else if (e.key === 'Enter' && selectedVariantIndex !== null) {
                handleAddToCart();
            } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                e.preventDefault();
                const variants = product?.variants || [];
                if (variants.length === 0) return;

                let newIndex = selectedVariantIndex;
                if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
                    newIndex = selectedVariantIndex > 0 ? selectedVariantIndex - 1 : variants.length - 1;
                } else {
                    newIndex = selectedVariantIndex < variants.length - 1 ? selectedVariantIndex + 1 : 0;
                }
                setSelectedVariantIndex(newIndex);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, selectedVariantIndex, product, onClose]);

    if (!isOpen || !product) return null;

    const variants = product.variants || [];
    const selectedVariant = selectedVariantIndex !== null ? variants[selectedVariantIndex] : null;

    const handleAddToCart = () => {
        if (selectedVariant && quantity > 0) {
            onAddToCart(product, selectedVariant, selectedVariantIndex, quantity);
            onClose();
        }
    };

    const incrementQuantity = () => {
        if (selectedVariant && quantity < selectedVariant.stock) {
            setQuantity(prev => prev + 1);
        }
    };

    const decrementQuantity = () => {
        if (quantity > 1) {
            setQuantity(prev => prev - 1);
        }
    };

    const formatVariantName = (variant) => {
        if (variant?.options?.[0] && variant.options[0].trim() !== '') {
            return variant.options[0];
        }
        return 'Unnamed Variant';
    };


    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 pointer-events-none">
            <div className="bg-white rounded-lg shadow-2xl max-w-3xl w-full mx-4 pointer-events-auto border-2 border-black animate-slideDown">
                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b bg-zinc-50">
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <span className="bg-black text-white px-2 py-1 rounded text-sm">SELECT VARIANT</span>
                        {product.name}
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600 transition-colors hover:bg-slate-100 rounded-full p-1"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 overflow-y-auto max-h-[60vh]">
                    {variants.length === 0 ? (
                        <div className="text-center py-6 text-slate-500">
                            No variants available for this product.
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                            {variants.map((variant, index) => {
                                const isSelected = selectedVariantIndex === index;
                                const isOutOfStock = variant.stock <= 0;
                                const variantName = formatVariantName(variant);

                                return (
                                    <div
                                        key={index}
                                        onClick={() => !isOutOfStock && setSelectedVariantIndex(index)}
                                        className={`
                                            relative p-3 rounded-lg border-2 transition-all cursor-pointer
                                            ${isSelected
                                                ? 'border-black bg-zinc-50 shadow-md scale-105'
                                                : isOutOfStock
                                                    ? 'border-slate-200 bg-slate-100 cursor-not-allowed opacity-60'
                                                    : 'border-slate-200 bg-white hover:border-black hover:shadow-sm'
                                            }
                                        `}
                                    >
                                        {/* Selected Indicator */}
                                        {isSelected && (
                                            <div className="absolute top-1 right-1 bg-black text-white rounded-full p-0.5">
                                                <Check size={14} />
                                            </div>
                                        )}

                                        {/* Out of Stock Badge */}
                                        {isOutOfStock && (
                                            <div className="absolute top-1 right-1 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-semibold">
                                                Out
                                            </div>
                                        )}

                                        {/* Variant Info */}
                                        <div className="space-y-1">
                                            <div className={`text-sm font-bold ${isSelected ? 'text-black' : 'text-slate-800'}`}>
                                                {variantName}
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <div className="text-base font-semibold text-slate-700">
                                                    ₹{Number(variant.price).toFixed(2)}
                                                </div>
                                                <div
                                                    className={`text-xs font-medium px-1.5 py-0.5 rounded
                                                ${isOutOfStock
                                                            ? 'bg-red-100 text-red-700'
                                                            : variant.stock <= 5
                                                                ? 'bg-amber-100 text-amber-700'
                                                                : 'bg-green-100 text-green-700'}
                                                `}
                                                >
                                                    {variant.stock} left
                                                </div>
                                            </div>

                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-3 border-t bg-white flex justify-between items-center gap-3">
                    {/* Quantity Selector */}
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-600">Qty:</span>
                        <div className="flex items-center border border-slate-300 rounded overflow-hidden">
                            <button
                                onClick={decrementQuantity}
                                disabled={quantity <= 1}
                                className="px-2 py-1 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <span className="text-base font-bold text-slate-600">−</span>
                            </button>
                            <input
                                type="number"
                                value={quantity}
                                onChange={(e) => {
                                    const val = parseInt(e.target.value) || 1;
                                    if (selectedVariant) {
                                        setQuantity(Math.min(Math.max(1, val), selectedVariant.stock));
                                    }
                                }}
                                className="w-12 text-center border-x border-slate-300 py-1 font-semibold focus:outline-none text-sm"
                                min="1"
                                max={selectedVariant?.stock || 1}
                            />
                            <button
                                onClick={incrementQuantity}
                                disabled={!selectedVariant || quantity >= selectedVariant.stock}
                                className="px-2 py-1 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <span className="text-base font-bold text-slate-600">+</span>
                            </button>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                        <Button
                            onClick={onClose}
                            className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 text-sm"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleAddToCart}
                            disabled={selectedVariantIndex === null || !selectedVariant || selectedVariant.stock <= 0}
                            className="bg-black hover:bg-zinc-800 text-white px-6 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Add to Cart
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VariantSelectionModal;