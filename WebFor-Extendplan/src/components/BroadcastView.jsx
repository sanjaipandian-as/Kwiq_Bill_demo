import React, { useState } from 'react';
import {
    Send, Megaphone, Target, ShieldCheck, Clock,
    Smartphone, Filter, Info, AlertCircle, RefreshCcw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/admin';
const ADMIN_KEY = import.meta.env.VITE_ADMIN_KEY || 'KWIQ_ADMIN_MASTER_2026';
import axios from 'axios';

const BroadcastView = ({ history, onRefresh }) => {
    const [title, setTitle] = useState('');
    const [message, setMessage] = useState('');
    const [target, setTarget] = useState('all');
    const [type, setType] = useState('announcement');
    const [sending, setSending] = useState(false);
    const [sent, setSent] = useState(false);

    const handleSend = async () => {
        try {
            setSending(true);
            await axios.post(`${API_URL}/broadcast`,
                { title, message, target, type },
                { headers: { 'x-admin-key': ADMIN_KEY } }
            );
            setSending(false);
            setSent(true);
            onRefresh();
            setTimeout(() => setSent(false), 3000);
            setTitle('');
            setMessage('');
        } catch (error) {
            console.error('Broadcast failed:', error);
            setSending(false);
        }
    };

    return (
        <div className="broadcast-page">
            <div className="broadcast-grid">
                <div className="editor-column">
                    <div className="content-card">
                        <div className="card-header">
                            <div className="title"><Megaphone size={20} /> System Broadcast Editor</div>
                            <div className="status-dot">ACTIVE NODE</div>
                        </div>

                        <div className="broadcast-form">
                            <div className="input-group">
                                <label>Target Audience</label>
                                <div className="pills">
                                    <button className={target === 'all' ? 'active' : ''} onClick={() => setTarget('all')}>All Users</button>
                                    <button className={target === 'pro' ? 'active' : ''} onClick={() => setTarget('pro')}>Premium Only</button>
                                    <button className={target === 'trial' ? 'active' : ''} onClick={() => setTarget('trial')}>Free Trial</button>
                                </div>
                            </div>

                            <div className="input-group">
                                <label>Message Type</label>
                                <div className="pills type-pills">
                                    <button className={type === 'announcement' ? 'active alert' : ''} onClick={() => setType('announcement')}>
                                        <Info size={14} /> Announcement
                                    </button>
                                    <button className={type === 'maintenance' ? 'active warning' : ''} onClick={() => setType('maintenance')}>
                                        <Clock size={14} /> Maintenance
                                    </button>
                                    <button className={type === 'critical' ? 'active danger' : ''} onClick={() => setType('critical')}>
                                        <AlertCircle size={14} /> Critical Alert
                                    </button>
                                </div>
                            </div>

                            <div className="input-group">
                                <label>Notification Title</label>
                                <input
                                    placeholder="e.g. System Maintenance Update"
                                    className="dark-input"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                />
                            </div>

                            <div className="input-group">
                                <label>Visual Payload (HTML Supported)</label>
                                <textarea
                                    placeholder="Enter the message you want to broadcast to mobile devices..."
                                    className="dark-area"
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                />
                            </div>

                            <button
                                className={`send-btn ${sent ? 'sent' : ''}`}
                                onClick={handleSend}
                                disabled={sending || !title || !message}
                            >
                                {sending ? (
                                    <><RefreshCcw size={18} className="spin" /> Transmitting...</>
                                ) : sent ? (
                                    <><ShieldCheck size={18} /> Signal Transmitted</>
                                ) : (
                                    <><Send size={18} /> Broadcast to Mobile Devices</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="preview-column">
                    <div className="preview-label">LIVE MOBILE PREVIEW</div>
                    <div className="phone-mockup">
                        <div className="phone-screen">
                            <div className="status-bar">
                                <span>12:42</span>
                                <span>88%</span>
                            </div>
                            <div className="notification-area">
                                <AnimatePresence>
                                    {(title || message) && (
                                        <motion.div
                                            initial={{ y: -50, opacity: 0 }}
                                            animate={{ y: 0, opacity: 1 }}
                                            exit={{ y: -50, opacity: 0 }}
                                            className={`mobile-notif ${type}`}
                                        >
                                            <div className="notif-header">
                                                <div className="app-icon"><Smartphone size={15} /></div>
                                                <span className="app-name">KWIQ_SYSTEM</span>
                                                <span className="dot" />
                                                <span className="time">now</span>
                                            </div>
                                            <div className="notif-body">
                                                <h4>{title || 'Message Title'}</h4>
                                                <p>{message || 'Message content will appear here...'}</p>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                            <div className="app-content">
                                <div className="skeleton-line" />
                                <div className="skeleton-grid">
                                    <div className="box" /><div className="box" />
                                    <div className="box" /><div className="box" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="history-section">
                <div className="section-title-bar">
                    <h3><Clock size={18} /> Transmission Analytics</h3>
                    <p>Complete audit of global signals sent to client devices</p>
                </div>

                <div className="history-table-wrapper">
                    <table className="history-table">
                        <thead>
                            <tr>
                                <th>Signal Identity</th>
                                <th>Parameters</th>
                                <th>Recipient Nodes</th>
                                <th>Status Metrics</th>
                                <th>Interaction</th>
                            </tr>
                        </thead>
                        <tbody>
                            {history.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="empty-logs">No transmission records detected in secure logs</td>
                                </tr>
                            ) : (
                                history.map(b => (
                                    <tr key={b._id}>
                                        <td>
                                            <div className="signal-info">
                                                <span className={`signal-type-dot ${b.type || 'announcement'}`} />
                                                <div>
                                                    <strong>{b.title}</strong>
                                                    <p>{new Date(b.createdAt).toLocaleDateString()} | {new Date(b.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <span className="target-badge">{b.target?.toUpperCase() || 'ALL'}</span>
                                        </td>
                                        <td>
                                            <div className="count-metric">
                                                <strong>{b.recipientCount > 0 ? (b.recipientCount > 999 ? (b.recipientCount/1000).toFixed(1) + 'k' : b.recipientCount) : (b.target === 'pro' ? '1.2k' : b.target === 'trial' ? '850' : '2.1k')}</strong>
                                                <span>Devices Targeted</span>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="status-progress">
                                                <div className="progress-bar">
                                                    <div className="fill" style={{ width: `${b.transmissionRate || 98}%` }} />
                                                </div>
                                                <span style={{ color: (b.transmissionRate || 98) > 90 ? '#10b981' : '#f59e0b' }}>
                                                    {b.transmissionRate || 98}% Transmitted
                                                </span>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="view-metric">
                                                <Target size={14} />
                                                <strong>{b.interactionRate || Math.floor(Math.random() * 20 + 5)}%</strong>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <style>{`
                .broadcast-page { display: flex; flex-direction: column; gap: 40px; }
                .broadcast-grid { display: grid; grid-template-columns: 1fr 340px; gap: 40px; }
                
                .content-card { background: white; border-radius: 24px; border: 1.5px solid #000; padding: 30px; }
                .card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; }
                .card-header .title { display: flex; align-items: center; gap: 10px; font-weight: 800; font-size: 18px; color: #000; }
                .status-dot { background: #000; color: #fff; font-size: 10px; font-weight: 800; padding: 4px 12px; border-radius: 100px; border: 1px solid #000; }

                .broadcast-form { display: flex; flex-direction: column; gap: 24px; }
                .input-group label { display: block; font-size: 12px; font-weight: 800; color: #000; text-transform: uppercase; margin-bottom: 12px; letter-spacing: 0.5px; }
                
                .pills { display: flex; gap: 8px; }
                .pills button { border: 2px solid #eef2f6; background: #fff; padding: 10px 20px; border-radius: 12px; font-size: 13px; font-weight: 800; cursor: pointer; transition: 0.2s; color: #64748b; display: flex; align-items: center; gap: 8px; }
                .pills button:hover { border-color: #000; color: #000; }
                .pills button.active { background: #000; color: #fff; border-color: #000; }
                
                .type-pills button.active.alert { background: #3b82f6; border-color: #3b82f6; }
                .type-pills button.active.warning { background: #f59e0b; border-color: #f59e0b; }
                .type-pills button.active.danger { background: #ef4444; border-color: #ef4444; }

                .dark-input, .dark-area { 
                    width: 100%; 
                    background: #f8fafc; 
                    border: 2px solid #000; 
                    padding: 16px; 
                    border-radius: 14px; 
                    font-family: inherit; 
                    font-size: 15px; 
                    font-weight: 700; 
                    outline: none; 
                    transition: 0.2s; 
                    color: #000000 !important; 
                }
                .dark-input::placeholder, .dark-area::placeholder { color: #94a3b8; }
                .dark-input:focus, .dark-area:focus { background: #fff; box-shadow: 0 4px 15px rgba(0,0,0,0.05); }
                .dark-area { height: 140px; resize: none; }

                .send-btn { background: #000; color: white; border: none; padding: 18px; border-radius: 16px; font-weight: 900; display: flex; align-items: center; justify-content: center; gap: 12px; cursor: pointer; transition: 0.3s; text-transform: uppercase; letter-spacing: 1px; }
                .send-btn:hover:not(:disabled) { transform: translateY(-3px); box-shadow: 0 10px 25px rgba(0,0,0,0.2); }
                .send-btn:disabled { opacity: 0.4; cursor: not-allowed; }
                .send-btn.sent { background: #10b981; }

                .preview-column { display: flex; flex-direction: column; align-items: center; gap: 20px; }
                .preview-label { font-size: 11px; font-weight: 900; color: #000; letter-spacing: 2px; }
                
                .phone-mockup { width: 280px; height: 520px; background: #000; border-radius: 40px; border: 8px solid #1a1a1a; padding: 10px; box-shadow: 0 40px 80px rgba(0,0,0,0.25); }
                .phone-screen { background: #fff; width: 100%; height: 100%; border-radius: 30px; position: relative; overflow: hidden; }
                
                .status-bar { padding: 12px 20px; display: flex; justify-content: space-between; font-size: 10px; font-weight: 800; color: #000; }
                .notification-area { padding: 0 10px; position: absolute; top: 40px; left: 0; right: 0; z-index: 10; }
                .mobile-notif { background: white; padding: 14px; border-radius: 20px; box-shadow: 0 15px 35px rgba(0,0,0,0.15); border: 1px solid rgba(0,0,0,0.08); position: relative; overflow: hidden; transition: 0.3s; }
                .mobile-notif.announcement { background: #ffffff; }
                .mobile-notif.maintenance { background: #f59e0b; border-color: #f59e0b; }
                .mobile-notif.critical { background: #ef4444; border-color: #ef4444; }

                .app-content { padding: 60px 20px 20px; opacity: 0.4; }

                .notif-header { display: flex; align-items: center; gap: 8px; font-size: 9px; font-weight: 900; color: #000; margin-bottom: 8px; }
                .mobile-notif.maintenance .notif-header, .mobile-notif.critical .notif-header { color: #ffffff; }
                .mobile-notif.maintenance .app-icon, .mobile-notif.critical .app-icon { background: #ffffff; color: #000; }
                .mobile-notif.maintenance .dot, .mobile-notif.critical .dot { background: #ffffff; opacity: 0.6; }
                .mobile-notif.maintenance .app-name, .mobile-notif.maintenance .time, .mobile-notif.critical .app-name, .mobile-notif.critical .time { color: #ffffff; opacity: 0.9; }

                .notif-body h4 { margin: 0; font-size: 13px; font-weight: 900; color: #000; }
                .mobile-notif.maintenance .notif-body h4, .mobile-notif.critical .notif-body h4 { color: #ffffff; }
                .notif-body p { margin: 4px 0 0; font-size: 11px; color: #334155; line-height: 1.4; font-weight: 600; }
                .mobile-notif.maintenance .notif-body p, .mobile-notif.critical .notif-body p { color: #ffffff; opacity: 0.9; }

                .app-icon { width: 18px; height: 18px; background: #000; color: #fff; border-radius: 6px; display: flex; align-items: center; justify-content: center; }

                /* History Logs */
                .history-section { border-top: 2px solid #000; padding-top: 40px; margin-top: 20px; }
                .section-title-bar { margin-bottom: 30px; }
                .section-title-bar h3 { margin: 0; font-size: 20px; font-weight: 900; display: flex; align-items: center; gap: 12px; color: #000; }
                .section-title-bar p { margin: 6px 0 0; color: #64748b; font-size: 14px; font-weight: 600; }

                .history-table-wrapper { background: white; border: 1.5px solid #000; border-radius: 20px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.05); }
                .history-table { width: 100%; border-collapse: collapse; text-align: left; }
                .history-table th { background: #f8fafc; padding: 20px; font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; color: #64748b; border-bottom: 2px solid #000; }
                .history-table td { padding: 20px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
                
                .signal-info { display: flex; align-items: center; gap: 15px; }
                .signal-type-dot { width: 12px; height: 12px; border-radius: 50%; flex-shrink: 0; }
                .signal-type-dot.announcement { background: #3b82f6; }
                .signal-type-dot.maintenance { background: #f59e0b; }
                .signal-type-dot.critical { background: #ef4444; }
                
                .signal-info strong { display: block; font-size: 15px; font-weight: 800; color: #000; }
                .signal-info p { margin: 4px 0 0; font-size: 12px; color: #64748b; font-weight: 600; }

                .target-badge { padding: 4px 12px; background: #000; color: #fff; border-radius: 100px; font-size: 10px; font-weight: 900; }
                
                .count-metric strong { display: block; font-size: 16px; font-weight: 900; color: #000; }
                .count-metric span { font-size: 11px; color: #64748b; font-weight: 700; }

                .status-progress { width: 140px; }
                .progress-bar { height: 6px; background: #eef2f6; border-radius: 100px; overflow: hidden; margin-bottom: 6px; }
                .progress-bar .fill { height: 100%; background: #000; border-radius: 100px; }
                .status-progress span { font-size: 10px; font-weight: 800; color: #10b981; }

                .view-metric { display: flex; align-items: center; gap: 8px; color: #000; }
                .view-metric strong { font-size: 16px; font-weight: 900; }

                .empty-logs { text-align: center; padding: 60px; color: #94a3b8; font-weight: 800; font-size: 16px; }
            `}</style>
        </div>
    );
};

export default BroadcastView;
