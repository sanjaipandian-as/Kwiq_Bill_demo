import React, { useState } from 'react';
import { Coffee, ShieldCheck, Heart, Search, Filter } from 'lucide-react';
import { format } from 'date-fns';
import { motion } from 'framer-motion';

const DonationsView = ({ donations, onRefresh }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');

    const filteredDonations = (donations || []).filter(donation => {
        const matchesSearch = 
            (donation.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (donation.orderId || '').toLowerCase().includes(searchTerm.toLowerCase());
        const matchesFilter = filterStatus === 'all' || donation.status === filterStatus;
        return matchesSearch && matchesFilter;
    });

    const totalRevenue = filteredDonations
        .filter(d => d.status === 'paid')
        .reduce((sum, d) => sum + (Number(d.amount) || 0), 0);

    return (
        <div className="revenue-page">
            <div className="card-header" style={{ marginBottom: 0, justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h2 style={{ fontSize: '24px', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Heart size={28} color="#000" strokeWidth={3} /> Donation Hub
                    </h2>
                    <p style={{ color: '#64748b', fontSize: '14px', marginTop: '4px' }}>Track community support and secure contributions.</p>
                </div>
                <button 
                    onClick={onRefresh}
                    style={{ background: '#000', color: '#fff', padding: '10px 20px', borderRadius: '12px', fontWeight: 700, border: 'none', cursor: 'pointer' }}
                >
                    Refresh Data
                </button>
            </div>

            <div className="time-filters" style={{ width: 'fit-content' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '0 8px' }}>
                    <Search size={16} color="#64748b" />
                    <input 
                        type="text" 
                        placeholder="Search email or ID..." 
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '13px', width: '200px' }}
                    />
                    <div style={{ width: '1px', height: '20px', background: '#e2e8f0', margin: '0 10px' }} />
                    <Filter size={16} color="#64748b" />
                    <select 
                        value={filterStatus} 
                        onChange={e => setFilterStatus(e.target.value)}
                        style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '13px', color: '#64748b', fontWeight: 600, cursor: 'pointer' }}
                    >
                        <option value="all">All Statuses</option>
                        <option value="paid">Paid</option>
                        <option value="pending">Pending</option>
                    </select>
                </div>
            </div>

            <div className="revenue-grid">
                <div className="stat-card">
                    <div className="card-header">
                        <div className="icon bw-icon-wrapper"><Heart size={20} /></div>
                    </div>
                    <div className="card-body">
                        <p className="label">Total Attempts</p>
                        <h2 className="value">{filteredDonations.length}</h2>
                        <p className="sub-value">Overall checkout clicks</p>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="card-header">
                        <div className="icon bw-icon-wrapper"><ShieldCheck size={20} /></div>
                    </div>
                    <div className="card-body">
                        <p className="label">Total Collected</p>
                        <h2 className="value">₹{totalRevenue.toLocaleString()}</h2>
                        <p className="sub-value">Secured and Verified</p>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="card-header">
                        <div className="icon bw-icon-wrapper"><Coffee size={20} /></div>
                    </div>
                    <div className="card-body">
                        <p className="label">Incomplete Process</p>
                        <h2 className="value">{filteredDonations.filter(d => d.status === 'pending').length}</h2>
                        <p className="sub-value">Pending or Cancelled</p>
                    </div>
                </div>
            </div>

            <div className="modern-table-container">
                <table className="modern-table">
                    <thead>
                        <tr>
                            <th>DATE</th>
                            <th>ORDER ID</th>
                            <th>SUPPORTER EMAIL</th>
                            <th>AMOUNT</th>
                            <th>STATUS</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredDonations.length > 0 ? filteredDonations.map((donation) => (
                            <motion.tr 
                                key={donation._id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.2 }}
                            >
                                <td className="font-mono text-sm text-gray-500">
                                    {format(new Date(donation.createdAt), 'MMM dd, yyyy HH:mm')}
                                </td>
                                <td className="font-mono text-sm" style={{color: '#64748b'}}>
                                    {donation.orderId}
                                </td>
                                <td>
                                    <span style={{fontWeight: 600}}>{donation.email || 'Anonymous'}</span>
                                </td>
                                <td style={{fontWeight: 700}}>
                                    ₹{donation.amount}
                                </td>
                                <td>
                                    <span className={`status-badge ${donation.status === 'paid' ? 'status-active' : 'status-pending'}`}>
                                        {donation.status.toUpperCase()}
                                    </span>
                                </td>
                            </motion.tr>
                        )) : (
                            <tr>
                                <td colSpan="5" style={{textAlign: 'center', padding: '40px', color: '#94a3b8'}}>
                                    No donations found matching criteria.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <style>{`
                .revenue-page { display: flex; flex-direction: column; gap: 30px; }
                .revenue-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
                
                .stat-card { 
                    background: white; 
                    padding: 24px; 
                    border-radius: 16px; 
                    border: 1.5px solid #e2e8f0;
                    transition: 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    position: relative;
                    overflow: hidden;
                }
                .stat-card:hover { transform: translateY(-4px); border-color: #000; box-shadow: 0 12px 24px rgba(0,0,0,0.06); }
                
                .card-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
                .icon { width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; }
                
                /* B&W Theme Icon Styles */
                .bw-icon-wrapper { background: #f8fafc; border: 1.5px solid #cbd5e1; color: #0f172a; }
                .stat-card:hover .bw-icon-wrapper { background: #000; color: #fff; border-color: #000; }
                
                .card-body .label { color: #64748b; font-size: 13px; font-weight: 600; margin-bottom: 6px; }
                .card-body .value { font-size: 36px; font-weight: 900; margin: 0; color: #000; letter-spacing: -1px; }
                .card-body .sub-value { font-size: 12px; font-weight: 700; color: #94a3b8; margin: 8px 0 0; text-transform: uppercase; letter-spacing: 0.5px; }

                /* Modern Table Override B&W */
                .modern-table-container { background: white; border: 1.5px solid #e2e8f0; border-radius: 16px; overflow: hidden; }
                .modern-table { width: 100%; border-collapse: collapse; }
                .modern-table th { background: #f8fafc; color: #0f172a; font-weight: 800; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; padding: 16px 24px; text-align: left; border-bottom: 1.5px solid #e2e8f0; }
                .modern-table td { padding: 16px 24px; border-bottom: 1px solid #f1f5f9; color: #0f172a; }
                .modern-table tbody tr { transition: 0.2s; }
                .modern-table tbody tr:hover { background: #f8fafc; }

                /* Status Badges */
                .status-badge { padding: 6px 12px; border-radius: 100px; font-size: 11px; font-weight: 800; display: inline-block; letter-spacing: 0.5px; }
                .status-active { background: #000; color: #fff; }
                .status-pending { background: #f1f5f9; color: #64748b; border: 1px solid #cbd5e1; }
                
                .text-gray-500 { color: #64748b; }
                .text-sm { font-size: 13px; }
            `}</style>
        </div>
    );
};

export default DonationsView;
