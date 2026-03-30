import React, { useState } from 'react';
import { X, Download, Trash2, RefreshCw, Tag } from 'lucide-react';
import { Button } from '../ui/Button';

export const BulkActionsToolbar = ({
    selectedCount,
    onClearSelection,
    onCategoryChange,
    onMarkRecurring,
    onExportCSV,
    onDelete,
    categories = []
}) => {
    const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);

    if (selectedCount === 0) return null;

    return (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
            <div className="bg-slate-900 text-white rounded-lg shadow-2xl px-6 py-4 flex items-center gap-4 border border-slate-700">
                {/* Selection count */}
                <div className="flex items-center gap-2 pr-4 border-r border-slate-700">
                    <span className="font-semibold">{selectedCount}</span>
                    <span className="text-slate-300">selected</span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                    {/* Change Category */}
                    <div className="relative">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                            className="text-white hover:bg-slate-800"
                        >
                            <Tag className="h-4 w-4 mr-2" />
                            Change Category
                        </Button>
                        {showCategoryDropdown && (
                            <div className="absolute bottom-full mb-2 left-0 w-48 bg-white rounded-lg shadow-lg border border-slate-200 py-1 max-h-64 overflow-y-auto">
                                {categories.map((category, index) => (
                                    <button
                                        key={index}
                                        onClick={() => {
                                            onCategoryChange(category);
                                            setShowCategoryDropdown(false);
                                        }}
                                        className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                                    >
                                        {category}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Mark as Recurring */}
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onMarkRecurring}
                        className="text-white hover:bg-slate-800"
                    >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Mark Recurring
                    </Button>

                    {/* Export to CSV */}
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onExportCSV}
                        className="text-white hover:bg-slate-800"
                    >
                        <Download className="h-4 w-4 mr-2" />
                        Export CSV
                    </Button>

                    {/* Delete */}
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onDelete}
                        className="text-red-400 hover:bg-red-900/20"
                    >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                    </Button>
                </div>

                {/* Clear Selection */}
                <button
                    onClick={onClearSelection}
                    className="ml-2 p-1 hover:bg-slate-800 rounded-full transition-colors"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
};
