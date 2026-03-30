import React, { useState, useEffect, useRef } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { Search, UserPlus } from 'lucide-react';
import { useCustomers } from '../../../context/CustomerContext';
import { isSearchMatch } from '../../../utils/searchUtils';

const CustomerSearchModal = ({ isOpen, onClose, onSelect }) => {
    const { customers } = useCustomers();
    const [searchTerm, setSearchTerm] = useState('');
    const inputRef = useRef(null);

    useEffect(() => {
        if (isOpen && inputRef.current) {
            setTimeout(() => inputRef.current.focus(), 100);
        }
    }, [isOpen]);

    const filteredCustomers = customers.filter(customer => {
        const fullName = customer.fullName || `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || customer.name || '';
        return isSearchMatch(fullName, searchTerm) || isSearchMatch(customer.phone, searchTerm);
    }).slice(0, 10);

    const handleKeyDown = (e, customer) => {
        if (e.key === 'Enter') {
            onSelect(customer);
            onClose();
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Search Customer"
            className="w-[60vw] max-w-4xl h-[70vh]"
        >
            <div className="space-y-4 h-full flex flex-col">
                <div className="relative shrink-0">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
                    <Input
                        ref={inputRef}
                        placeholder="Search by Name or Phone..."
                        className="pl-10 h-12 text-lg"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="border rounded-md flex-1 overflow-y-auto">
                    {filteredCustomers.length > 0 ? (
                        filteredCustomers.map((customer, index) => (
                            <div
                                key={customer.id || customer._id}
                                tabIndex={0}
                                className="p-3 hover:bg-blue-50 cursor-pointer border-b last:border-0 focus:bg-blue-50 focus:outline-none"
                                onClick={() => {
                                    onSelect(customer);
                                    onClose();
                                }}
                                onKeyDown={(e) => handleKeyDown(e, customer)}
                            >
                                <div className="font-semibold text-slate-800">
                                    {customer.fullName || `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || customer.name || 'Unknown'}
                                </div>
                                <div className="text-sm text-slate-500">
                                    {customer.phone} {customer.email && `| ${customer.email}`}
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="p-8 text-center text-slate-500">
                            No customers found.
                        </div>
                    )}
                </div>

                <div className="flex justify-end pt-2">
                    {/* Placeholder for quick add feature if requested later */}
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                </div>
            </div>
        </Modal>
    );
};

export default CustomerSearchModal;
