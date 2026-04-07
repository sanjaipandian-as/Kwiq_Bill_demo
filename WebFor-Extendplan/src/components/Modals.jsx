import { Zap, UserCheck, ShieldAlert, ShieldCheck, UserX, Activity, ChevronRight, Key } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const Modals = ({
    selectedUser,
    setSelectedUser,

    showInviteModal,
    setShowInviteModal,
    inviteEmail,
    setInviteEmail,
    handleInviteUser,
    inviteLoading,

    showSecurityModal,
    setShowSecurityModal,
    securityStats,
    users,

    resetData,
    setResetData
}) => {
    return (
        <>
            {/* Premium Extension Modal removed */}

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
            {/* PIN Reset Code Modal */}
            <AnimatePresence>
                {resetData && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="modal-backdrop"
                        style={{ zIndex: 2000 }}
                    >
                        <motion.div
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, y: 20 }}
                            className="premium-modal"
                            style={{ border: '3px solid #000' }}
                        >
                            <div className="modal-header">
                                <div className="modal-icon" style={{ background: '#000' }}><Key size={24} color="#fff" /></div>
                                <h2>Manual Override Code</h2>
                                <p>Provide this code to the manager for identity verification.</p>
                            </div>

                            <div style={{
                                background: '#000',
                                color: '#fff',
                                padding: '30px',
                                borderRadius: '24px',
                                textAlign: 'center',
                                marginBottom: '24px',
                                boxShadow: '0 15px 30px rgba(0,0,0,0.2)'
                            }}>
                                <span style={{
                                    fontSize: '48px',
                                    fontWeight: '950',
                                    letterSpacing: '4px',
                                    fontFamily: 'monospace'
                                }}>
                                    {resetData.code}
                                </span>
                            </div>

                            <div className="sec-stat-box neutral" style={{ marginBottom: 24 }}>
                                <Activity size={20} />
                                <div>
                                    <h4>Code Validity</h4>
                                    <p>Expires in 2 hours. Can be used only once.</p>
                                </div>
                            </div>

                            <button className="plan-btn" onClick={() => setResetData(null)} style={{ background: '#000', color: '#fff' }}>
                                <div className="btn-content" style={{ justifyContent: 'center' }}>
                                    <span className="opt-label" style={{ color: '#fff' }}>CODE PROVIDED</span>
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
