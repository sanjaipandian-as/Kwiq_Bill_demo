import SyncButton from '../components/SyncButton';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import {
    TrendingUp,
    Users,
    Package,
    IndianRupee,
    ArrowUpRight,
    ArrowDownRight,
    ScanBarcode,
    ShoppingCart,
    ShoppingBag,
    Calendar,
    Filter,
    CreditCard,
    PlusCircle,
    Download,
    MoreHorizontal,
    Eye
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';
import services from '../services/api';
import { generateDashboardReport } from '../utils/generateReport';
import { isSearchMatch } from '../utils/searchUtils';
import { formatCappedPercentage } from '../utils/formatUtils';
import { Modal } from '../components/ui/Modal';
import useKeyboardShortcuts from '../hooks/useKeyboardShortcuts';
import InvoicePreviewModal from './Invoices/InvoicePreviewModal';
import { useExpenses } from '../context/ExpenseContext';

// PERFORMANCE: Memoized StatCard to prevent re-renders when parent updates
const StatCard = React.memo(({ title, value, change, changeType, icon: Icon, color, secondary }) => (
    <Card className={cn(
        "border-none overflow-hidden h-full bg-white shadow-md rounded-xl",
        secondary ? "bg-slate-50 border border-slate-100 shadow-sm" : "bg-white shadow-sm"
    )}>
        <CardContent className="p-6 h-full flex flex-col justify-between">
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-sm font-medium text-slate-500 mb-1">{title}</p>
                    <h3 className="text-2xl font-bold text-slate-900 tracking-tight" title={value}>{value}</h3>
                </div>
                <div className="p-3 rounded-xl bg-black">
                    <Icon size={20} className="text-white" />
                </div>
            </div>
            <div className="mt-4 flex items-center text-sm">
                {change !== null && change !== undefined ? (
                    <>
                        <span
                            className={cn(
                                "font-medium flex items-center cursor-help",
                                changeType === 'increase' ? "text-slate-900" : "text-slate-600"
                            )}
                            title={`Percentage change compared to the previous period (e.g. Today vs Yesterday). -100% usually means no data for the current period yet.`}
                        >
                            {changeType === 'increase' ? <ArrowUpRight size={16} className="mr-1" /> : <ArrowDownRight size={16} className="mr-1" />}
                            {change}
                        </span>
                        <span className="text-slate-400 ml-2 text-xs">vs last period</span>
                    </>
                ) : (
                    <span className="text-slate-400 font-medium">No prior data</span>
                )}
            </div>
        </CardContent>
    </Card >
));

// PERFORMANCE: Memoized HeroStatCard - removed large background icon to reduce paint cost
const HeroStatCard = React.memo(({ title, value, change, changeType, icon: Icon }) => (
    <Card className="bg-black text-white shadow-xl shadow-slate-900/20 border-none overflow-hidden relative h-full rounded-2xl">
        <CardContent className="p-8 h-full flex flex-col justify-between relative z-10">
            <div>
                <div className="flex items-center gap-2 mb-4 opacity-90">
                    <Icon size={20} />
                    <span className="text-sm font-medium uppercase tracking-wider">{title}</span>
                </div>
                <h3 className="text-5xl font-bold tracking-tight mb-2">{value}</h3>
            </div>

            <div className="flex items-center gap-3">
                {change !== null && change !== undefined ? (
                    <>
                        <div className={cn(
                            "px-3 py-1.5 rounded-full text-sm font-semibold flex items-center bg-slate-700/50 backdrop-blur-sm",
                            changeType === 'increase' ? "text-white" : "text-white"
                        )}>
                            {changeType === 'increase' ? <ArrowUpRight size={16} className="mr-1" /> : <ArrowDownRight size={16} className="mr-1" />}
                            {change}
                        </div>
                        <span className="text-sm opacity-70">vs last period</span>
                    </>
                ) : (
                    <span className="text-sm opacity-70 font-medium bg-white/10 px-3 py-1.5 rounded-full">No prior data</span>
                )}
            </div>
        </CardContent>
    </Card>
));

// PERFORMANCE: Removed animate-pulse to reduce constant repaints
const ActivityBadge = React.memo(() => (
    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-medium border border-slate-200">
        <div className="h-1.5 w-1.5 rounded-full bg-slate-600"></div>
        Healthy
    </div>
));

// PERFORMANCE: Memoized TopMoverItem to prevent re-renders
const TopMoverItem = React.memo(({ product }) => (
    <div className="flex items-center justify-between rounded-xl hover:bg-slate-50 px-3 py-3 transition-colors duration-150">
        <div className="min-w-0 flex-1">
            <p className="font-medium text-slate-700 truncate text-sm" title={product.name}>
                {product.name}
            </p>
            <p className="text-xs text-slate-400">
                {product.quantity} units sold
            </p>
        </div>

        <div className="flex items-center gap-4">
            <p className="text-sm font-bold text-slate-900 text-right min-w-[70px]">
                ₹{(product.revenue || 0).toFixed(0)}
            </p>

            {product.marginPercent != null ? (
                <span className={cn(
                    "text-xs font-semibold px-2.5 py-1 rounded-full min-w-[50px] text-center",
                    product.marginPercent >= 20
                        ? "bg-emerald-100 text-emerald-700"
                        : product.marginPercent > 0
                            ? "bg-amber-100 text-amber-700"
                            : "bg-slate-100 text-slate-600"
                )}>
                    {product.marginPercent.toFixed(0)}%
                </span>
            ) : (
                <span className="text-slate-300 text-xs">—</span>
            )}
        </div>
    </div>
));

// PERFORMANCE: Memoized date formatting to avoid recalculating on every render
const OrderTableRow = React.memo(({ order, formattedTime, onNavigate, getStatusBadge, onInvoiceClick }) => {
    // PERFORMANCE: Stable click handler using useCallback
    return (
        <TableRow
            className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors cursor-pointer"
            onClick={() => onInvoiceClick(order)}
        >
            <TableCell className="py-4 font-medium text-slate-700 text-sm">
                <span className="font-mono text-slate-400 mr-1">#</span>{order.id.slice(-6).toUpperCase()}
                <div className="text-[10px] text-slate-400 mt-0.5">{formattedTime}</div>
            </TableCell>
            <TableCell className="py-4 text-sm">
                <div className="font-medium text-slate-800">{order.customerName || order.customer || 'Walk-in'}</div>
            </TableCell>
            <TableCell className="py-4">
                <div className="flex items-center gap-1.5 text-slate-600 text-sm">
                    {order.paymentMethod.includes('Cash') && <IndianRupee size={12} />}
                    {order.paymentMethod.includes('Card') && <CreditCard size={12} />}
                    {order.paymentMethod.includes('UPI') && <ScanBarcode size={12} />}
                    {order.paymentMethod}
                </div>
            </TableCell>
            <TableCell className="py-4">
                {getStatusBadge(order.status)}
            </TableCell>
            <TableCell className="py-4 text-right font-bold text-slate-800 text-sm">
                ₹{Number(order.total || order.amount || 0).toFixed(2)}
            </TableCell>
        </TableRow>
    );
});

// PERFORMANCE: Memoized CashFlowSection to prevent re-renders when unrelated state changes
const CashFlowSection = React.memo(({ revenue, expenses, netProfit, salesValue, aovValue }) => {
    // PERFORMANCE: Pre-calculate max value and widths to avoid recalculation on every render
    const { maxVal, revenueWidth, expensesWidth, operatingMargin } = useMemo(() => {
        const max = Math.max(revenue, expenses, 1);
        return {
            maxVal: max,
            revenueWidth: `${(revenue / max) * 100}%`,
            expensesWidth: `${(expenses / max) * 100}%`,
            operatingMargin: salesValue > 0 ? (netProfit / salesValue) * 100 : 0
        };
    }, [revenue, expenses, netProfit, salesValue]);

    return (
        <Card className="shadow-md border-none rounded-xl">
            <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
                        <IndianRupee size={18} className="text-slate-400" />
                        Cash Flow Analysis
                    </CardTitle>
                    <ActivityBadge />
                </div>
            </CardHeader>
            <CardContent>
                <div className="space-y-8">
                    <div className="space-y-3">
                        <div className="flex justify-between text-sm">
                            <span className="font-medium text-slate-900">Revenue</span>
                            <span className="font-bold text-slate-900">₹{revenue.toFixed(2)}</span>
                        </div>
                        <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-slate-900 rounded-full" style={{ width: revenueWidth }}></div>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div className="flex justify-between text-sm">
                            <span className="font-medium text-slate-500">Expenses</span>
                            <span className="font-bold text-slate-500">₹{expenses.toFixed(2)}</span>
                        </div>
                        <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-slate-400 rounded-full" style={{ width: expensesWidth }}></div>
                        </div>
                    </div>

                    <div className="pt-6 border-t border-slate-100 grid grid-cols-2 gap-8">
                        <div>
                            <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-2">Operating Margin</p>
                            <p className="text-2xl font-bold text-slate-800">
                                {formatCappedPercentage(operatingMargin)}
                            </p>
                        </div>
                        <div>
                            <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-2">Avg Order Value</p>
                            <p className="text-2xl font-bold text-slate-800">
                                ₹{aovValue.toFixed(0)}
                            </p>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
});

// PERFORMANCE: Memoized DateRangeButton to prevent re-renders
const DateRangeButton = React.memo(({ range, currentRange, onClick }) => (
    <button
        onClick={onClick}
        className={cn(
            "px-4 py-1.5 text-sm font-medium rounded-full capitalize transition-all duration-150",
            currentRange === range ? "bg-slate-900 text-white shadow-sm" : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
        )}
    >
        {range === 'all' ? 'All Time' : range}
    </button>
));

const Dashboard = () => {
    const navigate = useNavigate();
    const { expenses: localExpensesRow } = useExpenses();
    const [statsData, setStatsData] = useState({
        sales: { value: 0, change: 0 },
        orders: { value: 0, change: 0 },
        expenses: { value: 0, change: 0 },
        netProfit: { value: 0, change: 0 },
        aov: { value: 0, change: 0 }
    });
    const [financials, setFinancials] = useState({
        totalExpenses: 0,
        netProfit: 0,
        avgOrderValue: 0
    });
    const [topProducts, setTopProducts] = useState([]);
    const [recentOrders, setRecentOrders] = useState([]);

    // Filters
    const [dateRange, setDateRange] = useState('today');
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');
    const [paymentFilter, setPaymentFilter] = useState('All');
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [isInventoryModalOpen, setIsInventoryModalOpen] = useState(false);

    // Invoice Preview Modal State
    const [isInvoicePreviewOpen, setIsInvoicePreviewOpen] = useState(false);
    const [selectedInvoice, setSelectedInvoice] = useState(null);

    // PERFORMANCE: Memoize keyboard shortcuts to prevent effect re-triggering
    const shortcuts = useMemo(() => ({
        'Alt+N': (e) => { e.preventDefault(); navigate('/billing'); },
        'Alt+P': (e) => { e.preventDefault(); navigate('/products'); },
        'Alt+C': (e) => { e.preventDefault(); navigate('/customers'); },
        'Alt+B': (e) => { e.preventDefault(); navigate('/barcode'); },
    }), [navigate]);

    useKeyboardShortcuts(shortcuts);

    // PERFORMANCE: Memoize date params calculation to prevent recalculation
    const getDateParams = useCallback(() => {
        const now = new Date();
        let start = new Date();
        let end = new Date();

        if (dateRange === 'today') {
            start.setHours(0, 0, 0, 0);
            end.setHours(23, 59, 59, 999);
        } else if (dateRange === 'week') {
            const day = start.getDay();
            const diff = start.getDate() - day + (day === 0 ? -6 : 1);
            start.setDate(diff);
            start.setHours(0, 0, 0, 0);
            end.setHours(23, 59, 59, 999);
        } else if (dateRange === 'month') {
            start.setDate(1);
            start.setHours(0, 0, 0, 0);
            end.setHours(23, 59, 59, 999);
        } else if (dateRange === 'custom') {
            if (!customStart) return {};
            start = new Date(customStart);
            start.setHours(0, 0, 0, 0);
            if (customEnd) {
                end = new Date(customEnd);
                end.setHours(23, 59, 59, 999);
            }
        } else {
            return {};
        }

        return {
            startDate: start.toISOString(),
            endDate: end.toISOString()
        };
    }, [dateRange, customStart, customEnd]);

    useEffect(() => {
        const fetchDashboardData = async () => {
            const params = getDateParams();

            // PERFORMANCE: Parallel API calls to reduce wait time
            services.reports.getDashboardStats(params)
                .then(res => setStatsData(res.data))
                .catch(err => console.error("Stats Error:", err));

            services.reports.getFinancials(params)
                .then(res => setFinancials(res.data))
                .catch(err => console.error("Fin Error:", err));

            services.invoices.getAll({ ...params, limit: 10 })
                .then(res => {
                    let orders = res.data.data || [];

                    // PERFORMANCE: Process orders efficiently and pre-format times
                    orders = orders.map(order => {
                        const payments = order.payments || [];
                        const methods = [...new Set(payments.map(p => p.method).filter(Boolean))];
                        const methodStr = methods.length > 0 ? methods.join(', ') : (order.status === 'Paid' ? 'Cash' : '-');
                        // PERFORMANCE: Pre-format time to avoid Date() calls during render
                        const formattedTime = new Date(order.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        return { ...order, paymentMethod: methodStr, formattedTime };
                    });

                    if (paymentFilter !== 'All') {
                        orders = orders.filter(o => o.paymentMethod.includes(paymentFilter));
                    }
                    setRecentOrders(orders.slice(0, 5));
                })
                .catch(err => console.error("Orders Error:", err));

            services.reports.getTopProducts(params)
                .then(res => setTopProducts(res.data))
                .catch(err => console.error("TopProducts Error:", err));
        };

        fetchDashboardData();
    }, [getDateParams, paymentFilter, refreshTrigger]);

    // Calculate local expenses explicitly during render if in Electron
    const localOverride = useMemo(() => {
        if (!window.electron) return null;

        const params = getDateParams();
        const start = params.startDate ? new Date(params.startDate).getTime() : 0;
        const end = params.endDate ? new Date(params.endDate).getTime() : Infinity;

        // Calculate current period expenses
        const currentExpenses = localExpensesRow.filter(e => {
            const d = new Date(e.date).getTime();
            return d >= start && d <= end;
        });

        // Compute local total expenses
        const totalLocalExpenses = currentExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

        // Calculate previous period expenses for percentage change
        const currentDuration = end === Infinity ? 0 : end - start;
        const prevEnd = start - 1;
        const prevStart = prevEnd - currentDuration;

        const prevExpenses = localExpensesRow.filter(e => {
            if (end === Infinity) return false;
            const d = new Date(e.date).getTime();
            return d >= prevStart && d <= prevEnd;
        });

        const totalPrevExpenses = prevExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
        let change = 0;

        if (totalPrevExpenses > 0) {
            change = Number(((totalLocalExpenses - totalPrevExpenses) / totalPrevExpenses * 100).toFixed(2));
        } else if (totalLocalExpenses > 0) {
            change = 100;
        }

        return {
            totalLocalExpenses,
            change,
            totalPrevExpenses
        };
    }, [localExpensesRow, getDateParams]);

    const finalStatsData = useMemo(() => {
        if (!localOverride) return statsData;
        return {
            ...statsData,
            expenses: {
                value: localOverride.totalLocalExpenses,
                change: localOverride.change,
                prev: localOverride.totalPrevExpenses
            },
            netProfit: {
                ...statsData.netProfit,
                value: (statsData.sales?.value || 0) - localOverride.totalLocalExpenses
            }
        };
    }, [statsData, localOverride]);

    const finalFinancials = useMemo(() => {
        if (!localOverride) return financials;
        return {
            ...financials,
            totalExpenses: localOverride.totalLocalExpenses,
            netProfit: financials.totalRevenue ? (financials.totalRevenue - localOverride.totalLocalExpenses) : ((statsData.sales?.value || 0) - localOverride.totalLocalExpenses)
        };
    }, [financials, localOverride, statsData.sales?.value]);


    // PERFORMANCE: Memoize net profit calculations to avoid recalculation on every render
    const { netProfitValue, netProfitChange, netProfitTrend, netMargin } = useMemo(() => {
        const rawChange = finalStatsData.netProfit?.change;
        return {
            netProfitValue: `₹${(finalFinancials.netProfit || 0).toFixed(2)}`,
            netProfitChange: rawChange !== null && rawChange !== undefined ? formatCappedPercentage(rawChange) : null,
            netProfitTrend: (rawChange || 0) >= 0 ? 'increase' : 'decrease',
            netMargin: formatCappedPercentage(finalStatsData.margins?.net?.value || 0)
        };
    }, [finalFinancials.netProfit, finalStatsData.netProfit?.change, finalStatsData.margins]);

    // PERFORMANCE: Memoize secondary stats to prevent recalculation
    const secondaryStats = useMemo(() => {
        const formatChange = (val) => val !== null && val !== undefined ? formatCappedPercentage(val) : null;

        return [
            {
                title: 'Total Sales',
                value: `₹${(finalStatsData.sales?.value || 0).toFixed(2)}`,
                change: formatChange(finalStatsData.sales?.change),
                changeType: (finalStatsData.sales?.change || 0) >= 0 ? 'increase' : 'decrease',
                icon: IndianRupee,
                color: 'bg-neutral-900',
            },
            {
                title: 'Gross Margin',
                value: formatCappedPercentage(finalStatsData.margins?.gross?.value || 0),
                change: formatChange(finalStatsData.margins?.gross?.change),
                changeType: (finalStatsData.margins?.gross?.change || 0) >= 0 ? 'increase' : 'decrease',
                icon: TrendingUp,
                color: 'bg-neutral-700',
            },
            {
                title: 'Expenses',
                value: `₹${(finalFinancials.totalExpenses || 0).toFixed(2)}`,
                change: formatChange(finalStatsData.expenses?.change),
                changeType: (finalStatsData.expenses?.change || 0) > 50 ? 'decrease' : 'increase',
                icon: ArrowDownRight,
                color: 'bg-neutral-500',
                secondary: true
            },
        ];
    }, [finalStatsData.sales, finalStatsData.margins, finalStatsData.expenses, finalFinancials.totalExpenses]);

    // PERFORMANCE: Memoize status badge function to maintain stable reference
    const getStatusBadge = useCallback((status) => {
        const styles = {
            'Paid': 'bg-slate-100 text-slate-900 ring-1 ring-slate-900/20',
            'Completed': 'bg-slate-100 text-slate-900 ring-1 ring-slate-900/20',
            'Pending': 'bg-white text-slate-600 ring-1 ring-slate-300',
            'Cancelled': 'bg-slate-200 text-slate-900 ring-1 ring-slate-900'
        };
        const defaultStyle = 'bg-slate-50 text-slate-700 ring-1 ring-slate-600/20';
        return (
            <span className={cn("px-3 py-1 rounded-full text-xs font-medium", styles[status] || defaultStyle)}>
                {status}
            </span>
        );
    }, []);

    // PERFORMANCE: Stable navigation callback to prevent child re-renders
    const handleNavigate = useCallback((path) => {
        navigate(path);
    }, [navigate]);

    // PERFORMANCE: Stable date range handlers
    const handleDateRangeChange = useCallback((range) => {
        setDateRange(range);
    }, []);

    const handleCustomStartChange = useCallback((e) => {
        setCustomStart(e.target.value);
    }, []);

    const handleCustomEndChange = useCallback((e) => {
        setCustomEnd(e.target.value);
    }, []);

    const handlePaymentFilterChange = useCallback((e) => {
        setPaymentFilter(e.target.value);
    }, []);

    const handleInventoryModalOpen = useCallback(() => {
        setIsInventoryModalOpen(true);
    }, []);

    const handleInventoryModalClose = useCallback(() => {
        setIsInventoryModalOpen(false);
    }, []);

    const handleInvoicesNavigate = useCallback(() => {
        navigate('/invoices');
    }, [navigate]);

    // Handle opening invoice preview modal
    const handleInvoiceClick = useCallback((order) => {
        setSelectedInvoice(order);
        setIsInvoicePreviewOpen(true);
    }, []);

    const handleInvoicePreviewClose = useCallback(() => {
        setIsInvoicePreviewOpen(false);
        setSelectedInvoice(null);
    }, []);

    // PERFORMANCE: Memoize top 5 products to avoid slicing on every render
    const topFiveProducts = useMemo(() => topProducts.slice(0, 5), [topProducts]);

    // PERFORMANCE: Memoize date range buttons to prevent re-creation
    const dateRanges = useMemo(() => ['today', 'week', 'month', 'all', 'custom'], []);

    return (
        <div className="min-h-screen bg-slate-50 p-6 space-y-8 pb-10">

            {/* Header & Controls */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Overview</h1>
                    <p className="text-slate-500 text-sm">Welcome back, here's what's happening today.</p>
                </div>

                <div className="flex flex-wrap gap-3 items-center">
                    <SyncButton />

                    <div className="h-6 w-px bg-slate-200 mx-1 hidden md:block"></div>

                    {/* PERFORMANCE: Avoid inline object creation in className */}
                    <div className="flex items-center bg-white rounded-full shadow-sm border border-slate-200 p-1">
                        {dateRanges.map((range) => (
                            <DateRangeButton
                                key={range}
                                range={range}
                                currentRange={dateRange}
                                onClick={() => handleDateRangeChange(range)}
                            />
                        ))}
                        {dateRange === 'custom' && (
                            <>
                                <div className="w-px h-4 bg-slate-200 mx-1" />
                                <Input
                                    type="date"
                                    className="w-auto h-8 text-xs"
                                    value={customStart}
                                    onChange={handleCustomStartChange}
                                />
                                <span className="text-slate-300">-</span>
                                <Input
                                    type="date"
                                    className="w-auto h-8 text-xs"
                                    value={customEnd}
                                    onChange={handleCustomEndChange}
                                />
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* SECTION 1: HEALTH (KPIs) */}
            <section className="space-y-6">
                <div className="grid gap-6 md:grid-cols-12 h-auto md:h-48">
                    <div className="md:col-span-5 h-full">
                        <HeroStatCard
                            title="Net Profit"
                            value={
                                <div className="flex items-baseline gap-3">
                                    <span>{netProfitValue}</span>
                                    <span className="text-xl font-medium opacity-70 bg-slate-700/50 px-3 py-1 rounded-full">
                                        {netMargin}
                                    </span>
                                </div>
                            }
                            change={netProfitChange}
                            changeType={netProfitTrend}
                            icon={TrendingUp}
                        />
                    </div>

                    {/* PERFORMANCE: Avoid re-rendering all StatCards when one changes */}
                    <div className="md:col-span-7 h-full grid grid-cols-2 md:grid-cols-3 gap-4">
                        {secondaryStats.map((stat, i) => (
                            <StatCard key={i} {...stat} />
                        ))}
                    </div>
                </div>
            </section>

            {/* SECTION 2: ANALYSIS (Flow & Inventory) */}
            <section className="grid gap-6 lg:grid-cols-2">
                {/* PERFORMANCE: Extracted CashFlowSection to prevent re-renders */}
                <CashFlowSection
                    revenue={finalStatsData.sales?.value || 0}
                    expenses={finalFinancials.totalExpenses || 0}
                    netProfit={finalFinancials.netProfit}
                    salesValue={finalStatsData.sales?.value || 0}
                    aovValue={finalStatsData.aov?.value || 0}
                />

                {/* Inventory Snapshot */}
                <Card className="flex flex-col border-none shadow-sm rounded-2xl bg-white">
                    <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
                                <Package size={18} className="text-slate-400" />
                                Top Movers
                            </CardTitle>

                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 text-xs text-primary-main hover:text-primary-dark hover:bg-primary-50"
                                onClick={handleInventoryModalOpen}
                            >
                                View All <ArrowUpRight size={14} className="ml-1" />
                            </Button>
                        </div>
                    </CardHeader>

                    <div className="px-4 pb-4 space-y-1">
                        {topFiveProducts.length > 0 ? (
                            topFiveProducts.map((product) => (
                                <TopMoverItem key={product.id || product.name} product={product} />
                            ))
                        ) : (
                            <div className="py-8 text-center text-slate-400 text-sm">
                                No data for this period
                            </div>
                        )}
                    </div>
                </Card>

            </section>

            {/* SECTION 3: DETAILS (Transactions) */}
            <section>
                <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-lg font-bold text-slate-900">Recent Activity</h3>
                    <div className="flex items-center gap-2">
                        <select
                            className="text-xs border-none bg-transparent text-slate-500 font-medium focus:ring-0 cursor-pointer"
                            value={paymentFilter}
                            onChange={handlePaymentFilterChange}
                        >
                            <option value="All">All Methods</option>
                            <option value="Cash">Cash Only</option>
                            <option value="Card">Card Only</option>
                            <option value="UPI">UPI Only</option>
                        </select>
                        <Button variant="outline" size="sm" className="h-8 text-xs bg-white" onClick={handleInvoicesNavigate}>
                            View Full History
                        </Button>
                    </div>
                </div>

                <div className="overflow-hidden bg-white rounded-xl shadow-sm border border-slate-100">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-slate-50 hover:bg-slate-50 border-b border-slate-100">
                                <TableHead className="py-4 text-xs uppercase tracking-wider font-semibold text-slate-500">Invoice</TableHead>
                                <TableHead className="py-4 text-xs uppercase tracking-wider font-semibold text-slate-500">Customer</TableHead>
                                <TableHead className="py-4 text-xs uppercase tracking-wider font-semibold text-slate-500">Payment</TableHead>
                                <TableHead className="py-4 text-xs uppercase tracking-wider font-semibold text-slate-500">Status</TableHead>
                                <TableHead className="py-4 text-xs uppercase tracking-wider font-semibold text-slate-500 text-right">Amount</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {recentOrders.length > 0 ? recentOrders.map((order) => (
                                <OrderTableRow
                                    key={order.id}
                                    order={order}
                                    formattedTime={order.formattedTime}
                                    onNavigate={handleNavigate}
                                    getStatusBadge={getStatusBadge}
                                    onInvoiceClick={handleInvoiceClick}
                                />
                            )) : (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8 text-slate-500 text-sm">
                                        No recent transactions found
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </section>

            {/* Invoice Preview Modal */}
            <InvoicePreviewModal
                isOpen={isInvoicePreviewOpen}
                onClose={handleInvoicePreviewClose}
                invoice={selectedInvoice}
            />

            {/* PERFORMANCE: Modal content only renders when open */}
            <Modal
                isOpen={isInventoryModalOpen}
                onClose={handleInventoryModalClose}
                title="Full Inventory Performance"
                className="w-[95vw] md:w-[70vw] h-[80vh] max-w-none"
            >
                <div className="h-full flex flex-col bg-white">
                    <div className="flex-1 overflow-auto">
                        {/* PERFORMANCE: Only render table when modal is open */}
                        {!isInventoryModalOpen ? null : (
                            <Table>
                                <TableHeader className="sticky top-0 bg-slate-50 z-10 shadow-sm">
                                    <TableRow>
                                        <TableHead className="w-[40%]">Product Name</TableHead>
                                        <TableHead className="text-right">Units Sold</TableHead>
                                        <TableHead className="text-right">Total Revenue</TableHead>
                                        <TableHead className="text-right">Margin %</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {topProducts.map((product, idx) => (
                                        <TableRow key={idx} className="hover:bg-slate-50">
                                            <TableCell className="font-medium text-slate-800">{product.name}</TableCell>
                                            <TableCell className="text-right">{product.quantity}</TableCell>
                                            <TableCell className="text-right font-medium">₹{(product.revenue || 0).toFixed(2)}</TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end">
                                                    {product.marginPercent !== null && product.marginPercent !== undefined ? (
                                                        <Badge variant="outline" className={cn(
                                                            "bg-opacity-50 border-0 w-16 justify-center",
                                                            product.marginPercent > 30 ? "bg-slate-900 text-white" :
                                                                product.marginPercent > 10 ? "bg-slate-200 text-slate-800" : "bg-white text-slate-900 border border-slate-200"
                                                        )}>
                                                            {formatCappedPercentage(product.marginPercent)}
                                                        </Badge>
                                                    ) : (
                                                        <span className="text-slate-400 text-sm mr-4">—</span>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default Dashboard;