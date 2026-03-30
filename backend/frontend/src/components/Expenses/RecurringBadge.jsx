import React from 'react';
import { RefreshCw, Calendar } from 'lucide-react';

export const RecurringBadge = ({ frequency, nextDueDate }) => {
    if (!frequency || frequency === 'one-time') return null;

    const frequencyColors = {
        weekly: 'bg-purple-100 text-purple-700 border-purple-200',
        monthly: 'bg-blue-100 text-blue-700 border-blue-200',
        quarterly: 'bg-green-100 text-green-700 border-green-200',
        yearly: 'bg-orange-100 text-orange-700 border-orange-200',
    };

    const frequencyLabels = {
        weekly: 'Weekly',
        monthly: 'Monthly',
        quarterly: 'Quarterly',
        yearly: 'Yearly',
    };

    const colorClass = frequencyColors[frequency] || 'bg-slate-100 text-slate-700 border-slate-200';
    const label = frequencyLabels[frequency] || frequency;

    const formatDate = (date) => {
        if (!date) return '';
        return new Date(date).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    };

    return (
        <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold border ${colorClass}`}>
                <RefreshCw className="h-3 w-3" />
                {label}
            </span>
            {nextDueDate && (
                <span className="inline-flex items-center gap-1 text-xs text-slate-600">
                    <Calendar className="h-3 w-3" />
                    Due: {formatDate(nextDueDate)}
                </span>
            )}
        </div>
    );
};
