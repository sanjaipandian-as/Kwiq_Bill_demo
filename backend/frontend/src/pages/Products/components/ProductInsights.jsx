import React, { useState, useEffect } from 'react';
import services from '../../../services/api';
import { formatCappedPercentage } from '../../../utils/formatUtils';
import { TrendingUp, Calendar, DollarSign, Activity, X } from 'lucide-react';

const ProductInsights = ({ product, onClose }) => {
    if (!product) return null;

    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchStats = async () => {
            if (!product?.id) return;
            setLoading(true);
            try {
                const { data } = await services.products.getStats(product.id);
                setStats(data);
            } catch (error) {
                console.error("Failed to load insights", error);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, [product]);

    // Derived logic
    const marginVal = product.price > 0
        ? ((product.price - (product.costPrice || 0)) / product.price * 100).toFixed(1)
        : 0;

    const monthlySales = stats?.monthlySales || 0;

    const formatDate = (dateStr) => {
        if (!dateStr || dateStr === 'Never') return 'Never';
        try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return 'Unknown';
            return d.toLocaleDateString();
        } catch { return 'Unknown'; }
    };

    const lastSold = stats?.lastSold ? formatDate(stats.lastSold) : 'Never';

    // Improved Last Restocked Logic:
    // 1. Try stats.lastRestocked (if backend provides it)
    // 2. Try product.lastPurchased (if available in product pivot)
    // 3. Fallback to product.updatedAt (last modification)
    // 4. Fallback to 'Unknown'
    const lastPurchasedRaw = stats?.lastRestocked || product.lastPurchased || product.updatedAt;
    const lastPurchased = lastPurchasedRaw ? formatDate(lastPurchasedRaw) : 'Unknown';

    const isProfitable = parseFloat(marginVal) > 20;

    return (
        <div className="w-80 border-l border-slate-200 bg-white h-[calc(100vh-64px)] overflow-y-auto hidden xl:block sticky top-0 right-0">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                <h3 className="font-semibold text-slate-900">Product Insights</h3>
                <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                    <X size={18} />
                </button>
            </div>

            <div className="p-4 space-y-6">
                {/* Product Header */}
                <div>
                    <h4 className="font-medium text-slate-900 line-clamp-2">{product.name}</h4>
                    <p className="text-sm text-slate-500 mt-1">{product.sku}</p>
                </div>

                {/* Quick Stats Grid */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-black rounded-lg">
                        <div className="flex items-center gap-2 text-white mb-1">
                            <TrendingUp size={14} />
                            <span className="text-xs font-medium">Sales (30d)</span>
                        </div>
                        <p className="text-xl font-bold text-white">
                            {loading ? '...' : monthlySales}
                        </p>
                    </div>
                    <div className={`p-3 rounded-lg border ${isProfitable ? 'bg-white border-black' : 'bg-neutral-100 border-neutral-300'}`}>
                        <div className={`flex items-center gap-2 mb-1 ${isProfitable ? 'text-black' : 'text-neutral-600'}`}>
                            <DollarSign size={14} />
                            <span className="text-xs font-medium">Margin</span>
                        </div>
                        <p className="text-xl font-bold text-slate-900">{formatCappedPercentage(marginVal)}</p>
                    </div>
                </div>

                {/* Timeline */}
                <div className="space-y-3">
                    <h5 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Activity Timeline</h5>
                    <div className="relative pl-4 border-l border-slate-200 space-y-4">
                        <div className="relative">
                            <div className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-black border-2 border-white" />
                            <p className="text-sm font-medium text-slate-900">Last Sold</p>
                            <p className="text-xs text-slate-500">
                                {loading ? '...' : lastSold}
                            </p>
                        </div>
                        <div className="relative">
                            <div className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-slate-300 border-2 border-white" />
                            <p className="text-sm font-medium text-slate-900">Last Restocked</p>
                            <p className="text-xs text-slate-500">{lastPurchased}</p>
                        </div>
                    </div>
                </div>

                {/* Variants Preview */}
                {product.variants && product.variants.length > 0 && (
                    <div className="space-y-3">
                        <h5 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Variants ({product.variants.length})</h5>
                        <div className="flex flex-wrap gap-2">
                            {product.variants.slice(0, 5).map((v, i) => (
                                <span key={i} className="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded-md border border-slate-200">
                                    {v.options[0]} ({v.stock})
                                </span>
                            ))}
                            {product.variants.length > 5 && (
                                <span className="px-2 py-1 text-xs text-slate-400">+ {product.variants.length - 5} more</span>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProductInsights;
