import React from 'react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Download, Table as TableIcon, Upload } from 'lucide-react';
import { utils, writeFile } from 'xlsx';

const ProductTemplateWizard = ({ open, onClose, onUpload }) => {

    const handleDownloadTemplate = () => {
        // Define clean, friendly headers matching the Add Product form
        const headers = [
            "Product Name",
            "Category",
            "Cost Price",
            "Selling Price",
            "Current Stock",
            "Brand",
            "Unit",
            "Tax Rate",
            "Barcode / SKU"
        ];

        // Sample Row for guidance
        const sampleRow = [
            "Premium Cotton Shirt", // Product Name
            "Apparel",              // Category
            150,                    // Cost Price
            499,                    // Selling Price
            50,                     // Current Stock
            "levis",                //brand
            "pc",                   // Unit
            5,                      // Tax Rate
            "SHIRT-001"             // Barcode / SKU
        ];

        const ws = utils.aoa_to_sheet([headers, sampleRow]);
        const wb = utils.book_new();
        utils.book_append_sheet(wb, ws, "Import Template");
        writeFile(wb, "product_import_template.xlsx");
    };

    return (
        <Modal
            isOpen={open}
            onClose={onClose}
            title="Import Products"
            className="w-[95vw] md:w-[600px] h-auto max-h-[90vh]"
        >
            <div className="flex flex-col space-y-6">

                {/* 1. Instructions */}
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-sm text-slate-700 space-y-2">
                    <h3 className="font-semibold flex items-center gap-2 text-slate-900">
                        <TableIcon className="w-4 h-4 text-black" />
                        How to Import
                    </h3>
                    <p>
                        1. Download the Excel template below.<br />
                        2. Fill in your product details. <span className="text-slate-500">(Leave optional fields empty)</span><br />
                        3. Click <b>Upload Filled Template</b> here to import the data.
                    </p>
                    <div className="text-xs text-slate-500 italic mt-2">
                        * All fields marked with (*) are mandatory. <br />
                        * "Status" can be 'Active' or 'Inactive'.
                    </div>
                </div>

                {/* 2. Preview of Columns (Simplified) */}
                <div className="border rounded-md overflow-hidden">
                    <div className="bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600 border-b">
                        TEMPLATE COLUMNS
                    </div>
                    <div className="p-3 bg-white overflow-x-auto">
                        <div className="flex gap-2 text-xs whitespace-nowrap text-slate-500">
                            <span className="bg-slate-100 text-black px-2 py-1 rounded border border-slate-200">Product Name *</span>
                            <span className="bg-slate-100 text-black px-2 py-1 rounded border border-slate-200">Category *</span>
                            <span className="bg-slate-100 text-black px-2 py-1 rounded border border-slate-200">Cost Price *</span>
                            <span className="bg-slate-100 text-black px-2 py-1 rounded border border-slate-200">Selling Price *</span>
                            <span className="bg-slate-100 text-black px-2 py-1 rounded border border-slate-200">Current Stock *</span>
                            <span className="bg-slate-100 text-black px-2 py-1 rounded border border-slate-200">Brand *</span>
                            <span className="bg-slate-100 text-black px-2 py-1 rounded border border-slate-200">Unit *</span>
                            <span className="bg-slate-100 text-black px-2 py-1 rounded border border-slate-200">Tax Rate *</span>
                            <span className="bg-slate-100 text-black px-2 py-1 rounded border border-slate-200">Barcode / SKU *</span>
                        </div>
                    </div>
                </div>

                {/* 3. Actions */}
                <div className="flex gap-3 pt-4 border-t border-slate-200">
                    <Button
                        onClick={handleDownloadTemplate}
                        className="flex-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700"
                    >
                        <Download className="mr-2 h-4 w-4" /> Download Template
                    </Button>
                    <div className="relative flex-1">
                        <input
                            type="file"
                            accept=".xlsx, .xls"
                            onChange={(e) => {
                                onClose();
                                if (onUpload) onUpload(e);
                            }}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            title="Upload Filled Template"
                        />
                        <Button className="w-full bg-black hover:bg-neutral-800 text-white shadow-md">
                            <Upload className="mr-2 h-4 w-4" /> Upload Filled Template
                        </Button>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default ProductTemplateWizard;
