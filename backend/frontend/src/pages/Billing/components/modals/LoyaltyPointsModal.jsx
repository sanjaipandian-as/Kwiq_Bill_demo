import React, { useState, useEffect, useRef } from 'react';
import { Modal } from '../../../../components/ui/Modal';
import { Input } from '../../../../components/ui/Input';
import { Button } from '../../../../components/ui/Button';
import { useToast } from '../../../../context/ToastContext';

export const LoyaltyPointsModal = ({ isOpen, onClose, onApply, availablePoints = 150 }) => {
    const toast = useToast();
    // Dummy available points if not provided. In real app, fetch from customer.
    const [pointsToRedeem, setPointsToRedeem] = useState(0);
    const conversionRate = 1.0; // 1 Point = ₹1
    const inputRef = useRef(null);

    useEffect(() => {
        if (isOpen && inputRef.current) {
            setTimeout(() => inputRef.current.focus(), 100);
            setPointsToRedeem(0);
        }
    }, [isOpen]);

    const handleSubmit = (e) => {
        e.preventDefault();
        const redeeem = parseInt(pointsToRedeem) || 0;
        if (redeeem > availablePoints) {
            toast.error(`You only have ${availablePoints} points!`);
            return;
        }
        onApply(redeeem * conversionRate);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Redeem Loyalty Points" className="w-full max-w-3xl">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="bg-zinc-50 p-4 rounded-md flex justify-between items-center text-black border border-zinc-200">
                    <span className="font-medium">Available Points</span>
                    <span className="font-bold text-xl">{availablePoints}</span>
                </div>
                <div>
                    <label className="text-sm font-medium text-slate-700">Points to Redeem (1 Pt = ₹{conversionRate})</label>
                    <Input
                        ref={inputRef}
                        type="number"
                        min="0"
                        max={availablePoints}
                        value={pointsToRedeem}
                        onChange={(e) => setPointsToRedeem(e.target.value)}
                        className="text-right text-lg font-bold focus:ring-black focus:border-black"
                        placeholder="0"
                    />
                    <p className="text-right text-sm text-slate-500 mt-1">
                        Discount Value: <span className="font-semibold text-green-600">₹{((parseFloat(pointsToRedeem) || 0) * conversionRate).toFixed(2)}</span>
                    </p>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                    <Button type="button" variant="outline" onClick={onClose} className="border-slate-200 hover:bg-slate-50 text-slate-700">Cancel</Button>
                    <Button type="submit" className="bg-black hover:bg-zinc-800 text-white shadow-md">Redeem</Button>
                </div>
            </form>
        </Modal>
    );
};

export default React.memo(LoyaltyPointsModal);
