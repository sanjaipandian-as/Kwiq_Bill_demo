import React, { useMemo } from 'react';
import { Button } from '../../../components/ui/Button';

const BottomFunctionBar = ({ onFunctionClick, selectedCount = 0 }) => {
    const functions = useMemo(() => [
        { key: 'F3', label: 'Item Discount' },
        { key: 'F4', label: 'Remove Item' },
        { key: 'F6', label: 'Change Qty' },
        { key: 'F7', label: 'Change Unit', highlight: false },
        { key: 'F8', label: 'Add Charges' },
        { key: 'F9', label: 'Bill Discount' },
        { key: 'F10', label: 'Loyalty Pts' },
        { key: 'F11', label: 'Change Price', highlight: false},
        { key: 'F12', label: 'Remarks' },
    ], []);

    return (
        <div className="grid grid-cols-5 lg:grid-cols-9 gap-2 p-2 bg-white/80 backdrop-blur-md border-t border-zinc-200 shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.05)] z-10">
            {functions.map((fn) => (
                <Button
                    key={fn.key}
                    variant="outline"
                    className={`flex flex-col items-center justify-center h-12 shadow-sm hover:shadow transition-all duration-200 rounded-lg group relative ${
                        fn.highlight 
                            ? 'bg-slate-900 hover:bg-slate-800 border-slate-900 text-white' 
                            : 'bg-white hover:bg-zinc-50 border-zinc-200 hover:border-zinc-300'
                    }`}
                    onClick={() => onFunctionClick(fn.key)}
                >
                    <span className={`text-xs font-bold mb-0.5 ${fn.highlight ? 'text-white' : 'text-zinc-900'}`}>{fn.key}</span>
                    <span className={`text-[9px] font-medium uppercase tracking-wide ${fn.highlight ? 'text-slate-300 group-hover:text-white' : 'text-zinc-500 group-hover:text-zinc-700'}`}>
                        {fn.label}
                    </span>
                    {/* Show badge for multi-select operations */}
                    {selectedCount > 0 && (fn.key === 'F7' || fn.key === 'F11') && (
                        <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-[8px] font-bold rounded-full h-4 w-4 flex items-center justify-center">
                            {selectedCount}
                        </span>
                    )}
                </Button>
            ))}
        </div>
    );
};

export default React.memo(BottomFunctionBar);
