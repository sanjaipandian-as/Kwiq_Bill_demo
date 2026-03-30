import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/Table';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Receipt, Percent, Calculator, Trash2 } from 'lucide-react';

const SummaryStep = ({ billingData, setBillingData }) => {
    const [globalDiscount, setGlobalDiscount] = useState(0); // in percentage for simplicity or amount
    const [discountType, setDiscountType] = useState('percent'); // 'percent' or 'fixed'

    // Recalculate totals when discount changes
    useEffect(() => {
        const subtotal = billingData.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

        let discountAmount = 0;
        if (discountType === 'percent') {
            discountAmount = subtotal * (globalDiscount / 100);
        } else {
            discountAmount = Number(globalDiscount);
        }

        const taxableAmount = Math.max(0, subtotal - discountAmount);

        // Tax Calculation (Assuming simplistic 18% GST for demo, normally item-wise)
        // In a real app, you'd integrate item-specific tax rates here
        const taxAmount = taxableAmount * 0.18;

        const totalRaw = taxableAmount + taxAmount;
        const roundedTotal = Math.round(totalRaw);
        const roundOff = roundedTotal - totalRaw;

        setBillingData(prev => ({
            ...prev,
            totals: {
                subtotal,
                discount: discountAmount,
                tax: taxAmount,
                roundOff: roundOff,
                total: roundedTotal
            }
        }));
    }, [globalDiscount, discountType, billingData.cart]);

    return (
        <div className="flex gap-6 h-full">
            {/* Left: Itemized Bill */}
            <div className="w-[65%] flex flex-col gap-4">
                <Card className="flex-1 overflow-hidden flex flex-col">
                    <CardHeader className="bg-slate-50 border-b border-slate-100 py-4">
                        <CardTitle className="text-base flex items-center gap-2">
                            <Receipt className="h-4 w-4 text-blue-500" /> Bill Details
                        </CardTitle>
                    </CardHeader>
                    <div className="flex-1 overflow-y-auto p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Item</TableHead>
                                    <TableHead className="text-center">Qty</TableHead>
                                    <TableHead className="text-right">Unit Price</TableHead>
                                    <TableHead className="text-right">Total</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {billingData.cart.map((item) => (
                                    <TableRow key={item.id}>
                                        <TableCell className="font-medium">
                                            {item.name}
                                            <p className="text-xs text-slate-500">{item.category}</p>
                                        </TableCell>
                                        <TableCell className="text-center">{item.quantity}</TableCell>
                                        <TableCell className="text-right">${item.price.toFixed(2)}</TableCell>
                                        <TableCell className="text-right">${(item.price * item.quantity).toFixed(2)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </Card>
            </div>

            {/* Right: Calculations & Totals */}
            <div className="w-[35%] space-y-4">
                {/* Customer Info Card */}
                <Card>
                    <CardHeader className="py-3 bg-slate-50 border-b border-slate-100">
                        <h4 className="font-semibold text-sm">Customer Details</h4>
                    </CardHeader>
                    <CardContent className="p-4 text-sm">
                        {billingData.customer ? (
                            <div className="space-y-1">
                                <p className="font-bold text-slate-900">{billingData.customer.name}</p>
                                <p className="text-slate-500">{billingData.customer.phone}</p>
                                <p className="text-slate-500">{billingData.customer.email}</p>
                            </div>
                        ) : (
                            <p className="text-slate-400 italic">No customer selected</p>
                        )}
                    </CardContent>
                </Card>

                {/* Calculations */}
                <Card>
                    <CardHeader className="py-3 bg-slate-50 border-b border-slate-100 flex flex-row justify-between items-center">
                        <h4 className="font-semibold text-sm flex items-center gap-2">
                            <Calculator className="h-4 w-4" /> Calculations
                        </h4>
                    </CardHeader>
                    <CardContent className="p-4 space-y-4">
                        {/* Discount Input */}
                        <div className="flex gap-2 items-end">
                            <div className="flex-1 space-y-1">
                                <label className="text-xs font-medium text-slate-500">Global Discount</label>
                                <Input
                                    type="number"
                                    value={globalDiscount}
                                    onChange={(e) => setGlobalDiscount(parseFloat(e.target.value) || 0)}
                                    className="h-9"
                                    min="0"
                                />
                            </div>
                            <div className="flex bg-slate-100 rounded-lg p-1">
                                <button
                                    onClick={() => setDiscountType('percent')}
                                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${discountType === 'percent' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'}`}
                                >
                                    %
                                </button>
                                <button
                                    onClick={() => setDiscountType('fixed')}
                                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${discountType === 'fixed' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'}`}
                                >
                                    $
                                </button>
                            </div>
                        </div>

                        <div className="border-t border-slate-100 my-4"></div>

                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between text-slate-600">
                                <span>Subtotal</span>
                                <span>${billingData.totals.subtotal.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-green-600">
                                <span>Discount</span>
                                <span>-${billingData.totals.discount.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-slate-600">
                                <span>Tax (18% GST)</span>
                                <span>${billingData.totals.tax.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-slate-400 text-xs">
                                <span>Round Off</span>
                                <span>{(billingData.totals.roundOff || 0) > 0 ? '+' : ''}{(billingData.totals.roundOff || 0).toFixed(2)}</span>
                            </div>

                            <div className="pt-3 mt-3 border-t border-slate-200 flex justify-between items-center">
                                <span className="font-bold text-lg text-slate-900">Total Payable</span>
                                <span className="font-bold text-xl text-blue-600">${billingData.totals.total.toFixed(2)}</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default SummaryStep;