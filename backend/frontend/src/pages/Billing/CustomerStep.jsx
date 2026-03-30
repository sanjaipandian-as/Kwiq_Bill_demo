import React, { useState } from 'react';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Search, UserPlus, Phone, Mail, MapPin, User, CheckCircle2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Modal } from '../../components/ui/Modal';
import { useCustomers } from '../../context/CustomerContext';
import { isSearchMatch } from '../../utils/searchUtils';

const CustomerStep = ({ billingData, setBillingData, onNext }) => {
    const { customers, addCustomer } = useCustomers();
    const [searchTerm, setSearchTerm] = useState('');
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);

    // Form State for new customer
    const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', email: '', address: '' });

    const filteredCustomers = customers.filter(c =>
        isSearchMatch(c.name, searchTerm) ||
        isSearchMatch(c.phone, searchTerm)
    );

    const handleSelectCustomer = (customer) => {
        setBillingData(prev => ({ ...prev, customer }));
    };

    const handleSaveNewCustomer = () => {
        if (!newCustomer.name || !newCustomer.phone) {
            alert("Name and Phone are required");
            return;
        }
        const created = addCustomer(newCustomer);
        setBillingData(prev => ({ ...prev, customer: created }));
        setIsAddModalOpen(false);
        setNewCustomer({ name: '', phone: '', email: '', address: '' }); // Reset
    };

    const selectedCustomerId = billingData.customer?.id;

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold text-slate-900">Select Customer</h2>
                <p className="text-slate-500">Search for an existing customer or add a new one</p>
            </div>

            <div className="flex gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                    <Input
                        placeholder="Search by name or phone number..."
                        className="pl-10 h-12 text-lg"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        autoFocus
                    />
                </div>
                <Button size="lg" className="h-12 px-6" onClick={() => setIsAddModalOpen(true)}>
                    <UserPlus className="mr-2 h-5 w-5" /> Add New
                </Button>
            </div>

            {/* Customer List Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                {filteredCustomers.map((customer) => (
                    <div
                        key={customer.id}
                        onClick={() => handleSelectCustomer(customer)}
                        className={cn(
                            "relative cursor-pointer rounded-xl border p-4 transition-all hover:shadow-md",
                            selectedCustomerId === customer.id
                                ? "border-blue-500 bg-blue-50/50 ring-1 ring-blue-500"
                                : "border-slate-200 bg-white hover:border-blue-300"
                        )}
                    >
                        {selectedCustomerId === customer.id && (
                            <div className="absolute top-4 right-4 text-blue-600">
                                <CheckCircle2 className="h-6 w-6" />
                            </div>
                        )}

                        <div className="flex items-start gap-4">
                            <div className={cn(
                                "flex h-12 w-12 items-center justify-center rounded-full",
                                selectedCustomerId === customer.id ? "bg-blue-100 text-blue-600" : "bg-slate-100 text-slate-500"
                            )}>
                                <User size={24} />
                            </div>
                            <div className="space-y-1">
                                <h3 className="font-semibold text-slate-900">{customer.name}</h3>
                                <div className="flex items-center gap-2 text-sm text-slate-500">
                                    <Phone size={14} /> <span>{customer.phone}</span>
                                </div>
                                {customer.email && customer.email !== '-' && (
                                    <div className="flex items-center gap-2 text-sm text-slate-500">
                                        <Mail size={14} /> <span>{customer.email}</span>
                                    </div>
                                )}
                                {customer.address && customer.address !== '-' && (
                                    <div className="flex items-center gap-2 text-sm text-slate-500">
                                        <MapPin size={14} /> <span className="truncate max-w-[200px]">{customer.address}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Add Customer Modal */}
            <Modal
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                title="Add New Customer"
            >
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Full Name</label>
                            <Input
                                value={newCustomer.name}
                                onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                                placeholder="John Doe"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Phone Number</label>
                            <Input
                                value={newCustomer.phone}
                                onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                                placeholder="+1 234 567 8900"
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Email Address</label>
                        <Input
                            type="email"
                            value={newCustomer.email}
                            onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                            placeholder="john@example.com"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Address</label>
                        <Input
                            value={newCustomer.address}
                            onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })}
                            placeholder="Street address, City, State"
                        />
                    </div>
                    <div className="pt-4 flex justify-end gap-2">
                        <Button variant="ghost" onClick={() => setIsAddModalOpen(false)}>Cancel</Button>
                        <Button onClick={handleSaveNewCustomer}>Save Customer</Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default CustomerStep;