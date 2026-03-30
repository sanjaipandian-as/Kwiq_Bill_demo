import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import Switch from '../../components/ui/Switch';
import { Badge } from '../../components/ui/Badge';
import {
    Calendar, Download, TrendingUp, TrendingDown, FileText, CreditCard,
    IndianRupee, Wallet, Users, Repeat, Layers, PieChart as PieIcon,
    ArrowUpRight, ArrowDownRight, Share2, Printer, LayoutDashboard, LineChart, HelpCircle
} from 'lucide-react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend, BarChart, Bar, ScatterChart, Scatter, ZAxis, ComposedChart, Line
} from 'recharts';
import services from '../../services/api';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCappedPercentage } from '../../utils/formatUtils';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { useExpenses } from '../../context/ExpenseContext';

// --- Helpers (extracted) ---
const formatCurrency = (val) => `₹${(val || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const formatPercent = (val) => formatCappedPercentage(val);

const getPaymentColor = (method) => {
    const colors = {
        'Cash': '#10b981', 'Card': '#8b5cf6', 'UPI': '#f59e0b',
        'Bank Transfer': '#ec4899', 'Cheque': '#06b6d4'
    };
    return colors[method] || '#64748b';
};

const fillTimeSeries = (data, startDateStr, endDateStr) => {
    const filled = [];
    let current = new Date(startDateStr);
    const end = new Date(endDateStr);
    const duration = end - current;
    const isHourly = duration <= 48 * 60 * 60 * 1000;

    const dataMap = new Map(data.map(item => {
        if (isHourly) return [new Date(item.date).toISOString(), item];
        return [item.date.split('T')[0], item];
    }));

    if (isHourly) current.setMinutes(0, 0, 0);
    else { current.setHours(0, 0, 0, 0); end.setHours(0, 0, 0, 0); }

    while (current <= end) {
        let dateKey;
        if (isHourly) dateKey = current.toISOString();
        else {
            const year = current.getFullYear();
            const month = String(current.getMonth() + 1).padStart(2, '0');
            const day = String(current.getDate()).padStart(2, '0');
            dateKey = `${year}-${month}-${day}`;
        }

        if (dataMap.has(dateKey)) filled.push(dataMap.get(dateKey));
        else filled.push({ date: dateKey, sales: 0, orders: 0 });

        if (isHourly) current.setTime(current.getTime() + 60 * 60 * 1000);
        else current.setDate(current.getDate() + 1);
    }
    return filled;
};

// --- Sub-Components (Memoized) ---

const StatCard = React.memo(({ title, metric, icon: Icon, colorClass, tooltipData }) => {
    const isPositive = metric.change >= 0;
    return (
        <div className="group relative bg-black rounded-xl border border-slate-800 p-5 shadow-sm hover:shadow-md transition-all ">
            <div className="flex justify-between items-start mb-2">
                <div>
                    <p className="text-sm font-medium text-slate-400">{title}</p>
                    <h3 className="text-2xl font-bold text-white mt-1">{metric.prefix || ''}{typeof metric.value === 'number' ? metric.value.toLocaleString() : metric.value}</h3>
                </div>
                <div className={`p-2 rounded-lg bg-slate-900 border border-slate-800`}>
                    <Icon className={`h-5 w-5 text-white`} />
                </div>
            </div>
            <div className="flex items-center gap-2 mb-3">
                <Badge variant="outline" className={`px-1.5 py-0.5 text-xs font-semibold flex items-center bg-slate-800 text-slate-300 border-slate-700`}>
                    {isPositive ? <ArrowUpRight className="h-3 w-3 mr-1" /> : <ArrowDownRight className="h-3 w-3 mr-1" />}
                    {formatCappedPercentage(Math.abs(metric.change))}
                </Badge>
                <span className="text-xs text-slate-400">vs prev period</span>
            </div>
            {metric.sparkline && metric.sparkline.length > 0 && (
                <div className="h-10 w-full opacity-50">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={metric.sparkline}>
                            <Area type="monotone" dataKey="value" stroke={isPositive ? "#10b981" : "#ef4444"} fill="transparent" strokeWidth={2} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            )}
            {tooltipData && (
                <div className="absolute inset-0 bg-white/95 backdrop-blur-sm rounded-xl p-4 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-center border border-slate-200 z-10 pointer-events-none">
                    <p className="text-xs font-bold text-slate-700 uppercase mb-2">Detailed Breakdown</p>
                    {tooltipData.map((t, i) => (
                        <div key={i} className="flex justify-between text-sm py-1 border-b last:border-0 border-slate-100">
                            <span className="text-slate-500">{t.label}</span>
                            <span className="font-medium text-slate-900">{t.value}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
});

const KPIsGrid = React.memo(({ dashboardStats }) => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
            title="Total Revenue"
            metric={{ ...dashboardStats.sales, prefix: '₹' }}
            icon={IndianRupee}
            colorClass="bg-violet-500"
            tooltipData={[
                { label: 'Gross Sales', value: formatCurrency(dashboardStats.sales.value) },
                { label: 'Discounts', value: formatCurrency(dashboardStats.discounts?.value || 0) },
                { label: 'Returns', value: formatCurrency(dashboardStats.returns?.value || 0) }
            ]}
        />
        <StatCard
            title="Net Profit"
            metric={{ ...dashboardStats.netProfit, prefix: '₹' }}
            icon={Wallet}
            colorClass="bg-emerald-500"
            tooltipData={[
                { label: 'Margin', value: formatCappedPercentage(dashboardStats.sales.value ? (dashboardStats.netProfit.value / dashboardStats.sales.value) * 100 : 0) },
                { label: 'Profit/Order', value: formatCurrency(dashboardStats.netProfit.value / (dashboardStats.orders.value || 1)) }
            ]}
        />
        <StatCard
            title="Expenses"
            metric={{ ...dashboardStats.expenses, prefix: '₹' }}
            icon={TrendingDown}
            colorClass="bg-red-500"
            tooltipData={[
                { label: 'Total Recorded', value: formatCurrency(dashboardStats.expenses.value) }
            ]}
        />
        <StatCard
            title="Avg Order Value"
            metric={{ ...dashboardStats.aov, prefix: '₹' }}
            icon={CreditCard}
            colorClass="bg-amber-500"
            tooltipData={[
                { label: 'Total Revenue', value: formatCurrency(dashboardStats.sales.value) },
                { label: 'Total Orders', value: dashboardStats.orders.value }
            ]}
        />
    </div>
));

const ChartsSection = React.memo(({ salesTrend, paymentMethods, visibleMetrics, setVisibleMetrics, compare, setCompare, selectedPaymentMethod, setSelectedPaymentMethod, dashboardSalesValue }) => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                    <CardTitle>Revenue & Order Volume</CardTitle>
                    <div className="relative group">
                        <HelpCircle size={16} className="text-slate-400 cursor-pointer hover:text-slate-600" />
                        <div className="absolute left-0 top-6 w-64 p-3 bg-slate-800 text-white text-xs rounded-lg shadow-xl z-50 hidden group-hover:block">
                            <p className="font-semibold mb-1">How to read this graph:</p>
                            <ul className="list-disc pl-4 space-y-1 text-slate-300">
                                <li><span className="text-violet-400 font-bold">Purple Area:</span> Total Sales Revenue</li>
                                <li><span className="text-amber-400 font-bold">Orange Bars:</span> Number of Orders</li>
                                <li><span className="text-slate-400 font-bold">Dashed Line:</span> Comparison to previous period</li>
                            </ul>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <span className={`text-sm font-medium ${visibleMetrics.revenue ? 'text-violet-600' : 'text-slate-400'}`}>Revenue</span>
                        <Switch
                            checked={visibleMetrics.revenue}
                            onCheckedChange={(checked) => setVisibleMetrics(prev => ({ ...prev, revenue: checked }))}
                            color="bg-violet-600"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <span className={`text-sm font-medium ${visibleMetrics.orders ? 'text-amber-500' : 'text-slate-400'}`}>Orders</span>
                        <Switch
                            checked={visibleMetrics.orders}
                            onCheckedChange={(checked) => setVisibleMetrics(prev => ({ ...prev, orders: checked }))}
                            color="bg-amber-500"
                        />
                    </div>
                    <div className="w-px h-6 bg-slate-200 mx-2"></div>
                    <Button
                        variant="outline"
                        size="sm"
                        className={`${compare ? 'bg-violet-50 text-violet-700 border-violet-200' : 'text-slate-500 border-slate-200'} transition-all`}
                        onClick={() => setCompare(!compare)}
                    >
                        {compare ? 'Hide Comparison' : 'Compare Period'}
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={salesTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colSal" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8} />
                                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis
                            dataKey="date"
                            tick={{ fontSize: 11, fill: '#64748b' }}
                            tickFormatter={(str) => {
                                const d = new Date(str);
                                if (str.length > 10 && str.includes('T')) return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
                                return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
                            }}
                            minTickGap={30}
                        />
                        <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(val) => `₹${val >= 1000 ? (val / 1000).toFixed(1) + 'k' : val}`} />
                        <YAxis yAxisId="right" orientation="right" hide />
                        <Tooltip content={({ active, payload, label }) => {
                            if (active && payload && payload.length) {
                                const currentSales = payload.find(p => p.dataKey === 'sales')?.value || 0;
                                const currentOrders = payload.find(p => p.dataKey === 'orders')?.value || 0;
                                const prevSales = payload.find(p => p.dataKey === 'prevSales')?.value || 0;
                                const isCompare = payload.some(p => p.dataKey === 'prevSales');
                                let change = 0;
                                if (isCompare && prevSales > 0) change = ((currentSales - prevSales) / prevSales) * 100;

                                return (
                                    <div className="bg-white p-3 border border-slate-200 shadow-lg rounded-lg text-xs">
                                        <p className="font-semibold text-slate-700 mb-2">{(() => {
                                            const d = new Date(label);
                                            if (label.length > 10 && label.includes('T')) return d.toLocaleDateString('en-IN', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                                            return d.toLocaleDateString('en-IN', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
                                        })()}</p>
                                        <div className="flex items-center justify-between gap-4 mb-1">
                                            <span className="text-violet-600 font-medium">Current:</span>
                                            <span className="font-bold">{formatCurrency(currentSales)}</span>
                                        </div>
                                        <div className="pt-2 border-t border-slate-100">
                                            <div className="flex items-center justify-between gap-4">
                                                <span className="text-amber-500 font-medium">Invoices:</span>
                                                <span className="font-bold">{currentOrders}</span>
                                            </div>
                                            <div className="flex items-center justify-between gap-4 mt-1">
                                                <span className="text-slate-400 font-medium text-[10px]">Avg Order:</span>
                                                <span className="font-bold text-slate-500 text-[10px]">{currentOrders > 0 ? formatCurrency(currentSales / currentOrders) : '₹0'}</span>
                                            </div>
                                        </div>
                                        {isCompare && (
                                            <>
                                                <div className="flex items-center justify-between gap-4 mb-2">
                                                    <span className="text-slate-500 font-medium">Previous:</span>
                                                    <span className="font-bold text-slate-600">{formatCurrency(prevSales)}</span>
                                                </div>
                                                <div className={`pt-2 border-t border-slate-100 flex items-center justify-between gap-2 ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                    <span className="font-medium">Change:</span>
                                                    <span className="font-bold flex items-center">
                                                        {change >= 0 ? <ArrowUpRight size={12} className="mr-1" /> : <ArrowDownRight size={12} className="mr-1" />}
                                                        {Math.abs(change).toFixed(1)}%
                                                    </span>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                );
                            }
                            return null;
                        }} />
                        {visibleMetrics.revenue && <Bar yAxisId="left" dataKey="sales" fill="#8b5cf6" barSize={20} radius={[4, 4, 0, 0]} />}
                        {visibleMetrics.revenue && compare && <Area yAxisId="left" type="monotone" dataKey="prevSales" name="Previous Sales" stroke="#94a3b8" strokeDasharray="4 4" fill="none" strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />}
                        {visibleMetrics.orders && <Bar yAxisId="right" dataKey="orders" barSize={20} fill="#f59e0b" radius={[4, 4, 0, 0]} opacity={0.6} />}
                    </ComposedChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>

        <Card>
            <CardHeader><CardTitle>Payment Methods</CardTitle></CardHeader>
            <CardContent className="h-80 relative">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={paymentMethods}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                            onClick={(data) => setSelectedPaymentMethod(selectedPaymentMethod === data.name ? null : data.name)}
                        >
                            {paymentMethods.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={getPaymentColor(entry.name)} opacity={selectedPaymentMethod && selectedPaymentMethod !== entry.name ? 0.3 : 1} />
                            ))}
                        </Pie>
                        <Tooltip formatter={(value) => formatCurrency(value)} />
                        <Legend verticalAlign="bottom" height={36} />
                    </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-8">
                    <span className="text-xs text-slate-500">Total</span>
                    <span className="font-bold text-slate-900">{formatCurrency(dashboardSalesValue)}</span>
                </div>
            </CardContent>
        </Card>
    </div>
));

const InsightsSection = React.memo(({ customers, topProducts }) => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                    <CardTitle className="flex items-center gap-2"><Users size={16} /> Customer Insights</CardTitle>
                    <div className="relative group">
                        <HelpCircle size={16} className="text-slate-400 cursor-pointer hover:text-slate-600" />
                        <div className="absolute left-0 top-6 w-64 p-3 bg-slate-800 text-white text-xs rounded-lg shadow-xl z-50 hidden group-hover:block">
                            <p className="font-semibold mb-1">Metrics Guide:</p>
                            <ul className="list-disc pl-4 space-y-1 text-slate-300">
                                <li><span className="text-indigo-400 font-bold">Retention Rate:</span> % of active customers in this period who have shopped more than once.</li>
                                <li><span className="text-amber-400 font-bold">CLV (Lifetime Value):</span> Avg. total revenue generated per customer over their entire history.</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="flex justify-between items-center border-b pb-4">
                    <div>
                        <p className="text-sm text-slate-500">New Customers</p>
                        <p className="text-xl font-bold text-emerald-600">{customers.newCustomers}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-sm text-slate-500">Returning</p>
                        <p className="text-xl font-bold text-indigo-600">{customers.returningCustomers}</p>
                    </div>
                </div>
                <div className="flex justify-between items-center">
                    <div>
                        <p className="text-sm text-slate-500">Repeat Rate</p>
                        <p className="text-lg font-semibold">{customers.repeatRate.toFixed(1)}%</p>
                    </div>
                    <div>
                        <p className="text-sm text-slate-500 text-right">CLV (Est.)</p>
                        <p className="text-lg font-semibold">{formatCurrency(customers.clv)}</p>
                    </div>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg text-xs text-slate-500">
                    <strong>Tip:</strong> Improve CLV by running loyalty campaigns for returning users.
                </div>
            </CardContent>
        </Card>

        <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                    <CardTitle>Product Performance Matrix</CardTitle>
                    <div className="relative group">
                        <HelpCircle size={16} className="text-slate-400 cursor-pointer hover:text-slate-600" />
                        <div className="absolute right-0 top-6 w-64 p-3 bg-slate-800 text-white text-xs rounded-lg shadow-xl z-50 hidden group-hover:block">
                            <p className="font-semibold mb-1">Matrix Guide:</p>
                            <ul className="list-disc pl-4 space-y-1 text-slate-300">
                                <li><span className="text-emerald-400 font-bold">Green:</span> High Margin & High Revenue (Stars)</li>
                                <li><span className="text-amber-400 font-bold">Orange:</span> High Margin but Low Revenue (Potential)</li>
                                <li><span className="text-rose-400 font-bold">Red:</span> Low Margin (Risk)</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                        <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                        <XAxis type="number" dataKey="marginPercent" name="Margin" unit="%" domain={[0, 'auto']} label={{ value: 'Margin %', position: 'insideBottom', offset: -10 }} tickFormatter={(val) => val.toFixed(2)} tick={{ fill: '#64748b', fontSize: 11 }} />
                        <YAxis type="number" dataKey="revenue" name="Revenue" unit="₹" label={{ value: 'Revenue', angle: -90, position: 'insideLeft' }} tick={{ fill: '#64748b', fontSize: 11 }} />
                        <ZAxis type="number" dataKey="quantity" range={[60, 400]} name="Quantity" />
                        <Tooltip cursor={{ strokeDasharray: '3 3' }} content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                                const data = payload[0].payload;
                                return (
                                    <div className="bg-white p-2 border border-slate-200 shadow-lg rounded text-xs z-50">
                                        <p className="font-bold text-slate-700 mb-1">{data.name}</p>
                                        <div className="space-y-0.5">
                                            <p><span className="text-slate-500">Revenue:</span> <span className="font-medium">{formatCurrency(data.revenue)}</span></p>
                                            <p><span className="text-slate-500">Margin:</span> <span className="font-medium text-slate-800">{Number(data.marginPercent).toFixed(2)}%</span></p>
                                            <p><span className="text-slate-500">Quantity:</span> <span className="font-medium">{data.quantity}</span></p>
                                        </div>
                                    </div>
                                );
                            }
                            return null;
                        }} />
                        <Scatter name="Products" data={topProducts} fill="#8b5cf6">
                            {topProducts.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.marginPercent > 30 ? (entry.revenue > 5000 ? '#10b981' : '#f59e0b') : '#ef4444'} />
                            ))}
                        </Scatter>
                    </ScatterChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    </div>
));

const TopProductsSection = React.memo(({ topProducts, topProductsTab, setTopProductsTab }) => (
    <Card>
        <CardHeader className="border-b bg-slate-50/50 py-3">
            <div className="flex items-center justify-between">
                <CardTitle>Top Performers</CardTitle>
                <div className="flex gap-2">
                    {['product', 'category', 'brand'].map(tab => (
                        <button
                            key={tab}
                            onClick={() => setTopProductsTab(tab)}
                            className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${topProductsTab === tab ? 'bg-violet-100 text-violet-700' : 'text-slate-500 hover:bg-slate-100'}`}
                        >
                            {tab.charAt(0).toUpperCase() + tab.slice(1)}s
                        </button>
                    ))}
                </div>
            </div>
        </CardHeader>
        <CardContent className="p-0">
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-500 font-medium">
                        <tr>
                            <th className="px-4 py-3">Name</th>
                            <th className="px-4 py-3 text-right">Revenue</th>
                            <th className="px-4 py-3 text-right">Units</th>
                            <th className="px-4 py-3 text-right">Margin %</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {topProducts.map((p, i) => (
                            <tr key={i} className="hover:bg-slate-50/50">
                                <td className="px-4 py-3 font-medium text-slate-800">{p.name}</td>
                                <td className="px-4 py-3 text-right">{formatCurrency(p.revenue)}</td>
                                <td className="px-4 py-3 text-right">{p.quantity}</td>
                                <td className="px-4 py-3 text-right">
                                    <span className={`px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-700`}>
                                        {formatPercent(p.marginPercent)}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </CardContent>
    </Card>
));

const OwnerView = React.memo(({ stats, datePreset, printRef }) => (
    <div className="space-y-6" ref={printRef}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card className="bg-slate-900 text-white border-none shadow-lg">
                <CardContent className="p-6">
                    <h3 className="text-lg font-medium opacity-90 mb-1">Revenue Growth</h3>
                    <p className="text-3xl font-bold mb-4">{stats.dashboard.sales.change > 0 ? '+' : ''}{formatCappedPercentage(stats.dashboard.sales.change)}</p>
                    <p className="text-sm opacity-80">
                        Compared to previous period, you made <strong>{formatCurrency(Math.abs(stats.dashboard.sales.value - stats.dashboard.sales.prev))}</strong> {stats.dashboard.sales.value >= stats.dashboard.sales.prev ? 'more' : 'less'} in revenue.
                    </p>
                </CardContent>
            </Card>
            <Card className="bg-slate-900 text-white border-none shadow-lg">
                <CardContent className="p-6">
                    <h3 className="text-lg font-medium opacity-90 mb-1">Net Margin</h3>
                    <p className="text-3xl font-bold mb-4">
                        {formatCappedPercentage(stats.dashboard.sales.value > 0 ? (stats.dashboard.netProfit.value / stats.dashboard.sales.value) * 100 : 0)}
                    </p>
                    <p className="text-sm opacity-80">
                        You kept <strong>{formatCurrency(stats.dashboard.netProfit.value)}</strong> as pure profit after {formatCurrency(stats.dashboard.expenses.value)} in expenses.
                    </p>
                </CardContent>
            </Card>
            <Card className="bg-slate-900 border-none shadow-lg">
                <CardContent className="p-6">
                    <h3 className="text-lg font-bold text-white mb-4">Top Category</h3>
                    {stats.topProducts.length > 0 ? (
                        <div>
                            <p className="text-2xl font-bold text-violet-600">{stats.topProducts[0]?.name || 'N/A'}</p>
                            <p className="text-sm text-slate-500 mt-1">{stats.topProducts[0]?.quantity} units sold</p>
                        </div>
                    ) : (
                        <p className="text-slate-400">No data available</p>
                    )}
                </CardContent>
            </Card>
        </div>
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                    <CardTitle>Revenue Trend</CardTitle>
                    <div className="relative group">
                        <HelpCircle size={16} className="text-slate-400 cursor-pointer hover:text-slate-600" />
                        <div className="absolute left-0 bottom-6 w-64 p-3 bg-slate-800 text-white text-xs rounded-lg shadow-xl z-50 hidden group-hover:block">
                            <p className="font-semibold mb-1">Trend Analysis:</p>
                            <p className="text-slate-300">Shows your revenue performance over the selected period. Use this to spot peak hours or days and identify growth patterns.</p>
                        </div>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={stats.salesTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorSalesOwner" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8} />
                                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(str) => {
                            const d = new Date(str);
                            if (str.length > 10 && str.includes('T')) return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
                            return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
                        }} minTickGap={30} />
                        <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(val) => `₹${val >= 1000 ? (val / 1000).toFixed(1) + 'k' : val}`} />
                        <Tooltip content={({ active, payload, label }) => {
                            if (active && payload && payload.length) {
                                const currentSales = payload[0].value;
                                return (
                                    <div className="bg-white p-2 border border-slate-200 shadow-lg rounded text-xs">
                                        <p className="font-semibold text-slate-700 mb-1">{(() => {
                                            const d = new Date(label);
                                            if (label.length > 10 && label.includes('T')) return d.toLocaleDateString('en-IN', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                                            return d.toLocaleDateString('en-IN', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
                                        })()}</p>
                                        <div className="flex items-center gap-2">
                                            <span className="text-violet-600 font-medium">Revenue:</span>
                                            <span className="font-bold">{formatCurrency(currentSales)}</span>
                                        </div>
                                    </div>
                                );
                            }
                            return null;
                        }} />
                        <Area type="monotone" dataKey="sales" stroke="#8b5cf6" strokeWidth={2} fillOpacity={1} fill="url(#colorSalesOwner)" activeDot={{ r: 6, strokeWidth: 0 }} />
                    </AreaChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    </div>
));

const AnalystView = React.memo(({
    dashboardStats,
    salesTrend,
    paymentMethods,
    customers,
    topProducts,
    visibleMetrics,
    setVisibleMetrics,
    compare,
    setCompare,
    selectedPaymentMethod,
    setSelectedPaymentMethod,
    topProductsTab,
    setTopProductsTab
}) => (
    <div className="space-y-6">
        <KPIsGrid dashboardStats={dashboardStats} />
        <ChartsSection
            salesTrend={salesTrend}
            paymentMethods={paymentMethods}
            visibleMetrics={visibleMetrics}
            setVisibleMetrics={setVisibleMetrics}
            compare={compare}
            setCompare={setCompare}
            selectedPaymentMethod={selectedPaymentMethod}
            setSelectedPaymentMethod={setSelectedPaymentMethod}
            dashboardSalesValue={dashboardStats.sales.value}
        />
        <InsightsSection customers={customers} topProducts={topProducts} />
        <TopProductsSection
            topProducts={topProducts}
            topProductsTab={topProductsTab}
            setTopProductsTab={setTopProductsTab}
        />
    </div>
));

const ReportsPage = () => {
    // --- State ---
    const [viewMode, setViewMode] = useState('analyst');
    const [datePreset, setDatePreset] = useState('today');
    const [dateRange, setDateRange] = useState({ start: '', end: '' });
    const [compare, setCompare] = useState(false);
    const [visibleMetrics, setVisibleMetrics] = useState({ revenue: true, orders: true });
    const [loading, setLoading] = useState(true);
    const [isExporting, setIsExporting] = useState(false);

    const [showExportModal, setShowExportModal] = useState(false);
    const [exportOptions, setExportOptions] = useState({
        type: 'this_month',
        startDate: '',
        endDate: '',
        specificMonth: ''
    });

    // Split state for isolated updates
    const [dashboardStats, setDashboardStats] = useState({
        sales: { value: 0, prev: 0, change: 0, sparkline: [] },
        orders: { value: 0, prev: 0, change: 0 },
        expenses: { value: 0, prev: 0, change: 0 },
        netProfit: { value: 0, prev: 0, change: 0 },
        aov: { value: 0, prev: 0, change: 0 }
    });
    const [customers, setCustomers] = useState({ newCustomers: 0, returningCustomers: 0, repeatRate: 0, clv: 0 });
    const [paymentMethods, setPaymentMethods] = useState([]);
    const [salesTrend, setSalesTrend] = useState([]);
    const [topProducts, setTopProducts] = useState([]);

    const [topProductsTab, setTopProductsTab] = useState('product');
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(null);
    const printRef = useRef();
    const { expenses: localExpensesRow } = useExpenses();

    // Calculate local expenses explicitly during render if in Electron
    const localOverride = useMemo(() => {
        if (!window.electron || !dateRange.start) return null;

        const start = new Date(dateRange.start).getTime();
        const end = new Date(dateRange.end).getTime();

        const currentExpenses = localExpensesRow.filter(e => {
            const d = new Date(e.date).getTime();
            return d >= start && d <= end;
        });
        const totalLocalExpenses = currentExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

        const duration = end - start;
        const prevEnd = start - 1;
        const prevStart = prevEnd - duration;

        const prevExpenses = localExpensesRow.filter(e => {
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
    }, [localExpensesRow, dateRange]);

    const finalDashboardStats = useMemo(() => {
        if (!localOverride) return dashboardStats;
        return {
            ...dashboardStats,
            expenses: {
                value: localOverride.totalLocalExpenses,
                change: localOverride.change,
                prev: localOverride.totalPrevExpenses
            },
            netProfit: {
                ...dashboardStats.netProfit,
                value: (dashboardStats.sales?.value || 0) - localOverride.totalLocalExpenses
            }
        };
    }, [dashboardStats, localOverride]);

    // Memoize stats object for OwnerView to prevent unnecessary re-renders
    const ownerStats = useMemo(() => ({
        dashboard: finalDashboardStats,
        topProducts,
        salesTrend
    }), [finalDashboardStats, topProducts, salesTrend]);

    // --- Date Logic ---
    useEffect(() => {
        const now = new Date();
        let start = new Date();
        let end = new Date();

        switch (datePreset) {
            case 'today':
                start.setHours(0, 0, 0, 0); end.setHours(23, 59, 59, 999);
                break;
            case 'yesterday':
                start.setDate(start.getDate() - 1); start.setHours(0, 0, 0, 0);
                end.setDate(end.getDate()); end.setHours(23, 59, 59, 999);
                end = new Date(start); end.setHours(23, 59, 59, 999);
                break;
            case 'thisWeek':
                const day = start.getDay();
                const diff = start.getDate() - day + (day === 0 ? -6 : 1);
                start.setDate(diff); start.setHours(0, 0, 0, 0); end.setHours(23, 59, 59, 999);
                break;
            case 'thisMonth':
                start = new Date(now.getFullYear(), now.getMonth(), 1);
                end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
                break;
            case 'lastMonth':
                start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
                break;
            default: break;
        }
        setDateRange({ start: start.toISOString(), end: end.toISOString() });
    }, [datePreset]);

    // --- Main Data Fetching (Date/Compare changes) ---
    useEffect(() => {
        if (!dateRange.start) return;

        const fetchData = async () => {
            setLoading(true);
            try {
                const params = { startDate: dateRange.start, endDate: dateRange.end };
                const promises = [
                    services.reports.getDashboardStats(params),
                    services.reports.getCustomerMetrics(params),
                    services.reports.getPaymentMethodStats(params),
                    services.reports.getSalesTrend(params)
                ];

                if (compare) {
                    const start = new Date(dateRange.start);
                    const end = new Date(dateRange.end);
                    const duration = end.getTime() - start.getTime();
                    const prevEnd = new Date(start.getTime() - 1);
                    const prevStart = new Date(prevEnd.getTime() - duration);
                    promises.push(services.reports.getSalesTrend({ startDate: prevStart.toISOString(), endDate: prevEnd.toISOString() }));
                }

                const results = await Promise.all(promises);

                setDashboardStats(results[0].data);
                setCustomers(results[1].data);
                setPaymentMethods(results[2].data);

                let trendRes = results[3];
                const currentTrendRaw = trendRes.data || [];
                const currentTrendFilled = fillTimeSeries(currentTrendRaw, dateRange.start, dateRange.end);

                if (compare && results[4]) {
                    const prevTrendRaw = results[4].data || [];
                    const startRaw = new Date(dateRange.start);
                    const endRaw = new Date(dateRange.end);
                    const duration = endRaw.getTime() - startRaw.getTime();
                    const prevEnd = new Date(startRaw.getTime() - 1);
                    const prevStart = new Date(prevEnd.getTime() - duration);
                    const prevTrendFilled = fillTimeSeries(prevTrendRaw, prevStart.toISOString(), prevEnd.toISOString());

                    setSalesTrend(currentTrendFilled.map((item, index) => ({
                        ...item,
                        prevSales: prevTrendFilled[index] ? prevTrendFilled[index].sales : 0,
                        prevOrders: prevTrendFilled[index] ? prevTrendFilled[index].orders : 0
                    })));
                } else {
                    setSalesTrend(currentTrendFilled);
                }

                // Initial fetch for top products (default 'product' tab)
                const prodRes = await services.reports.getTopProducts({ ...params, groupBy: topProductsTab });
                setTopProducts(prodRes.data);

            } catch (error) {
                console.error("Analytics Error:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [dateRange, compare]);



    // --- Independent Fetching for Top Products Tab ---
    useEffect(() => {
        if (!dateRange.start) return;
        // Skip initial load as it's handled above, or just let it run (minor dup on initial load less complex state sync)
        // Optimization: Only run if loading is false (meaning main fetch done) to avoid race conditions or use separate Loading
        if (loading) return;

        const fetchTopProducts = async () => {
            try {
                const params = { startDate: dateRange.start, endDate: dateRange.end, groupBy: topProductsTab };
                const prodRes = await services.reports.getTopProducts(params);
                setTopProducts(prodRes.data);
            } catch (error) {
                console.error("Products Error:", error);
            }
        };

        fetchTopProducts();
    }, [topProductsTab, dateRange, loading]); // Dependent on dateRange too, but main effect handles date changes.

    const handleConfirmExport = async () => {
        setIsExporting(true);
        try {
            let startD, endD;
            const now = new Date();

            if (exportOptions.type === 'this_month') {
                const s = new Date(now.getFullYear(), now.getMonth(), 1);
                const e = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
                startD = s.toISOString(); endD = e.toISOString();
            } else if (exportOptions.type === 'last_month') {
                const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                const e = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
                startD = s.toISOString(); endD = e.toISOString();
            } else if (exportOptions.type === 'specific_month' && exportOptions.specificMonth) {
                const [year, month] = exportOptions.specificMonth.split('-');
                const s = new Date(parseInt(year), parseInt(month) - 1, 1);
                const e = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59, 999);
                startD = s.toISOString(); endD = e.toISOString();
            } else if (exportOptions.type === 'date_range' && exportOptions.startDate && exportOptions.endDate) {
                const s = new Date(exportOptions.startDate);
                s.setHours(0, 0, 0, 0);
                const e = new Date(exportOptions.endDate);
                e.setHours(23, 59, 59, 999);
                startD = s.toISOString(); endD = e.toISOString();
            } else if (exportOptions.type === 'dashboard_current') {
                startD = dateRange.start;
                endD = dateRange.end;
            } else {
                alert("Please select valid dates for export.");
                setIsExporting(false);
                return;
            }

            const params = { startDate: startD, endDate: endD };

            // Re-fetch standard stats specific for the PDF
            const results = await Promise.all([
                services.reports.getDashboardStats(params),
                services.reports.getPaymentMethodStats(params),
                services.reports.getTopProducts({ ...params, groupBy: 'product' })
            ]);

            let pdfStats = results[0].data;
            const pdfPayments = results[1].data;
            const pdfProducts = results[2].data;

            if (window.electron) {
                const sTime = new Date(startD).getTime();
                const eTime = new Date(endD).getTime();
                const currentOverride = localExpensesRow.filter(e => {
                    const d = new Date(e.date).getTime();
                    return d >= sTime && d <= eTime;
                }).reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

                const dur = eTime - sTime;
                const pEnd = sTime - 1;
                const pStart = pEnd - dur;
                const prevOverride = localExpensesRow.filter(e => {
                    const d = new Date(e.date).getTime();
                    return d >= pStart && d <= pEnd;
                }).reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

                let overrideChange = 0;
                if (prevOverride > 0) {
                    overrideChange = Number(((currentOverride - prevOverride) / prevOverride * 100).toFixed(2));
                } else if (currentOverride > 0) {
                    overrideChange = 100;
                }

                pdfStats = {
                    ...pdfStats,
                    expenses: { value: currentOverride, change: overrideChange, prev: prevOverride },
                    netProfit: { ...pdfStats.netProfit, value: (pdfStats.sales?.value || 0) - currentOverride }
                };
            }

            const doc = new jsPDF();
            const dateStr = `${new Date(startD).toLocaleDateString()} - ${new Date(endD).toLocaleDateString()}`;
            const toCurrency = (val) => `Rs. ${(val || 0).toLocaleString('en-IN')}`;

            doc.setFillColor(139, 92, 246);
            doc.rect(0, 0, 210, 20, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(16);
            doc.text("Business Analytics Report", 14, 13);
            doc.setTextColor(100, 116, 139);
            doc.setFontSize(10);
            doc.text(`Period: ${dateStr}`, 14, 28);
            doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 33);

            let finalY = 40;
            doc.setTextColor(15, 23, 42);
            doc.setFontSize(12);
            doc.text("Executive Summary", 14, finalY);

            autoTable(doc, {
                startY: finalY + 5,
                head: [['Metric', 'Value', 'Previous', 'Change']],
                body: [
                    ['Total Revenue', toCurrency(pdfStats.sales.value), toCurrency(pdfStats.sales.prev), formatPercent(pdfStats.sales.change)],
                    ['Net Profit', toCurrency(pdfStats.netProfit.value), toCurrency(pdfStats.netProfit.prev), formatPercent(pdfStats.netProfit.change)],
                    ['Total Expenses', toCurrency(pdfStats.expenses.value), toCurrency(pdfStats.expenses.prev), formatPercent(pdfStats.expenses.change)],
                    ['Total Orders', pdfStats.orders.value, pdfStats.orders.prev, formatPercent(pdfStats.orders.change)],
                ],
                theme: 'grid',
                headStyles: { fillColor: [139, 92, 246], textColor: 255 },
                styles: { fontSize: 10, cellPadding: 3 },
            });

            finalY = doc.lastAutoTable.finalY + 15;
            doc.text("Payment Methods Breakdown", 14, finalY);
            const paymentRows = pdfPayments.map(p => [
                p.name, toCurrency(p.value), formatCappedPercentage((p.value / (pdfStats.sales.value || 1)) * 100)
            ]);

            autoTable(doc, {
                startY: finalY + 5,
                head: [['Method', 'Revenue', 'Share']],
                body: paymentRows,
                theme: 'striped',
                headStyles: { fillColor: [6, 182, 212] },
            });

            finalY = doc.lastAutoTable.finalY + 15;
            doc.text("Top Performing Products", 14, finalY);
            const productRows = pdfProducts.map(p => [
                p.name, p.quantity, toCurrency(p.revenue), formatCappedPercentage(p.marginPercent)
            ]);

            autoTable(doc, {
                startY: finalY + 5,
                head: [['Product Name', 'Sold', 'Revenue', 'Margin']],
                body: productRows,
                theme: 'striped',
                headStyles: { fillColor: [16, 185, 129] },
            });

            doc.save(`Report_${startD.split('T')[0]}.pdf`);
            setShowExportModal(false);
        } catch (error) {
            console.error(error);
            alert("Export failed");
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className="p-6 min-h-screen bg-slate-50/30 space-y-6 pb-20">
            <div className="bg-white border-b border-slate-200 -mx-6 px-6 py-4 flex justify-between items-center mb-6 -mt-6">
                <div className="flex items-center gap-4">
                    <h1 className="text-2xl font-bold text-slate-900">Analytics</h1>
                    <div className="flex bg-slate-100 p-1 rounded-lg">
                        <button
                            className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${viewMode === 'analyst' ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}
                            onClick={() => setViewMode('analyst')}
                        >
                            <LineChart className="h-3 w-3 inline mr-1" /> Detailed
                        </button>
                        <button
                            className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${viewMode === 'owner' ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}
                            onClick={() => setViewMode('owner')}
                        >
                            <LayoutDashboard className="h-3 w-3 inline mr-1" /> Owner Summary
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <select
                        className="bg-slate-50 border border-slate-200 text-sm rounded-md px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
                        value={datePreset}
                        onChange={(e) => setDatePreset(e.target.value)}
                    >
                        <option value="today">Today</option>
                        <option value="yesterday">Yesterday</option>
                        <option value="thisWeek">This Week</option>
                        <option value="lastMonth">Last Month</option>
                        <option value="thisMonth">This Month</option>
                    </select>

                    <Button variant="outline" size="sm" onClick={() => setShowExportModal(true)}>
                        <Download className="mr-2 h-4 w-4" /> Export
                    </Button>
                </div>
            </div>

            {loading ? (
                <div className="h-96 flex items-center justify-center text-slate-400">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mr-3"></div>
                    Loading analytics...
                </div>
            ) : (
                viewMode === 'owner' ? (
                    <OwnerView
                        stats={ownerStats}
                        datePreset={datePreset}
                        printRef={printRef}
                    />
                ) : (
                    <AnalystView
                        dashboardStats={finalDashboardStats}
                        salesTrend={salesTrend}
                        paymentMethods={paymentMethods}
                        customers={customers}
                        topProducts={topProducts}
                        visibleMetrics={visibleMetrics}
                        setVisibleMetrics={setVisibleMetrics}
                        compare={compare}
                        setCompare={setCompare}
                        selectedPaymentMethod={selectedPaymentMethod}
                        setSelectedPaymentMethod={setSelectedPaymentMethod}
                        topProductsTab={topProductsTab}
                        setTopProductsTab={setTopProductsTab}
                    />
                )
            )}
            <Modal isOpen={showExportModal} onClose={() => setShowExportModal(false)} title="Export Report PDF" size="sm">
                <div className="space-y-4">
                    <div>
                        <label className="text-sm font-medium text-slate-700 block mb-1">Export Range</label>
                        <select
                            className="w-full border p-2 rounded-lg text-sm outline-none focus:ring-2 focus:ring-slate-900 border-slate-200"
                            value={exportOptions.type}
                            onChange={(e) => setExportOptions({ ...exportOptions, type: e.target.value })}
                        >
                            <option value="dashboard_current">Same as Dashboard</option>
                            <option value="this_month">This Month</option>
                            <option value="last_month">Last Month</option>
                            <option value="specific_month">Specific Month</option>
                            <option value="date_range">Custom Date Range</option>
                        </select>
                    </div>

                    {exportOptions.type === 'specific_month' && (
                        <div>
                            <label className="text-sm font-medium text-slate-700 block mb-1">Select Month</label>
                            <Input
                                type="month"
                                value={exportOptions.specificMonth}
                                onChange={(e) => setExportOptions({ ...exportOptions, specificMonth: e.target.value })}
                            />
                        </div>
                    )}

                    {exportOptions.type === 'date_range' && (
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-sm font-medium text-slate-700 block mb-1">Start Date</label>
                                <Input
                                    type="date"
                                    value={exportOptions.startDate}
                                    onChange={(e) => setExportOptions({ ...exportOptions, startDate: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-slate-700 block mb-1">End Date</label>
                                <Input
                                    type="date"
                                    value={exportOptions.endDate}
                                    onChange={(e) => setExportOptions({ ...exportOptions, endDate: e.target.value })}
                                />
                            </div>
                        </div>
                    )}

                    <div className="pt-4 flex justify-end gap-2 border-t mt-4">
                        <Button variant="outline" onClick={() => setShowExportModal(false)}>Cancel</Button>
                        <Button onClick={handleConfirmExport} disabled={isExporting}>
                            {isExporting ? 'Exporting...' : 'Export'}
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default ReportsPage;
