import React from 'react';
import { Zap, UserCheck, ShieldAlert, ShieldCheck, UserX, Activity, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const Modals = ({
    selectedUser, 
    setSelectedUser, 
    handleUpdatePlan,
    
    showInviteModal,
    setShowInviteModal,
    inviteEmail,
    setInviteEmail,
    handleInviteUser,
    inviteLoading,

    showSecurityModal,
    setShowSecurityModal,
    securityStats,
    users
}) => {
    return (
        <>
            {/* Premium Extension Modal */}
            <AnimatePresence>
                {selectedUser && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="modal-backdrop"
                    >
                        <motion.div 
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, y: 20 }}
                            className="premium-modal"
                        >
                            <div className="modal-header">
                                <div className="modal-icon"><Zap size={24} color="#fff" fill="#fff" /></div>
                                <h2>Subscription Lifecycle Extension</h2>
                                <p>Modifying access for <strong>{selectedUser.name}</strong></p>
                            </div>

                            <div className="plan-selector">
                                {[
                                    { id: '1m', label: 'Pro - 1 Month', color: '#000000' },
                                    { id: '3m', label: 'Growth - 3 Months', color: '#000000' },
                                    { id: '1y', label: 'Business - 1 Year', color: '#000000', hot: true },
                                    { id: '3y', label: 'Enterprise - 3 Years', color: '#000000' },
                                    { id: '5y', label: 'Unlimited - 5 Years', color: '#000000' }
                                ].map(option => (
                                    <button 
                                        key={option.id} 
                                        onClick={() => handleUpdatePlan(selectedUser._id, option.id)}
                                        className="plan-btn"
                                        style={{ '--accent': option.color }}
                                    >
                                        <div className="btn-content">
                                            <span className="opt-label">{option.label}</span>
                                            <ChevronRight size={18} />
                                        </div>
                                        {option.hot && <span className="hot-pill">Popular</span>}
                                    </button>
                                ))}
                            </div>

                            <button className="btn-secondary" onClick={() => setSelectedUser(null)}>Abort Transfer</button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Invite User Modal */}
            <AnimatePresence>
                {showInviteModal && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="modal-backdrop"
                    >
                        <motion.div 
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, y: 20 }}
                            className="premium-modal invite-modal"
                        >
                            <div className="modal-header">
                                <div className="modal-icon"><UserCheck size={24} color="#fff" fill="none" /></div>
                                <h2>Invite Enterprise User</h2>
                                <p>They will be able to onboard completely after login.</p>
                            </div>

                            <form onSubmit={handleInviteUser} className="invite-form">
                                <div className="input-group">
                                    <label>User's Email Address</label>
                                    <input 
                                        type="email" 
                                        required 
                                        placeholder="founder@startup.com"
                                        value={inviteEmail}
                                        onChange={(e) => setInviteEmail(e.target.value)}
                                        className="invite-input"
                                    />
                                </div>

                                <button type="submit" className="plan-btn submit-invite-btn" disabled={inviteLoading}>
                                    <div className="btn-content" style={{ justifyContent: 'center' }}>
                                        <span className="opt-label" style={{ color: '#fff' }}>
                                            {inviteLoading ? 'Sending Invite...' : 'Send Secure Invite'}
                                        </span>
                                    </div>
                                </button>
                            </form>

                            <button type="button" className="btn-secondary" onClick={() => {
                                setShowInviteModal(false);
                                setInviteEmail('');
                            }}>Cancel Invite</button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Security Audit Modal */}
            <AnimatePresence>
                {showSecurityModal && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="modal-backdrop"
                    >
                        <motion.div 
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, y: 20 }}
                            className="premium-modal security-modal"
                        >
                            <div className="modal-header">
                                <div className="modal-icon" style={{ background: '#000' }}><ShieldAlert size={24} color="#fff" /></div>
                                <h2>Global Security Audit</h2>
                                <p>System-wide security analysis and threat assessment.</p>
                            </div>

                            <div className="security-stats-grid">
                                <div className="sec-stat-box safe">
                                    <ShieldCheck size={20} color="#166534" />
                                    <div>
                                        <h4>{securityStats.activeSecured} Secured</h4>
                                        <p>Active verified accounts</p>
                                    </div>
                                </div>
                                <div className="sec-stat-box danger">
                                    <UserX size={20} color="#991b1b" />
                                    <div>
                                        <h4>{securityStats.blockedThreats} Blocked</h4>
                                        <p>Restricted access alerts</p>
                                    </div>
                                </div>
                                <div className="sec-stat-box neutral">
                                    <Activity size={20} color="#334155" />
                                    <div>
                                        <h4>System Status</h4>
                                        <p>All protocols nominal</p>
                                    </div>
                                </div>
                            </div>

                            <div className="audit-log">
                                <h3>Recent Security Events</h3>
                                <div className="log-item">
                                    <span className="time">{securityStats.lastAudit}</span>
                                    <span className="event">Full system scan completed.</span>
                                </div>
                                {users.filter(u => u.isBlocked).slice(0, 3).map(u => (
                                    <div key={u._id} className="log-item warning">
                                        <span className="time">Found</span>
                                        <span className="event">Blocked user detected: {u.email}</span>
                                    </div>
                                ))}
                            </div>

                            <button className="plan-btn" onClick={() => setShowSecurityModal(false)} style={{ marginTop: 20 }}>
                                <div className="btn-content" style={{ justifyContent: 'center' }}>
                                    <span className="opt-label">Acknowledge Status</span>
                                </div>
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
};

export default Modals;
