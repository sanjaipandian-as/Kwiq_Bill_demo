import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/Table';
import { Button } from '../../../components/ui/Button';
import { Trash2, Plus, Minus, Percent, AlertTriangle, Edit3 } from 'lucide-react';
import { Input } from '../../../components/ui/Input';

// Separate component for quantity input to handle local state
const QuantityInput = ({ item, updateQuantity, isOverStock }) => {
    const [localValue, setLocalValue] = useState(item.quantity.toString());
    const inputRef = useRef(null);
    const hasStockLimit = item.stock !== undefined && item.stock !== null;
    const availableStock = item.stock ?? 0;

    // Sync local value with item quantity when it changes externally
    useEffect(() => {
        setLocalValue(item.quantity.toString());
    }, [item.quantity]);

    const handleChange = (e) => {
        const value = e.target.value;
        // Allow empty string or valid numbers
        if (value === '' || /^\d+$/.test(value)) {
            setLocalValue(value);
        }
    };

    const handleBlur = () => {
        // On blur, commit the value
        const numValue = parseInt(localValue) || 0;
        if (numValue < 1) {
            // If 0 or invalid, reset to 1
            setLocalValue('1');
            updateQuantity(item.id || item._id, 1);
        } else {
            const finalValue = hasStockLimit ? Math.min(numValue, availableStock) : numValue;
            setLocalValue(finalValue.toString());
            updateQuantity(item.id || item._id, finalValue);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            inputRef.current?.blur();
        }
    };

    return (
        <Input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            value={localValue}
            onChange={handleChange}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className={`w-12 h-8 p-0 text-center font-bold text-zinc-900 bg-white border border-zinc-200 focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 rounded-md shadow-sm text-sm ${isOverStock ? 'border-red-500 bg-red-50' : ''}`}
            onClick={(e) => e.stopPropagation()}
        />
    );
};

const BillingGrid = ({
    cart,
    updateQuantity,
    removeItem,
    selectedItemId,
    onRowClick,
    onDiscountClick,
    onUnitClick,
    onPriceClick,
    selectedItems = [],
    onMultiSelectToggle,
    onSelectAll,
    onClearSelection
}) => {
    const gridRef = useRef(null);

    // Handle keyboard navigation and delete
    const handleKeyDown = useCallback((e) => {
        // Shift + Left or Right to Sidebar
        if (e.shiftKey && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
            e.preventDefault();
            const mobileInput = document.getElementById('customer-mobile-input');
            const nameInput = document.getElementById('customer-name-input');
            const amountInput = document.getElementById('amount-received-input');
            
            if (nameInput && !nameInput.value) {
                nameInput.focus();
            } else if (mobileInput && (!mobileInput.value || mobileInput.value.length < 10)) {
                mobileInput.focus();
            } else if (amountInput) {
                amountInput.focus();
            }
            return;
        }

        // Don't handle if user is typing in an input
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
            return;
        }

        const currentIndex = cart.findIndex(item => (item.id || item._id) === selectedItemId);

        if (e.key === 'Delete' || e.key === 'Del') {
            e.preventDefault();
            // Delete selected item(s)
            if (selectedItems.length > 0) {
                // Delete multiple selected items
                selectedItems.forEach(id => removeItem(id));
                if (onClearSelection) onClearSelection();
            } else if (selectedItemId) {
                // Delete single selected item
                removeItem(selectedItemId);
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (cart.length === 0) return;

            // If holding Shift, extend multi-select
            if (e.shiftKey && currentIndex >= 0) {
                const nextIndex = Math.min(currentIndex + 1, cart.length - 1);
                const nextItem = cart[nextIndex];
                if (nextItem && onMultiSelectToggle) {
                    onMultiSelectToggle(nextItem.id || nextItem._id);
                }
            }

            // Move selection down
            if (currentIndex < cart.length - 1) {
                onRowClick(cart[currentIndex + 1]?.id || cart[currentIndex + 1]?._id);
            } else if (currentIndex === -1 && cart.length > 0) {
                // If no item selected, select the first one
                onRowClick(cart[0]?.id || cart[0]?._id);
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (cart.length === 0) return;

            // If holding Shift, extend multi-select
            if (e.shiftKey && currentIndex >= 0) {
                const prevIndex = Math.max(currentIndex - 1, 0);
                const prevItem = cart[prevIndex];
                if (prevItem && onMultiSelectToggle) {
                    onMultiSelectToggle(prevItem.id || prevItem._id);
                }
            }

            // Move selection up
            if (currentIndex > 0) {
                onRowClick(cart[currentIndex - 1]?.id || cart[currentIndex - 1]?._id);
            } else if (currentIndex === 0 || (currentIndex === -1 && cart.length > 0)) {
                // If at first item or no selection, move focus to search bar
                const searchInput = document.getElementById('main-search-input');
                if (searchInput) {
                    e.preventDefault();
                    searchInput.focus();
                    onRowClick(null);
                }
            }
        } else if (e.key === 'Escape') {
            // Clear selection on Escape
            if (onClearSelection) onClearSelection();
            onRowClick(null);
        } else if (e.ctrlKey && e.key === 'a') {
            // Select all with Ctrl+A
            e.preventDefault();
            if (onSelectAll && cart.length > 0) {
                onSelectAll();
            }
        }
    }, [cart, selectedItemId, selectedItems, removeItem, onRowClick, onMultiSelectToggle, onClearSelection, onSelectAll]);

    // Add keyboard event listener
    useEffect(() => {
        const gridElement = gridRef.current;
        if (gridElement) {
            gridElement.addEventListener('keydown', handleKeyDown);
            return () => gridElement.removeEventListener('keydown', handleKeyDown);
        }
    }, [handleKeyDown]);

    // Scroll selected item into view
    useEffect(() => {
        if (selectedItemId && gridRef.current) {
            const selectedRow = gridRef.current.querySelector(`[data-item-id="${selectedItemId}"]`);
            if (selectedRow) {
                selectedRow.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
        }
    }, [selectedItemId]);

    return (
        <div
            ref={gridRef}
            id="billing-grid-container"
            className="flex-1 overflow-y-auto overflow-x-hidden bg-white border rounded-none shadow-none h-full relative outline-none"
            tabIndex={0}
            role="grid"
            aria-label="Billing items grid"
            style={{ willChange: 'transform', overscrollBehavior: 'contain' }}
        >
            <Table className="w-full table-fixed">
                <colgroup>
                    <col style={{ width: '32px' }} />{/* checkbox */}
                    <col style={{ width: '32px' }} />{/* # */}
                    <col style={{ width: '90px' }} />{/* item code */}
                    <col />{/* item name - flex fill */}
                    <col style={{ width: '110px' }} />{/* qty */}
                    <col style={{ width: '48px' }} />{/* unit */}
                    <col style={{ width: '80px' }} />{/* price */}
                    <col style={{ width: '52px' }} />{/* disc */}
                    <col style={{ width: '44px' }} />{/* tax% */}
                    <col style={{ width: '58px' }} />{/* tax */}
                    <col style={{ width: '72px' }} />{/* total */}
                    <col style={{ width: '40px' }} />{/* action */}
                </colgroup>
                <TableHeader className="bg-zinc-50/90 backdrop-blur sticky top-0 z-10 shadow-sm border-b border-zinc-200">
                    <TableRow className="hover:bg-transparent h-11 border-b border-zinc-200">
                        <TableHead className="text-center font-bold text-zinc-700 px-1">
                            <input
                                type="checkbox"
                                checked={selectedItems.length === cart.length && cart.length > 0}
                                onChange={(e) => {
                                    if (onSelectAll) {
                                        if (e.target.checked) {
                                            onSelectAll();
                                        } else {
                                            onClearSelection?.();
                                        }
                                    }
                                }}
                                className="h-4 w-4 rounded border-zinc-300"
                            />
                        </TableHead>
                        <TableHead className="text-center font-bold text-zinc-700 px-1">#</TableHead>
                        <TableHead className="font-bold text-zinc-700 px-1 text-xs">Item Code</TableHead>
                        <TableHead className="font-bold text-slate-700 px-2">Item Name</TableHead>
                        <TableHead className="text-center font-bold text-slate-700 px-1">Qty</TableHead>
                        <TableHead className="font-bold text-slate-700 px-1 text-xs" title="Click to change unit">Unit</TableHead>
                        <TableHead className="text-right font-bold text-slate-700 px-1 text-xs" title="Click to change price">Price</TableHead>
                        <TableHead className="text-right font-bold text-slate-700 px-1 text-xs">Disc.</TableHead>
                        <TableHead className="text-right font-bold text-slate-700 px-1 text-xs">Tax%</TableHead>
                        <TableHead className="text-right font-bold text-slate-700 px-1 text-xs">Tax</TableHead>
                        <TableHead className="text-right font-bold text-slate-700 px-1">Total</TableHead>
                        <TableHead className="text-center font-bold text-slate-700 px-1"></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {cart.map((item, index) => {
                        const isSelected = (item.id || item._id) === selectedItemId;
                        const isMultiSelected = selectedItems.includes(item.id || item._id);
                        const hasStockLimit = item.stock !== undefined && item.stock !== null;
                        const isOverStock = hasStockLimit && item.quantity > item.stock;
                        const availableStock = item.stock ?? 0;

                        return (
                            <TableRow
                                key={item.id || item._id || index}
                                data-item-id={item.id || item._id}
                                className={`cursor-pointer transition-all h-12 border-b border-zinc-100 last:border-0 ${isMultiSelected ? 'bg-blue-50 border-l-4 border-l-blue-500' :
                                    isSelected ? 'bg-zinc-50 border-l-4 border-l-zinc-900 shadow-inner' : 'hover:bg-zinc-50/50'
                                    } ${isOverStock ? 'bg-red-50' : ''}`}
                                onClick={(e) => {
                                    // If holding Ctrl or Cmd, toggle multi-select
                                    if (e.ctrlKey || e.metaKey) {
                                        e.preventDefault();
                                        if (onMultiSelectToggle) {
                                            onMultiSelectToggle(item.id || item._id);
                                        }
                                    }
                                    onRowClick(item.id || item._id);
                                }}
                            >
                                <TableCell className="text-center py-1 px-1">
                                    <input
                                        type="checkbox"
                                        checked={isMultiSelected}
                                        onChange={(e) => {
                                            e.stopPropagation();
                                            if (onMultiSelectToggle) {
                                                onMultiSelectToggle(item.id || item._id);
                                            }
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                        className="h-4 w-4 rounded border-zinc-300"
                                    />
                                </TableCell>
                                <TableCell className="text-center py-1 px-1 text-xs">{index + 1}</TableCell>
                                <TableCell className="font-mono text-[10px] py-1 px-1 text-slate-500 truncate">{item.sku || item.barcode || 'N/A'}</TableCell>
                                <TableCell className="font-medium text-sm py-1 px-2 text-slate-900">
                                    <div className="flex items-center gap-1">
                                        {item.name}
                                        {hasStockLimit && availableStock <= 5 && (
                                            <span className="text-[10px] text-amber-600 font-medium flex items-center gap-0.5">
                                                <AlertTriangle size={10} />
                                                {availableStock} left
                                            </span>
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell className="py-1 px-0.5">
                                    <div className="flex items-center justify-center gap-0.5">
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            className="h-6 w-6 bg-white border-zinc-200 hover:bg-zinc-50 hover:border-zinc-300 text-zinc-600 rounded-md"
                                            onClick={(e) => { e.stopPropagation(); updateQuantity(item.id || item._id, parseInt(item.quantity) - 1); }}
                                        >
                                            <Minus size={9} className="text-slate-600" />
                                        </Button>
                                        <QuantityInput
                                            item={item}
                                            updateQuantity={updateQuantity}
                                            isOverStock={isOverStock}
                                        />
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            className={`h-6 w-6 bg-white border-zinc-200 hover:bg-zinc-50 hover:border-zinc-300 text-zinc-600 rounded-md ${hasStockLimit && item.quantity >= availableStock ? 'opacity-50 cursor-not-allowed' : ''}`}
                                            onClick={(e) => { e.stopPropagation(); updateQuantity(item.id || item._id, parseInt(item.quantity) + 1); }}
                                            disabled={hasStockLimit && item.quantity >= availableStock}
                                        >
                                            <Plus size={9} className="text-slate-600" />
                                        </Button>
                                    </div>
                                </TableCell>
                                <TableCell className="py-1 px-1">
                                    <button
                                        className="text-xs text-slate-500 hover:text-black hover:bg-zinc-100 px-1 py-0.5 rounded transition-colors flex items-center gap-0.5 w-full truncate"
                                        onClick={(e) => { e.stopPropagation(); onUnitClick?.(item.id || item._id); }}
                                        title="Click to change unit (F7)"
                                    >
                                        <span className="truncate">{item.unit || 'pc'}</span>
                                        <Edit3 size={9} className="opacity-40 shrink-0" />
                                    </button>
                                </TableCell>
                                <TableCell className="text-right py-1 px-1">
                                    <button
                                        className="font-medium text-slate-700 hover:text-black hover:bg-zinc-100 px-1 py-0.5 rounded transition-colors inline-flex items-center gap-0.5 text-xs w-full justify-end"
                                        onClick={(e) => { e.stopPropagation(); onPriceClick?.(item.id || item._id); }}
                                        title="Click to change price (F11)"
                                    >
                                        ₹{(item.price || item.sellingPrice || 0).toFixed(2)}
                                        <Edit3 size={9} className="opacity-40 shrink-0" />
                                    </button>
                                </TableCell>
                                <TableCell className="text-right text-black font-medium py-1 px-1 text-xs">
                                    <button
                                        className="hover:bg-zinc-100 px-1 py-0.5 rounded transition-colors w-full text-right"
                                        onClick={(e) => { e.stopPropagation(); onDiscountClick?.(item.id || item._id); }}
                                        title="Click to edit discount (F3)"
                                    >
                                        {item.discount > 0 ? `₹${item.discount.toFixed(2)}` : '-'}
                                    </button>
                                </TableCell>
                                <TableCell className="text-right text-slate-600 py-1 px-1 text-xs">
                                    {item.taxRate ? `${item.taxRate}%` : <span className="text-neutral-400">0%</span>}
                                </TableCell>
                                <TableCell className="text-right text-slate-500 py-1 px-1 text-xs" title={`CGST: ${item.cgst?.toFixed(2) || 0}, SGST: ${item.sgst?.toFixed(2) || 0}, IGST: ${item.igst?.toFixed(2) || 0}`}>
                                    {item.taxAmount !== undefined
                                        ? `₹${item.taxAmount.toFixed(2)}`
                                        : `₹${((Math.max(0, (item.price || 0) * item.quantity - (item.discount || 0))) * (item.taxRate || 0) / 100).toFixed(2)}`
                                    }
                                </TableCell>
                                <TableCell className="text-right font-bold text-sm py-1 px-1 text-slate-900">₹{item.total.toFixed(2)}</TableCell>
                                <TableCell className="py-1 px-1">
                                    <div className="flex items-center justify-center">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 w-7 p-0 text-slate-400 hover:text-black hover:bg-neutral-200 rounded-full"
                                            title="Remove Item (F4)"
                                            onClick={(e) => { e.stopPropagation(); removeItem(item.id || item._id); }}
                                        >
                                            <Trash2 size={14} />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        );
                    })}
                    {/* Empty Rows Fillers to look like POS - memoized to avoid re-renders */}
                    {Array.from({ length: Math.max(0, 10 - cart.length) }).map((_, i) => (
                        <TableRow key={`empty-${i}`} className="h-10 hover:bg-transparent border-dashed border-b border-zinc-100">
                            <TableCell className="text-zinc-200 text-center text-xs">{cart.length + i + 1}</TableCell>
                            <TableCell />
                            <TableCell />
                            <TableCell />
                            <TableCell />
                            <TableCell />
                            <TableCell />
                            <TableCell />
                            <TableCell />
                            <TableCell />
                            <TableCell />
                            <TableCell />
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
};

// Use simple React.memo without custom comparison - default shallow comparison is faster
export default React.memo(BillingGrid);
