import React from 'react';
import { Minus, Square, X } from 'lucide-react';
import './CustomTitleBar.css';

const CustomTitleBar = () => {
    const handleMinimize = () => {
        if (window.electron?.windowControls) {
            window.electron.windowControls.minimize();
        }
    };

    const handleMaximize = () => {
        if (window.electron?.windowControls) {
            window.electron.windowControls.maximize();
        }
    };

    const handleClose = () => {
        if (window.electron?.windowControls) {
            window.electron.windowControls.close();
        }
    };

    return (
        <div className="h-8 bg-white border-b border-theme flex items-center justify-between px-3 fixed top-0 left-0 right-0 z-50 titlebar">
            {/* App Title / Logo */}
            <div className="flex items-center gap-2">
            </div>

            {/* Window Controls */}
            <div className="flex h-full items-center">
                <button
                    onClick={handleMinimize}
                    className="h-8 w-10 flex items-center justify-center hover:bg-slate-100 text-slate-500 transition-colors titlebar-btn"
                >
                    <Minus size={16} />
                </button>
                <button
                    onClick={handleMaximize}
                    className="h-8 w-10 flex items-center justify-center hover:bg-slate-100 text-slate-500 transition-colors titlebar-btn"
                >
                    <Square size={14} />
                </button>
                <button
                    onClick={handleClose}
                    className="h-8 w-10 flex items-center justify-center hover:bg-red-500 hover:text-white text-slate-500 transition-colors titlebar-btn"
                >
                    <X size={16} />
                </button>
            </div>
        </div>
    );
};

export default CustomTitleBar;
