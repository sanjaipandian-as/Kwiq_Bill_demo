import React, { useState } from 'react';
import { syncService } from '../../services/syncService';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Search, Plus, FileText, Edit, Paperclip, Trash2, Download } from 'lucide-react';
import ExpenseModal from '../Expenses/ExpenseModal';
import { Modal } from '../../components/ui/Modal';
import DateRangePicker from '../../components/DateRangePicker/DateRangePicker';
import CategoryFilter from '../../components/CategoryFilter/CategoryFilter';
import { BulkActionsToolbar } from '../../components/Expenses/BulkActionsToolbar';
import { RecurringBadge } from '../../components/Expenses/RecurringBadge';
import { useExpenses } from '../../context/ExpenseContext';
import { exportToCSV } from '../../utils/csvExport';
import { utils, writeFile } from 'xlsx';
import { SAMPLE_CATEGORIES } from '../../utils/expenseConstants';
import { isSearchMatch } from '../../utils/searchUtils';

const ExpensesPage = () => {
    const { expenses, deleteExpense, bulkUpdateExpenses, bulkDeleteExpenses, exportToCSV: exportFromAPI, uploadReceipt } = useExpenses();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingExpense, setEditingExpense] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [dateRange, setDateRange] = useState(null);
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [selectedExpenses, setSelectedExpenses] = useState([]);
    const [isViewOnly, setIsViewOnly] = useState(false);
    const [showExportModal, setShowExportModal] = useState(false);
    const [viewReceiptUrl, setViewReceiptUrl] = useState(null);
    const [exportOptions, setExportOptions] = useState({
        type: 'this_month',
        startDate: '',
        endDate: '',
        specificMonth: ''
    });

    // Filter Logic
    const filteredExpenses = expenses.filter(e => {
        // Search filter
        const matchesSearch = isSearchMatch(e.title, searchTerm) ||
            isSearchMatch(e.category, searchTerm) ||
            isSearchMatch(e.paymentMethod, searchTerm) ||
            isSearchMatch(e.reference, searchTerm);

        // Date range filter
        let matchesDateRange = true;
        if (dateRange) {
            const expenseDate = new Date(e.date);
            expenseDate.setHours(0, 0, 0, 0);

            const startDate = new Date(dateRange.startDate);
            startDate.setHours(0, 0, 0, 0);

            const endDate = new Date(dateRange.endDate);
            endDate.setHours(23, 59, 59, 999);

            matchesDateRange = expenseDate >= startDate && expenseDate <= endDate;
        }

        // Category filter
        const matchesCategory = !selectedCategory || e.category === selectedCategory;

        return matchesSearch && matchesDateRange && matchesCategory;
    });

    // Selection handlers
    const toggleSelectAll = () => {
        if (selectedExpenses.length === filteredExpenses.length) {
            setSelectedExpenses([]);
        } else {
            setSelectedExpenses(filteredExpenses.map(e => e.id));
        }
    };

    const toggleSelectExpense = (id) => {
        setSelectedExpenses(prev =>
            prev.includes(id) ? prev.filter(eid => eid !== id) : [...prev, id]
        );
    };

    // Bulk action handlers
    const handleBulkCategoryChange = async (category) => {
        try {
            await bulkUpdateExpenses(selectedExpenses, { category });
            setSelectedExpenses([]);
            setSelectedExpenses([]);
        } catch (error) {
            if (window.electron && window.electron.showAlert) {
                await window.electron.showAlert('Failed to update categories', 'error');
            } else {
                alert('Failed to update categories');
            }
        }
    };

    const handleBulkMarkRecurring = async () => {
        const frequency = prompt('Enter frequency (weekly, monthly, quarterly, yearly):');
        if (!frequency || !['weekly', 'monthly', 'quarterly', 'yearly'].includes(frequency.toLowerCase())) {
            alert('Invalid frequency');
            return;
        }

        try {
            await bulkUpdateExpenses(selectedExpenses, {
                isRecurring: true,
                frequency: frequency.toLowerCase()
            });
            setSelectedExpenses([]);
            setSelectedExpenses([]);
        } catch (error) {
            if (window.electron && window.electron.showAlert) {
                await window.electron.showAlert('Failed to mark as recurring', 'error');
            } else {
                alert('Failed to mark as recurring');
            }
        }
    };

    const handleBulkExportCSV = () => {
        const selectedExpenseData = expenses.filter(e => selectedExpenses.includes(e.id));
        exportToCSV(selectedExpenseData, `selected-expenses-${Date.now()}.csv`);
    };

    const handleBulkDelete = async () => {
        let confirmed = false;
        if (window.electron && window.electron.showConfirm) {
            confirmed = await window.electron.showConfirm(`Delete ${selectedExpenses.length} expenses?`);
        } else {
            confirmed = window.confirm(`Delete ${selectedExpenses.length} expenses?`);
        }

        if (!confirmed) return;

        try {
            await bulkDeleteExpenses(selectedExpenses);
            setSelectedExpenses([]);
        } catch (error) {
            if (window.electron && window.electron.showAlert) {
                await window.electron.showAlert('Failed to delete expenses', 'error');
            } else {
                alert('Failed to delete expenses');
            }
        }
    };

    // Individual action handlers
    const handleEdit = (expense) => {
        setEditingExpense(expense);
        setIsViewOnly(false);
        setIsModalOpen(true);
    };

    const handleView = (expense) => {
        setEditingExpense(expense);
        setIsViewOnly(true);
        setIsModalOpen(true);
    };

    const handleDelete = async (id) => {
        let confirmed = false;
        if (window.electron && window.electron.showConfirm) {
            confirmed = await window.electron.showConfirm('Delete this expense?');
        } else {
            confirmed = window.confirm('Delete this expense?');
        }

        if (!confirmed) return;

        try {
            await deleteExpense(id);
            try {
                await syncService.uploadEvent('EXPENSE_DELETED', { expenseId: id });
            } catch (err) {
                console.error("Failed to upload delete event", err);
            }
        } catch (error) {
            if (window.electron && window.electron.showAlert) {
                await window.electron.showAlert('Failed to delete expense', 'error');
            } else {
                alert('Failed to delete expense');
            }
        }
    };

    const handleAttachReceipt = async (expenseId) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*,.pdf';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (file) {
                try {
                    await uploadReceipt(expenseId, file);
                    if (window.electron && window.electron.showAlert) {
                        await window.electron.showAlert('Receipt uploaded successfully!', 'info');
                    } else {
                        alert('Receipt uploaded successfully!');
                    }
                } catch (error) {
                    console.error('Receipt upload error:', error);
                    if (window.electron && window.electron.showAlert) {
                        await window.electron.showAlert(`Failed to upload receipt: ${error.message}`, 'error');
                    } else {
                        alert(`Failed to upload receipt: ${error.message}`);
                    }
                }
            }
        };
        input.click();
    };

    const handleConfirmExport = async () => {
        try {
            let start, end;
            const now = new Date();

            if (exportOptions.type === 'this_month') {
                const s = new Date(now.getFullYear(), now.getMonth(), 1);
                const e = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
                start = s.getTime(); end = e.getTime();
            } else if (exportOptions.type === 'last_month') {
                const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                const e = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
                start = s.getTime(); end = e.getTime();
            } else if (exportOptions.type === 'specific_month' && exportOptions.specificMonth) {
                const [year, month] = exportOptions.specificMonth.split('-');
                const s = new Date(parseInt(year), parseInt(month) - 1, 1);
                const e = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59, 999);
                start = s.getTime(); end = e.getTime();
            } else if (exportOptions.type === 'date_range' && exportOptions.startDate && exportOptions.endDate) {
                const s = new Date(exportOptions.startDate);
                s.setHours(0, 0, 0, 0);
                const e = new Date(exportOptions.endDate);
                e.setHours(23, 59, 59, 999);
                start = s.getTime(); end = e.getTime();
            } else if (exportOptions.type === 'all_time') {
                start = 0;
                end = Date.now() + 100000000000;
            } else {
                alert("Please select valid dates for export.");
                return;
            }

            const exportData = expenses.filter(e => {
                const createdDate = new Date(e.date).getTime();
                return createdDate >= start && createdDate <= end;
            });

            if (exportData.length === 0) {
                alert("No records found in the selected date range.");
                return;
            }

            const dataToExport = exportData.map(e => ({
                Title: e.title,
                Category: e.category,
                Date: new Date(e.date).toLocaleDateString(),
                Amount: Number(e.amount || 0).toFixed(2),
                PaymentMethod: e.paymentMethod || '-',
                Reference: e.reference || '-',
                Description: e.description || '-',
                Recurring: e.isRecurring ? `Yes (${e.frequency})` : 'No'
            }));

            const ws = utils.json_to_sheet(dataToExport);
            const wb = utils.book_new();
            utils.book_append_sheet(wb, ws, "Expenses_Export");
            writeFile(wb, `Expenses_Export_${exportOptions.type}_${new Date().toISOString().split('T')[0]}.xlsx`);
            setShowExportModal(false);
        } catch (error) {
            console.error("Export failed", error);
            alert("Export failed: " + error.message);
        }
    };

    const handleModalClose = () => {
        setIsModalOpen(false);
        setEditingExpense(null);
        setIsViewOnly(false);
    };

    // Empty state
    if (expenses.length === 0) {
        return (
            <div className="p-6 space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <h1 className="text-2xl font-bold text-slate-900">Expenses</h1>
                    <Button onClick={() => setIsModalOpen(true)} className="bg-red-600 hover:bg-red-700">
                        <Plus className="mr-2 h-4 w-4" /> Add Expense
                    </Button>
                </div>

                <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
                    <FileText className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">No expenses yet</h3>
                    <p className="text-slate-600 mb-6 max-w-md mx-auto">
                        Start tracking your business expenses to get better insights into your spending patterns.
                    </p>
                    <Button onClick={() => setIsModalOpen(true)} className="bg-red-600 hover:bg-red-700">
                        <Plus className="mr-2 h-4 w-4" /> Add First Expense
                    </Button>

                    <div className="mt-8 pt-8 border-t border-slate-200">

                        <div className="flex flex-wrap gap-2 justify-center">
                        </div>
                    </div>
                </div>

                <ExpenseModal
                    isOpen={isModalOpen}
                    onClose={handleModalClose}
                    expense={editingExpense}
                    readOnly={isViewOnly}
                />
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h1 className="text-2xl font-bold text-slate-900">Expenses</h1>
                <div className="flex gap-2">
                    <Button
                        onClick={() => setShowExportModal(true)}
                        variant="outline"
                        className="border-slate-300"
                    >
                        <Download className="mr-2 h-4 w-4" /> Export All
                    </Button>
                    <Button onClick={() => setIsModalOpen(true)} className="bg-slate-900 hover:bg-slate-800 text-white">
                        <Plus className="mr-2 h-4 w-4" /> Add Expense
                    </Button>
                </div>
            </div>

            {/* Filters Area */}
            <div className="flex flex-col sm:flex-row gap-4 bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                        placeholder="Search by title, category, payment method, or reference..."
                        className="pl-10"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex gap-2">
                    <DateRangePicker
                        value={dateRange}
                        onDateRangeChange={setDateRange}
                    />
                    <CategoryFilter
                        expenses={expenses}
                        value={selectedCategory}
                        onCategoryChange={setSelectedCategory}
                    />
                </div>
            </div>

            {/* Expenses List / Grid */}
            {filteredExpenses.length > 0 && (
                <div className="flex justify-between items-center px-1 py-2 mt-4 bg-white/50 backdrop-blur-sm rounded-lg border border-slate-100 shadow-sm mb-4">
                    <label className="flex items-center gap-2.5 cursor-pointer group pl-3 py-1.5">
                        <input
                            type="checkbox"
                            checked={selectedExpenses.length === filteredExpenses.length && filteredExpenses.length > 0}
                            onChange={toggleSelectAll}
                            className="w-4 h-4 text-red-600 border-slate-300 rounded focus:ring-red-500 cursor-pointer"
                        />
                        <span className="text-sm font-semibold text-slate-600 group-hover:text-slate-900 transition-colors">Select All</span>
                    </label>
                    <span className="text-sm text-slate-500 font-medium pr-4">{filteredExpenses.length} {filteredExpenses.length === 1 ? 'expense' : 'expenses'}</span>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-20">
                {filteredExpenses.map((expense) => (
                    <div key={expense.id} className={`bg-white rounded-2xl border ${selectedExpenses.includes(expense.id) ? 'border-red-400 ring-4 ring-red-50' : 'border-slate-200/80'} shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] hover:shadow-[0_8px_30px_-4px_rgba(6,81,237,0.15)] transition-all duration-300 relative group overflow-hidden flex flex-col`}>
                        {/* Top Accent line */}
                        <div className={`absolute top-0 left-0 right-0 h-1.5 ${selectedExpenses.includes(expense.id) ? 'bg-red-500' : 'bg-gradient-to-r from-slate-200 to-slate-200 group-hover:from-red-500 group-hover:to-orange-400'} transition-all duration-500`} />

                        <div
                            className="p-5 flex-1 flex flex-col relative z-10 cursor-pointer"
                            onClick={() => handleView(expense)}
                        >
                            <div className="flex justify-between items-start mb-5">
                                <div className="max-w-[80%]">
                                    <div className="flex items-center gap-2 mb-2">
                                        <h3 className="font-bold text-slate-800 text-lg leading-tight line-clamp-2" title={expense.title}>
                                            {expense.title}
                                        </h3>
                                    </div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className={`px-2.5 py-1 rounded-md text-[11px] uppercase tracking-wider font-bold ${expense.category === 'Rent' ? 'bg-orange-100 text-orange-700' :
                                            expense.category === 'Salaries' ? 'bg-blue-100 text-blue-700' :
                                                expense.category === 'Utilities' ? 'bg-cyan-100 text-cyan-700' :
                                                    expense.category === 'Inventory' ? 'bg-purple-100 text-purple-700' :
                                                        expense.category === 'Marketing' ? 'bg-pink-100 text-pink-700' :
                                                            expense.category === 'Maintenance' ? 'bg-yellow-100 text-yellow-700' :
                                                                expense.category === 'Office Supplies' ? 'bg-teal-100 text-teal-700' :
                                                                    'bg-slate-100 text-slate-600'
                                            }`}>
                                            {expense.category}
                                        </span>
                                        {expense.isRecurring && (
                                            <RecurringBadge
                                                frequency={expense.frequency}
                                                nextDueDate={expense.nextDueDate}
                                            />
                                        )}
                                    </div>
                                </div>

                                <input
                                    type="checkbox"
                                    checked={selectedExpenses.includes(expense.id)}
                                    onChange={() => toggleSelectExpense(expense.id)}
                                    onClick={(e) => e.stopPropagation()}
                                    className={`w-5 h-5 text-red-600 border-slate-300 rounded focus:ring-red-500 cursor-pointer transition-opacity ${selectedExpenses.includes(expense.id) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                                />
                            </div>

                            <div className="mt-auto pt-4 border-t border-slate-100/80">
                                <div className="flex items-end justify-between">
                                    <div className="space-y-1">
                                        <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Amount</p>
                                        <p className="text-2xl font-black text-slate-900 tracking-tight">
                                            ₹{Number(expense.amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                                        </p>
                                    </div>

                                    <div className="text-right space-y-1">
                                        <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Date</p>
                                        <p className="text-sm font-semibold text-slate-600 bg-slate-50 px-2 py-1 rounded-md inline-block">{new Date(expense.date).toLocaleDateString()}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Actions Footer */}
                        <div className="bg-slate-50/80 px-4 py-3 border-t border-slate-100 flex items-center justify-between z-10">
                            <div className="flex gap-2">
                                {expense.receiptUrl ? (
                                    <button
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-100/50 text-blue-700 hover:bg-blue-100 text-xs font-bold transition-all hover:scale-105 active:scale-95"
                                        title="View Receipt"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setViewReceiptUrl(expense.receiptUrl);
                                        }}
                                    >
                                        <Paperclip className="h-3.5 w-3.5" />
                                        <span>Receipt</span>
                                    </button>
                                ) : (
                                    <button
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-800 text-xs font-bold transition-all shadow-sm hover:shadow active:scale-95"
                                        title="Attach Receipt"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleAttachReceipt(expense.id);
                                        }}
                                    >
                                        <Paperclip className="h-3.5 w-3.5" />
                                        <span>Attach</span>
                                    </button>
                                )}
                            </div>

                            <div className="flex gap-1">
                                <button
                                    className="p-1.5 rounded-lg text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                                    title="Edit Expense"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleEdit(expense);
                                    }}
                                >
                                    <Edit className="h-4 w-4" />
                                </button>
                                <button
                                    className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                                    title="Delete Expense"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDelete(expense.id);
                                    }}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}

                {filteredExpenses.length === 0 && (
                    <div className="col-span-full py-12 text-center bg-white rounded-2xl border border-dashed border-slate-300">
                        <FileText className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                        <h3 className="text-lg font-semibold text-slate-900 mb-1">No matching expenses</h3>
                        <p className="text-slate-500 text-sm">Try adjusting your filters or search term.</p>
                    </div>
                )}
            </div>

            {/* Bulk Actions Toolbar */}
            <BulkActionsToolbar
                selectedCount={selectedExpenses.length}
                onClearSelection={() => setSelectedExpenses([])}
                onCategoryChange={handleBulkCategoryChange}
                onMarkRecurring={handleBulkMarkRecurring}
                onExportCSV={handleBulkExportCSV}
                onDelete={handleBulkDelete}
                categories={SAMPLE_CATEGORIES}
            />

            <ExpenseModal
                isOpen={isModalOpen}
                onClose={handleModalClose}
                expense={editingExpense}
                readOnly={isViewOnly}
            />

            <Modal isOpen={showExportModal} onClose={() => setShowExportModal(false)} title="Export Expenses" size="sm">
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
                            <option value="all_time">All Time</option>
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
                        <Button onClick={handleConfirmExport}>
                            Export
                        </Button>
                    </div>
                </div>
            </Modal>

            <Modal isOpen={!!viewReceiptUrl} onClose={() => setViewReceiptUrl(null)} title="Receipt View" size="xl">
                <div className="flex flex-col space-y-4">
                    <div className="flex justify-center items-center p-4 bg-slate-50/80 rounded-xl max-h-[65vh] overflow-auto border border-slate-100">
                        {viewReceiptUrl && (
                            viewReceiptUrl.startsWith('data:application/pdf') ? (
                                <embed src={viewReceiptUrl} type="application/pdf" className="w-full h-[60vh] rounded" />
                            ) : (
                                <img src={viewReceiptUrl} alt="Receipt" className="max-w-full h-auto rounded-lg shadow-sm" />
                            )
                        )}
                    </div>
                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                        {viewReceiptUrl && (
                            <a
                                href={viewReceiptUrl}
                                download={`Receipt-${Date.now()}`}
                                className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-sm hover:shadow"
                            >
                                <Download className="h-4 w-4 mr-2" />
                                Download File
                            </a>
                        )}
                        <Button variant="outline" onClick={() => setViewReceiptUrl(null)}>Close</Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default ExpensesPage;