import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { FileText, Download, Calendar, Loader2, IndianRupee, Percent, Hash } from 'lucide-react';
import services from '../../services/api';
import { exportToCSV } from '../../utils/exportService';

const GSTReportsPage = () => {
    const [dateRange, setDateRange] = useState({
        start: '',
        end: ''
    });
    const [loading, setLoading] = useState(true);
    const [activePreset, setActivePreset] = useState('thisMonth');
    const [summary, setSummary] = useState({
        taxableValue: 0,
        totalTax: 0,
        cgst: 0,
        sgst: 0,
        igst: 0,
        count: 0
    });

    // --- Initialization ---
    useEffect(() => {
        setPreset('thisMonth');
    }, []);

    // --- Preset Handlers ---
    const setPreset = (preset) => {
        setActivePreset(preset);
        const now = new Date();
        let start = new Date();
        let end = new Date();

        // Helper to format as YYYY-MM-DD in local time
        const toLocalISO = (d) => {
            const offset = d.getTimezoneOffset() * 60000;
            return new Date(d.getTime() - offset).toISOString().split('T')[0];
        };

        switch (preset) {
            case 'today':
                // start and end are already 'now'
                break;
            case 'thisMonth':
                start = new Date(now.getFullYear(), now.getMonth(), 1);
                end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                break;
            case 'financialYear': // Indian FY (Apr-Mar)
                const currentMonth = now.getMonth();
                const currentYear = now.getFullYear();
                const startYear = currentMonth >= 3 ? currentYear : currentYear - 1;
                start = new Date(startYear, 3, 1); // Apr 1st
                end = new Date(startYear + 1, 2, 31); // Mar 31st
                break;
            default: break;
        }

        setDateRange({
            start: toLocalISO(start),
            end: toLocalISO(end)
        });
    };

    // --- Data Fetching ---
    const fetchSummary = async () => {
        if (!dateRange.start || !dateRange.end) return;
        setLoading(true);
        try {
            // Construct timestamps for start of start-day and end of end-day in LOCAL time
            const startStr = `${dateRange.start}T00:00:00`;
            const endStr = `${dateRange.end}T23:59:59`;

            // Create Date objects - these will parsing based on browser's local timezone
            const startDateObj = new Date(startStr);
            const endDateObj = new Date(endStr);

            const response = await services.invoices.getAll({
                startDate: startDateObj.toISOString(),
                endDate: endDateObj.toISOString(),
                limit: 2000
            });
            const invoices = response.data?.data || [];

            // Calculate Taxes from Items
            const initialAgg = { taxableValue: 0, totalTax: 0, cgst: 0, sgst: 0, igst: 0, count: 0 };

            const agg = invoices.reduce((acc, inv) => {
                if (inv.status === 'Cancelled') return acc;

                let invCGST = 0;
                let invSGST = 0;
                let invIGST = 0;
                const items = inv.items || [];

                let itemTaxFound = false;

                items.forEach(item => {
                    const iC = parseFloat(item.cgst) || 0;
                    const iS = parseFloat(item.sgst) || 0;
                    const iI = parseFloat(item.igst) || 0;
                    if (iC > 0 || iS > 0 || iI > 0) itemTaxFound = true;
                    invCGST += iC;
                    invSGST += iS;
                    invIGST += iI;
                });

                // REMOVED Fallback Logic logic:
                // We strictly trust item snapshots. If missing, we warn but do not estimate.
                if (!itemTaxFound && (inv.tax || 0) > 0) {
                    // console.warn(`Invoice ${inv.id} missing item tax snapshots. Tax not included in breakdown.`);
                }

                return {
                    taxableValue: acc.taxableValue + (inv.subtotal || 0),
                    totalTax: acc.totalTax + (inv.tax || 0),
                    cgst: acc.cgst + invCGST,
                    sgst: acc.sgst + invSGST,
                    igst: acc.igst + invIGST,
                    count: acc.count + 1
                };
            }, initialAgg);

            setSummary(agg);
        } catch (error) {
            console.error("Failed to fetch summary", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSummary();
    }, [dateRange]);

    // --- Export ---
    const handleExportCSV = async () => {
        try {
            setLoading(true);

            // Same date logic as fetchSummary
            const startStr = `${dateRange.start}T00:00:00`;
            const endStr = `${dateRange.end}T23:59:59`;
            const startDateObj = new Date(startStr);
            const endDateObj = new Date(endStr);

            const response = await services.invoices.getAll({
                startDate: startDateObj.toISOString(),
                endDate: endDateObj.toISOString(),
                limit: 5000
            });

            const invoices = response.data?.data || [];
            if (invoices.length === 0) {
                alert("No data to export");
                return;
            }

            const csvData = invoices.map(inv => {
                if (inv.status === 'Cancelled') return null;

                let c = 0, s = 0, i = 0;
                const isInter = inv.taxType === 'Inter-State';
                const tax = inv.tax || 0;
                let itemSumC = 0, itemSumS = 0, itemSumI = 0;
                const items = inv.items || [];
                let hasItemTax = false;

                items.forEach(itm => {
                    if (itm.cgst || itm.igst) {
                        hasItemTax = true;
                        itemSumC += (parseFloat(itm.cgst) || 0);
                        itemSumS += (parseFloat(itm.sgst) || 0);
                        itemSumI += (parseFloat(itm.igst) || 0);
                    }
                });

                if (hasItemTax) {
                    c = itemSumC; s = itemSumS; i = itemSumI;
                } else {
                    // Strict: No fallback estimation
                    console.warn(`Export: Invoice ${inv.id} missing item tax snapshots.`);
                }

                const d = new Date(inv.date);
                const dateStr = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;

                return {
                    'Invoice Date': dateStr,
                    'Invoice Number': inv.billNumber ? inv.billNumber : inv.id,
                    'Customer Name': inv.customerName || 'Walk-in',
                    'GSTIN': inv.customerGstin || '',
                    'State': isInter ? 'Inter-State' : 'State',
                    'Taxable Value': (inv.subtotal || 0).toFixed(2),
                    'CGST Amount': c.toFixed(2),
                    'SGST Amount': s.toFixed(2),
                    'IGST Amount': i.toFixed(2),
                    'Total Tax': tax.toFixed(2),
                    'Invoice Total': (inv.total || 0).toFixed(2)
                };
            }).filter(Boolean); // Filter out nulls (cancelled invoices)

            exportToCSV(csvData, `GSTR1_Report_${dateRange.start}_${dateRange.end}.csv`);

        } catch (error) {
            console.error("Export failed", error);
            alert("Export failed");
        } finally {
            setLoading(false);
        }
    };

    // --- Sub-Components ---
    const StatCard = ({ title, value, icon: Icon }) => (
        <div className="group relative bg-black rounded-xl border border-slate-800 p-5 shadow-sm hover:shadow-md transition-all h-32 flex flex-col justify-between">
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-sm font-medium text-slate-400 uppercase tracking-wide">{title}</p>
                    <h3 className="text-2xl font-bold text-white mt-1">{value}</h3>
                </div>
                <div className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300">
                    <Icon className="h-5 w-5" />
                </div>
            </div>
        </div>
    );

    const ToggleButton = ({ label, id, onClick }) => (
        <button
            onClick={onClick}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${activePreset === id
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-50'
                }`}
        >
            {label}
        </button>
    );

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">GST Compliance</h1>
                    <div className="flex flex-col mt-1">
                        <p className="text-slate-500 text-sm">GSTR-1 Filing Data & Tax Summaries</p>
                        <p className="text-xs text-amber-600 font-medium mt-0.5">Note: This report shows OUTPUT GST from sales only.</p>
                    </div>
                </div>

                {/* Date Controls */}
                <div className="flex items-center gap-2 bg-white p-1.5 rounded-lg border border-slate-200 shadow-sm">
                    <ToggleButton label="Today" id="today" onClick={() => setPreset('today')} />
                    <ToggleButton label="This Month" id="thisMonth" onClick={() => setPreset('thisMonth')} />
                    <ToggleButton label="Financial Year" id="financialYear" onClick={() => setPreset('financialYear')} />

                    <div className="w-px h-4 bg-slate-200 mx-1"></div>

                    <div className="flex items-center gap-2 px-2">
                        <Calendar size={14} className="text-slate-400" />
                        <input
                            type="date"
                            value={dateRange.start}
                            onChange={(e) => {
                                setActivePreset('custom');
                                setDateRange(prev => ({ ...prev, start: e.target.value }));
                            }}
                            className="text-xs border-none focus:ring-0 text-slate-700 w-24 p-0 bg-transparent font-medium cursor-pointer"
                        />
                        <span className="text-slate-300">-</span>
                        <input
                            type="date"
                            value={dateRange.end}
                            onChange={(e) => {
                                setActivePreset('custom');
                                setDateRange(prev => ({ ...prev, end: e.target.value }));
                            }}
                            className="text-xs border-none focus:ring-0 text-slate-700 w-24 p-0 bg-transparent font-medium cursor-pointer"
                        />
                    </div>
                </div>
            </div>

            {/* Stats Grid - Black Background, White Text */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                {/* Added Total Invoices Card */}
                <StatCard
                    title="Total Invoices"
                    value={summary.count}
                    icon={Hash}
                />
                <StatCard
                    title="Taxable Value"
                    value={`₹${summary.taxableValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`}
                    icon={IndianRupee}
                />
                <StatCard
                    title="Total Tax Collected"
                    value={`₹${summary.totalTax.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`}
                    icon={FileText}
                />
                <StatCard
                    title="CGST + SGST"
                    value={`₹${(summary.cgst + summary.sgst).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`}
                    icon={Percent}
                />
                <StatCard
                    title="IGST"
                    value={`₹${summary.igst.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`}
                    icon={IndianRupee}
                />
            </div>

            {/* Export Section */}
            <Card className="border-slate-200 shadow-sm bg-white">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-slate-900">
                        <Download size={20} className="text-slate-800" />
                        GSTR-1 Data Export
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-5 flex flex-col md:flex-row justify-between items-center gap-4">
                        <div className="space-y-1">
                            <p className="font-semibold text-slate-900">Download CSV for Filing</p>
                            <p className="text-sm text-slate-500">
                                Contains invoice-level details including Taxable Value, Cess, and Place of Supply.
                                Formatted for easy import into accounting software.
                            </p>
                        </div>
                        <Button
                            onClick={handleExportCSV}
                            disabled={loading}
                            className="bg-slate-900 hover:bg-slate-800 text-white min-w-[160px]"
                        >
                            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                            Export Data
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default GSTReportsPage;
