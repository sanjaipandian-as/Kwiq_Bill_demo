import React, { useState, useEffect, useRef } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Package, Check } from 'lucide-react';

// Common unit options
const COMMON_UNITS = ['pc', 'kg', 'g', 'l', 'ml', 'box', 'pack', 'meter', 'sq.ft', 'dozen', 'set'];

const UnitModal = ({ isOpen, onClose, onApply, currentItem, cart }) => {
    const [selectedUnit, setSelectedUnit] = useState('');
    const [customUnit, setCustomUnit] = useState('');
    const [isCustom, setIsCustom] = useState(false);
    const inputRef = useRef(null);

    // Get the current item's unit
    const item = cart?.find(i => (i.id || i._id) === currentItem);

    useEffect(() => {
        if (item?.unit) {
            if (COMMON_UNITS.includes(item.unit.toLowerCase())) {
                setSelectedUnit(item.unit.toLowerCase());
                setIsCustom(false);
            } else {
                setSelectedUnit('');
                setCustomUnit(item.unit);
                setIsCustom(true);
            }
        } else {
            setSelectedUnit('pc');
            setIsCustom(false);
        }
    }, [item, isOpen]);

    useEffect(() => {
        if (isOpen && isCustom && inputRef.current) {
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen, isCustom]);

    const handleApply = () => {
        const finalUnit = isCustom ? customUnit.trim() : selectedUnit;
        if (finalUnit) {
            onApply(currentItem, finalUnit);
            onClose();
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleApply();
        } else if (e.key === 'Escape') {
            onClose();
        }
    };

    if (!item) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Change Unit - ${item.name || 'Item'}`}>
            <div className="space-y-4 p-4">
                {/* Current Info */}
                <div className="bg-slate-50 rounded-lg p-3 flex items-center justify-between">
                    <div>
                        <p className="text-sm font-medium text-slate-700">{item.name}</p>
                        <p className="text-xs text-slate-500">Current Unit: <span className="font-semibold text-slate-900">{item.unit || 'pc'}</span></p>
                    </div>
                    <Package className="text-slate-400" size={24} />
                </div>

                {/* Unit Selection */}
                <div>
                    <label className="text-sm font-medium text-slate-700 mb-2 block">Select Unit</label>
                    <div className="grid grid-cols-4 gap-2">
                        {COMMON_UNITS.map((unit) => (
                            <button
                                key={unit}
                                type="button"
                                onClick={() => { setSelectedUnit(unit); setIsCustom(false); }}
                                className={`px-3 py-2 text-sm font-medium rounded-lg border transition-all ${
                                    !isCustom && selectedUnit === unit
                                        ? 'bg-black text-white border-black'
                                        : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                                }`}
                            >
                                {unit}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Custom Unit */}
                <div>
                    <label className="text-sm font-medium text-slate-700 mb-2 block">Or Enter Custom Unit</label>
                    <Input
                        ref={inputRef}
                        value={customUnit}
                        onChange={(e) => { setCustomUnit(e.target.value); setIsCustom(true); }}
                        onKeyDown={handleKeyDown}
                        placeholder="e.g., bundle, case, carton"
                        className={`${isCustom ? 'border-black ring-1 ring-black' : ''}`}
                    />
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                    <Button variant="outline" onClick={onClose} className="flex-1">
                        Cancel
                    </Button>
                    <Button onClick={handleApply} className="flex-1 bg-black hover:bg-slate-800">
                        <Check size={16} className="mr-1" />
                        Apply
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

export default React.memo(UnitModal);
