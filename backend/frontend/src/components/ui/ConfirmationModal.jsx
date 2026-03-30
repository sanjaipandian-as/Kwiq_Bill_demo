import React from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { Button } from './Button';

const ConfirmationModal = ({
    isOpen,
    onClose,
    onConfirm,
    onCancel,
    title,
    message,
    variant = 'danger',
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    showCancel = false
}) => {
    // Handle Enter and Escape keys
    React.useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                onConfirm();
                if (!showCancel) onClose();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onConfirm, onClose, showCancel]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                        {variant === 'danger' && <AlertTriangle className="w-5 h-5 text-red-500" />}
                        {title}
                    </h3>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="px-6 py-6">
                    <p className="text-slate-600 leading-relaxed">
                        {message}
                    </p>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-slate-50 flex justify-end gap-3 border-t border-slate-100">
                    <Button variant="secondary" onClick={onClose}>
                        {showCancel ? 'Stay Here' : cancelText}
                    </Button>

                    {showCancel && onCancel && (
                        <Button variant="outline" onClick={onCancel}>
                            {cancelText}
                        </Button>
                    )}

                    <Button
                        variant={variant}
                        onClick={() => {
                            onConfirm();
                            if (!showCancel) onClose();
                        }}
                    >
                        {confirmText}
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmationModal;
