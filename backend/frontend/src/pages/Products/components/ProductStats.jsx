import React from 'react';
import { Package, CheckCircle, XCircle, AlertTriangle, AlertOctagon } from 'lucide-react';

const StatCard = ({ label, count, icon: Icon, color, active, onClick }) => {
    // Map colors to ring/text styles for active state
    const colorStyles = {
        slate: 'ring-slate-500',
        emerald: 'ring-emerald-500',
        neutral: 'ring-gray-500',
        amber: 'ring-amber-500',
        rose: 'ring-rose-500'
    };

    const activeRing = active ? `ring-1 ${colorStyles[color] || 'ring-blue-500'}` : '';

    return (
        <button
            onClick={onClick}
            className={`bg-black border border-slate-800 rounded-xl p-6 shadow-sm hover:shadow-md transition-all duration-200 text-left w-full flex items-center justify-between group ${activeRing}`}
        >
            <div>
                <p className="text-sm font-medium text-slate-400 group-hover:text-slate-300 transition-colors">{label}</p>
                <p className="text-3xl font-bold text-white mt-2">{count}</p>
            </div>
            <div className={`bg-slate-800 p-3 rounded-lg group-hover:bg-slate-700 transition-colors`}>
                <Icon className="h-6 w-6 text-white" />
            </div>
        </button>
    );
};

const ProductStats = ({ products, currentFilter, onFilterChange }) => {
    const stats = {
        total: products.length,
        active: products.filter(p => p.isActive !== false).length,
        inactive: products.filter(p => p.isActive === false).length,
        lowStock: products.filter(p => p.stock <= (p.minStock ?? 10) && p.stock > 0).length,
        outOfStock: products.filter(p => p.stock === 0).length
    };

    const filters = [
        { key: 'all', label: 'Total SKUs', icon: Package, count: stats.total, color: 'slate' },
        { key: 'active', label: 'Active', icon: CheckCircle, count: stats.active, color: 'emerald' },
        { key: 'inactive', label: 'Inactive', icon: XCircle, count: stats.inactive, color: 'neutral' },
        { key: 'lowStock', label: 'Low Stock', icon: AlertTriangle, count: stats.lowStock, color: 'amber' },
        { key: 'outOfStock', label: 'Out of Stock', icon: AlertOctagon, count: stats.outOfStock, color: 'rose' },
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {filters.map(({ key, ...rest }) => (
                <StatCard
                    key={key}
                    {...rest}
                    active={currentFilter === key}
                    onClick={() => onFilterChange(key)}
                />
            ))}
        </div>
    );
};

export default ProductStats;
