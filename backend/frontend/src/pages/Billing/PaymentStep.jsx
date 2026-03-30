import React, { useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { CreditCard, Banknote, QrCode, SplitSquareHorizontal, CheckCircle2, Receipt } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Modal } from '../../components/ui/Modal';
import { useTransactions } from '../../context/TransactionContext';
import { useCustomers } from '../../context/CustomerContext';
import { useProducts } from '../../context/ProductContext';
import { useSettings } from '../../context/SettingsContext';
import { printReceipt } from '../../utils/printReceipt';

const PaymentStep = ({ billingData, onComplete }) => {
    const { addTransaction } = useTransactions();
    const { settings } = useSettings();
    const [method, setMethod] = useState('cash'); // cash, card, upi, split
    const [splitCash, setSplitCash] = useState('');
    const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
    const [currentInvoice, setCurrentInvoice] = useState(null);
    const totalAmount = billingData.totals?.total || 0;

    // Mock processing state
    const [isProcessing, setIsProcessing] = useState(false);

    const handlePayment = async () => {
        setIsProcessing(true);
        try {
            // Prepare payload matching backend schema
            let methodStr = method.charAt(0).toUpperCase() + method.slice(1);
            if (method === 'split') {
                const cash = parseFloat(splitCash) || 0;
                const online = totalAmount - cash;
                methodStr = `Split (Cash: ${cash.toFixed(2)}, Online: ${online.toFixed(2)})`;
            }

            const invoiceData = {
                customerId: billingData.customer?.id || '',
                customerName: billingData.customer?.fullName || billingData.customer?.name || '',
                date: new Date(),
                paymentMethod: methodStr,
                items: billingData.cart.map(item => ({
                    productId: item.id,
                    name: item.name,
                    quantity: Number(item.quantity),
                    price: Number(item.price),
                    total: Number(item.price) * Number(item.quantity)
                })),
                subtotal: Number(billingData.totals.subtotal),
                tax: Number(billingData.totals.tax),
                discount: Number(billingData.totals.discount),
                total: Number(totalAmount)
            };

            // 1. Create Invoice/Transaction (Backend already handles customer stats and stock updates)
            const newInvoice = await addTransaction(invoiceData);

            // 2. Refresh customer data to get updated stats (backend already updated them)
            // Note: Backend automatically updates customer stats when creating invoice

            // 3. Stock is already updated by backend when invoice is created
            if (billingData.cart && billingData.cart.length > 0) {
                // Execute all stock updates in parallel
                await Promise.all(billingData.cart.map(item =>
                    updateStock(item.id, -item.quantity)
                ));
            }

            setCurrentInvoice(newInvoice);
            setIsSuccessModalOpen(true);
        } catch (error) {
            console.error("Payment failed", error);
            alert("Payment processing failed. Please try again.");
        } finally {
            setIsProcessing(false);
        }
    };

    const handlePrint = () => {
        if (currentInvoice) {
            printReceipt(currentInvoice, settings.invoice?.paperSize || '80mm', settings);
        }
    };

    const PaymentMethodCard = ({ id, label, icon: Icon }) => (
        <div
            onClick={() => setMethod(id)}
            className={cn(
                "cursor-pointer rounded-xl border-2 p-6 flex flex-col items-center justify-center gap-3 transition-all h-32",
                method === id
                    ? "border-blue-500 bg-blue-50 text-blue-700 shadow-md"
                    : "border-slate-200 bg-white text-slate-500 hover:border-blue-200 hover:bg-slate-50"
            )}
        >
            <Icon size={32} />
            <span className="font-semibold">{label}</span>
            {method === id && <CheckCircle2 size={24} className="absolute top-3 right-3 text-blue-600" />}
        </div>
    );

    return (
        <div className="max-w-3xl mx-auto h-full flex flex-col gap-8">
            {/* Amount Display */}
            <div className="text-center space-y-2 py-6">
                <p className="text-slate-500 font-medium uppercase tracking-wide">Total Payable Amount</p>
                <h1 className="text-5xl font-bold text-slate-900">${totalAmount.toFixed(2)}</h1>
            </div>

            {/* Payment Methods Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <PaymentMethodCard id="cash" label="Cash" icon={Banknote} />
                <PaymentMethodCard id="card" label="Card" icon={CreditCard} />
                <PaymentMethodCard id="upi" label="UPI / QR" icon={QrCode} />
                <PaymentMethodCard id="split" label="Split" icon={SplitSquareHorizontal} />
            </div>

            {/* Payment Details Section */}
            <Card className="p-6 bg-slate-50 border-slate-200">
                {method === 'cash' && (
                    <div className="space-y-4">
                        <div className="flex justify-between items-center text-sm font-medium">
                            <span>Amt. Received</span>
                            <Input className="w-40 text-right" placeholder="0.00" defaultValue={totalAmount.toFixed(2)} />
                        </div>
                        <div className="flex justify-between items-center text-sm font-medium text-slate-500">
                            <span>Change to Return</span>
                            <span>$0.00</span>
                        </div>
                    </div>
                )}

                {method === 'card' && (
                    <div className="text-center space-y-4 text-slate-500">
                        <p>Swipe or Insert card on the terminal.</p>
                        <div className="animate-pulse flex justify-center text-blue-500 font-medium">
                            Waiting for terminal...
                        </div>
                    </div>
                )}

                {method === 'upi' && (
                    <div className="text-center space-y-4">
                        <div className="mx-auto bg-white p-2 w-fit rounded-lg border border-slate-200">
                            {/* Placeholder QR */}
                            <div className="h-40 w-40 bg-slate-900 flex items-center justify-center text-white">
                                <QrCode size={48} />
                            </div>
                        </div>
                        <p className="text-sm text-slate-500">Scan QR Code to pay</p>
                    </div>
                )}

                {method === 'split' && (
                    <div className="space-y-4">
                        <div className="flex justify-between items-center text-sm font-medium">
                            <span className="flex items-center gap-2"><Banknote size={16} /> Cash Amount</span>
                            <Input
                                className="w-40 text-right"
                                type="number"
                                min="0"
                                max={totalAmount}
                                placeholder="0.00"
                                value={splitCash}
                                onChange={(e) => setSplitCash(e.target.value)}
                            />
                        </div>
                        <div className="flex justify-between items-center text-sm font-medium text-slate-600">
                            <span className="flex items-center gap-2"><CreditCard size={16} /> Card/Online Amount</span>
                            <span className="font-bold text-slate-900">${(totalAmount - (parseFloat(splitCash) || 0)).toFixed(2)}</span>
                        </div>
                        {(parseFloat(splitCash) || 0) > totalAmount && (
                            <p className="text-red-500 text-xs text-center">Cash amount cannot exceed total.</p>
                        )}
                    </div>
                )}
            </Card>

            {/* Actions */}
            <div className="flex items-center gap-4 mt-auto">
                <Button variant="outline" size="lg" className="flex-1">
                    Cancel
                </Button>
                <Button
                    size="lg"
                    className="flex-[2] h-14 text-lg bg-green-600 hover:bg-green-700 text-white"
                    onClick={handlePayment}
                    isLoading={isProcessing}
                >
                    Confirm Payment & Print
                </Button>
            </div>

            {/* Success Modal */}
            <Modal isOpen={isSuccessModalOpen} onClose={() => setIsSuccessModalOpen(false)} title="Payment Successful" size="sm">
                <div className="text-center space-y-4 py-4">
                    <div className="bg-green-100 text-green-600 p-4 rounded-full w-20 h-20 mx-auto flex items-center justify-center">
                        <Receipt size={40} />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900">Invoice Created!</h3>
                    <p className="text-slate-500">Transaction completed successfully.</p>

                    <div className="flex flex-col gap-2 pt-4">
                        <Button className="w-full" onClick={handlePrint}>Print Invoice</Button>
                        <Button variant="outline" className="w-full" onClick={() => window.location.reload()}>New Sale (Reset)</Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default PaymentStep;