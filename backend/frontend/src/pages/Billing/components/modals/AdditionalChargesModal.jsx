import React, { useState, useEffect, useRef } from 'react';
import { Modal } from '../../../../components/ui/Modal';
import { Input } from '../../../../components/ui/Input';
import { Button } from '../../../../components/ui/Button';

export const AdditionalChargesModal = ({ isOpen, onClose, onApply, initialValue = 0 }) => {
    const [value, setValue] = useState(initialValue);
    const inputRef = useRef(null);

    useEffect(() => {
        if (isOpen && inputRef.current) {
            setTimeout(() => inputRef.current.focus(), 100);
            setValue(initialValue);
        }
    }, [isOpen, initialValue]);

    const handleSubmit = (e) => {
        e.preventDefault();
        onApply(parseFloat(value) || 0);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Additional Charges" className="w-full max-w-3xl">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="text-sm font-medium text-slate-700">Packing/Delivery Charges (₹)</label>
                    <Input
                        ref={inputRef}
                        type="number"
                        step="0.01"
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        className="text-right text-lg font-bold focus:ring-black focus:border-black"
                        placeholder="0.00"
                    />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                    <Button type="button" variant="outline" onClick={onClose} className="border-slate-200 hover:bg-slate-50 text-slate-700">Cancel</Button>
                    <Button type="submit" className="bg-black hover:bg-zinc-800 text-white shadow-md">Apply Charge</Button>
                </div>
            </form>
        </Modal>
    );
};

export default React.memo(AdditionalChargesModal);
