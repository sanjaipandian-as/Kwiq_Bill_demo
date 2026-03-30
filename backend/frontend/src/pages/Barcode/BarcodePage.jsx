import React, { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';
import { Printer, Copy } from 'lucide-react';
import Barcode from 'react-barcode';
import { useProducts } from '../../context/ProductContext';


const BarcodeGeneratorPage = () => {
    const { products } = useProducts();
    const [inputValue, setInputValue] = useState('PROD-101');
    // derived state for barcode value to ensure live update, or just use inputValue directly
    const [barcodeFormat, setBarcodeFormat] = useState('CODE128');

    const handleProductSelect = (e) => {
        const prod = products.find(p => p.id === e.target.value);
        if (prod) {
            setInputValue(prod.barcode || prod.id); // Use barcode if exists, else ID
            setBarcodeFormat(prod.barcodeType || 'CODE128');
        }
    };

    const handlePrint = () => {
        const printContent = document.getElementById('barcode-area');
        const windowUrl = 'about:blank';
        const uniqueName = new Date().getTime();
        const windowName = 'Print' + uniqueName;
        const printWindow = window.open(windowUrl, windowName, 'left=50000,top=50000,width=0,height=0');

        printWindow.document.write(`
            <html>
                <head>
                    <title>Print Barcode</title>
                    <style>
                        body {
                            margin: 0;
                            display: flex;
                            justify-content: center;
                            align-items: center;
                            height: 100vh;
                        }
                    </style>
                </head>
                <body>
                    ${printContent.innerHTML}
                </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
        printWindow.close();
    };

    return (
        <div className="max-w-2xl mx-auto space-y-8 text-center pt-8">
            <h1 className="text-3xl font-bold text-slate-900">Barcode Generator</h1>
            <p className="text-slate-500">Generate printable barcodes for your products inventory.</p>

            <Card className="p-8">
                <div className="flex flex-col gap-4 max-w-md mx-auto mb-8 text-left">
                    <div>
                        <label className="text-sm font-medium text-slate-700 mb-1 block">Select Product (Optional)</label>
                        <select
                            className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            onChange={handleProductSelect}
                            defaultValue=""
                        >
                            <option value="" disabled>Select a product...</option>
                            {products.map(p => (
                                <option key={p.id} value={p.id}>{p.name} ({p.barcode || 'No Barcode'})</option>
                            ))}
                        </select>
                        <select
                            className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 mt-2"
                            value={barcodeFormat}
                            onChange={(e) => setBarcodeFormat(e.target.value)}
                        >
                            <option value="CODE128">CODE-128 (Standard)</option>
                            <option value="EAN13">EAN-13 (Retail)</option>
                            <option value="UPC">UPC-A (US Retail)</option>
                        </select>
                    </div>

                    <div className="flex gap-2">
                        <Input
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            placeholder="Enter Product Code / SKU"
                            className="text-lg font-mono uppercase"
                        />
                        {/* Generate button removed as it is now live-preview */}
                    </div>
                    <p className="text-xs text-slate-400">Barcode updates automatically as you type.</p>
                </div>

                <div className="space-y-6">
                    {/* Printable Area - Centered for both Screen and Print */}
                    <div className="flex justify-center">
                        <div
                            id="barcode-area"
                            className="p-8 bg-white flex justify-center items-center"
                            style={{
                                width: 'fit-content',
                                minWidth: '300px',
                                minHeight: '150px'
                            }}
                        >
                            <Barcode value={inputValue || ' '} format={barcodeFormat} width={2} height={100} fontSize={16} />
                        </div>
                    </div>

                    <div className="flex justify-center gap-4">
                        <Button variant="outline" onClick={() => navigator.clipboard.writeText(inputValue)}>
                            <Copy className="mr-2 h-4 w-4" /> Copy Code
                        </Button>
                        <Button onClick={handlePrint}>
                            <Printer className="mr-2 h-4 w-4" /> Print Label
                        </Button>
                    </div>
                </div>
            </Card>
        </div>
    );
};

export default BarcodeGeneratorPage;
