import React from 'react';
import { RefreshCcw, Zap, ShieldCheck, Lock, Crown, Gem, Award, Star, Trophy, Key } from 'lucide-react';
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
    handleToggleBlock,
    handleGenerateResetCode
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
                            <tr>
                                <th>User Profile</th>
                                <th>Security Status</th>
                                <th>Account Type</th>
                                <th>Registration</th>
                                <th className="text-right-aligned">Access Guard</th>
                            </tr>

                        </thead>
                        <tbody>
                            {filteredUsers.map(user => {
                                 const daysLeft = 9999;

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

                                        <td>
                                            <div className="status-cell">
                                                <span className={`indicator ${user.isBlocked ? 'blocked' : 'active'}`} />
                                                <span className="status-text" style={{ color: user.isBlocked ? '#ef4444' : '#10b981', fontWeight: 'bold' }}>
                                                    {user.isBlocked ? 'ACCESS_DENIED' : 'VERIFIED_ACTIVE'}
                                                </span>
                                            </div>
                                        </td>
                                        <td>
                                            <span className="tier-badge plat"><Trophy size={11} /> UNLIMITED</span>
                                        </td>
                                        <td>
                                            <div className="timeline-cell">
                                                <p className="date">{format(new Date(user.createdAt), 'dd MMM yyyy')}</p>
                                                <p className="time-sub">Auto-Verified</p>
                                            </div>
                                        </td>


                                        <td className="text-right-aligned">
                                            <div className="action-row">
                                                <button className="action-btn reset" onClick={() => handleGenerateResetCode(user._id)} title="Reset Manager PIN">
                                                    <Key size={18} color="#000000" strokeWidth={2.5} />
                                                    <span className="btn-text">PIN</span>
                                                </button>
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
