import React, { useState, useRef } from 'react';
import {
    Send, Megaphone, Target, ShieldCheck, Clock, Calendar,
    Smartphone, Filter, Info, AlertCircle, RefreshCcw,
    Zap, ChevronRight, PlayCircle, XCircle
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
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [startTimeStr, setStartTimeStr] = useState(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }));
    const [startAMPM, setStartAMPM] = useState(new Date().getHours() >= 12 ? 'PM' : 'AM');
    const [expiryDate, setExpiryDate] = useState(new Date().toISOString().split('T')[0]);
    const [expiryTimeStr, setExpiryTimeStr] = useState(new Date(Date.now() + 3600000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }));
    const [expiryAMPM, setExpiryAMPM] = useState(new Date(Date.now() + 3600000).getHours() >= 12 ? 'PM' : 'AM');
    const [priority, setPriority] = useState('medium');
    const [sending, setSending] = useState(false);
    const [sent, setSent] = useState(false);

    const startDateRef = useRef(null);
    const startTimeRef = useRef(null);
    const expiryDateRef = useRef(null);
    const expiryTimeRef = useRef(null);

    const openPicker = (ref) => {
        if (ref.current && ref.current.showPicker) {
            ref.current.showPicker();
        } else if (ref.current) {
            ref.current.focus();
        }
    };

    const handleSend = async () => {
        try {
            setSending(true);
            const combineToISO = (date, time, ampm) => {
                if (!date) return null;
                let [hours, minutes] = time.split(':').map(Number);
                if (ampm === 'PM' && hours < 12) hours += 12;
                if (ampm === 'AM' && hours === 12) hours = 0;
                const dateObj = new Date(date);
                dateObj.setHours(hours, minutes, 0, 0);
                return dateObj.toISOString();
            };

            const finalStartTime = combineToISO(startDate, startTimeStr, startAMPM) || new Date().toISOString();
            const finalExpiryTime = combineToISO(expiryDate, expiryTimeStr, expiryAMPM);

            await axios.post(`${API_URL}/broadcast`,
                { 
                    title, 
                    message, 
                    target, 
                    type,
                    startTime: finalStartTime,
                    expiryTime: finalExpiryTime,
                    priority
                },
                { headers: { 'x-admin-key': ADMIN_KEY } }
            );
            setSending(false);
            setSent(true);
            onRefresh();
            setTimeout(() => setSent(false), 3000);
            setTitle('');
            setMessage('');
            setStartDate('');
            setExpiryDate('');
            setStartTimeStr('12:00');
            setExpiryTimeStr('12:00');
            setPriority('medium');
        } catch (error) {
            console.error('Broadcast failed:', error);
            setSending(false);
        }
    };

    return (
        <div className="broadcast-page">
            <h1 className="minimal-page-title">Broadcast</h1>
            <div className="broadcast-grid">
                <div className="editor-column">
                    <div className="content-card main-editor">
                        <div className="section-header">
                            <Megaphone size={18} />
                            <h3>Compose Transmission</h3>
                        </div>

                        <div className="broadcast-form">
                            <div className="form-row">
                                <div className="input-group">
                                    <label>Target Audience</label>
                                    <div className="pills target-pills">
                                        <button className={target === 'all' ? 'active' : ''} onClick={() => setTarget('all')}>
                                            <Target size={14} /> All Nodes
                                        </button>
                                        <button className={target === 'pro' ? 'active' : ''} onClick={() => setTarget('pro')}>
                                            <ShieldCheck size={14} /> Premium
                                        </button>
                                        <button className={target === 'trial' ? 'active' : ''} onClick={() => setTarget('trial')}>
                                            <Clock size={14} /> Free Trial
                                        </button>
                                    </div>
                                </div>

                                <div className="input-group">
                                    <label>Priority Level</label>
                                    <div className="pills priority-pills">
                                        <button className={`p-low ${priority === 'low' ? 'active' : ''}`} onClick={() => setPriority('low')}>Low</button>
                                        <button className={`p-med ${priority === 'medium' ? 'active' : ''}`} onClick={() => setPriority('medium')}>Medium</button>
                                        <button className={`p-high ${priority === 'high' ? 'active' : ''}`} onClick={() => setPriority('high')}>High</button>
                                    </div>
                                </div>
                            </div>

                            <div className="input-group">
                                <label>Broadcast Nature</label>
                                <div className="pills type-pills-full">
                                    <button className={type === 'announcement' ? 'active announcement' : ''} onClick={() => setType('announcement')}>
                                        <Info size={16} /> 
                                        <div className="btn-text">
                                            <strong>Announcement</strong>
                                            <span>General information or feature updates</span>
                                        </div>
                                    </button>
                                    <button className={type === 'maintenance' ? 'active maintenance' : ''} onClick={() => setType('maintenance')}>
                                        <Clock size={16} />
                                        <div className="btn-text">
                                            <strong>Maintenance</strong>
                                            <span>Scheduled downtime or server updates</span>
                                        </div>
                                    </button>
                                    <button className={type === 'critical' ? 'active critical' : ''} onClick={() => setType('critical')}>
                                        <AlertCircle size={16} />
                                        <div className="btn-text">
                                            <strong>Critical Alert</strong>
                                            <span>Urgent system health or security warnings</span>
                                        </div>
                                    </button>
                                </div>
                            </div>

                            <div className="scheduling-layout-pro">
                                <div className="scheduling-section">
                                    <div className="section-label-pro">
                                        <PlayCircle size={18} />
                                        <span>EMISSION START</span>
                                    </div>
                                    <div className="picker-grid">
                                        <div className="picker-block">
                                            <label>Trigger Date</label>
                                            <div className="input-with-icon">
                                                <input 
                                                    ref={startDateRef}
                                                    type="date" 
                                                    value={startDate} 
                                                    onChange={(e) => setStartDate(e.target.value)}
                                                    className="modern-picker date-p" 
                                                />
                                                <Calendar size={16} className="field-icon-embedded" onClick={() => openPicker(startDateRef)} />
                                            </div>
                                        </div>
                                        <div className="picker-block time-block">
                                            <label>Trigger Time</label>
                                            <div className="time-input-cluster">
                                                <div className="input-with-icon time-p-wrapper">
                                                    <input 
                                                        ref={startTimeRef}
                                                        type="time" 
                                                        value={startTimeStr} 
                                                        onChange={(e) => setStartTimeStr(e.target.value)}
                                                        className="modern-picker time-p"
                                                    />
                                                    <Clock size={16} className="field-icon-embedded" onClick={() => openPicker(startTimeRef)} />
                                                </div>
                                                <div className="ampm-toggle-pro">
                                                    <button className={startAMPM === 'AM' ? 'active' : ''} onClick={() => setStartAMPM('AM')}>AM</button>
                                                    <button className={startAMPM === 'PM' ? 'active' : ''} onClick={() => setStartAMPM('PM')}>PM</button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <span className="input-hint">Default: Broadcast triggers immediately upon confirmation if current date/time is selected.</span>
                                </div>

                                <div className="scheduling-divider" />

                                <div className="scheduling-section">
                                    <div className="section-label-pro">
                                        <XCircle size={18} />
                                        <span>AUTOMATIC EXPIRATION</span>
                                    </div>
                                    <div className="picker-grid">
                                        <div className="picker-block">
                                            <label>Expiry Date</label>
                                            <div className="input-with-icon">
                                                <input 
                                                    ref={expiryDateRef}
                                                    type="date" 
                                                    value={expiryDate} 
                                                    onChange={(e) => setExpiryDate(e.target.value)}
                                                    className="modern-picker date-p" 
                                                />
                                                <Calendar size={16} className="field-icon-embedded" onClick={() => openPicker(expiryDateRef)} />
                                            </div>
                                        </div>
                                        <div className="picker-block time-block">
                                            <label>Expiry Time</label>
                                            <div className="time-input-cluster">
                                                <div className="input-with-icon time-p-wrapper">
                                                    <input 
                                                        ref={expiryTimeRef}
                                                        type="time" 
                                                        value={expiryTimeStr} 
                                                        onChange={(e) => setExpiryTimeStr(e.target.value)}
                                                        className="modern-picker time-p"
                                                    />
                                                    <Clock size={16} className="field-icon-embedded" onClick={() => openPicker(expiryTimeRef)} />
                                                </div>
                                                <div className="ampm-toggle-pro">
                                                    <button className={expiryAMPM === 'AM' ? 'active' : ''} onClick={() => setExpiryAMPM('AM')}>AM</button>
                                                    <button className={expiryAMPM === 'PM' ? 'active' : ''} onClick={() => setExpiryAMPM('PM')}>PM</button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <span className="input-hint">Highly Recommended: Set an expiration to ensure urgent alerts don't persist indefinitely.</span>
                                </div>

                                {(() => {
                                    const combineToISO = (date, time, ampm) => {
                                        if (!date || !time) return null;
                                        let [hours, minutes] = time.split(':').map(Number);
                                        if (ampm === 'PM' && hours < 12) hours += 12;
                                        if (ampm === 'AM' && hours === 12) hours = 0;
                                        const d = new Date(date);
                                        d.setHours(hours, minutes, 0, 0);
                                        return d;
                                    };
                                    
                                    const start = combineToISO(startDate, startTimeStr, startAMPM) || new Date();
                                    const end = combineToISO(expiryDate, expiryTimeStr, expiryAMPM);
                                    
                                    let lifespanStr = 'PERPETUAL';
                                    if (end && start) {
                                        const diff = end - start;
                                        if (diff > 0) {
                                            const hours = Math.floor(diff / (1000 * 60 * 60));
                                            const days = Math.floor(hours / 24);
                                            const remHours = hours % 24;
                                            lifespanStr = days > 0 ? `${days} DAYS ${remHours} HRS` : `${hours} HOURS`;
                                        } else if (expiryDate) {
                                            lifespanStr = 'INVALID THRESHOLD';
                                        }
                                    }

                                    return (
                                        <div className="temporal-summary">
                                            <div className={`summary-badge ${lifespanStr === 'INVALID THRESHOLD' ? 'error' : ''}`}>
                                                <div className="badge-main">
                                                    <ShieldCheck size={14} />
                                                    <span>LIFESPAN CONFIGURATION: {(!startDate || new Date(startDate) <= new Date()) ? 'IMMEDIATE' : startDate} UNTIL {expiryDate ? expiryDate : 'PERPETUAL'}</span>
                                                </div>
                                                <div className="active-window-tag">
                                                    <strong>ACTIVE WINDOW:</strong>
                                                    <span>{lifespanStr}</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>

                            <div className="input-group">
                                <label>Title Header</label>
                                <input
                                    placeholder="e.g. Server Migration Scheduled"
                                    className="pro-input"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                />
                            </div>

                            <div className="input-group">
                                <label>Transmission Body (Supports HTML Rendering)</label>
                                <textarea
                                    placeholder="Draft your global message content here..."
                                    className="pro-area"
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                />
                            </div>

                            <div className="form-actions-pro">
                                <button className="ghost-btn" onClick={() => {setTitle(''); setMessage('');}}>Reset Draft</button>
                                <button
                                    className={`primary-send-btn ${sent ? 'success' : ''}`}
                                    onClick={handleSend}
                                    disabled={sending || !title || !message}
                                >
                                    {sending ? (
                                        <><RefreshCcw size={18} className="spin" /> Establishing Upstream...</>
                                    ) : sent ? (
                                        <><ShieldCheck size={18} /> Signal Locked & Sent</>
                                    ) : (
                                        <><Send size={18} /> Confirm & Broadcast</>
                                    )}
                                </button>
                            </div>
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
                            {/* Compute combined time for preview logic */}
                            {(() => {
                                const combineToISO = (date, time, ampm) => {
                                    if (!date) return null;
                                    let [hours, minutes] = time.split(':').map(Number);
                                    if (ampm === 'PM' && hours < 12) hours += 12;
                                    if (ampm === 'AM' && hours === 12) hours = 0;
                                    const dateObj = new Date(date);
                                    dateObj.setHours(hours, minutes, 0, 0);
                                    return dateObj;
                                };
                                const previewStart = combineToISO(startDate, startTimeStr, startAMPM);
                                const isScheduled = previewStart && previewStart > new Date();

                                return (
                                    <div className="notification-area">
                                        <AnimatePresence>
                                            {(title || message) && (
                                                <motion.div
                                                    initial={{ y: -50, scale: 0.9, opacity: 0 }}
                                                    animate={{ y: 0, scale: 1, opacity: 1 }}
                                                    exit={{ y: -50, opacity: 0 }}
                                                    className="notif-wrapper"
                                                >
                                                    <div className="priority-tab-wrapper">
                                                        <div className={`priority-tab ${priority}`}>
                                                            {priority.toUpperCase()} PRIORITY
                                                        </div>
                                                    </div>
                                                    <div className={`kwiq-alert-card ${type}`}>
                                                        <div className="alert-header">
                                                            <span>KWIQ BILL</span>
                                                        </div>
                                                        <div className="alert-separator" />
                                                        <div className="alert-body">
                                                            <div className="alert-title-row">
                                                                <strong>SIGNAL TITLE :</strong>
                                                                <h4>{title || 'Maintenance Alert'}</h4>
                                                            </div>
                                                            <div className="alert-message-section">
                                                                <strong>MESSAGE CONTENT :</strong>
                                                                <p>
                                                                    {message || 'Your broadcast message content will be displayed here in this section.'}
                                                                </p>
                                                            </div>
                                                            <div className="alert-temporal-footer">
                                                                <div className="temporal-main-info">
                                                                    <div className="t-row">
                                                                        <PlayCircle size={10} className="start-icon" />
                                                                        <span>EMISSION: {startDate ? `${startDate} ${startTimeStr} ${startAMPM}` : 'IMMEDIATE'}</span>
                                                                    </div>
                                                                    <div className="t-row">
                                                                        <XCircle size={10} className="end-icon" />
                                                                        <span>EXPIRY: {expiryDate ? `${expiryDate} ${expiryTimeStr} ${expiryAMPM}` : 'PERPETUAL'}</span>
                                                                    </div>
                                                                </div>
                                                                {(() => {
                                                                    const combineToISO = (date, time, ampm) => {
                                                                        if (!date || !time) return null;
                                                                        let [hours, minutes] = time.split(':').map(Number);
                                                                        if (ampm === 'PM' && hours < 12) hours += 12;
                                                                        if (ampm === 'AM' && hours === 12) hours = 0;
                                                                        const d = new Date(date);
                                                                        d.setHours(hours, minutes, 0, 0);
                                                                        return d;
                                                                    };
                                                                    const s = combineToISO(startDate, startTimeStr, startAMPM) || new Date();
                                                                    const e = combineToISO(expiryDate, expiryTimeStr, expiryAMPM);
                                                                    if (!e || e <= s) return null;
                                                                    
                                                                    const diff = e - s;
                                                                    const hours = Math.floor(diff / (1000 * 60 * 60));
                                                                    const days = Math.floor(hours / 24);
                                                                    const remHours = hours % 24;
                                                                    const durLabel = days > 0 ? `${days}d ${remHours}h` : `${hours}h`;

                                                                    return (
                                                                        <div className="duration-pill-mock">
                                                                            <Clock size={8} /> TOTAL DURATION: {durLabel}
                                                                        </div>
                                                                    );
                                                                })()}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                );
                            })()}
                            <div className="app-mockup-bg">
                                <div className="mock-header" />
                                <div className="app-content">
                                    <div className="skeleton-line" />
                                    <div className="skeleton-grid">
                                        <div className="box" /><div className="box" />
                                        <div className="box" /><div className="box" />
                                    </div>
                                    <div className="skeleton-line full" />
                                    <div className="skeleton-line med" />
                                </div>
                                <div className="mock-tabs">
                                    <div className="tab" /><div className="tab" /><div className="tab" /><div className="tab" />
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
                                <th>Lifespan Metrics</th>
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
                                                    <div className="signal-meta">
                                                        <span>{new Date(b.createdAt).toLocaleDateString()} | {new Date(b.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                        {b.startTime && new Date(b.startTime) > new Date() && (
                                                            <span className="status-label scheduled">SCHEDULED: {new Date(b.startTime).toLocaleString()}</span>
                                                        )}
                                                        {b.expiryTime && new Date(b.expiryTime) < new Date() && (
                                                            <span className="status-label expired">EXPIRED</span>
                                                        )}
                                                        {(!b.startTime || new Date(b.startTime) <= new Date()) && (!b.expiryTime || new Date(b.expiryTime) > new Date()) && (
                                                            <span className="status-label live">LIVE</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                         <td>
                                            <div className="param-column">
                                                <div className="mini-pills">
                                                    <span className={`m-pill target-${b.target || 'all'}`}>{b.target?.toUpperCase() || 'ALL'}</span>
                                                    <span className={`m-pill p-${b.priority || 'low'}`}>{b.priority?.toUpperCase()}</span>
                                                </div>
                                                <span className="type-sub">{b.type?.replace('_', ' ')}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="lifespan-metric">
                                                <div className="time-point">
                                                    <PlayCircle size={14} className="start-icon" />
                                                    <div>
                                                        <strong>{b.startTime ? new Date(b.startTime).toLocaleDateString() : 'Immediate'}</strong>
                                                        <span>{b.startTime ? new Date(b.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Upon Signal'}</span>
                                                    </div>
                                                </div>
                                                <div className="time-point">
                                                    <XCircle size={14} className="end-icon" />
                                                    <div>
                                                        <strong>{b.expiryTime ? new Date(b.expiryTime).toLocaleDateString() : 'Perpetual'}</strong>
                                                        <span>{b.expiryTime ? new Date(b.expiryTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'No Expiry'}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="status-progress-v2">
                                                <div className="status-pill-container">
                                                    {b.expiryTime && new Date(b.expiryTime) < new Date() ? (
                                                        <span className="status-pill expired">EXPIRED</span>
                                                    ) : b.startTime && new Date(b.startTime) > new Date() ? (
                                                        <span className="status-pill scheduled">SCHEDULED</span>
                                                    ) : (
                                                        <span className="status-pill active-live">ACTIVE LIVE</span>
                                                    )}
                                                </div>
                                                <div className="progress-mini">
                                                    <div className="fill" style={{ width: `${b.transmissionRate || 98}%` }} />
                                                    <span>{b.transmissionRate || 98}% Delivered</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="interaction-metric">
                                                <strong>{b.interactionRate || Math.floor(Math.random() * 20 + 5)}%</strong>
                                                <span>Engagement</span>
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
                .broadcast-page { padding: 24px 0; display: flex; flex-direction: column; gap: 32px; background: #fff; min-height: 100vh; width: 100%; }
                
                .minimal-page-title { margin: 0 40px; font-size: 34px; font-weight: 950; color: #000; letter-spacing: -1px; }

                .broadcast-grid { display: grid; grid-template-columns: 1fr 340px; gap: 40px; align-items: flex-start; width: 100%; padding: 0 40px; }
                
                .content-card.main-editor { background: #fff; border-radius: 36px; border: 1.5px solid #f1f5f9; padding: 48px; box-shadow: 0 40px 100px -20px rgba(0, 0, 0, 0.05); }
                .section-header { display: flex; align-items: center; gap: 12px; margin-bottom: 30px; color: #0f172a; border-bottom: 1.5px solid #f1f5f9; padding-bottom: 20px; }
                .section-header h3 { margin: 0; font-size: 20px; font-weight: 900; letter-spacing: -0.3px; }

                .broadcast-form { display: flex; flex-direction: column; gap: 32px; }
                .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; }

                .input-group label { display: block; font-size: 11px; font-weight: 950; color: #94a3b8; text-transform: uppercase; margin-bottom: 12px; letter-spacing: 1.5px; }
                
                .scheduling-panel { display: flex; flex-direction: column; gap: 14px; }
                .panel-label { display: flex; align-items: center; gap: 10px; font-size: 12px; font-weight: 950; color: #0f172a; }
                .picker-row { display: flex; gap: 20px; align-items: center; }
                
                .input-with-icon { position: relative; }
                .date-container { flex: 1.2; }
                .time-cluster { flex: 1.8; display: flex; align-items: center; gap: 12px; }
                .time-container { flex: 1; }

                .modern-picker { 
                    width: 100%; 
                    background: #f8fafc; 
                    border: 1.5px solid #e2e8f0; 
                    border-radius: 14px; 
                    padding: 12px 50px 12px 20px; 
                    font-size: 14px; 
                    font-weight: 700; 
                    outline: none; 
                    cursor: pointer;
                    color: #0f172a;
                    transition: 0.2s;
                }
                .modern-picker:hover { border-color: #3b82f6; background: #fff; }
                .field-icon-embedded { position: absolute; right: 20px; top: 50%; transform: translateY(-50%); color: #3b82f6; cursor: pointer; pointer-events: auto; z-index: 5; }
                .field-icon-embedded:hover { color: #2563eb; transform: translateY(-50%) scale(1.1); }
                
                .ampm-toggle-pro { display: flex; background: #f1f5f9; padding: 3px; border-radius: 12px; border: 1.5px solid #e2e8f0; }
                .ampm-toggle-pro button { 
                    padding: 8px 16px; 
                    border-radius: 10px; 
                    border: none; 
                    background: transparent; 
                    font-size: 11px; 
                    font-weight: 900; 
                    cursor: pointer; 
                    transition: 0.2s;
                    color: #64748b;
                }





                
                .ampm-toggle-pro button.active { background: #0f172a; color: #fff; box-shadow: 0 4px 10px rgba(15, 23, 42, 0.15); }

                .pills { display: flex; gap: 10px; flex-wrap: wrap; }
                .pills button { 
                    border: 1.5px solid #e2e8f0; background: #fff; padding: 12px 20px; border-radius: 14px; 
                    font-size: 13px; font-weight: 800; cursor: pointer; transition: 0.2s; color: #64748b; 
                    display: flex; align-items: center; gap: 10px;
                }
                .pills button:hover { border-color: #0f172a; color: #0f172a; background: #f8fafc; }
                .pills button.active { background: #0f172a; color: #fff; border-color: #0f172a; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
                
                .priority-pills .active.p-low { background: #94a3b8; border-color: #94a3b8; }
                .priority-pills .active.p-med { background: #3b82f6; border-color: #3b82f6; }
                .priority-pills .active.p-high { background: #ef4444; border-color: #ef4444; }

                .type-pills-full { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
                .type-pills-full button { 
                    flex-direction: column; align-items: flex-start; padding: 16px; height: auto; text-align: left; gap: 12px;
                    background: #f8fafc; border-color: #eef2f6;
                }
                .type-pills-full .btn-text strong { display: block; font-size: 14px; margin-bottom: 2px; }
                .type-pills-full .btn-text span { font-size: 11px; opacity: 0.7; font-weight: 600; line-height: 1.3; }
                
                .type-pills-full button.active.announcement { background: #3b82f6; border-color: #2563eb; }
                .type-pills-full button.active.maintenance { background: #f59e0b; border-color: #d97706; }
                .type-pills-full button.active.critical { background: #ef4444; border-color: #dc2626; }

                .pro-input, .pro-area { 
                    width: 100%; background: #f8fafc; border: 1.5px solid #e2e8f0; 
                    padding: 18px 24px; border-radius: 18px; font-family: inherit; font-size: 16px; 
                    font-weight: 700; outline: none; transition: 0.2s; color: #0f172a;
                }
                .pro-input:focus, .pro-area:focus { background: #fff; border-color: #3b82f6; box-shadow: 0 0 0 5px rgba(59, 130, 246, 0.08); }
                .pro-area { height: 160px; resize: none; line-height: 1.6; }

                .scheduling-layout-pro { border: 1.5px solid #f1f5f9; padding: 40px; border-radius: 36px; background: #fff; display: flex; flex-direction: column; gap: 40px; }
                .scheduling-section { display: flex; flex-direction: column; gap: 20px; }
                .section-label-pro { display: flex; align-items: center; gap: 12px; font-size: 13px; font-weight: 950; color: #0f172a; letter-spacing: 1px; }
                .picker-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
                .picker-block label { display: block; font-size: 10px; font-weight: 950; color: #94a3b8; text-transform: uppercase; margin-bottom: 8px; letter-spacing: 1px; }
                
                .time-input-cluster { display: flex; align-items: center; gap: 12px; }
                .time-p-wrapper { flex: 1; }
                
                .scheduling-divider { height: 1px; background: #f1f5f9; width: 100%; }
                
                .temporal-summary { background: #0f172a; padding: 20px; border-radius: 20px; display: flex; justify-content: center; width: 100%; border: 1px solid #1e293b; }
                .summary-badge { display: flex; flex-direction: column; align-items: center; gap: 12px; color: #fff; width: 100%; }
                .summary-badge.error { border: 1px solid #ef4444; background: rgba(239, 68, 68, 0.1); }
                
                .badge-main { display: flex; align-items: center; gap: 10px; font-size: 10px; font-weight: 950; letter-spacing: 1px; color: #94a3b8; }
                .active-window-tag { display: flex; align-items: center; gap: 12px; padding: 8px 16px; background: #fff; border-radius: 12px; color: #0f172a; }
                .active-window-tag strong { font-size: 11px; font-weight: 950; letter-spacing: 1px; }
                .active-window-tag span { font-size: 18px; font-weight: 950; color: #3b82f6; }

                .lifespan-metric { display: flex; flex-direction: column; gap: 12px; min-width: 180px; }
                .time-point { display: flex; align-items: center; gap: 12px; }
                .time-point strong { display: block; font-size: 13px; color: #0f172a; line-height: 1; margin-bottom: 2px; }
                .time-point span { font-size: 11px; color: #64748b; font-weight: 600; }
                .start-icon { color: #10b981; }
                .end-icon { color: #ef4444; }

                .status-progress-v2 { display: flex; flex-direction: column; gap: 12px; }
                .status-pill-container { display: flex; }
                .status-pill { font-size: 9px; font-weight: 950; padding: 6px 12px; border-radius: 80px; letter-spacing: 1px; }
                .status-pill.expired { background: #f1f5f9; color: #64748b; border: 1px solid #e2e8f0; }
                .status-pill.scheduled { background: #fff7ed; color: #f97316; border: 1px solid #ffedd5; }
                .status-pill.active-live { background: #dcfce7; color: #10b981; border: 1px solid #bbf7d0; }

                .progress-mini { display: flex; flex-direction: column; gap: 6px; }
                .progress-mini .fill { height: 4px; background: #10b981; border-radius: 2px; }
                .progress-mini span { font-size: 10px; font-weight: 700; color: #64748b; }

                .count-metric strong { font-size: 20px; }
                .view-metric strong { font-size: 20px; }

                .preview-column { position: sticky; top: 40px; display: flex; flex-direction: column; gap: 20px; }
                .preview-label { font-size: 11px; font-weight: 950; color: #94a3b8; letter-spacing: 1.5px; text-transform: uppercase; }
                .phone-mockup { width: 300px; height: 620px; background: #000; border-radius: 50px; border: 12px solid #1a1a1a; padding: 0; box-shadow: 0 50px 100px rgba(0,0,0,0.3); position: relative; overflow: hidden; }
                .phone-mockup::after { content: ''; position: absolute; top: 0; left: 50%; transform: translateX(-50%); width: 120px; height: 35px; background: #1a1a1a; border-radius: 0 0 20px 20px; z-index: 20; }
                
                /* Mobile Preview Styles Restored to User Preference */
                .phone-screen { background: #fff; width: 100%; height: 100%; position: relative; overflow: hidden; display: flex; flex-direction: column; }
                .status-bar { padding: 18px 24px; display: flex; justify-content: space-between; font-size: 11px; font-weight: 950; color: #000; letter-spacing: 0.5px; }
                
                .notification-area { padding: 12px; position: absolute; top: 45px; left: 0; right: 0; z-index: 10; display: flex; flex-direction: column; align-items: center; }
                .notif-wrapper { width: 100%; pointer-events: none; }
                
                .priority-tab-wrapper { margin-bottom: -1px; z-index: 2; width: 100%; display: center; display: flex; justify-content: center; }
                .priority-tab { 
                    background: #fff; padding: 6px 20px; border: 1.5px solid #000; border-bottom: none;
                    border-radius: 12px 12px 0 0; font-size: 10px; font-weight: 950; text-transform: uppercase; letter-spacing: 1.5px; color: #000;
                }
                .priority-tab.high { border-color: #ef4444; color: #ef4444; background: #fff; }
                .priority-tab.medium { border-color: #3b82f6; color: #3b82f6; background: #fff; }

                .kwiq-alert-card { background: white; width: 100%; border: 1.5px solid #000; border-radius: 24px; overflow: hidden; box-shadow: 0 15px 30px rgba(0,0,0,0.1); }
                .kwiq-alert-card.maintenance { border-color: #f59e0b; background: #fffbeb; }
                .kwiq-alert-card.critical { border-color: #ef4444; background: #fef2f2; }

                .alert-header { padding: 12px; display: flex; justify-content: center; align-items: center; }
                .alert-header span { font-size: 14px; font-weight: 950; letter-spacing: 3px; color: #000; }
                .alert-separator { height: 1.5px; background: #000; width: 100%; }
                .kwiq-alert-card.maintenance .alert-separator { background: #f59e0b; }
                .kwiq-alert-card.critical .alert-separator { background: #ef4444; }

                .alert-body { padding: 20px; display: flex; flex-direction: column; gap: 16px; }
                .alert-title-row strong, .alert-message-section strong { font-size: 9px; font-weight: 900; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; display: block; margin-bottom: 4px; }
                .alert-title-row h4 { margin: 0; font-size: 16px; font-weight: 950; color: #000; line-height: 1.2; }
                .alert-message-section p { margin: 0; font-size: 11.5px; color: #475569; font-weight: 650; line-height: 1.4; }

                .alert-temporal-footer { border-top: 1px solid #f1f5f9; padding-top: 12px; display: flex; flex-direction: column; gap: 10px; }
                .temporal-main-info { display: flex; flex-direction: column; gap: 6px; }
                .t-row { display: flex; align-items: center; gap: 8px; }
                .t-row span { font-size: 9px; font-weight: 950; color: #94a3b8; letter-spacing: 0.5px; }
                .t-row .start-icon { color: #10b981; }
                .t-row .end-icon { color: #ef4444; }

                .duration-pill-mock { align-self: flex-start; background: #f1f5f9; padding: 4px 10px; border-radius: 6px; font-size: 8px; font-weight: 950; color: #0f172a; display: flex; align-items: center; gap: 6px; letter-spacing: 0.5px; border: 1px solid #e2e8f0; }

                .app-mockup-bg { position: absolute; inset: 0; display: flex; flex-direction: column; background: #fff; z-index: 1; opacity: 1; }
                .mock-header { height: 60px; background: #3b82f6; width: 100%; }
                .mock-tabs { margin-top: auto; height: 60px; background: #fff; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-around; align-items: center; padding: 0 20px; }
                .mock-tabs .tab { width: 30px; height: 30px; background: #e2e8f0; border-radius: 50%; opacity: 0.7; }
                
                .app-content { padding: 20px; display: flex; flex-direction: column; gap: 20px; flex: 1; pointer-events: none; }
                .skeleton-line { height: 12px; background: #e2e8f0; border-radius: 10px; width: 40%; }
                .skeleton-line.full { width: 100%; }
                .skeleton-line.med { width: 70%; }
                .skeleton-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
                .skeleton-grid .box { height: 80px; background: #e2e8f0; border-radius: 20px; }

                .form-actions-pro { display: flex; align-items: center; gap: 20px; margin-top: 24px; padding-top: 32px; border-top: 1.5px solid #f1f5f9; }
                .ghost-btn { background: transparent; border: 1.5px solid #e2e8f0; color: #64748b; padding: 16px 32px; border-radius: 14px; font-weight: 800; font-size: 14px; cursor: pointer; transition: 0.2s; }
                .ghost-btn:hover { background: #f8fafc; border-color: #0f172a; color: #0f172a; }
                
                .primary-send-btn { 
                    flex: 1; background: #0f172a; color: #fff; border: none; padding: 18px 32px; border-radius: 14px; 
                    font-weight: 950; font-size: 15px; cursor: pointer; transition: 0.2s; display: flex; align-items: center; justify-content: center; gap: 12px;
                    letter-spacing: 0.5px;
                }
                .primary-send-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 10px 20px rgba(0,0,0,0.1); }
                .primary-send-btn:disabled { background: #e2e8f0; color: #94a3b8; cursor: not-allowed; opacity: 1; }
                .primary-send-btn.success { background: #10b981; }

                .history-section { padding: 80px 40px; background: #fff; margin-top: 40px; width: 100%; border-top: 2px solid #f8fafc; }
                .section-title-bar { margin-bottom: 40px; }
                .section-title-bar h3 { font-size: 28px; font-weight: 950; display: flex; align-items: center; gap: 12px; margin-bottom: 8px; color: #0f172a; letter-spacing: -0.5px; }
                .section-title-bar p { color: #64748b; font-weight: 600; font-size: 15px; }

                .history-table-wrapper { width: 100%; overflow-x: auto; border: 1.5px solid #f1f5f9; border-radius: 32px; background: #fff; }
                .history-table { width: 100%; border-collapse: collapse; min-width: 1100px; }
                .history-table th { text-align: left; padding: 24px; background: #f8fafc; font-size: 11px; font-weight: 950; color: #94a3b8; text-transform: uppercase; letter-spacing: 2px; border-bottom: 1.5px solid #f1f5f9; }
                .history-table td { padding: 28px 24px; border-bottom: 1.5px solid #f1f5f9; vertical-align: top; }
                .history-table tr:hover td { background: #fafafa; }
                .history-table tr:last-child td { border-bottom: none; }

                .signal-info strong { display: block; font-size: 16px; font-weight: 950; margin-bottom: 8px; color: #0f172a; }
                .signal-meta { display: flex; flex-direction: column; gap: 8px; }
                .signal-meta span { font-size: 12px; color: #94a3b8; font-weight: 700; }

                .param-column { display: flex; flex-direction: column; gap: 12px; }
                .mini-pills { display: flex; gap: 8px; }
                .m-pill { font-size: 9px; font-weight: 950; padding: 5px 10px; border-radius: 6px; background: #f1f5f9; color: #475569; letter-spacing: 0.5px; border: 1px solid #e2e8f0; }
                .m-pill.target-pro { background: #dcfce7; color: #166534; border-color: #bbf7d0; }
                .m-pill.p-high { background: #fee2e2; color: #991b1b; border-color: #fecaca; }
                .m-pill.p-med { background: #eff6ff; color: #1e40af; border-color: #dbeafe; }
                .type-sub { font-size: 11px; color: #64748b; font-weight: 800; text-transform: capitalize; }

                .interaction-metric { display: flex; flex-direction: column; gap: 4px; }
                .interaction-metric strong { font-size: 22px; font-weight: 950; color: #0f172a; }
                .interaction-metric span { font-size: 10px; color: #94a3b8; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; }

                .status-progress-v2 { gap: 16px; }
            `}</style>
        </div>
    );
};

export default BroadcastView;
