import React from 'react';
import {
    Users, UserCheck, Zap, AlertCircle, ArrowUpRight, ArrowDownRight,
    PlusCircle, ShieldAlert, CreditCard
} from 'lucide-react';
import { motion } from 'framer-motion';

const DashboardView = ({ stats, metrics, setShowInviteModal, setShowSecurityModal }) => {
    return (
        <div className="dashboard-view">
            <div className="stats-grid">
                <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="dashboard-card">
                    <div className="card-top">
                        <div className="icon-box"><Users size={20} /></div>
                        <span className="trend positive"><ArrowUpRight size={14} /> 12%</span>
                    </div>
                    <h3 className="stat-value">{stats.total}</h3>
                    <p className="stat-label">Total Registered Businesses</p>
                </motion.div>
                <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }} className="dashboard-card">
                    <div className="card-top">
                        <div className="icon-box"><UserCheck size={20} /></div>
                        <span className="trend positive"><ArrowUpRight size={14} /> 5%</span>
                    </div>
                    <h3 className="stat-value">{stats.active}</h3>
                    <p className="stat-label">Active Deployments</p>
                </motion.div>
                <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }} className="dashboard-card">
                    <div className="card-top">
                        <div className="icon-box"><ShieldAlert size={20} /></div>
                        <span className="trend positive"><ArrowUpRight size={14} /> 2%</span>
                    </div>
                    <h3 className="stat-value">{stats.blocked}</h3>
                    <p className="stat-label">Security Blocks Active</p>
                </motion.div>
                <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }} className="dashboard-card">
                    <div className="card-top">
                        <div className="icon-box"><PlusCircle size={20} /></div>
                        <span className="trend positive"><ArrowUpRight size={14} /> 8%</span>
                    </div>
                    <h3 className="stat-value">{stats.total}</h3>
                    <p className="stat-label">Total Nodes Connected</p>
                </motion.div>

            </div>

            <div className="dashboard-columns">
                <div className="column main">
                    <div className="content-card">
                        <div className="card-header">
                            <h3>Network Traffic Overview</h3>
                            <button className="text-btn">View Full Logs</button>
                        </div>
                        <div className="chart-placeholder">
                            <div className="system-health-viz">
                                <div className="health-stat">
                                    <span className="label">Live CPU Load</span>
                                    <div className="progress-ring">
                                        <div className="ring-fill" style={{ height: `${metrics?.cpu || 0}%` }} />
                                        <span className="ring-val">{metrics?.cpu || 0}%</span>
                                    </div>
                                </div>
                                <div className="health-stat">
                                    <span className="label">Memory usage</span>
                                    <div className="progress-ring purple">
                                        <div className="ring-fill" style={{ height: `${metrics?.memory || 0}%` }} />
                                        <span className="ring-val">{metrics?.memory || 0}%</span>
                                    </div>
                                </div>
                            </div>
                            <div className="chart-labels">
                                <span>Core 1</span><span>Core 2</span><span>Core 3</span><span>Core 4</span><span>Memory</span><span>V-Swap</span><span>Uptime</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="column side">
                    <div className="content-card">
                        <div className="card-header">
                            <h3>Quick Actions</h3>
                        </div>
                        <div className="action-list">
                            <button className="quick-item" onClick={() => setShowInviteModal(true)}>
                                <PlusCircle size={20} />
                                <span>Invite Enterprise User</span>
                            </button>
                            <button className="quick-item" onClick={() => setShowSecurityModal(true)}>
                                <ShieldAlert size={20} />
                                <span>Audit Global Security</span>
                            </button>
                            <button className="quick-item">
                                <CreditCard size={20} />
                                <span>Revenue Analytics</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            <style>{`
                .system-health-viz {
                    display: flex;
                    justify-content: space-around;
                    align-items: flex-end;
                    height: 200px;
                    padding: 20px;
                }
                .health-stat {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 15px;
                }
                .progress-ring {
                    width: 100px;
                    height: 100px;
                    background: #f1f5f9;
                    border-radius: 50%;
                    position: relative;
                    overflow: hidden;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border: 1px solid #e2e8f0;
                }
                .ring-fill {
                    position: absolute;
                    bottom: 0;
                    width: 100%;
                    background: #3b82f6;
                    transition: 1s ease-in-out;
                    opacity: 0.2;
                }
                .progress-ring.purple .ring-fill { background: #a855f7; }
                .ring-val {
                    font-size: 24px;
                    font-weight: 800;
                    color: #1e293b;
                    z-index: 2;
                }
                .health-stat .label {
                    font-size: 11px;
                    font-weight: 800;
                    text-transform: uppercase;
                    color: #64748b;
                    letter-spacing: 1px;
                }
            `}</style>
        </div>
    );
};

export default DashboardView;
