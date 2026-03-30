import React, { useState, useEffect, useRef } from 'react';
import { Filter, X, Search } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { isSearchMatch } from '../../utils/searchUtils';
import './CategoryFilter.css';

const CategoryFilter = ({ expenses, onCategoryChange, value }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState(value || null);
    const dropdownRef = useRef(null);

    // Extract unique categories from expenses
    const allCategories = [...new Set(expenses.map(e => e.category).filter(Boolean))].sort();

    // Filter categories based on search term
    const filteredCategories = allCategories.filter(category =>
        isSearchMatch(category, searchTerm)
    );

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const handleCategorySelect = (category) => {
        setSelectedCategory(category);
        onCategoryChange(category);
        setIsOpen(false);
        setSearchTerm('');
    };

    const handleClear = () => {
        setSelectedCategory(null);
        onCategoryChange(null);
        setSearchTerm('');
        setIsOpen(false);
    };

    const handleAllCategories = () => {
        setSelectedCategory(null);
        onCategoryChange(null);
        setSearchTerm('');
        setIsOpen(false);
    };

    return (
        <div className="category-filter" ref={dropdownRef}>
            <Button
                variant="outline"
                onClick={() => setIsOpen(!isOpen)}
                className={selectedCategory ? 'cf-button-active' : ''}
            >
                <Filter className="mr-2 h-4 w-4" />
                {selectedCategory || 'Category'}
            </Button>

            {isOpen && (
                <div className="cf-dropdown">
                    <div className="cf-content">
                        {/* Search Bar */}
                        <div className="cf-search-container">
                            <div className="relative">
                                <Search className="cf-search-icon" />
                                <Input
                                    placeholder="Search categories..."
                                    className="cf-search-input"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    autoFocus
                                />
                            </div>
                        </div>

                        {/* Categories List */}
                        <div className="cf-categories-list">
                            {/* All Categories Option */}
                            <div
                                className={`cf-category-item ${!selectedCategory ? 'cf-category-selected' : ''}`}
                                onClick={handleAllCategories}
                            >
                                <span className="cf-category-name">All Categories</span>
                                <span className="cf-category-count">{expenses.length}</span>
                            </div>

                            {/* Filtered Categories */}
                            {filteredCategories.length > 0 ? (
                                filteredCategories.map(category => {
                                    const count = expenses.filter(e => e.category === category).length;
                                    return (
                                        <div
                                            key={category}
                                            className={`cf-category-item ${selectedCategory === category ? 'cf-category-selected' : ''}`}
                                            onClick={() => handleCategorySelect(category)}
                                        >
                                            <span className="cf-category-name">{category}</span>
                                            <span className="cf-category-count">{count}</span>
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="cf-no-results">
                                    No categories found
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Actions */}
                    {selectedCategory && (
                        <div className="cf-actions">
                            <Button variant="ghost" size="sm" onClick={handleClear}>
                                <X className="mr-1 h-3 w-3" />
                                Clear Filter
                            </Button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default CategoryFilter;
