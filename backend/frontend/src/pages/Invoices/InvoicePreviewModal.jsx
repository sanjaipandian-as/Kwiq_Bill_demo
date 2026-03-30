import React, { useEffect, useRef, useState } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Printer, Check } from 'lucide-react';
import { useSettings } from '../../context/SettingsContext';
import { printReceipt } from '../../utils/printReceipt';
import services from '../../services/api';

const InvoicePreviewModal = ({
    isOpen,
    onClose,
    invoice,
    showConfirmButton = false,
    onConfirm = null,
    isSaved = true
}) => {
    const { settings } = useSettings();
    const iframeRef = useRef(null);

    // Local state for paper size and template (can be changed without affecting global settings)
    const [selectedPaperSize, setSelectedPaperSize] = useState('80mm');
    const [selectedTemplate, setSelectedTemplate] = useState('Modern');

    // State for full invoice details (fetched on open to ensure freshness)
    const [fullInvoice, setFullInvoice] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    // Reset to default settings when modal opens
    useEffect(() => {
        if (isOpen && settings) {
            const defaultTemplate = settings?.invoice?.template || 'Express';
            setSelectedTemplate(defaultTemplate);

            // Receipt templates (Express, Streamlined, Modern, Minimal) default to 80mm
            const receiptTemplates = ['Express', 'Streamlined', 'Minimal'];
            if (receiptTemplates.includes(defaultTemplate)) {
                setSelectedPaperSize('80mm');
            } else {
                setSelectedPaperSize(settings?.invoice?.paperSize || 'A4');
            }
        }
    }, [isOpen, settings]);

    // Handle Enter key to confirm
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (isOpen && showConfirmButton && onConfirm && e.key === 'Enter') {
                e.preventDefault();
                onConfirm(selectedPaperSize);
            }
        };

        if (isOpen) {
            window.addEventListener('keydown', handleKeyDown);
            return () => window.removeEventListener('keydown', handleKeyDown);
        }
    }, [isOpen, showConfirmButton, onConfirm, selectedPaperSize]);

    // Fetch full invoice details when modal opens
    useEffect(() => {
        if (isOpen && invoice) {
            // If it's a preview or not saved yet, don't try to fetch from backend
            if (!isSaved || !invoice.id || String(invoice.id).toUpperCase() === 'PREVIEW') {
                setFullInvoice(invoice);
                return;
            }

            setIsLoading(true);
            services.invoices.getById(invoice.id)
                .then(res => {
                    setFullInvoice(res.data);
                })
                .catch(err => {
                    console.error("Failed to fetch full invoice details", err);
                    setFullInvoice(invoice);
                })
                .finally(() => setIsLoading(false));
        } else {
            setFullInvoice(null);
        }
    }, [isOpen, invoice]);

    // Generate the actual bill HTML using printReceipt function
    useEffect(() => {
        const targetInvoice = fullInvoice || invoice;
        if (isOpen && targetInvoice && iframeRef.current && settings && !isLoading) {
            try {
                // Generate the HTML using the actual printReceipt function
                // Note: 'Modern' maps to Express styles in printReceipt.js if not explicit
                let billHTML = printReceipt(targetInvoice, selectedPaperSize, settings, { preview: true, template: selectedTemplate });

                // INJECT FIX: Express/Modern templates use 42ch width which hits the edge with border-box
                // We inject a style override to use content-box so padding is added OUTSIDE the 42 characters.
                if (selectedTemplate === 'Express' || selectedTemplate === 'Modern') {
                    const styleOverride = `
                        <style>
                            .receipt-container { 
                                box-sizing: content-box !important; 
                                border: 1px solid #ddd !important;
                                margin-bottom: 20px !important;
                                width: max-content !important;
                                max-width: none !important;
                            }
                            body { background: white !important; padding: 10px !important; }
                            .receipt-wrap { padding: 0 !important; overflow-x: auto !important; }
                        </style>
                    `;
                    billHTML = billHTML.replace('</head>', `${styleOverride}</head>`);
                }

                // Write to iframe
                const iframeDoc = iframeRef.current.contentDocument || iframeRef.current.contentWindow.document;
                iframeDoc.open();
                iframeDoc.write(billHTML);
                iframeDoc.close();
            } catch (error) {
                console.error('Error generating bill preview:', error);
            }
        }
    }, [isOpen, fullInvoice, invoice, settings, selectedPaperSize, selectedTemplate, isLoading]);

    const handlePrint = () => {
        const displayInvoice = fullInvoice || invoice;

        // Check if template is compatible with thermal ESC/POS printing
        const thermalTemplates = ['Express', 'Streamlined', 'Modern', 'Minimal'];
        const isThermalTemplate = thermalTemplates.includes(selectedTemplate);

        // Thermal template → ESC/POS pipeline (bypasses HTML rendering)
        if (isThermalTemplate && window.electron?.printThermal) {
            console.log('[PreviewModal] Sending to ESC/POS printer with template:', selectedTemplate);

            // Merge local selection into settings so the thermal printer knows which template to use
            const printSettings = {
                ...settings,
                invoice: {
                    ...settings?.invoice,
                    template: selectedTemplate,
                    paperSize: selectedPaperSize
                }
            };

            window.electron.printThermal(displayInvoice, printSettings)
                .then(result => {
                    if (!result?.success) {
                        console.warn('[PreviewModal] ESC/POS failed.', result?.message);
                        alert(`ESC/POS Print Failed: ${result?.message || 'Unknown error'}`);
                    } else {
                        console.log('[PreviewModal] ESC/POS print succeeded:', result.message);
                    }
                })
                .catch(err => {
                    console.error('[PreviewModal] ESC/POS error:', err);
                    alert(`ESC/POS Print Error: ${err.message || 'Unknown error'}`);
                });
            return;
        }

        // A4 or no ESC/POS bridge → HTML iframe print
        if (iframeRef.current) {
            iframeRef.current.contentWindow.print();
        }
    };

    // Use fullInvoice for display if available
    const displayInvoice = fullInvoice || invoice;

    // Calculate container max-width based on selected paper size
    // Increase slightly for better fitting of content-box thermal receipts
    const isThermal = selectedPaperSize === '80mm';
    const containerMaxWidth = isThermal ? '500px' : '850px';

    // Auto-resize iframe height to content
    const updateIframeHeight = () => {
        if (iframeRef.current) {
            try {
                const iframeDoc = iframeRef.current.contentDocument || iframeRef.current.contentWindow.document;
                if (iframeDoc && iframeDoc.body) {
                    // Set height to 0 first to get accurate scrollHeight if it's shrinking
                    iframeRef.current.style.height = '0px';
                    const height = Math.max(
                        iframeDoc.body.scrollHeight,
                        iframeDoc.documentElement.scrollHeight,
                        iframeDoc.body.offsetHeight,
                        iframeDoc.documentElement.offsetHeight
                    );
                    iframeRef.current.style.height = (height + 20) + 'px';
                }
            } catch (e) {
                console.warn("Could not resize iframe", e);
            }
        }
    };

    // Trigger height update when selected settings change
    useEffect(() => {
        const timer = setTimeout(updateIframeHeight, 300);
        return () => clearTimeout(timer);
    }, [selectedPaperSize, selectedTemplate, fullInvoice, invoice, isLoading]);

    if (!invoice) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Invoice Preview - #${displayInvoice.invoiceNumber || displayInvoice.id}`} size="4xl">
            <div className="flex flex-col h-[calc(100vh-200px)] overflow-hidden">
                {/* Info Bar with Paper Size Selector */}
                <div className="mb-4 p-3 bg-slate-50 rounded-lg border border-slate-200 shrink-0">
                    <div className="flex items-center justify-between text-sm">
                        <div className="flex gap-5">
                            <div>
                                <span className="text-slate-500 font-medium">Customer:</span>
                                <span className="ml-2 text-slate-900 font-semibold">{displayInvoice.customerName || 'Guest'}</span>
                            </div>
                            <div>
                                <span className="text-slate-500 font-medium">Date:</span>
                                <span className="ml-2 text-slate-900">{new Date(displayInvoice.date).toLocaleDateString()}</span>
                            </div>
                            <div>
                                <span className="text-slate-500 font-medium">Total:</span>
                                <span className="ml-2 text-slate-900 font-bold">₹{(displayInvoice.total || 0).toFixed(2)}</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-4 ml-8">
                            <div className="flex items-center gap-2">
                                <label htmlFor="paper-size-select" className="text-xs text-slate-500 font-medium">Paper Size:</label>
                                <select
                                    id="paper-size-select"
                                    value={selectedPaperSize}
                                    onChange={(e) => setSelectedPaperSize(e.target.value)}
                                    className="text-xs px-2 py-1 border border-slate-300 rounded bg-white hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="80mm">Thermal (80mm)</option>
                                    <option value="A4">A4 Paper</option>
                                </select>
                            </div>
                            <div className="flex items-center gap-2">
                                <label htmlFor="template-select" className="text-xs text-slate-500 font-medium">Template:</label>
                                <select
                                    id="template-select"
                                    value={selectedTemplate}
                                    onChange={(e) => {
                                        const newTemplate = e.target.value;
                                        setSelectedTemplate(newTemplate);
                                        // Auto-switch paper size based on template type
                                        const receiptTemplates = ['Express', 'Streamlined', 'Modern', 'Minimal'];
                                        if (receiptTemplates.includes(newTemplate)) {
                                            setSelectedPaperSize('80mm');
                                        } else {
                                            setSelectedPaperSize('A4');
                                        }
                                    }}
                                    className="text-xs px-2 py-1 border border-slate-300 rounded bg-white hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <optgroup label="Receipt (80mm)">
                                        <option value="Express">Express Receipt</option>
                                        <option value="Streamlined">Streamlined Receipt</option>
                                    </optgroup>
                                    <optgroup label="A4 Paper">
                                        <option value="Classic">Classic</option>
                                        <option value="Compact">Compact (Professional)</option>
                                        <option value="GST-Detailed">GST-Detailed</option>
                                    </optgroup>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>


                {/* Bill Preview - Scrollable Area */}
                <div className="flex-1 border rounded-lg bg-slate-100 overflow-y-auto relative custom-scrollbar p-2 md:p-4">
                    <div className="flex justify-center items-start min-h-full">
                        <div
                            className={`${isThermal ? 'bg-white' : 'bg-white shadow-xl'} w-full transition-all duration-300 mx-auto`}
                            style={{ maxWidth: containerMaxWidth }}
                        >
                            <iframe
                                ref={iframeRef}
                                className="bg-transparent w-full"
                                onLoad={updateIframeHeight}
                                style={{
                                    border: 'none',
                                    display: 'block',
                                    overflow: 'hidden'
                                }}
                                title="Bill Preview"
                            />
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex justify-between gap-3 pt-4 mt-4 border-t">
                    <Button variant="outline" onClick={onClose}>
                        {showConfirmButton ? 'Cancel' : 'Close'}
                    </Button>
                    {showConfirmButton && onConfirm ? (
                        <Button
                            className="bg-green-600 hover:bg-green-700 text-white"
                            onClick={() => onConfirm(selectedPaperSize)}
                            data-confirm-button
                        >
                            <Check className="mr-2 h-4 w-4" /> Confirm & Save
                        </Button>
                    ) : isSaved ? (
                        <Button className="bg-black hover:bg-neutral-800 text-white" onClick={handlePrint} data-print-button>
                            <Printer className="mr-2 h-4 w-4" /> Print Receipt
                        </Button>
                    ) : (
                        <Button className="bg-black hover:bg-neutral-800 text-white" onClick={handlePrint} data-print-button>
                            <Printer className="mr-2 h-4 w-4" /> Print
                        </Button>
                    )}
                </div>
            </div>
        </Modal>
    );
};

export default InvoicePreviewModal;

