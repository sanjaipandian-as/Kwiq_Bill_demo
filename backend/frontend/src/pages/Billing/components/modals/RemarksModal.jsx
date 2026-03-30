import React, { useState, useEffect, useRef } from 'react';
import { Modal } from '../../../../components/ui/Modal';
import { Input } from '../../../../components/ui/Input';
import { Button } from '../../../../components/ui/Button';

export const RemarksModal = ({ isOpen, onClose, onSave, initialValue = "" }) => {
    const [text, setText] = useState(initialValue);
    const inputRef = useRef(null);

    useEffect(() => {
        if (isOpen && inputRef.current) {
            setTimeout(() => inputRef.current.focus(), 100);
            setText(initialValue);
        }
    }, [isOpen, initialValue]);

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave(text);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Add Bill Remarks" className="w-full max-w-3xl">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="text-sm font-medium text-slate-700">Remarks / Note</label>
                    <textarea
                        ref={inputRef}
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        className="w-full min-h-[120px] rounded-md border border-slate-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-black resize-none"
                        placeholder="Enter any special instructions or notes..."
                    />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                    <Button type="button" variant="outline" onClick={onClose} className="border-slate-200 hover:bg-slate-50 text-slate-700">Cancel</Button>
                    <Button type="submit" className="bg-black hover:bg-zinc-800 text-white shadow-md">Save Choice</Button>
                </div>
            </form>
        </Modal>
    );
};

export default React.memo(RemarksModal);
