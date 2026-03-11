import React from 'react';
import { RefreshCcw, Zap, ShieldCheck, Lock, Crown, Gem, Award, Star, Trophy } from 'lucide-react';
import { format } from 'date-fns';
import { motion } from 'framer-motion';

const UsersTableView = ({
    mode,
    loading,
    filteredUsers,
    filterStatus,
    setFilterStatus,
    getRemainingDays,
    setSelectedUser,
    handleToggleBlock
}) => {
    return (
        <div className="data-view">
            <div className="table-filters">
                <div className="filter-group">
                    <button className={filterStatus === 'all' ? 'active' : ''} onClick={() => setFilterStatus('all')}>
                        {mode === 'directory' ? 'All Directory' : 'All Licenses'}
                    </button>
                    <button className={filterStatus === 'active' ? 'active' : ''} onClick={() => setFilterStatus('active')}>
                        {mode === 'directory' ? 'Active Users' : 'Valid Plans'}
                    </button>
                    <button className={filterStatus === 'blocked' ? 'active' : ''} onClick={() => setFilterStatus('blocked')}>
                        {mode === 'directory' ? 'Security Blocks' : 'Terminated'}
                    </button>
                </div>
                <div className="search-count">
                    {mode === 'directory' ? 'Scanning' : 'Monitoring'} {filteredUsers.length} active node records
                </div>
            </div>

            {loading ? (
                <div className="pro-loader">
                    <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}>
                        <RefreshCcw size={40} color="#000000" />
                    </motion.div>
                    <p>{mode === 'directory' ? 'Fetching Secure Directory...' : 'Calculating License Cycles...'}</p>
                </div>
            ) : (
                <div className="pro-table-wrapper">
                    <table className="pro-table">
                        <thead>
                            {mode === 'directory' ? (
                                <tr>
                                    <th>User Profile</th>
                                    <th>Security Status</th>
                                    <th>Account Type</th>
                                    <th>Registration</th>
                                    <th className="text-right-aligned">Access Guard</th>
                                </tr>
                            ) : (
                                <tr>
                                    <th>Enterprise Client</th>
                                    <th>Subscription Tier</th>
                                    <th>License Validity</th>
                                    <th>Renewal Potential</th>
                                    <th className="text-right-aligned">Plan Actions</th>
                                </tr>
                            )}
                        </thead>
                        <tbody>
                            {filteredUsers.map(user => {
                                const daysLeft = user.plan === 'free' 
                                    ? getRemainingDays(user.trialExpiresAt) 
                                    : getRemainingDays(user.planExpiresAt);
                                
                                return (
                                    <motion.tr layout key={user._id} className={user.isBlocked ? 'row-blocked' : ''}>
                                        <td>
                                            <div className="user-identity">
                                                <div className="avatar-med">{user.name[0]}</div>
                                                <div className="details">
                                                    <p className="name-bold">{user.name}</p>
                                                    <p className="email-sub">{user.email}</p>
                                                </div>
                                            </div>
                                        </td>

                                        {mode === 'directory' ? (
                                            <>
                                                <td>
                                                    <div className="status-cell">
                                                        <span className={`indicator ${user.isBlocked ? 'blocked' : 'active'}`} />
                                                        <span className="status-text" style={{ color: user.isBlocked ? '#ef4444' : '#10b981', fontWeight: 'bold' }}>
                                                            {user.isBlocked ? 'ACCESS_DENIED' : 'VERIFIED_ACTIVE'}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td>
                                                    {(() => {
                                                        const p = user.plan;
                                                        if (p === '5y') return <span className="tier-badge plat"><Trophy size={11} /> PLATINUM</span>;
                                                        if (p === '3y') return <span className="tier-badge gold"><Crown size={11} /> ELITE 3Y</span>;
                                                        if (p === '1y') return <span className="tier-badge annual"><Gem size={11} /> ANNUAL</span>;
                                                        if (p === '3m') return <span className="tier-badge quarterly"><Award size={11} /> QUARTERLY</span>;
                                                        if (p === '1m') return <span className="tier-badge monthly"><Star size={11} /> MONTHLY</span>;
                                                        return <span className="tier-badge basic"><Zap size={11} /> ESSENTIAL</span>;
                                                    })()}
                                                </td>
                                                <td>
                                                    <div className="timeline-cell">
                                                        <p className="date">{format(new Date(user.createdAt), 'dd MMM yyyy')}</p>
                                                        <p className="time-sub">Auto-Verified</p>
                                                    </div>
                                                </td>
                                            </>
                                        ) : (
                                            <>
                                                <td>
                                                    <span className={`plan-badge ${user.plan}`}>
                                                        <Zap size={12} fill="currentColor" />
                                                        {user.plan === 'free' ? 'Standard Trial' : `${user.plan.toUpperCase()} Enterprise`}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div className="status-cell">
                                                        <span className={`indicator ${daysLeft > 0 ? 'active' : 'expired'}`} />
                                                        <span className="status-text" style={{ fontWeight: '800' }}>
                                                            {daysLeft > 0 ? `${daysLeft} DAYS LEFT` : 'LICENSE_EXPIRED'}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td>
                                                    <div className="timeline-cell">
                                                        <p className="date">Expires: {user.planExpiresAt ? format(new Date(user.planExpiresAt), 'MMM dd, yyyy') : 'Trial End'}</p>
                                                        <p className="active-since">Auto-Billing: Active</p>
                                                    </div>
                                                </td>
                                            </>
                                        )}

                                        <td className="text-right-aligned">
                                            <div className="action-row">
                                                {mode === 'subscriptions' && (
                                                    <button className="action-btn pro" onClick={() => setSelectedUser(user)} title="Extend Plan">
                                                        <RefreshCcw size={18} color="#000000" strokeWidth={2.5} />
                                                        <span className="btn-text">UPGRADE</span>
                                                    </button>
                                                )}
                                                <button 
                                                    className={`action-btn ${user.isBlocked ? 'safety' : 'danger'}`} 
                                                    onClick={() => handleToggleBlock(user._id)}
                                                    title={user.isBlocked ? 'Unlock' : 'Lock Account'}
                                                >
                                                    {user.isBlocked ? (
                                                        <>
                                                            <ShieldCheck size={18} color="#000000" strokeWidth={2.5} />
                                                            <span className="btn-text">UNLOCK</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Lock size={18} color="#000000" strokeWidth={2.5} />
                                                            <span className="btn-text">BLOCK</span>
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                        </td>
                                    </motion.tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default UsersTableView;
