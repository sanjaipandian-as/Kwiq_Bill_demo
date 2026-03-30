import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/Table';
import { Badge } from '../../components/ui/Badge';
import { Search, Filter, Eye, Download, Trash2, Calendar, MoreHorizontal, Lock, FileText, CheckCircle, XCircle, Printer, CreditCard, Save, X, RotateCcw, BarChart3, Columns, Mail } from 'lucide-react';
import services from '../../services/api';
import InvoicePreviewModal from './InvoicePreviewModal';
import { utils, writeFile } from 'xlsx';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuCheckboxItem } from '../../components/ui/DropdownMenu';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, Cell } from 'recharts';
import { useProducts } from '../../context/ProductContext';
import { useCustomers } from '../../context/CustomerContext';
import { Modal } from '../../components/ui/Modal';

import RecordPaymentModal from './RecordPaymentModal';

// PERFORMANCE: Memoized QuickTab component to prevent re-renders
const QuickTab = React.memo(({ tab, activeTab, onClick }) => (
    <button
        onClick={onClick}
        className={`px-4 py-2 text-sm font-medium whitespace-nowrap rounded-t-lg border-b-2 
            ${activeTab === tab.id
                ? 'border-zinc-900 text-zinc-900 bg-zinc-50'
                : 'border-transparent text-zinc-500 hover:text-zinc-700 hover:bg-zinc-50/50'}`}
    >
        {tab.label}
    </button>
));

// PERFORMANCE: Memoized SavedView component
const SavedView = React.memo(({ view, index, onLoad, onDelete }) => (
    <div className="group flex items-center bg-slate-100 rounded-t-lg border-b-2 border-transparent hover:bg-slate-200">
        <button
            onClick={() => onLoad(view)}
            className="px-3 py-2 text-sm font-medium text-slate-600 whitespace-nowrap"
        >
            {view.name}
        </button>
        <button
            onClick={() => onDelete(index)}
            className="pr-2 text-slate-400 hover:text-rose-500 opacity-0 group-hover:opacity-100"
        >
            <X size={12} />
        </button>
    </div>
));

// PERFORMANCE: Memoized StatusBadge component
const StatusBadge = React.memo(({ status, onClick }) => {
    const getStatusStyle = (status) => {
        switch (status) {
            case 'Paid': return 'bg-green-100 text-green-700 border-green-200 hover:bg-green-200';
            case 'Partially Paid': return 'bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-200';
            case 'Unpaid': return 'bg-red-100 text-red-700 border-red-200 hover:bg-red-200';
            case 'Cancelled': return 'bg-slate-100 text-slate-500 border-slate-200 line-through';
            default: return 'bg-slate-50 text-slate-600 border-slate-200';
        }
    };

    return (
        <Badge
            className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusStyle(status)}`}
            onClick={onClick}
        >
            {status}
        </Badge>
    );
});

// PERFORMANCE: Memoized InvoiceRow component to prevent re-rendering all rows during scroll
const InvoiceRow = React.memo(({
    invoice,
    isSelected,
    isChecked,
    visibleColumns,
    formattedDate,
    onRowClick,
    onCheckboxChange,
    onRecordPayment,
    getTypeColor
}) => {
    // Dynamic payment method display
    const renderPaymentMethod = () => {
        let paymentsList = [];
        try {
            paymentsList = typeof invoice.payments === 'string'
                ? JSON.parse(invoice.payments)
                : (invoice.payments || []);
        } catch (e) { }

        if (paymentsList && paymentsList.length > 1) {
            return (
                <div className="flex flex-col text-xs space-y-0.5">
                    <span className="font-medium text-slate-700">Split:</span>
                    {paymentsList.map((p, idx) => (
                        <span key={idx} className="text-slate-500">- {p.method}</span>
                    ))}
                </div>
            );
        }
        return invoice.paymentMethod || 'Cash';
    };

    const handleRowClick = useCallback(() => {
        onRowClick(invoice);
    }, [invoice, onRowClick]);

    const handleCheckboxChange = useCallback((e) => {
        e.stopPropagation();
        onCheckboxChange(invoice.id, e.target.checked);
    }, [invoice.id, onCheckboxChange]);

    const handleRecordPayment = useCallback((e) => {
        e.stopPropagation();
        onRecordPayment(invoice);
    }, [invoice, onRecordPayment]);

    return (
        <TableRow
            className={`cursor-pointer border-b border-zinc-100/50 last:border-none ${isSelected ? 'bg-zinc-50' : 'hover:bg-zinc-50/50'}`}
            onClick={handleRowClick}
        >
            <TableCell onClick={(e) => e.stopPropagation()}>
                <input
                    type="checkbox"
                    className="rounded border-slate-300"
                    checked={isChecked}
                    onChange={handleCheckboxChange}
                />
            </TableCell>
            {visibleColumns.id && (
                <TableCell className="font-medium text-zinc-900">
                    {invoice.invoiceNumber || invoice.id.slice(-6).toUpperCase()}
                    {invoice.isLocked && <Lock className="inline ml-1 h-3 w-3 text-slate-400" />}
                </TableCell>
            )}
            {visibleColumns.date && <TableCell className="text-slate-500 text-sm">{formattedDate}</TableCell>}
            {visibleColumns.customer && <TableCell className="font-medium text-slate-800">{invoice.customerName}</TableCell>}
            {visibleColumns.type && (
                <TableCell>
                    <Badge variant="outline" className={`font-normal ${getTypeColor(invoice.type)}`}>
                        {invoice.type || 'Retail'}
                    </Badge>
                </TableCell>
            )}
            {visibleColumns.amount && <TableCell className="text-right font-bold text-slate-900">₹{(invoice.total || 0).toFixed(2)}</TableCell>}
            {visibleColumns.tax && <TableCell className="text-right text-slate-500 text-sm">₹{invoice.tax?.toFixed(2) || 0}</TableCell>}
            {visibleColumns.discount && <TableCell className="text-right text-slate-500 text-sm">₹{invoice.discount?.toFixed(2) || 0}</TableCell>}
            {visibleColumns.balance && (
                <TableCell className="text-right">
                    {invoice.balance > 0 ? (
                        <span className="text-zinc-900 bg-zinc-100 px-1.5 py-0.5 rounded-md font-medium text-xs border border-zinc-200">
                            ₹{invoice.balance.toFixed(2)}
                        </span>
                    ) : (
                        <span className="text-zinc-300">-</span>
                    )}
                </TableCell>
            )}
            {visibleColumns.status && (
                <TableCell className="text-center">
                    {(invoice.status === 'Partially Paid' || invoice.status === 'Unpaid') ? (
                        <div className="flex items-center justify-center gap-2">
                            <StatusBadge status={invoice.status} />
                            <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0 hover:bg-blue-100 text-blue-600"
                                onClick={handleRecordPayment}
                                title="Add Payment"
                            >
                                <CreditCard className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                    ) : (
                        <StatusBadge status={invoice.status} />
                    )}
                </TableCell>
            )}
            {visibleColumns.method && (
                <TableCell className="text-slate-600 text-sm">
                    {renderPaymentMethod()}
                </TableCell>
            )}
        </TableRow>
    );
});

const InvoicesPage = () => {
    // --- State ---
    const [invoices, setInvoices] = useState([]);
    const [stats, setStats] = useState({
        summary: { totalSales: 0, totalInvoices: 0, avgOrderValue: 0, outstandingAmount: 0 },
        byMethod: []
    });
    const [isLoading, setIsLoading] = useState(false);
    const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
    const [selectedInvoice, setSelectedInvoice] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [recordPaymentInvoice, setRecordPaymentInvoice] = useState(null);
    const [selectedIds, setSelectedIds] = useState([]);
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const { refreshProducts } = useProducts();
    const { refreshCustomers } = useCustomers();

    // Advanced Features State
    const [savedViews, setSavedViews] = useState([]);
    const [showExportModal, setShowExportModal] = useState(false);
    const [exportOptions, setExportOptions] = useState({
        type: 'this_month',
        startDate: '',
        endDate: '',
        specificMonth: ''
    });
    const [currentViewName, setCurrentViewName] = useState('');
    const [showSaveViewInput, setShowSaveViewInput] = useState(false);
    const [visibleColumns, setVisibleColumns] = useState({
        id: true, date: true, customer: true, type: false, amount: true, balance: false, status: true, method: true, tax: false, discount: false
    });
    const [activeTab, setActiveTab] = useState('all');

    // Filters
    const [filters, setFilters] = useState({
        search: '',
        dateRange: 'all',
        startDate: '',
        endDate: '',
        status: [],
        paymentMethod: 'All',
        minAmount: '',
        maxAmount: '',
        sortBy: 'date_desc'
    });

    // --- Effects ---

    // Load saved views from local storage on mount
    useEffect(() => {
        const saved = localStorage.getItem('invoiceSavedViews');
        if (saved) {
            try { setSavedViews(JSON.parse(saved)); } catch (e) { console.error("Failed to load saved views"); }
        }
    }, []);

    // PERFORMANCE: Memoize helper functions
    const getTypeColor = useCallback((type) => {
        switch (type) {
            case 'Retail': return 'text-zinc-900 bg-zinc-50 border-zinc-200';
            case 'Tax': return 'text-zinc-700 bg-white border-zinc-200';
            case 'Estimate': return 'text-zinc-500 bg-zinc-50 border-zinc-200';
            default: return 'text-slate-600 bg-slate-50 border-slate-200';
        }
    }, []);

    // --- Fetch Data ---

    const fetchInvoices = useCallback(async () => {
        setIsLoading(true);
        try {
            let start = filters.startDate;
            let end = filters.endDate;
            const now = new Date();

            if (filters.dateRange === 'today') {
                const s = new Date(); s.setHours(0, 0, 0, 0);
                const e = new Date(); e.setHours(23, 59, 59, 999);
                start = s.toISOString(); end = e.toISOString();
            } else if (filters.dateRange === 'week') {
                const s = new Date();
                const day = s.getDay();
                const diff = s.getDate() - day + (day === 0 ? -6 : 1);
                s.setDate(diff); s.setHours(0, 0, 0, 0);
                const e = new Date(); e.setHours(23, 59, 59, 999);
                start = s.toISOString(); end = e.toISOString();
            } else if (filters.dateRange === 'month') {
                const s = new Date(now.getFullYear(), now.getMonth(), 1);
                const e = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
                start = s.toISOString(); end = e.toISOString();
            }

            const params = {
                page: pagination.page,
                limit: 50,
                search: filters.search,
                startDate: start,
                endDate: end,
                status: filters.status.length > 0 ? filters.status.join(',') : undefined,
                paymentMethod: filters.paymentMethod,
                minAmount: filters.minAmount,
                maxAmount: filters.maxAmount,
                sortBy: filters.sortBy
            };

            const [invRes, statsRes] = await Promise.all([
                services.invoices.getAll(params),
                services.invoices.getStats(params)
            ]);

            // Filter invoices based on active tab
            let filteredInvoices;
            if (activeTab === 'cancelled') {
                filteredInvoices = invRes.data.data.filter(inv => inv.status === 'Cancelled');
            } else {
                filteredInvoices = invRes.data.data.filter(inv => inv.status !== 'Cancelled');
            }

            // PERFORMANCE: Pre-format dates and calculate payment info once
            setInvoices(filteredInvoices.map(inv => {
                const payments = inv.payments || [];
                const totalPaid = payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);

                let balance = 0;
                if (inv.status !== 'Paid') {
                    const total = parseFloat(inv.total) || 0;
                    balance = Math.max(0, total - totalPaid);
                }

                const methods = [...new Set(payments.map(p => p.method).filter(Boolean))];
                const paymentMethod = methods.length > 0 ? methods.join(', ') : (inv.status === 'Paid' ? 'Cash' : '-');

                // PERFORMANCE: Pre-format date to avoid Date() calls during render
                const formattedDate = new Date(inv.date).toLocaleDateString();

                return {
                    ...inv,
                    balance,
                    paymentMethod,
                    amountPaid: totalPaid,
                    roundOff: inv.round_off || 0,
                    formattedDate
                };
            }));

            setPagination({
                page: invRes.data.page,
                pages: invRes.data.pages,
                total: invRes.data.total
            });
            setStats(statsRes.data);

        } catch (error) {
            console.error("Failed to fetch invoices", error);
        } finally {
            setIsLoading(false);
        }
    }, [filters.search, filters.startDate, filters.endDate, filters.dateRange, filters.status, filters.paymentMethod, filters.minAmount, filters.maxAmount, filters.sortBy, pagination.page, refreshTrigger, activeTab]);

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchInvoices();
        }, 300);
        return () => clearTimeout(timer);
    }, [fetchInvoices]);

    // --- Handlers ---

    const handleFilterChange = useCallback((key, value, keepTab = false) => {
        setFilters(prev => ({ ...prev, [key]: value }));
        setPagination(prev => ({ ...prev, page: 1 }));
        // BUG5 FIX: Only switch to 'custom' for search/amount/date filters, not every filter
        if (!keepTab) setActiveTab('custom');
    }, []);

    const toggleStatusFilter = useCallback((status) => {
        setFilters(prev => {
            const current = prev.status;
            if (current.includes(status)) return { ...prev, status: current.filter(s => s !== status) };
            else return { ...prev, status: [...current, status] };
        });
    }, []);

    const toggleColumn = useCallback((col) => {
        setVisibleColumns(prev => ({ ...prev, [col]: !prev[col] }));
    }, []);

    const saveView = useCallback(() => {
        if (!currentViewName.trim()) return;
        const newView = { name: currentViewName, filters: { ...filters } };
        const updatedViews = [...savedViews, newView];
        setSavedViews(updatedViews);
        localStorage.setItem('invoiceSavedViews', JSON.stringify(updatedViews));
        setCurrentViewName('');
        setShowSaveViewInput(false);
    }, [currentViewName, filters, savedViews]);

    const loadView = useCallback((view) => {
        setFilters(view.filters);
    }, []);

    const deleteView = useCallback((index) => {
        const updated = savedViews.filter((_, i) => i !== index);
        setSavedViews(updated);
        localStorage.setItem('invoiceSavedViews', JSON.stringify(updated));
    }, [savedViews]);

    const handleBulkAction = useCallback(async (action) => {
        if (!selectedIds.length) return;
        if (!window.confirm(`Perform '${action}' on ${selectedIds.length} invoices?`)) return;

        try {
            if (action === 'delete') {
                if (services.invoices.bulkDelete) {
                    await services.invoices.bulkDelete(selectedIds);
                } else {
                    await Promise.all(selectedIds.map(id => services.invoices.delete(id)));
                }
                setRefreshTrigger(prev => prev + 1);
                setSelectedIds([]);
                refreshProducts();
                refreshCustomers();
            } else if (action === 'markPaid') {
                await Promise.all(
                    selectedIds.filter(id => {
                        const inv = invoices.find(i => i.id === id);
                        return inv && inv.status !== 'Paid';
                    }).map(id => services.invoices.update(id, { status: 'Paid', paymentStatus: 'Paid', balance: 0 }))
                );
                setRefreshTrigger(prev => prev + 1);
                setSelectedIds([]);
            } else if (action === 'uncancel') {
                await services.invoices.bulkUncancel(selectedIds);
                setRefreshTrigger(prev => prev + 1);
                setSelectedIds([]);
            } else if (action === 'resend') {
                alert("Invoices queued for resending.");
                setSelectedIds([]);
            } else if (action === 'permanent-delete') {
                if (!window.confirm("CRITICAL: You are about to PERMANENTLY remove these records from the database. This action cannot be undone. Proceed?")) return;
                await services.invoices.bulkPermanentDelete(selectedIds);
                setRefreshTrigger(prev => prev + 1);
                setSelectedIds([]);
                refreshProducts();
                refreshCustomers();
            }
        } catch (error) {
            console.error("Bulk action failed", error);
            alert("Failed to perform bulk action");
        }
    }, [selectedIds, invoices, refreshProducts, refreshCustomers]);

    const handleConfirmExport = useCallback(async () => {
        setIsLoading(true);
        try {
            let start, end;
            const now = new Date();

            if (exportOptions.type === 'this_month') {
                const s = new Date(now.getFullYear(), now.getMonth(), 1);
                const e = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
                start = s.toISOString(); end = e.toISOString();
            } else if (exportOptions.type === 'last_month') {
                const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                const e = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
                start = s.toISOString(); end = e.toISOString();
            } else if (exportOptions.type === 'specific_month' && exportOptions.specificMonth) {
                const [year, month] = exportOptions.specificMonth.split('-');
                const s = new Date(parseInt(year), parseInt(month) - 1, 1);
                const e = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59, 999);
                start = s.toISOString(); end = e.toISOString();
            } else if (exportOptions.type === 'date_range' && exportOptions.startDate && exportOptions.endDate) {
                const s = new Date(exportOptions.startDate);
                s.setHours(0, 0, 0, 0);
                const e = new Date(exportOptions.endDate);
                e.setHours(23, 59, 59, 999);
                start = s.toISOString(); end = e.toISOString();
            } else {
                alert("Please select valid dates for export.");
                setIsLoading(false);
                return;
            }

            const params = {
                page: 1,
                limit: 100000,
                startDate: start,
                endDate: end
            };

            const res = await services.invoices.getAll(params);
            const exportData = res.data.data;

            const dataToExport = exportData.map(t => {
                let payments = [];
                try {
                    payments = typeof t.payments === 'string' ? JSON.parse(t.payments) : (t.payments || []);
                } catch (e) { }
                const totalPaid = payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
                let balance = 0;
                if (t.status !== 'Paid') {
                    const total = parseFloat(t.total) || 0;
                    balance = Math.max(0, total - totalPaid);
                }
                const methods = [...new Set(payments.map(p => p.method).filter(Boolean))];
                const paymentMethod = methods.length > 0 ? methods.join(', ') : (t.status === 'Paid' ? 'Cash' : '-');

                return {
                    InvoiceID: t.invoiceNumber || t.id,
                    Date: new Date(t.date).toLocaleDateString(),
                    Customer: t.customer_name || t.customerName,
                    Type: t.type,
                    Subtotal: t.subtotal,
                    Tax: t.tax,
                    Discount: t.discount,
                    Total: t.total,
                    Balance: balance,
                    Status: t.status,
                    Method: paymentMethod,
                    Notes: t.internalNotes || t.remarks || ''
                };
            });
            const ws = utils.json_to_sheet(dataToExport);
            const wb = utils.book_new();
            utils.book_append_sheet(wb, ws, "Invoices_Export");
            writeFile(wb, `Invoices_Export_${exportOptions.type}_${new Date().toISOString().split('T')[0]}.xlsx`);
            setShowExportModal(false);
        } catch (error) {
            console.error("Export failed", error);
            alert("Export failed: " + error.message);
        } finally {
            setIsLoading(false);
        }
    }, [exportOptions]);

    const handleRestApiAction = useCallback(async (action, id, data = {}) => {
        try {
            if (action === 'delete') await services.invoices.delete(id);
            if (action === 'update') await services.invoices.update(id, data);
            setRefreshTrigger(prev => prev + 1);
            refreshProducts();
            refreshCustomers();

            if (selectedInvoice && selectedInvoice.id === id) {
                if (action === 'delete') setSelectedInvoice(null);
                else setSelectedInvoice({ ...selectedInvoice, ...data });
            }
        } catch (e) {
            alert(`Failed to ${action} invoice`);
        }
    }, [selectedInvoice, refreshProducts, refreshCustomers]);

    // PERFORMANCE: Memoize row click handlers
    const handleRowClick = useCallback((invoice) => {
        if (invoice.status === 'Partially Paid' || invoice.status === 'Unpaid') {
            // toast.warning would go here if available
            return;
        }
        setSelectedInvoice(invoice);
        setIsModalOpen(true);
    }, []);

    const handleCheckboxChange = useCallback((id, checked) => {
        if (checked) {
            setSelectedIds(prev => [...prev, id]);
        } else {
            setSelectedIds(prev => prev.filter(selectedId => selectedId !== id));
        }
    }, []);

    const handleRecordPayment = useCallback((invoice) => {
        setRecordPaymentInvoice(invoice);
    }, []);

    const handleSelectAll = useCallback((checked) => {
        if (checked) {
            setSelectedIds(invoices.map(i => i.id));
        } else {
            setSelectedIds([]);
        }
    }, [invoices]);

    const handleTabClick = useCallback((tab) => {
        setActiveTab(tab.id);
        if (tab.id === 'unpaid') {
            setFilters(prev => ({ ...prev, dateRange: 'all', status: ['Unpaid', 'Partially Paid'] }));
        } else if (tab.id === 'cancelled') {
            setFilters(prev => ({ ...prev, dateRange: 'all', status: ['Cancelled'] }));
        } else {
            setFilters(prev => ({ ...prev, dateRange: tab.id, status: [] }));
        }
    }, []);

    const handleResetFilters = useCallback(() => {
        setFilters({
            search: '',
            dateRange: 'all',
            startDate: '',
            endDate: '',
            status: [],
            paymentMethod: 'All',
            minAmount: '',
            maxAmount: '',
            sortBy: 'date_desc'
        });
    }, []);

    const handlePrevPage = useCallback(() => {
        setPagination(prev => ({ ...prev, page: prev.page - 1 }));
    }, []);

    const handleNextPage = useCallback(() => {
        setPagination(prev => ({ ...prev, page: prev.page + 1 }));
    }, []);

    const handleCloseModal = useCallback(() => {
        setIsModalOpen(false);
        setSelectedInvoice(null);
    }, []);

    const handleCloseRecordPayment = useCallback(() => {
        setRecordPaymentInvoice(null);
    }, []);

    const handlePaymentAdded = useCallback(() => {
        setRefreshTrigger(prev => prev + 1);
        if (selectedInvoice && recordPaymentInvoice && selectedInvoice.id === recordPaymentInvoice.id) {
            services.invoices.getById(selectedInvoice.id).then(res => setSelectedInvoice(res.data));
        }
    }, [selectedInvoice, recordPaymentInvoice]);

    // PERFORMANCE: Memoize quick tabs
    const quickTabs = useMemo(() => [
        { label: 'All Invoices', id: 'all' },
        { label: 'Today', id: 'today' },
        { label: 'Unpaid', id: 'unpaid', filter: { status: ['Unpaid', 'Partially Paid'] } },
        { label: 'Cancelled', id: 'cancelled', filter: { status: ['Cancelled'] } }
    ], []);

    // PERFORMANCE: Memoize status filter options
    const statusOptions = useMemo(() => ['Paid', 'Unpaid', 'Partially Paid', 'Cancelled'], []);

    // PERFORMANCE: Memoize chart data
    const chartData = useMemo(() => ({
        byMethod: stats.byMethod || [],
        trend: stats.trend && stats.trend.length > 0 ? stats.trend : []
    }), [stats.byMethod, stats.trend]);

    // --- Render ---

    const renderChart = () => {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <Card className="p-4 border-none shadow-sm h-48">
                    <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Sales Trend (Last 7 Days)</p>
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} debounce={50}>
                        <AreaChart data={chartData.trend}>
                            <defs>
                                <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8} />
                                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                            <Tooltip />
                            <Area type="monotone" dataKey="sales" stroke="#8b5cf6" strokeWidth={2} fillOpacity={1} fill="url(#colorSales)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </Card>
                <Card className="p-4 border-none shadow-sm h-48">
                    <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Payment Methods</p>
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} debounce={50}>
                        <BarChart data={chartData.byMethod}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="_id" tick={{ fontSize: 10 }} />
                            <Tooltip cursor={{ fill: 'transparent' }} />
                            <Bar dataKey="totalAmount" fill="#8b5cf6" radius={[4, 4, 0, 0]} barSize={40}>
                                {chartData.byMethod.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={['#10b981', '#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4'][index % 5]} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </Card>
            </div>
        );
    };

    return (
        <div className="p-6 space-y-6 relative min-h-screen pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900">Invoices</h1>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="text-sm font-medium text-slate-500 px-2 py-0.5 bg-slate-100 rounded-md border border-slate-200">
                            Total: {stats.summary.totalInvoices}
                        </span>
                        <span className="text-sm font-medium text-white px-2.5 py-0.5 bg-zinc-900 rounded-md border border-zinc-900 shadow-sm">
                            Sales: ₹{stats.summary.totalSales.toFixed(0)}
                        </span>
                        <div className="relative group cursor-help">
                            <span className="text-sm font-bold text-red-600 px-2.5 py-0.5 bg-red-50 rounded-md border border-red-200 shadow-sm">
                                Total Due: ₹{(stats?.summary?.outstandingAmount || 0).toFixed(0)}
                            </span>
                            <div className="absolute top-full mt-1 left-0 bg-gray-800 text-white text-xs px-2 py-1 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap pointer-events-none">
                                Pending from Unpaid/Partial Invoices
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex gap-2">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline">
                                <Columns className="mr-2 h-4 w-4" /> Columns
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Toggle Columns</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {Object.keys(visibleColumns).map(col => (
                                <DropdownMenuCheckboxItem
                                    key={col}
                                    checked={visibleColumns[col]}
                                    onCheckedChange={() => toggleColumn(col)}
                                >
                                    {col.charAt(0).toUpperCase() + col.slice(1)}
                                </DropdownMenuCheckboxItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <Button variant="outline" onClick={() => setShowExportModal(true)}>
                        <Download className="mr-2 h-4 w-4" /> Export
                    </Button>
                </div>
            </div>

            {/* Quick Tabs & Saved Views */}
            <div className="flex justify-between items-center border-b border-slate-200">
                <div className="flex gap-1 overflow-x-auto pb-2 no-scrollbar">
                    {quickTabs.map(tab => (
                        <QuickTab
                            key={tab.id}
                            tab={tab}
                            activeTab={activeTab}
                            onClick={() => handleTabClick(tab)}
                        />
                    ))}
                    {savedViews.map((view, index) => (
                        <SavedView
                            key={index}
                            view={view}
                            index={index}
                            onLoad={loadView}
                            onDelete={deleteView}
                        />
                    ))}
                </div>
                <div className="pb-2">
                    <Button variant="ghost" size="sm" onClick={() => setShowSaveViewInput(!showSaveViewInput)}>
                        <Save size={14} className="mr-1" /> Save View
                    </Button>
                </div>
            </div>

            {/* Save View Input */}
            {showSaveViewInput && (
                <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-md border">
                    <Input
                        placeholder="View Name (e.g. 'UPI Sales')"
                        className="h-8 text-sm"
                        value={currentViewName}
                        onChange={e => setCurrentViewName(e.target.value)}
                    />
                    <Button size="sm" onClick={saveView}>Save</Button>
                    <Button size="sm" variant="ghost" onClick={() => setShowSaveViewInput(false)}><X size={14} /></Button>
                </div>
            )}

            {renderChart()}

            {/* Main Content Area */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

                {/* Left Filter Sidebar */}
                <div className="lg:col-span-1 space-y-4">
                    <Card className="sticky top-6">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center justify-between">
                                <span className="flex items-center gap-2"><Filter className="h-4 w-4" /> Filters</span>
                                <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={handleResetFilters}>
                                    <RotateCcw size={12} className="mr-1" /> Reset
                                </Button>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Search */}
                            <div>
                                <label className="text-xs font-semibold text-slate-500 mb-1 block">Search</label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                                    <Input
                                        placeholder="ID, Name..."
                                        className="pl-9 bg-slate-50"
                                        value={filters.search}
                                        onChange={(e) => handleFilterChange('search', e.target.value)}
                                    />
                                </div>
                                <div className="flex flex-wrap gap-1 mt-2">
                                    {['ID', 'Customer', 'SKU'].map(chip => (
                                        <Badge
                                            key={chip}
                                            variant="outline"
                                            className="text-[10px] cursor-pointer hover:bg-slate-100 text-slate-500"
                                            onClick={() => document.querySelector('input[placeholder="ID, Name..."]').focus()}
                                        >
                                            {chip}
                                        </Badge>
                                    ))}
                                </div>
                            </div>

                            {/* Date Custom */}
                            {filters.dateRange === 'custom' && (
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="text-xs text-slate-500">Start</label>
                                        <Input type="date" value={filters.startDate} onChange={e => handleFilterChange('startDate', e.target.value)} />
                                    </div>
                                    <div>
                                        <label className="text-xs text-slate-500">End</label>
                                        <Input type="date" value={filters.endDate} onChange={e => handleFilterChange('endDate', e.target.value)} />
                                    </div>
                                </div>
                            )}
                            {filters.dateRange !== 'custom' && (
                                <Button variant="ghost" size="sm" className="w-full justify-start text-xs h-8" onClick={() => handleFilterChange('dateRange', 'custom')}>
                                    <Calendar className="mr-2 h-3 w-3" /> Custom Date Range
                                </Button>
                            )}

                            {/* Sort By */}
                            <div>
                                <label className="text-xs font-semibold text-slate-500 mb-1 block">Sort By</label>
                                <div className="space-y-1">
                                    {[
                                        { label: 'Recently Created', value: 'date_desc' },
                                        { label: 'Oldest Created', value: 'date_asc' },
                                        { label: 'Highest Paid', value: 'amount_desc' },
                                        { label: 'Lowest Paid', value: 'amount_asc' },
                                    ].map((option) => (
                                        <button
                                            key={option.value}
                                            onClick={() => handleFilterChange('sortBy', option.value, true)}
                                            className={`w-full text-left px-3 py-1.5 rounded-md text-xs transition-colors ${
                                                filters.sortBy === option.value
                                                    ? 'bg-zinc-900 text-white font-medium'
                                                    : 'text-slate-600 hover:bg-slate-100'
                                            }`}
                                        >
                                            {option.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Status */}
                            <div>
                                <label className="text-xs font-semibold text-slate-500 mb-2 block">Status</label>
                                <div className="flex flex-wrap gap-2">
                                    {statusOptions.map(status => (
                                        <Badge
                                            key={status}
                                            variant="outline"
                                            className={`cursor-pointer rounded-lg px-3 ${filters.status.includes(status) ? 'bg-zinc-900 text-white border-zinc-900 shadow-md' : 'bg-white hover:bg-zinc-50 text-zinc-600 border-zinc-200'}`}
                                            onClick={() => toggleStatusFilter(status)}
                                        >
                                            {status}
                                        </Badge>
                                    ))}
                                </div>
                            </div>

                            {/* Payment Method */}
                            <div>
                                <label className="text-xs font-semibold text-slate-500 mb-1 block">Payment Method</label>
                                <select
                                    className="w-full border rounded-md p-2 text-sm bg-slate-50"
                                    value={filters.paymentMethod}
                                    onChange={(e) => handleFilterChange('paymentMethod', e.target.value)}
                                >
                                    <option value="All">All Methods</option>
                                    <option value="Cash">Cash</option>
                                    <option value="Card">Card</option>
                                    <option value="UPI">UPI</option>
                                    <option value="Cheque">Cheque</option>
                                    <option value="Bank Transfer">Bank Transfer</option>
                                    <option value="Credit">Credit</option>
                                </select>
                            </div>

                            {/* Amount Range */}
                            <div>
                                <label className="text-xs font-semibold text-slate-500 mb-1 block">Amount Range</label>
                                <div className="flex gap-2 items-center">
                                    <Input
                                        placeholder="Min"
                                        type="number"
                                        className="h-8 text-xs bg-slate-50"
                                        value={filters.minAmount}
                                        onChange={e => handleFilterChange('minAmount', e.target.value)}
                                    />
                                    <span className="text-slate-400">-</span>
                                    <Input
                                        placeholder="Max"
                                        type="number"
                                        className="h-8 text-xs bg-slate-50"
                                        value={filters.maxAmount}
                                        onChange={e => handleFilterChange('maxAmount', e.target.value)}
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Right Table Area */}
                <div className="lg:col-span-3 space-y-4">
                    {/* Bulk Selection Bar */}
                    {selectedIds.length > 0 && (
                        <div className="bg-slate-900 text-white px-4 py-3 rounded-lg flex items-center justify-between shadow-lg sticky top-6 z-20">
                            <span className="text-sm font-medium">{selectedIds.length} select</span>
                            <div className="flex gap-2 items-center">
                                <Button size="sm" variant="ghost" className="h-8 text-white hover:bg-slate-800" onClick={() => setSelectedIds([])}>
                                    Clear
                                </Button>
                                <div className="h-6 w-px bg-slate-700 mx-2"></div>
                                <Button size="sm" variant="ghost" className="h-8 text-white hover:bg-slate-800" onClick={() => handleBulkAction('markPaid')}>
                                    <CheckCircle className="mr-2 h-4 w-4" /> Paid
                                </Button>
                                <Button size="sm" variant="ghost" className="h-8 text-white hover:bg-slate-800" onClick={() => setShowExportModal(true)}>
                                    <Download className="mr-2 h-4 w-4" /> Export
                                </Button>
                                {activeTab === 'cancelled' ? (
                                    <div className="flex gap-2">
                                        <Button size="sm" variant="ghost" className="h-8 text-white hover:bg-slate-800" onClick={() => handleBulkAction('uncancel')}>
                                            <RotateCcw className="mr-2 h-4 w-4" /> Uncancel
                                        </Button>
                                        <Button size="sm" variant="ghost" className="h-8 text-white hover:bg-rose-900 text-rose-300" onClick={() => handleBulkAction('permanent-delete')}>
                                            <Trash2 className="mr-2 h-4 w-4" /> Permanent Delete
                                        </Button>
                                    </div>
                                ) : (
                                    <Button size="sm" variant="ghost" className="h-8 text-white hover:bg-slate-800 text-rose-300 hover:text-rose-200" onClick={() => handleBulkAction('delete')}>
                                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                                    </Button>
                                )}
                            </div>
                        </div>
                    )}

                    <Card className="min-h-[600px] border-none shadow-sm">
                        <CardContent className="p-0">
                            <div className="rounded-md border-t border-b md:border overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                                            <TableHead className="w-[40px]">
                                                <input
                                                    type="checkbox"
                                                    className="rounded border-slate-300"
                                                    onChange={(e) => handleSelectAll(e.target.checked)}
                                                    checked={selectedIds.length === invoices.length && invoices.length > 0}
                                                />
                                            </TableHead>
                                            {visibleColumns.id && <TableHead>Invoice ID</TableHead>}
                                            {visibleColumns.date && <TableHead>Date</TableHead>}
                                            {visibleColumns.customer && <TableHead>Customer</TableHead>}
                                            {visibleColumns.type && <TableHead>Type</TableHead>}
                                            {visibleColumns.amount && <TableHead className="text-right">Amount</TableHead>}
                                            {visibleColumns.tax && <TableHead className="text-right">Tax</TableHead>}
                                            {visibleColumns.discount && <TableHead className="text-right">Disc</TableHead>}
                                            {visibleColumns.balance && <TableHead className="text-right">Balance</TableHead>}
                                            {visibleColumns.status && <TableHead className="text-center">Status</TableHead>}
                                            {visibleColumns.method && <TableHead>Method</TableHead>}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {isLoading ? (
                                            [...Array(5)].map((_, i) => (
                                                <TableRow key={i}>
                                                    <TableCell colSpan={12} className="h-16 animate-pulse bg-slate-50/50"></TableCell>
                                                </TableRow>
                                            ))
                                        ) : invoices.length > 0 ? (
                                            invoices.map((invoice) => (
                                                <InvoiceRow
                                                    key={invoice.id}
                                                    invoice={invoice}
                                                    isSelected={selectedInvoice?.id === invoice.id}
                                                    isChecked={selectedIds.includes(invoice.id)}
                                                    visibleColumns={visibleColumns}
                                                    formattedDate={invoice.formattedDate}
                                                    onRowClick={handleRowClick}
                                                    onCheckboxChange={handleCheckboxChange}
                                                    onRecordPayment={handleRecordPayment}
                                                    getTypeColor={getTypeColor}
                                                />
                                            ))
                                        ) : (
                                            <TableRow>
                                                <TableCell colSpan={12} className="text-center py-12 text-slate-500">
                                                    No invoices found. Try adjusting filters.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* Pagination */}
                            {pagination.pages > 1 && (
                                <div className="flex items-center justify-between px-2 py-4">
                                    <div className="text-sm text-slate-500">
                                        Page {pagination.page} of {pagination.pages} ({pagination.total} items)
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            disabled={pagination.page === 1}
                                            onClick={handlePrevPage}
                                        >
                                            Previous
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            disabled={pagination.page === pagination.pages}
                                            onClick={handleNextPage}
                                        >
                                            Next
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>

            

            <InvoicePreviewModal
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                invoice={selectedInvoice}
            />

            <RecordPaymentModal
                isOpen={!!recordPaymentInvoice}
                onClose={handleCloseRecordPayment}
                invoice={recordPaymentInvoice}
                onPaymentAdded={handlePaymentAdded}
            />

            <Modal isOpen={showExportModal} onClose={() => setShowExportModal(false)} title="Export Invoices" size="sm">
                <div className="space-y-4">
                    <div>
                        <label className="text-sm font-medium text-slate-700 block mb-1">Export Range</label>
                        <select
                            className="w-full border p-2 rounded-lg text-sm outline-none focus:ring-2 focus:ring-slate-900 border-slate-200"
                            value={exportOptions.type}
                            onChange={(e) => setExportOptions({ ...exportOptions, type: e.target.value })}
                        >
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
                        <Button onClick={handleConfirmExport} disabled={isLoading}>
                            {isLoading ? 'Exporting...' : 'Export'}
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default InvoicesPage;