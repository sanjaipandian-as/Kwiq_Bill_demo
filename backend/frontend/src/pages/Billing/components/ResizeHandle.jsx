import React from 'react';
import { Separator } from 'react-resizable-panels';

const ResizeHandle = () => {
    return (
        <Separator className="group relative w-2 bg-slate-200 hover:bg-blue-400 transition-colors duration-200 cursor-col-resize flex items-center justify-center mx-1">
            {/* Visual indicator */}
            <div className="absolute inset-y-0 w-0.5 bg-slate-300 group-hover:bg-blue-500 transition-colors" />

            {/* Grip dots for better UX */}
            <div className="absolute flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="w-1 h-1 rounded-full bg-slate-400 group-hover:bg-white" />
                <div className="w-1 h-1 rounded-full bg-slate-400 group-hover:bg-white" />
                <div className="w-1 h-1 rounded-full bg-slate-400 group-hover:bg-white" />
            </div>
        </Separator>
    );
};

export default ResizeHandle;
