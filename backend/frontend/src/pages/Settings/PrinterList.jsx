import React, { useState, useEffect, useCallback, useRef } from 'react';

// Helper Component for Printer Listing
const PrinterList = ({ selectedPrinter, onSelect, settings, saveSettings }) => {
    const [printers, setPrinters] = useState([]);
    const [loading, setLoading] = useState(true);
    const [systemDefaultPrinter, setSystemDefaultPrinter] = useState('');
    const prevPrintersRef = useRef([]);
    const isInitialMount = useRef(true);
    const hasUserSelectedRef = useRef(false);

    // Function to fetch printers and detect changes
    const fetchPrinters = useCallback(async () => {
        if (window.electron && window.electron.getPrinters) {
            try {
                const list = await window.electron.getPrinters();
                
                // Find the system default printer
                const defaultPrinter = list.find(p => p.isDefault);
                const newSystemDefault = defaultPrinter ? defaultPrinter.name : '';
                
                // Check if printers list changed
                const prevPrinters = prevPrintersRef.current;
                const currentPrinterNames = list.map(p => p.name).sort();
                const prevPrinterNames = prevPrinters.map(p => p.name).sort();
                const printersChanged = JSON.stringify(currentPrinterNames) !== JSON.stringify(prevPrinterNames);
                
                // Update system default if changed
                const systemDefaultChanged = systemDefaultPrinter !== newSystemDefault;
                if (systemDefaultChanged) {
                    setSystemDefaultPrinter(newSystemDefault);
                }
                
                // Auto-select logic: only if user hasn't manually selected and we have a system default
                if (!hasUserSelectedRef.current && newSystemDefault) {
                    // On initial mount or when system default changes
                    if (isInitialMount.current || systemDefaultChanged) {
                        onSelect(newSystemDefault);
                        // Save to settings
                        if (settings && saveSettings) {
                            saveSettings({
                                ...settings,
                                print: {
                                    ...settings.print,
                                    printerName: newSystemDefault
                                }
                            });
                        }
                    }
                }
                
                // If a new printer was added (not just reordered), check if we should switch
                if (printersChanged && !isInitialMount.current) {
                    const newPrinters = list.filter(p => !prevPrinters.some(prev => prev.name === p.name));
                    
                    // If new printers were added and system default changed, switch to new default
                    if (newPrinters.length > 0 && systemDefaultChanged && newSystemDefault) {
                        hasUserSelectedRef.current = false; // Reset user selection flag
                        onSelect(newSystemDefault);
                        if (settings && saveSettings) {
                            saveSettings({
                                ...settings,
                                print: {
                                    ...settings.print,
                                    printerName: newSystemDefault
                                }
                            });
                        }
                    }
                }
                
                setPrinters(list);
                prevPrintersRef.current = list;
                
                if (isInitialMount.current) {
                    isInitialMount.current = false;
                }
            } catch (e) {
                console.error("Failed to fetch printers", e);
            }
        }
        setLoading(false);
    }, [selectedPrinter, onSelect, settings, saveSettings, systemDefaultPrinter]);

    // Initial fetch
    useEffect(() => {
        fetchPrinters();
    }, []);

    // Poll for printer changes every 3 seconds
    useEffect(() => {
        const intervalId = setInterval(() => {
            fetchPrinters();
        }, 3000);

        return () => clearInterval(intervalId);
    }, [fetchPrinters]);

    // Handle manual selection - set flag to prevent auto-switching
    const handleSelect = (e) => {
        hasUserSelectedRef.current = true;
        const printerName = e.target.value;
        onSelect(printerName);
        
        // Save to settings when user manually selects
        if (settings && saveSettings) {
            saveSettings({
                ...settings,
                print: {
                    ...settings.print,
                    printerName: printerName
                }
            });
        }
    };

    if (loading) return <div className="text-xs text-slate-500">Loading printers...</div>;

    return (
        <div className="space-y-2">
            <select
                className="w-full h-10 rounded-md border border-slate-200 px-3 bg-white text-sm focus:ring-2 focus:ring-black shadow-sm"
                value={selectedPrinter || ''}
                onChange={handleSelect}
            >
                <option value="">System Default</option>
                {printers.map(p => (
                    <option key={p.name} value={p.name}>
                        {p.name} {p.isDefault ? '(Default)' : ''}
                    </option>
                ))}
            </select>
            {systemDefaultPrinter && (
                <p className="text-xs text-slate-500">
                    System default: {systemDefaultPrinter}
                </p>
            )}
        </div>
    );
};

export default PrinterList;
