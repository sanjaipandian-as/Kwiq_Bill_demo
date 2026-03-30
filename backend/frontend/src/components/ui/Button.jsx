import React from 'react';
import { cn } from '../../lib/utils';
import { Loader2 } from 'lucide-react';

const Button = React.forwardRef(({ className, variant = 'primary', size = 'default', children, isLoading, disabled, ...props }, ref) => {
    const baseStyles = "inline-flex items-center justify-center rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none";

    const variants = {
        primary: "bg-primary-main text-white hover:bg-neutral-800 focus:ring-neutral-500",
        secondary: "bg-white text-body-primary border border-theme hover:bg-slate-50 focus:ring-slate-200",
        ghost: "bg-transparent text-body-secondary hover:bg-slate-100 hover:text-body-primary",
        danger: "bg-neutral-900 text-white hover:bg-black focus:ring-neutral-500 border border-neutral-900",
        outline: "border border-theme bg-transparent hover:bg-slate-100 text-body-primary"
    };

    const sizes = {
        sm: "h-8 px-3 text-xs",
        default: "h-10 px-4 py-2 text-sm",
        lg: "h-12 px-6 text-base",
        icon: "h-10 w-10 p-2"
    };

    return (
        <button
            ref={ref}
            className={cn(baseStyles, variants[variant], sizes[size], className)}
            disabled={isLoading || disabled}
            {...props}
        >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {children}
        </button>
    );
});

Button.displayName = "Button";

export { Button };
