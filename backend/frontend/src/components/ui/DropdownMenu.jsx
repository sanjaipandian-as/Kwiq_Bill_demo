import React, { useState, useRef, useEffect, createContext, useContext } from 'react';
import { Check, ChevronRight, Circle } from 'lucide-react';
import { cn } from '../../lib/utils';

const DropdownContext = createContext({
    isOpen: false,
    setIsOpen: () => { },
    close: () => { }
});

export const DropdownMenu = ({ children }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef(null);

    const close = () => setIsOpen(false);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    return (
        <DropdownContext.Provider value={{ isOpen, setIsOpen, close }}>
            <div className="relative inline-block text-left" ref={containerRef}>
                {children}
            </div>
        </DropdownContext.Provider>
    );
};

export const DropdownMenuTrigger = ({ children, asChild, className }) => {
    const { isOpen, setIsOpen } = useContext(DropdownContext);

    // If asChild is true, we clone the child and add the onClick handler
    if (asChild && React.isValidElement(children)) {
        return React.cloneElement(children, {
            onClick: (e) => {
                if (children.props.onClick) children.props.onClick(e);
                setIsOpen(!isOpen);
            },
            className: cn(children.props.className, className),
            'aria-expanded': isOpen
        });
    }

    return (
        <button
            onClick={() => setIsOpen(!isOpen)}
            className={cn("inline-flex justify-center rounded-md text-sm font-medium focus:outline-none", className)}
        >
            {children}
        </button>
    );
};

export const DropdownMenuContent = ({ children, align = 'end', className }) => {
    const { isOpen } = useContext(DropdownContext);

    if (!isOpen) return null;

    return (
        <div
            className={cn(
                "absolute z-50 mt-2 min-w-[8rem] rounded-md border border-slate-200 bg-white p-1 shadow-md animate-in fade-in-0 zoom-in-95",
                align === 'end' ? 'right-0 origin-top-right' : 'left-0 origin-top-left',
                className
            )}
        >
            {children}
        </div>
    );
};

export const DropdownMenuItem = ({ children, onClick, className, disabled, inset }) => {
    const { close } = useContext(DropdownContext);

    const handleClick = (e) => {
        if (disabled) return;
        if (onClick) onClick(e);
        close();
    };

    return (
        <div
            onClick={handleClick}
            className={cn(
                "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-slate-100 focus:bg-slate-100 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 cursor-pointer",
                inset && "pl-8",
                className
            )}
        >
            {children}
        </div>
    );
};

export const DropdownMenuCheckboxItem = ({ children, checked, onCheckedChange, disabled, className }) => {
    const { close } = useContext(DropdownContext);

    const handleClick = (e) => {
        if (disabled) return;
        e.preventDefault(); // Don't close immediately? Radix keeps it open typically, but for this simple version let's follow standard behavior or maybe keep open
        // Usually checkbox items keep menu open. Let's not call close().
        if (onCheckedChange) onCheckedChange(!checked);
    };

    return (
        <div
            onClick={handleClick}
            className={cn(
                "relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none transition-colors hover:bg-slate-100 focus:bg-slate-100 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 cursor-pointer",
                className
            )}
        >
            <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                {checked && <Check className="h-4 w-4" />}
            </span>
            {children}
        </div>
    );
};

export const DropdownMenuLabel = ({ children, inset, className }) => (
    <div className={cn("px-2 py-1.5 text-sm font-semibold", inset && "pl-8", className)}>
        {children}
    </div>
);

export const DropdownMenuSeparator = ({ className }) => (
    <div className={cn("-mx-1 my-1 h-px bg-slate-100", className)} />
);
