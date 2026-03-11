import React, { useState } from 'react';
import {
    Database, HardDrive, RefreshCcw, ShieldCheck,
    History, Download, Cloud, AlertCircle, CheckCircle2,
    Clock, Play, Trash2, FileJson, Server
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/admin';
const ADMIN_KEY = import.meta.env.VITE_ADMIN_KEY || 'KWIQ_ADMIN_MASTER_2026';

const BackupView = ({ history, onRefresh }) => {
    const [backingUp, setBackingUp] = useState(false);

    const backupHistory = history;

    const triggerBackup = async () => {
        try {
            setBackingUp(true);
            await axios.post(`${API_URL}/backup`, {}, {
                headers: { 'x-admin-key': ADMIN_KEY }
            });
            setBackingUp(false);
            onRefresh();
        } catch (error) {
            console.error('Backup failed:', error);
            setBackingUp(false);
        }
    };

    return (
        <div className="backup-page-container">
            {/* Top Status Card */}
            <div className="backup-hero-section">
                <div className="status-banner-compact">
                    <div className="status-info">
                        <div className="status-icon-glow">
                            <Cloud size={28} color="#000" />
                        </div>
                        <div className="text-content">
                            <h3>Cloud Recovery Hub</h3>
                            <p>Real-time system mirroring across global nodes</p>
                        </div>
                    </div>
                    <button
                        className={`backup-action-btn ${backingUp ? 'running' : ''}`}
                        onClick={triggerBackup}
                        disabled={backingUp}
                    >
                        {backingUp ? (
                            <><RefreshCcw size={18} className="spin" /> Snapshotting...</>
                        ) : (
                            <><Play size={18} fill="currentColor" /> Force Snapshot</>
                        )}
                    </button>
                    <div className="accent-glow" />
                </div>
            </div>

            <div className="backup-content-layout">
                <div className="history-section">
                    <div className="section-head">
                        <div className="title-group">
                            <History size={20} className="header-icon" />
                            <span>Available Restore Points</span>
                        </div>
                        <button className="clean-logs-btn">
                            <Trash2 size={14} />
                            Clean Old Logs
                        </button>
                    </div>

                    <div className="snapshot-timeline">
                        {backupHistory.map((item, idx) => (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.05 }}
                                key={item._id}
                                className="snapshot-card"
                            >
                                <div className="card-left">
                                    <div className={`status-dot ${item.status === 'success' ? 'active' : 'warn'}`} />
                                    <div className="snapshot-details">
                                        <div className="file-name">
                                            <FileJson size={14} className="file-icon" />
                                            {item.filename || 'SNAPSHOT_SYSTEM_CORE'}
                                        </div>
                                        <div className="meta-info">
                                            <span>{new Date(item.createdAt).toLocaleString()}</span>
                                            <span className="dot-sep">•</span>
                                            <span className="provider-tag">{item.cloudProvider || 'MongoDB Atlas'}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="card-right">
                                    <div className="size-pill">{item.size || '3.2 MB'}</div>
                                    <div className="action-buttons-group">
                                        <button className="icon-btn download" title="Download Archive">
                                            <Download size={32} strokeWidth={4} color="#ffffff" />
                                        </button>
                                        <button className="icon-btn restore" title="Restore This Point">
                                            <RefreshCcw size={32} strokeWidth={4} color="#ffffff" />
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                        {backupHistory.length === 0 && (
                            <div className="empty-state">
                                <Database size={40} opacity={0.2} />
                                <p>No restore points found. Trigger a backup to begin.</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="sidebar-stats">
                    <div className="control-card metrics">
                        <h4>Storage Allocation</h4>
                        <div className="meter-item">
                            <div className="meter-labels">
                                <span>Core Backup</span>
                                <span>82%</span>
                            </div>
                            <div className="meter-bar">
                                <div className="bar-fill" style={{ width: '82%' }} />
                            </div>
                        </div>
                        <div className="meter-item">
                            <div className="meter-labels">
                                <span>Sync Archive</span>
                                <span>14%</span>
                            </div>
                            <div className="meter-bar">
                                <div className="bar-fill secondary" style={{ width: '14%' }} />
                            </div>
                        </div>
                    </div>

                    <div className="control-card integrity">
                        <h4>Integrity Checks</h4>
                        <div className="check-list">
                            <div className="check-item success">
                                <CheckCircle2 size={16} />
                                <span>Database Connectivity</span>
                            </div>
                            <div className="check-item success">
                                <CheckCircle2 size={16} />
                                <span>Cloud API Tokens</span>
                            </div>
                            <div className="check-item pending">
                                <Clock size={16} />
                                <span>Next Sync: 5h 20m</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <style>{`
                .backup-page-container {
                    display: flex;
                    flex-direction: column;
                    gap: 32px;
                    padding-bottom: 40px;
                }

                /* Hero Section */
                .status-banner-compact {
                    background: #fff;
                    border: 2px solid #000;
                    border-radius: 20px;
                    padding: 24px 32px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    position: relative;
                    overflow: hidden;
                    box-shadow: 0 4px 0 #000;
                }
                .status-info { display: flex; align-items: center; gap: 20px; position: relative; z-index: 2; }
                .status-icon-glow {
                    width: 56px;
                    height: 56px;
                    background: #f4f4f4;
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .text-content h3 { margin: 0; font-size: 20px; font-weight: 800; color: #000; }
                .text-content p { margin: 4px 0 0; font-size: 13px; color: #666; font-weight: 500; }

                .backup-action-btn {
                    background: #000;
                    color: #fff;
                    border: none;
                    padding: 14px 28px;
                    border-radius: 12px;
                    font-weight: 800;
                    font-size: 14px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    transition: all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                    z-index: 2;
                }
                .backup-action-btn:hover {
                    transform: translateY(-4px) scale(1.02);
                    box-shadow: 0 10px 20px rgba(0,0,0,0.15);
                }
                .backup-action-btn.running { background: #666; cursor: wait; transform: none; box-shadow: none; }

                /* Layout */
                .backup-content-layout {
                    display: grid;
                    grid-template-columns: 1fr 340px;
                    gap: 32px;
                }

                /* History Section */
                .section-head { 
                    display: flex; 
                    justify-content: space-between; 
                    align-items: center; 
                    margin-bottom: 24px;
                    padding: 0 4px;
                }
                .title-group { display: flex; align-items: center; gap: 10px; font-size: 16px; font-weight: 800; color: #000; }
                .header-icon { color: #000; }
                .clean-logs-btn {
                    background: none;
                    border: 1.5px solid #ddd;
                    color: #666;
                    font-size: 12px;
                    font-weight: 700;
                    padding: 6px 14px;
                    border-radius: 8px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    transition: 0.2s;
                }
                .clean-logs-btn:hover { border-color: #000; color: #000; background: #f8fafc; }

                /* Snapshot Cards */
                .snapshot-timeline { display: flex; flex-direction: column; gap: 14px; }
                .snapshot-card {
                    background: #fff;
                    padding: 18px 24px;
                    border-radius: 18px;
                    border: 2px solid #f0f2f5;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    transition: all 0.2s;
                }
                .snapshot-card:hover {
                    border-color: #000;
                    transform: translateX(8px);
                    box-shadow: 0 4px 12px rgba(0,0,0,0.05);
                }

                .card-left { display: flex; align-items: center; gap: 18px; }
                .status-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
                .status-dot.active { background: #000; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
                .status-dot.warn { background: #ff4d4d; }

                .file-name { 
                    font-size: 15px; 
                    font-weight: 800; 
                    color: #000; 
                    display: flex; 
                    align-items: center; 
                    gap: 8px; 
                    margin-bottom: 4px;
                }
                .file-icon { color: #666; }
                .meta-info { font-size: 12px; color: #888; display: flex; align-items: center; gap: 8px; font-weight: 600; }
                .dot-sep { opacity: 0.3; }
                .provider-tag { color: #000; background: #f0f0f0; padding: 2px 8px; border-radius: 4px; font-size: 10px; text-transform: uppercase; }

                .card-right { display: flex; align-items: center; gap: 24px; }
                .size-pill {
                    font-size: 12px;
                    font-weight: 800;
                    color: #666;
                    background: #f8fafc;
                    padding: 6px 12px;
                    border-radius: 10px;
                    min-width: 80px;
                    text-align: center;
                }

                .action-buttons-group { display: flex; gap: 8px; }
                .icon-btn {
                    width: 56px;
                    height: 56px;
                    border-radius: 14px;
                    border: 2px solid rgba(255,255,255,0.1);
                    background: #000000;
                    color: #ffffff !important;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                }
                .icon-btn svg {
                    stroke: #ffffff !important;
                    display: block;
                    width: 32px !important;
                    height: 32px !important;
                    stroke-width: 4px !important;
                }
                .icon-btn:hover {
                    background: #000000;
                    transform: translateY(-3px) scale(1.05);
                    border-color: rgba(255,255,255,0.3);
                    box-shadow: 0 8px 20px rgba(0,0,0,0.45);
                }
                .icon-btn svg { transition: all 0.2s; }
                .icon-btn:hover svg { stroke-width: 3.5px !important; }
                .icon-btn.restore:hover { background: #000; }

                /* Sidebar Stats */
                .control-card {
                    background: #fff;
                    border-radius: 20px;
                    border: 2px solid #f0f2f5;
                    padding: 24px;
                    margin-bottom: 24px;
                }
                .control-card h4 { margin: 0 0 20px; font-size: 14px; font-weight: 800; text-transform: uppercase; color: #888; }

                .meter-item { margin-bottom: 20px; }
                .meter-labels { display: flex; justify-content: space-between; font-size: 12px; font-weight: 700; margin-bottom: 8px; }
                .meter-bar { height: 8px; background: #f4f4f4; border-radius: 10px; overflow: hidden; }
                .bar-fill { height: 100%; background: #000; border-radius: 10px; }
                .bar-fill.secondary { background: #888; }

                .check-list { display: flex; flex-direction: column; gap: 14px; }
                .check-item { display: flex; align-items: center; gap: 10px; font-size: 13px; font-weight: 700; }
                .check-item.success { color: #000; }
                .check-item.pending { color: #888; }

                .empty-state {
                    padding: 60px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 16px;
                    color: #94a3b8;
                    text-align: center;
                    background: #fcfcfc;
                    border: 2px dashed #e2e8f0;
                    border-radius: 20px;
                }
                .empty-state p { font-weight: 600; font-size: 14px; margin: 0; }

                .spin { animation: spin 2s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
};

export default BackupView;
