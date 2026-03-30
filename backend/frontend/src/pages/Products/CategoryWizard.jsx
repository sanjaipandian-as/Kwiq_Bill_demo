import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Search, Tag, Check } from 'lucide-react';
import { isSearchMatch } from '../../utils/searchUtils';

const CategoryWizard = ({ isOpen, onClose, categories, onSelectCategory, title = "Select Category" }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [filteredCategories, setFilteredCategories] = useState(categories);

    useEffect(() => {
        if (isOpen) {
            setSearchQuery('');
            setFilteredCategories(categories);
        }
    }, [isOpen, categories]);

    useEffect(() => {
        setFilteredCategories(
            categories.filter(cat => isSearchMatch(cat, searchQuery))
        );
    }, [searchQuery, categories]);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title}>
            <div className="space-y-4">
                {/* Search Bar */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                        placeholder="Search categories..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                        autoFocus
                    />
                </div>

                {/* Categories List */}
                <div className="max-h-60 overflow-y-auto border rounded-md divide-y">
                    <div
                        className="p-3 hover:bg-slate-50 cursor-pointer flex items-center gap-2 text-body-primary font-medium border-l-4 border-transparent hover:border-primary-main transition-all"
                        onClick={() => { onSelectCategory(null); onClose(); }}
                    >
                        <div className="bg-slate-100 p-2 rounded-full"><Tag size={16} /></div>
                        <span>All Categories</span>
                    </div>
                    {filteredCategories.length > 0 ? (
                        filteredCategories.map((cat, index) => (
                            <div
                                key={index}
                                className="p-3 hover:bg-slate-50 cursor-pointer flex items-center gap-2 text-body-primary border-l-4 border-transparent hover:border-primary-main transition-all"
                                onClick={() => { onSelectCategory(cat); onClose(); }}
                            >
                                <div className="bg-primary-main/10 text-primary-main p-2 rounded-full"><Tag size={16} /></div>
                                <span>{cat}</span>
                            </div>
                        ))
                    ) : (
                        <div className="p-8 text-center text-slate-500">
                            No categories found matching "{searchQuery}"
                        </div>
                    )}
                </div>

                <div className="flex justify-end pt-2">
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                </div>
            </div>
        </Modal >
    );
};

export default CategoryWizard;
