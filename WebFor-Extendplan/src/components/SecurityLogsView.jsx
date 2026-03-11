import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, ShieldCheck, Lock, Unlock, Zap, UserPlus, 
  Activity, Database, Terminal, Cpu, HardDrive, Wifi, 
  Search, Shield, AlertTriangle, Fingerprint
} from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

const SecurityLogsView = ({ users, logs, metrics }) => {
    const [activeTab, setActiveTab] = useState('live');
    const [scanning, setScanning] = useState(false);
    
    // Generate events based on real Audit Logs
    const events = logs.map(log => ({
        id: log._id,
        type: log.action.toLowerCase().includes('plan') ? 'system' : 
              log.action.toLowerCase().includes('block') ? 'threat' : 'access',
        message: log.details,
        time: new Date(log.createdAt),
        icon: log.action.includes('PLAN') ? Zap : 
              log.action.includes('BLOCK') ? ShieldAlert : Fingerprint,
        status: log.action.includes('BLOCK') ? 'blocked' : 'success'
    }));

    const sortedEvents = events.slice(0, 30);

    const runScan = () => {
        setScanning(true);
        setTimeout(() => setScanning(false), 3000);
    };

    return (
        <div className="security-page">
            {/* Top Security Overview Cards */}
            <div className="security-hero-grid">
                <div className="hero-card primary">
                    <div className="card-inner">
                        <div className="icon-group">
                            <Shield size={32} />
                            <div className="pulse-container">
                                <div className="pulse-dot" />
                                <span>ENCRYPTED</span>
                            </div>
                        </div>
                        <div className="content">
                            <h3>Quantum Shield Active</h3>
                            <p>Global threat protection is running at peak performance with zero latency.</p>
                        </div>
                        <button className="scan-trigger" onClick={runScan} disabled={scanning}>
                            {scanning ? 'ANALYZING...' : 'FORCE SYSTEM SCAN'}
                        </button>
                    </div>
                    <div className="card-bg-icon"><Shield size={120} /></div>
                </div>

                <div className="sec-stats-stack">
                    <div className="mini-sec-card">
                        <div className="icon-box red"><AlertTriangle size={20} /></div>
                        <div className="info">
                            <span className="label">Blocked Threats</span>
                            <span className="value">{users.filter(u => u.isBlocked).length}</span>
                        </div>
                    </div>
                    <div className="mini-sec-card">
                        <div className="icon-box green"><ShieldCheck size={20} /></div>
                        <div className="info">
                            <span className="label">Verified Nodes</span>
                            <span className="value">{users.length}</span>
                        </div>
                    </div>
                    <div className="mini-sec-card">
                        <div className="icon-box blue"><Activity size={20} /></div>
                        <div className="info">
                            <span className="label">Uptime</span>
                            <span className="value">99.98%</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="security-main-grid">
                {/* Visual Terminal Area */}
                <div className="terminal-container">
                    <div className="terminal-header">
                        <div className="window-controls">
                            <span className="dot red" />
                            <span className="dot yellow" />
                            <span className="dot green" />
                        </div>
                        <div className="terminal-tabs">
                            <button className={activeTab === 'live' ? 'active' : ''} onClick={() => setActiveTab('live')}>
                                <Terminal size={14} /> LIVE COMMANDS
                            </button>
                            <button className={activeTab === 'audit' ? 'active' : ''} onClick={() => setActiveTab('audit')}>
                                <Database size={14} /> AUDIT REPOSITORY
                            </button>
                        </div>
                    </div>
                    
                    <div className="terminal-window">
                        {sortedEvents.map((event, idx) => (
                            <motion.div 
                                initial={{ opacity: 0, x: -5 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: idx * 0.02 }}
                                key={event.id}
                                className={`terminal-line ${event.status}`}
                            >
                                <span className="line-time">{format(event.time, 'HH:mm:ss')}</span>
                                <span className="line-tag">[{event.type}]</span>
                                <event.icon size={14} className="line-icon" />
                                <span className="line-msg">{event.message}</span>
                                <span className="line-cursor">_</span>
                            </motion.div>
                        ))}
                    </div>
                </div>

                {/* System Health Area */}
                <div className="system-side-panel">
                    <div className="glass-panel">
                        <h4 className="panel-title">System Integrity</h4>
                        <div className="health-metrics">
                            <div className="metric">
                                <div className="header"><Cpu size={16} /> <span>CPU Core usage</span></div>
                                <div className="bar-track"><motion.div initial={{ width: 0 }} animate={{ width: `${metrics?.cpu || 0}%` }} className="bar-fill blue" /></div>
                            </div>
                            <div className="metric">
                                <div className="header"><HardDrive size={16} /> <span>Memory Allocation</span></div>
                                <div className="bar-track"><motion.div initial={{ width: 0 }} animate={{ width: `${metrics?.memory || 0}%` }} className="bar-fill purple" /></div>
                            </div>
                            <div className="metric">
                                <div className="header"><Wifi size={16} /> <span>Network Latency</span></div>
                                <div className="bar-track"><motion.div initial={{ width: 0 }} animate={{ width: scanning ? '90%' : '5%' }} className="bar-fill green" /></div>
                            </div>
                        </div>

                        <div className="security-footer-info">
                            <div className="status-badge">
                                <div className="status-pulse" />
                                DB: CLOUD-SYNC STABLE
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <style>{`
                .security-page {
                    display: flex;
                    flex-direction: column;
                    gap: 24px;
                    padding-bottom: 40px;
                }

                .security-hero-grid {
                    display: grid;
                    grid-template-columns: 2fr 1fr;
                    gap: 24px;
                }

                .hero-card {
                    background: #000;
                    border-radius: 24px;
                    padding: 32px;
                    color: white;
                    position: relative;
                    overflow: hidden;
                    display: flex;
                    align-items: center;
                }

                .hero-card .card-inner {
                    position: relative;
                    z-index: 2;
                    width: 100%;
                }

                .icon-group {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    margin-bottom: 20px;
                }

                .pulse-container {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    background: rgba(34, 197, 94, 0.15);
                    padding: 6px 12px;
                    border-radius: 100px;
                    color: #4ade80;
                    font-size: 11px;
                    font-weight: 800;
                    letter-spacing: 1px;
                }

                .pulse-dot {
                    width: 6px;
                    height: 6px;
                    background: #22c55e;
                    border-radius: 50%;
                    animation: sec-pulse 2s infinite;
                }

                @keyframes sec-pulse {
                    0% { transform: scale(0.8); opacity: 0.5; }
                    50% { transform: scale(1.2); opacity: 1; }
                    100% { transform: scale(0.8); opacity: 0.5; }
                }

                .hero-card h3 {
                    font-size: 28px;
                    font-weight: 900;
                    margin: 0 0 12px;
                    letter-spacing: -0.5px;
                }

                .hero-card p {
                    color: rgba(255, 255, 255, 0.6);
                    font-size: 15px;
                    max-width: 400px;
                    line-height: 1.6;
                    margin: 0 0 24px;
                }

                .scan-trigger {
                    background: white;
                    color: black;
                    border: none;
                    padding: 14px 28px;
                    border-radius: 14px;
                    font-weight: 800;
                    font-size: 13px;
                    cursor: pointer;
                    transition: 0.3s;
                }

                .scan-trigger:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 10px 20px rgba(255, 255, 255, 0.2);
                }

                .card-bg-icon {
                    position: absolute;
                    right: -20px;
                    bottom: -20px;
                    opacity: 0.1;
                    transform: rotate(-15deg);
                }

                .sec-stats-stack {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }

                .mini-sec-card {
                    background: white;
                    border: 1px solid #eef2f6;
                    border-radius: 18px;
                    padding: 16px 20px;
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    transition: 0.3s;
                }

                .mini-sec-card:hover { border-color: #000; transform: translateX(5px); }

                .icon-box {
                    width: 44px;
                    height: 44px;
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .icon-box.red { background: #fef2f2; color: #ef4444; }
                .icon-box.green { background: #f0fdf4; color: #22c55e; }
                .icon-box.blue { background: #eff6ff; color: #3b82f6; }

                .mini-sec-card .label { font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; }
                .mini-sec-card .value { font-size: 20px; font-weight: 900; color: #000; display: block; }

                .security-main-grid {
                    display: grid;
                    grid-template-columns: 2fr 1fr;
                    gap: 24px;
                }

                .terminal-container {
                    background: #000;
                    border-radius: 24px;
                    overflow: hidden;
                    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
                    display: flex;
                    flex-direction: column;
                }

                .terminal-header {
                    background: #111;
                    padding: 14px 20px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-bottom: 1px solid #222;
                }

                .window-controls { display: flex; gap: 8px; }
                .window-controls .dot { width: 10px; height: 10px; border-radius: 50%; }
                .dot.red { background: #ff5f56; }
                .dot.yellow { background: #ffbd2e; }
                .dot.green { background: #27c93f; }

                .terminal-tabs { display: flex; gap: 8px; }
                .terminal-tabs button {
                    background: transparent;
                    border: none;
                    color: #555;
                    font-size: 11px;
                    font-weight: 800;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 6px 14px;
                    border-radius: 8px;
                    cursor: pointer;
                    transition: 0.2s;
                }

                .terminal-tabs button.active { background: #222; color: #fff; }

                .terminal-window {
                    padding: 24px;
                    height: 420px;
                    overflow-y: auto;
                    font-family: 'JetBrains Mono', 'Fira Code', monospace;
                }

                .terminal-line {
                    display: flex;
                    gap: 12px;
                    padding: 6px 0;
                    font-size: 13px;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.02);
                }

                .line-time { color: #555; flex-shrink: 0; }
                .line-tag { font-weight: 800; font-size: 10px; width: 60px; flex-shrink: 0; }
                .line-icon { flex-shrink: 0; }
                .line-msg { color: #ccc; line-height: 1.4; flex-grow: 1; }
                .line-cursor { color: #fff; animation: blink 1s step-start infinite; }

                @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }

                .terminal-line.success .line-tag { color: #4ade80; }
                .terminal-line.success .line-icon { color: #4ade80; }
                .terminal-line.blocked .line-tag { color: #f87171; }
                .terminal-line.blocked .line-icon { color: #f87171; }
                .terminal-line.blocked .line-msg { color: #f87171; font-weight: 600; }
                .terminal-line.info .line-tag { color: #fbbf24; }
                .terminal-line.info .line-icon { color: #fbbf24; }

                .system-side-panel .glass-panel {
                    background: white;
                    border: 1px solid #eef2f6;
                    border-radius: 24px;
                    padding: 24px;
                    height: 100%;
                }

                .panel-title {
                    font-size: 16px;
                    font-weight: 800;
                    margin: 0 0 24px;
                    color: #000;
                }

                .health-metrics {
                    display: flex;
                    flex-direction: column;
                    gap: 20px;
                    margin-bottom: 32px;
                }

                .metric .header {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    font-size: 12px;
                    font-weight: 700;
                    color: #64748b;
                    margin-bottom: 10px;
                }

                .bar-track { height: 10px; background: #f1f5f9; border-radius: 100px; overflow: hidden; }
                .bar-fill { height: 100%; border-radius: 100px; }
                .bar-fill.blue { background: #3b82f6; }
                .bar-fill.purple { background: #a855f7; }
                .bar-fill.green { background: #22c55e; }

                .status-badge {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    background: #000;
                    color: #fff;
                    padding: 12px 20px;
                    border-radius: 16px;
                    font-size: 11px;
                    font-weight: 800;
                    letter-spacing: 0.5px;
                }

                .status-pulse {
                    width: 10px;
                    height: 10px;
                    background: #22c55e;
                    border-radius: 50%;
                    box-shadow: 0 0 10px rgba(34, 197, 94, 0.5);
                }

            `}</style>
        </div>
    );
};

export default SecurityLogsView;
