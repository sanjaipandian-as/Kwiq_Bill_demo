import React, { useState, useEffect, useRef } from 'react';

const ResizableSplitPane = ({
    left,
    right,
    initialLeftWidth = 70,
    minLeftWidth = 30,
    maxLeftWidth = 85,
    mobileBreakpoint = 768
}) => {
    const [leftWidth, setLeftWidth] = useState(initialLeftWidth);
    const [isResizing, setIsResizing] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth < mobileBreakpoint);
    const containerRef = useRef(null);

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth < mobileBreakpoint);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [mobileBreakpoint]);

    const startResizing = (e) => {
        e.preventDefault();
        setIsResizing(true);
    };

    const stopResizing = () => {
        setIsResizing(false);
    };

    const resize = (e) => {
        if (isResizing && containerRef.current) {
            const containerRect = containerRef.current.getBoundingClientRect();
            const newLeftWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;

            if (newLeftWidth >= minLeftWidth && newLeftWidth <= maxLeftWidth) {
                setLeftWidth(newLeftWidth);
            }
        }
    };

    useEffect(() => {
        if (isResizing) {
            window.addEventListener('mousemove', resize);
            window.addEventListener('mouseup', stopResizing);
        } else {
            window.removeEventListener('mousemove', resize);
            window.removeEventListener('mouseup', stopResizing);
        }
        return () => {
            window.removeEventListener('mousemove', resize);
            window.removeEventListener('mouseup', stopResizing);
        };
    }, [isResizing]);

    if (isMobile) {
        return (
            <div className="flex flex-col gap-4 w-full h-full overflow-hidden">
                <div className="flex-1 overflow-hidden flex flex-col">
                    {left}
                </div>
                <div className="shrink-0">
                    {right}
                </div>
            </div>
        );
    }

    return (
        <div
            ref={containerRef}
            className="flex w-full h-full overflow-hidden relative"
            onMouseUp={stopResizing}
        >
            {/* Left Pane */}
            <div
                style={{ width: `${leftWidth}%` }}
                className="h-full overflow-hidden flex flex-col"
            >
                {left}
            </div>

            {/* Resizer Handle */}
            <div
                className="w-1 hover:w-2 bg-slate-200 hover:bg-blue-400 cursor-col-resize z-10 transition-all duration-200 flex items-center justify-center group"
                onMouseDown={startResizing}
            >
                <div className="h-8 w-1 bg-slate-400 rounded-full group-hover:bg-white" />
            </div>

            {/* Right Pane */}
            <div
                style={{ width: `${100 - leftWidth}%` }}
                className="h-full overflow-hidden flex flex-col"
            >
                {right}
            </div>

            {/* Overlay to prevent iframe capturing mouse events during resize */}
            {isResizing && (
                <div className="absolute inset-0 z-50 cursor-col-resize user-select-none" />
            )}
        </div>
    );
};

export default ResizableSplitPane;
