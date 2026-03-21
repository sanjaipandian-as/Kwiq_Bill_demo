import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    Users,
    Zap,
    Database,
    Search,
    Bell,
    LayoutDashboard,
    RefreshCcw,
    LogOut,
    TrendingUp,
    Cloud,
    Megaphone
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { motion } from 'framer-motion';

import DashboardView from './components/DashboardView';
import UsersTableView from './components/UsersTableView';
import Modals from './components/Modals';
import SecurityLogsView from './components/SecurityLogsView';
import RevenueView from './components/RevenueView';
import BackupView from './components/BackupView';
import BroadcastView from './components/BroadcastView';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/admin';
const ADMIN_KEY = import.meta.env.VITE_ADMIN_KEY || 'KWIQ_ADMIN_MASTER_2026';

const App = () => {
    const [users, setUsers] = useState([]);
    const [auditLogs, setAuditLogs] = useState([]);
    const [revenueData, setRevenueData] = useState([]);
    const [systemMetrics, setSystemMetrics] = useState(null);
    const [broadcasts, setBroadcasts] = useState([]);
    const [backups, setBackups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [selectedUser, setSelectedUser] = useState(null);
    const [activeSection, setActiveSection] = useState('dashboard');
    const [sidebarOpen, setSidebarOpen] = useState(true);

    // Invite Modal State
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteLoading, setInviteLoading] = useState(false);

    // Security Modal State
    const [showSecurityModal, setShowSecurityModal] = useState(false);

    // PIN Reset Modal State
    const [resetData, setResetData] = useState(null); // { userId, code, expiresAt }

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const headers = { 'x-admin-key': ADMIN_KEY };

            // Parallel fetch for speed
            const [usersRes, logsRes, revenueRes, metricsRes, broadcastRes, backupRes] = await Promise.all([
                axios.get(`${API_URL}/users`, { headers }),
                axios.get(`${API_URL}/logs`, { headers }),
                axios.get(`${API_URL}/revenue`, { headers }),
                axios.get(`${API_URL}/system/metrics`, { headers }),
                axios.get(`${API_URL}/broadcast`, { headers }),
                axios.get(`${API_URL}/backup`, { headers })
            ]);

            setUsers(usersRes.data);
            setAuditLogs(logsRes.data);
            setRevenueData(revenueRes.data);
            setSystemMetrics(metricsRes.data);
            setBroadcasts(broadcastRes.data);
            setBackups(backupRes.data);
            setError(null);
        } catch (err) {
            setError('System Link Failed. Verify API and Admin Master Key.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
        // Polling for real-time metrics every 10 seconds
        const metricsInterval = setInterval(async () => {
            try {
                const res = await axios.get(`${API_URL}/system/metrics`, { headers: { 'x-admin-key': ADMIN_KEY } });
                setSystemMetrics(res.data);
            } catch (err) { console.error("Metrics polling failed"); }
        }, 10000);

        return () => clearInterval(metricsInterval);
    }, []);

    const handleUpdatePlan = async (userId, plan) => {
        try {
            await axios.put(`${API_URL}/users/${userId}/plan`, { plan }, {
                headers: { 'x-admin-key': ADMIN_KEY }
            });
            fetchUsers();
            setSelectedUser(null);
        } catch (err) {
            alert('Failed to extend subscription');
        }
    };

    const handleToggleBlock = async (userId) => {
        if (!confirm('Security Protocol: Do you wish to override user access status?')) return;
        try {
            await axios.put(`${API_URL}/users/${userId}/block`, {}, {
                headers: { 'x-admin-key': ADMIN_KEY }
            });
            fetchUsers();
        } catch (err) {
            alert('Override failed');
        }
    };

    const handleGenerateResetCode = async (userId) => {
        if (!confirm('Security Protocol: Generate a Manager PIN override code for this user?')) return;
        try {
            // Pointing to our new security admin endpoint
            const res = await axios.post(`${API_URL}/security/admin/generate-reset-code/${userId}`, {}, {
                headers: { 'x-admin-key': ADMIN_KEY }
            });
            setResetData({
                userId,
                code: res.data.code,
                expiresAt: res.data.expiresAt
            });
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to generate reset code');
        }
    };

    const handleInviteUser = async (e) => {
        e.preventDefault();
        if (!inviteEmail) return;
        setInviteLoading(true);
        try {
            await axios.post(`${API_URL}/users/invite`, { email: inviteEmail }, {
                headers: { 'x-admin-key': ADMIN_KEY }
            });
            setInviteEmail('');
            setShowInviteModal(false);
            fetchUsers();
            alert('User invited successfully! They can now login via Google using this email.');
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to invite user');
        } finally {
            setInviteLoading(false);
        }
    };

    const stats = {
        total: users.length,
        active: users.filter(u => !u.isBlocked).length,
        blocked: users.filter(u => u.isBlocked).length,
        pro: users.filter(u => u.plan !== 'free').length,
        expiring: users.filter(u => {
            const expiry = u.plan === 'free' ? u.trialExpiresAt : u.planExpiresAt;
            if (!expiry) return false;
            const days = differenceInDays(new Date(expiry), new Date());
            return days > 0 && days <= 7;
        }).length
    };

    const securityStats = {
        totalScan: users.length,
        blockedThreats: users.filter(u => u.isBlocked).length,
        activeSecured: users.filter(u => !u.isBlocked).length,
        lastAudit: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const filteredUsers = users.filter(user => {
        const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.email.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesFilter = filterStatus === 'all' ||
            (filterStatus === 'blocked' && user.isBlocked) ||
            (filterStatus === 'active' && !user.isBlocked);
        return matchesSearch && matchesFilter;
    });

    const getRemainingDays = (date) => {
        if (!date) return 0;
        return differenceInDays(new Date(date), new Date());
    };

    const sidebarItems = [
        { id: 'dashboard', label: 'Monitor Center', icon: LayoutDashboard },
        { id: 'users', label: 'User Directory', icon: Users },
        { id: 'plans', label: 'Subscription Hub', icon: Zap },
        { id: 'revenue', label: 'Financial Hub', icon: TrendingUp },
        { id: 'broadcast', label: 'Global Broadcast', icon: Megaphone },
        { id: 'backup', label: 'Backup & Recovery', icon: Cloud },
        { id: 'system', label: 'Security & Logs', icon: Database },
    ];

    return (
        <div className="admin-app">
            {/* Sidebar Navigation */}
            <nav className={`sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
                <div className="sidebar-brand">
                    <div className="logo-container-modern">
                        <svg viewBox="0 95 85 55" className="k-brand-logo">
                            <path d="m5.46 108.2 11.06-11.52v11.52h-11.06z" fill="#000" />
                            <path d="m5.46 110.1v36.54c19.28-8.94 30.23-18.34 53.42-37.5l-2.53-1.07 12.01-4.57-5.57 13.22-1.76-3.89c-14.92 14.27-30.29 27.15-55.57 40.4 13.21-3.97 23.45-8.46 33.65-15.94l16.66 15.71h22.49l-24.55-26.18 28.71-30.1h-22.06l-25.33 22.17v-22.17h-16.24v13.38h-13.33zm5.75 9.39h14.26v2.73h-14.26v-2.73zm0 5.66h11.45v2.27h-11.45v-2.27z" fill="#000" />
                        </svg>
                    </div>
                    {sidebarOpen && (
                        <div className="brand-stack">
                            <span className="brand-main">KWIQBILL</span>
                            <span className="brand-sub">ADMINISTRATION HUB</span>
                        </div>
                    )}
                </div>

                <div className="sidebar-menu">
                    {sidebarItems.map(item => (
                        <div key={item.id} className="menu-wrapper">
                            <button
                                className={`menu-item ${activeSection === item.id ? 'active' : ''}`}
                                onClick={() => setActiveSection(item.id)}
                            >
                                <item.icon size={22} strokeWidth={activeSection === item.id ? 2.8 : 2.2} />
                                {sidebarOpen ? (
                                    <span className="menu-label">{item.label}</span>
                                ) : (
                                    <div className="sidebar-tooltip">{item.label}</div>
                                )}
                                {activeSection === item.id && <motion.div layoutId="active-glow" className="active-glow" />}
                            </button>
                        </div>
                    ))}
                </div>

                <div className="sidebar-footer">
                    <div className="admin-profile">
                        <div className="avatar-wrapper">
                            <div className="avatar-med">A</div>
                            <div className="online-indicator" />
                            {!sidebarOpen && <div className="sidebar-tooltip">Super Admin (Online)</div>}
                        </div>
                        {sidebarOpen && (
                            <div className="profile-info">
                                <p className="name">Super Admin</p>
                                <p className="role">Network Owner</p>
                            </div>
                        )}
                    </div>
                    <div className="logout-wrapper">
                        <button className="logout-btn-new">
                            <LogOut size={20} strokeWidth={2.5} />
                            {sidebarOpen ? (
                                <span className="exit-label">Secure Exit</span>
                            ) : (
                                <div className="sidebar-tooltip">Secure Exit</div>
                            )}
                        </button>
                    </div>
                </div>
            </nav>

            {/* Main Content Area */}
            <main className="main-content">
                <header className="content-navbar">
                    <div className="nav-left">
                        <button className="toggle-sidebar" onClick={() => setSidebarOpen(!sidebarOpen)}>
                            <LayoutDashboard size={24} strokeWidth={2.5} color="#000000" />
                        </button>
                        <h2 className="section-title">
                            {sidebarItems.find(i => i.id === activeSection)?.label}
                        </h2>
                    </div>
                    <div className="nav-right">
                        <div className="search-pill">
                            <Search size={22} strokeWidth={3.5} color="#000000" />
                            <input
                                placeholder="Global search..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <button className="icon-badge">
                            <Bell size={26} strokeWidth={3.5} color="#000000" />
                            <span className="dot" />
                        </button>
                        <button className="sync-btn" onClick={fetchUsers}>
                            <RefreshCcw size={26} strokeWidth={2.8} color="#ffffff" />
                        </button>
                    </div>
                </header>

                <div className="scroll-container">
                    {error && (
                        <div className="error-banner">
                            <Zap size={16} />
                            <span>{error}</span>
                            <button onClick={fetchUsers}>Retry Connection</button>
                        </div>
                    )}

                    {loading && users.length === 0 && (
                        <div className="loading-state">
                            <RefreshCcw className="spin" />
                            <p>Establishing Secure Link...</p>
                        </div>
                    )}
                    {activeSection === 'dashboard' && (
                        <DashboardView
                            stats={stats}
                            metrics={systemMetrics}
                            setShowInviteModal={setShowInviteModal}
                            setShowSecurityModal={setShowSecurityModal}
                        />
                    )}

                    {activeSection === 'users' && (
                        <UsersTableView
                            mode="directory"
                            loading={loading}
                            filteredUsers={filteredUsers}
                            filterStatus={filterStatus}
                            setFilterStatus={setFilterStatus}
                            getRemainingDays={getRemainingDays}
                            setSelectedUser={setSelectedUser}
                            handleToggleBlock={handleToggleBlock}
                            handleGenerateResetCode={handleGenerateResetCode}
                        />
                    )}

                    {activeSection === 'plans' && (
                        <UsersTableView
                            mode="subscriptions"
                            loading={loading}
                            filteredUsers={filteredUsers}
                            filterStatus={filterStatus}
                            setFilterStatus={setFilterStatus}
                            getRemainingDays={getRemainingDays}
                            setSelectedUser={setSelectedUser}
                            handleToggleBlock={handleToggleBlock}
                            handleGenerateResetCode={handleGenerateResetCode}
                        />
                    )}

                    {activeSection === 'system' && (
                        <SecurityLogsView users={users} logs={auditLogs} metrics={systemMetrics} />
                    )}

                    {activeSection === 'revenue' && (
                        <RevenueView users={users} revenueRecords={revenueData} />
                    )}

                    {activeSection === 'backup' && (
                        <BackupView history={backups} onRefresh={fetchUsers} />
                    )}

                    {activeSection === 'broadcast' && (
                        <BroadcastView history={broadcasts} onRefresh={fetchUsers} />
                    )}
                </div>
            </main>

            <Modals
                selectedUser={selectedUser}
                setSelectedUser={setSelectedUser}
                handleUpdatePlan={handleUpdatePlan}
                showInviteModal={showInviteModal}
                setShowInviteModal={setShowInviteModal}
                inviteEmail={inviteEmail}
                setInviteEmail={setInviteEmail}
                handleInviteUser={handleInviteUser}
                inviteLoading={inviteLoading}
                showSecurityModal={showSecurityModal}
                setShowSecurityModal={setShowSecurityModal}
                securityStats={securityStats}
                users={users}
                resetData={resetData}
                setResetData={setResetData}
            />



            <style>{`
                :root {
                    --bg-dark: #fcfcfc;
                    --sidebar: #000000;
                    --nav: #ffffff;
                    --primary: #000000;
                    --primary-soft: #f4f4f4;
                    --text-main: #000000;
                    --text-muted: #666666;
                    --glass: rgba(255, 255, 255, 0.98);
                    --border: #dddddd;
                    --success: #000000;
                    --danger: #000000;
                    --warning: #000000;
                }

                * { box-sizing: border-box; }
                body { background: var(--bg-dark); color: #000000; font-family: 'Plus Jakarta Sans', 'Inter', system-ui, sans-serif; margin: 0; overflow: hidden; -webkit-font-smoothing: antialiased; }

                .admin-app { display: flex; height: 100vh; width: 100vw; }

                /* Sidebar */
                .sidebar { 
                    background: #000000; 
                    color: white; 
                    display: flex; 
                    flex-direction: column; 
                    transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1); 
                    flex-shrink: 0; 
                    position: relative; 
                    z-index: 50; 
                    box-shadow: 4px 0 25px rgba(0,0,0,0.1);
                }
                .sidebar.open { width: 260px; }
                .sidebar.closed { width: 84px; }

                .sidebar-brand { padding: 30px 20px; display: flex; align-items: center; gap: 14px; margin-bottom: 10px; }
                .logo-container-modern { 
                    width: 44px; 
                    height: 44px; 
                    background: white; 
                    border-radius: 12px; 
                    display: flex; 
                    align-items: center; 
                    justify-content: center; 
                    border: 2px solid black; 
                    flex-shrink: 0; 
                    transition: 0.3s;
                    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
                }
                .sidebar.open .logo-container-modern { width: 50px; height: 50px; }
                .k-brand-logo { width: 85%; height: 85%; }
                .brand-stack { display: flex; flex-direction: column; line-height: 1.1; }
                .brand-main { font-weight: 900; font-size: 20px; letter-spacing: -0.5px; color: white; }
                .brand-sub { font-size: 9px; font-weight: 800; color: #94a3b8; letter-spacing: 1px; text-transform: uppercase; margin-top: 2px; }

                .sidebar-menu { flex: 1; padding: 12px; display: flex; flex-direction: column; gap: 8px; }
                .menu-wrapper { position: relative; }
                .menu-item { 
                    background: transparent; 
                    border: none; 
                    color: #94a3b8; 
                    display: flex; 
                    align-items: center; 
                    padding: 12px 14px; 
                    border-radius: 14px; 
                    cursor: pointer; 
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); 
                    position: relative;
                    width: 100%;
                    gap: 12px;
                    justify-content: flex-start;
                }
                .sidebar.closed .menu-item { justify-content: center; padding: 12px; }
                
                .menu-item:hover { background: rgba(255, 255, 255, 0.08); color: white; }
                .menu-item.active { color: white; background: rgba(255, 255, 255, 0.12); box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
                .menu-label { font-weight: 700; font-size: 14px; white-space: nowrap; transition: 0.2s; }
                
                .active-glow { 
                    position: absolute; 
                    left: 0; 
                    top: 15%; 
                    bottom: 15%; 
                    width: 4px; 
                    background: #ffffff; 
                    border-radius: 0 4px 4px 0;
                    box-shadow: 0 0 10px rgba(255,255,255,0.5);
                }

                .sidebar.closed .sidebar-tooltip {
                    position: absolute;
                    left: calc(100% + 15px);
                    background: #000000;
                    color: white;
                    padding: 8px 14px;
                    border-radius: 8px;
                    font-size: 12px;
                    font-weight: 800;
                    white-space: nowrap;
                    opacity: 0;
                    visibility: hidden;
                    transform: translateX(-10px);
                    transition: all 0.2s;
                    box-shadow: 0 4px 15px rgba(0,0,0,0.3);
                    pointer-events: none;
                    z-index: 100;
                    border: 1px solid rgba(255,255,255,0.1);
                }
                .sidebar.closed .menu-item:hover .sidebar-tooltip {
                    opacity: 1;
                    visibility: visible;
                    transform: translateX(0);
                }
                .sidebar.closed .sidebar-tooltip::before {
                    content: '';
                    position: absolute;
                    left: -4px;
                    top: 50%;
                    transform: translateY(-50%) rotate(45deg);
                    width: 8px;
                    height: 8px;
                    background: #000;
                    border-left: 1px solid rgba(255,255,255,0.1);
                    border-bottom: 1px solid rgba(255,255,255,0.1);
                }

                .sidebar-footer { 
                    padding: 20px 12px; 
                    border-top: 1px solid rgba(255,255,255,0.08);
                    display: flex;
                    flex-direction: column;
                    gap: 15px;
                }
                .admin-profile { 
                    display: flex; 
                    align-items: center; 
                    gap: 12px; 
                    padding: 8px;
                    border-radius: 12px;
                    transition: 0.2s;
                    position: relative;
                }
                .avatar-wrapper { position: relative; display: flex; align-items: center; justify-content: center; }
                .avatar-med { 
                    width: 40px; 
                    height: 40px; 
                    background: white; 
                    color: black; 
                    border-radius: 12px; 
                    display: flex; 
                    align-items: center; 
                    justify-content: center; 
                    font-weight: 900; 
                    font-size: 18px;
                    border: 2px solid #000;
                    box-shadow: 0 4px 10px rgba(0,0,0,0.2);
                }
                .online-indicator {
                    position: absolute;
                    bottom: -2px;
                    right: -2px;
                    width: 12px;
                    height: 12px;
                    background: #10b981;
                    border: 2.5px solid #0f172a;
                    border-radius: 50%;
                }

                .profile-info .name { margin: 0; font-size: 14px; font-weight: 800; color: #fff; }
                .profile-info .role { margin: 2px 0 0; font-size: 11px; color: #94a3b8; font-weight: 600; }

                .logout-wrapper { width: 100%; position: relative; }
                .logout-btn-new { 
                    background: white; 
                    border: none; 
                    color: black; 
                    display: flex; 
                    align-items: center; 
                    gap: 12px; 
                    padding: 12px; 
                    border-radius: 14px; 
                    width: 100%; 
                    cursor: pointer; 
                    font-weight: 800; 
                    transition: 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    justify-content: flex-start;
                    box-shadow: 0 4px 15px rgba(0,0,0,0.2);
                }
                .sidebar.closed .logout-btn-new { justify-content: center; padding: 12px; width: 44px; margin: 0 auto; }
                .logout-btn-new:hover { background: #ef4444; color: white; transform: translateY(-2px); box-shadow: 0 8px 20px rgba(239, 68, 68, 0.3); }
                .exit-label { font-size: 14px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px; }

                .sidebar.closed .avatar-wrapper:hover .sidebar-tooltip,
                .sidebar.closed .logout-wrapper:hover .sidebar-tooltip {
                    opacity: 1;
                    visibility: visible;
                    transform: translateX(0);
                }

                /* Main Content */
                .main-content { flex: 1; display: flex; flex-direction: column; height: 100vh; min-width: 0; }
                
                .content-navbar { height: 74px; background: #ffffff; border-bottom: 1.5px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; padding: 0 30px; flex-shrink: 0; }
                .nav-left { display: flex; align-items: center; gap: 16px; }
                .toggle-sidebar { background: #ffffff; border: 2px solid #000000; width: 46px; height: 46px; border-radius: 12px; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); box-shadow: 0 3px 0 #000; padding: 0; }
                .toggle-sidebar svg { width: 24px !important; height: 24px !important; stroke-width: 2.5px !important; }
                .toggle-sidebar:hover { transform: translateY(-2px); box-shadow: 0 5px 0 #000; }
                .toggle-sidebar:active { transform: translateY(1px); box-shadow: 0 1px 0 #000; }
                .section-title { margin: 0; font-size: 22px; font-weight: 800; color: #000000; letter-spacing: -0.3px; }

                .nav-right { display: flex; align-items: center; gap: 14px; }
                .search-pill { background: #f8fafc; border-radius: 100px; padding: 4px 18px; display: flex; align-items: center; gap: 10px; width: 280px; border: 2px solid #000; }
                .search-pill svg { width: 18px !important; height: 18px !important; stroke-width: 2.5px !important; }
                .search-pill input { background: transparent; border: none; outline: none; padding: 8px 0; width: 100%; font-size: 14px; font-weight: 600; color: #000000; }
                .search-pill input::placeholder { color: #94a3b8; }
                .icon-badge { background: #ffffff; border: 2px solid #000; width: 44px; height: 44px; border-radius: 12px; cursor: pointer; position: relative; color: #000000; display: flex; align-items: center; justify-content: center; transition: 0.2s; padding: 0; }
                .icon-badge svg { width: 22px !important; height: 22px !important; stroke-width: 2.5px !important; }
                .icon-badge:hover { background: #000000; color: #ffffff; }
                .icon-badge:hover svg { stroke: white !important; }
                .icon-badge .dot { position: absolute; top: -3px; right: -3px; width: 10px; height: 10px; background: #ef4444; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 8px rgba(239, 68, 68, 0.3); z-index: 5; }
                .sync-btn { background: #000000; color: white; border: none; width: 46px; height: 46px; border-radius: 12px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: 0.3s; box-shadow: 0 4px 8px rgba(0,0,0,0.15); padding: 0; }
                .sync-btn svg { width: 26px !important; height: 26px !important; stroke-width: 2.8px !important; }
                .sync-btn:hover { transform: rotate(180deg) scale(1.05); background: #1a1a1a; }

                .scroll-container { flex: 1; overflow-y: auto; padding: 30px; }

                /* Dashboard */
                .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px; margin-bottom: 30px; }
                .dashboard-card { background: white; padding: 24px; border-radius: 20px; border: 1px solid var(--border); box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
                .card-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
                .icon-box { width: 48px; height: 48px; border-radius: 14px; display: flex; align-items: center; justify-content: center; background: #f8fafc; border: 1.5px solid #eeeeee; color: #000000; }
                .trend { font-size: 12px; font-weight: 800; display: flex; align-items: center; gap: 4px; padding: 4px 10px; border-radius: 100px; background: #f1f5f9; border: 1px solid #e2e8f0; }
                .stat-value { margin: 0; font-size: 32px; font-weight: 900; letter-spacing: -1px; }
                .stat-label { margin: 8px 0 0; color: var(--text-muted); font-size: 13px; font-weight: 600; }

                .dashboard-columns { display: grid; grid-template-columns: 2fr 1fr; gap: 24px; }
                .content-card { background: white; border: 1px solid var(--border); border-radius: 24px; padding: 24px; }
                .card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
                .card-header h3 { margin: 0; font-size: 18px; font-weight: 800; }
                .text-btn { background: none; border: none; color: var(--primary); font-weight: 700; cursor: pointer; }

                .chart-placeholder { height: 240px; display: flex; flex-direction: column; justify-content: flex-end; }
                .mock-chart { height: 180px; display: flex; align-items: flex-end; gap: 20px; padding: 0 20px; }
                .bar { flex: 1; background: #e2e8f0; border-radius: 8px 8px 0 0; position: relative; transition: height 0.6s ease, background 0.3s ease; }
                .bar:hover { background: #000000; }
                .bar:hover .bar-glow { opacity: 0.2; }
                .bar-glow { position: absolute; top:0; left:0; right:0; height: 40px; background: #000000; opacity: 0.05; filter: blur(15px); transition: 0.3s; border-radius: 8px; }
                .chart-labels { display: flex; justify-content: space-between; padding: 15px 20px; border-top: 1px solid var(--border); margin-top: 10px; color: var(--text-muted); font-size: 12px; font-weight: bold; }

                .action-list { display: flex; flex-direction: column; gap: 12px; }
                .quick-item { background: #f8fafc; border: 1px solid var(--border); padding: 16px; border-radius: 16px; display: flex; align-items: center; gap: 15px; cursor: pointer; transition: 0.2s; font-weight: 700; color: var(--text-main); }
                .quick-item:hover { transform: translateX(5px); border-color: #000000; color: #000000; background: #ffffff; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }

                /* Tables */
                .table-filters { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
                .filter-group { background: #e2e8f0; padding: 4px; border-radius: 14px; display: flex; gap: 4px; }
                .filter-group button { border: none; background: transparent; color: var(--text-muted); padding: 10px 20px; border-radius: 10px; font-weight: 700; cursor: pointer; transition: 0.2s; font-size: 14px; }
                .filter-group button.active { background: #000000; color: white; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
                .search-count { color: var(--text-muted); font-size: 14px; font-weight: bold; }

                .pro-table-wrapper { background: white; border-radius: 24px; border: 1px solid var(--border); overflow-x: auto; box-shadow: 0 4px 20px rgba(0,0,0,0.03); }
                .pro-table { width: 100%; border-collapse: collapse; text-align: left; }
                .pro-table th { background: #f8fafc; padding: 20px; font-size: 13px; font-weight: 800; text-transform: uppercase; color: var(--text-muted); letter-spacing: 1px; border-bottom: 1.5px solid var(--border); white-space: nowrap; }
                .pro-table td { padding: 20px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; white-space: nowrap; }
                .row-blocked { background: #fff5f5; }

                .user-identity { display: flex; align-items: center; gap: 15px; }
                .avatar-med { width: 44px; height: 44px; background: #000000; color: #ffffff; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 18px; }
                .name-bold { margin: 0; font-weight: 800; font-size: 15px; color: var(--text-main); }
                .email-sub { margin: 2px 0 0; font-size: 12px; color: var(--text-muted); font-weight: 500; }

                .plan-badge { display: inline-flex; align-items: center; gap: 8px; padding: 8px 16px; border-radius: 10px; font-size: 13px; font-weight: 700; background: #000000; border: 1.5px solid #000000; color: #ffffff; }

                .status-cell { display: flex; align-items: center; gap: 10px; }
                .timeline-cell { font-size: 12px; }
                .timeline-cell .date { margin: 0; color: var(--text-muted); font-weight: 600; }
                .timeline-cell .active-since { margin: 4px 0 0; color: var(--text-main); font-weight: 800; }
                .timeline-cell .time-sub { margin: 4px 0 0; color: var(--text-muted); font-weight: 500; font-size: 11px; }

                .indicator { width: 10px; height: 10px; border-radius: 50%; display: block; }
                .indicator.active { background: #10b981; box-shadow: 0 0 10px rgba(16, 185, 129, 0.4); border: 1.5px solid white; }
                .indicator.expired { background: #cccccc; border: 1.5px solid white; }
                .indicator.blocked { background: #ef4444; box-shadow: 0 0 10px rgba(239, 68, 68, 0.4); border: 1.5px solid white; }
                
                .tier-badge { 
                    display: inline-flex; 
                    align-items: center; 
                    gap: 6px; 
                    padding: 5px 12px; 
                    border-radius: 100px; 
                    font-size: 10px; 
                    font-weight: 900; 
                    letter-spacing: 0.5px; 
                }
                .tier-badge svg { flex-shrink: 0; }
                .tier-badge.plat { background: #000000; color: #ffffff; border: 1.5px solid #000; }
                .tier-badge.gold { background: #fef9c3; color: #854d0e; border: 1.5px solid #fde047; }
                .tier-badge.annual { background: #ede9fe; color: #5b21b6; border: 1.5px solid #ddd6fe; }
                .tier-badge.quarterly { background: #dcfce7; color: #166534; border: 1.5px solid #bbf7d0; }
                .tier-badge.monthly { background: #f1f5f9; color: #000000; border: 1.5px solid #000000; }
                .tier-badge.basic { background: #ffffff; color: #64748b; border: 1.5px solid #e2e8f0; }
                .status-text { font-size: 13px; font-weight: 600; color: var(--text-main); }


                .action-btn { 
                    background: #ffffff; 
                    border: 2.5px solid #000000; 
                    min-width: 44px; 
                    height: 44px; 
                    padding: 0 16px; 
                    border-radius: 12px; 
                    cursor: pointer; 
                    display: flex; 
                    align-items: center; 
                    justify-content: center; 
                    transition: 0.2s; 
                    color: #000000; 
                    gap: 8px;
                }
                .action-btn .btn-text {
                    font-size: 11px;
                    font-weight: 900;
                    letter-spacing: 0.5px;
                    text-transform: uppercase;
                }
                .action-btn:hover { background: #000000; border-color: #000000; color: #ffffff; transform: translateY(-3px); box-shadow: 0 4px 15px rgba(0,0,0,0.2); }
                .action-btn:hover svg { stroke: white !important; }
                .action-btn.danger:hover { background: #000000; border-color: #000000; color: #ffffff; }
                .action-btn.safety:hover { background: #000000; border-color: #000000; color: #ffffff; }
                .action-row { display: flex; gap: 14px; justify-content: flex-end; min-width: 120px; }
                .text-right-aligned { text-align: right !important; }

                /* Modals */
                .modal-backdrop { position: fixed; top:0; left:0; right:0; bottom:0; background: rgba(15, 23, 42, 0.4); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 1000; }
                .premium-modal { background: white; border-radius: 32px; width: 100%; max-width: 440px; padding: 40px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); position: relative; overflow: hidden; }
                .modal-header { text-align: center; margin-bottom: 30px; }
                .modal-icon { width: 56px; height: 56px; background: var(--primary); border-radius: 18px; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; box-shadow: 0 10px 20px rgba(88, 76, 237, 0.3); }
                .modal-header h2 { margin: 0; font-size: 22px; font-weight: 900; letter-spacing: -0.5px; }
                .modal-header p { margin: 8px 0 0; color: var(--text-muted); font-size: 14px; }

                .plan-selector { display: flex; flex-direction: column; gap: 12px; margin-bottom: 24px; }
                .plan-btn { background: white; border: 2.5px solid #000000; border-radius: 20px; padding: 24px; cursor: pointer; position: relative; transition: 0.3s; text-align: left; color: #000000; font-family: inherit; }
                .plan-btn:hover { border-color: #000000; background: #000000; color: #ffffff !important; transform: scale(1.03); }
                .plan-btn:hover * { color: #ffffff !important; }
                .btn-content { display: flex; justify-content: space-between; align-items: center; color: #000000; }
                .opt-label { font-weight: 800; font-size: 18px; color: inherit; }
                .hot-pill { position: absolute; top: -12px; right: 24px; background: #000000; color: #ffffff; padding: 5px 12px; border-radius: 100px; font-size: 11px; font-weight: 900; text-transform: uppercase; border: 3px solid #ffffff; }

                .btn-secondary { background: none; border: none; color: #000000; font-weight: 800; cursor: pointer; display: block; margin: 20px auto 0; transition: 0.2s; font-size: 16px; }
                .btn-secondary:hover { color: #000000; text-decoration: underline; transform: scale(1.05); }

                .pro-loader { text-align: center; padding: 100px 0; color: var(--primary); display: flex; flex-direction: column; align-items: center; gap: 20px; font-weight: 800; }

                .text-right { text-align: right; }

                /* Security Modal Custom */
                .security-modal { max-width: 500px; }
                .security-stats-grid { display: grid; gap: 12px; margin-bottom: 24px; }
                .sec-stat-box { display: flex; align-items: center; gap: 16px; padding: 16px; border-radius: 16px; border: 1.5px solid var(--border); }
                .sec-stat-box h4 { margin: 0; font-size: 16px; font-weight: 800; }
                .sec-stat-box p { margin: 2px 0 0; font-size: 12px; font-weight: 600; opacity: 0.7; }
                .sec-stat-box.safe { background: #f0fdf4; border-color: #bbf7d0; color: #166534; }
                .sec-stat-box.danger { background: #fef2f2; border-color: #fecaca; color: #991b1b; }
                .sec-stat-box.neutral { background: #f8fafc; border-color: #e2e8f0; color: #334155; }
                
                .audit-log { background: #f8fafc; border-radius: 16px; padding: 16px; margin-bottom: 24px; border: 1px solid var(--border); }
                .audit-log h3 { margin: 0 0 12px; font-size: 14px; font-weight: 800; text-transform: uppercase; color: var(--text-muted); }
                .log-item { display: flex; gap: 12px; padding: 8px 0; border-bottom: 1px solid rgba(0,0,0,0.05); font-size: 13px; font-weight: 600; color: var(--text-main); }
                .log-item:last-child { border-bottom: none; padding-bottom: 0; }
                .log-item .time { color: var(--text-muted); width: 60px; font-variant-numeric: tabular-nums; flex-shrink: 0; }
                .log-item.warning .time { color: #ef4444; }
                .log-item.warning .event { color: #7f1d1d; }

                /* Invite Modal Custom */
                .invite-form { display: flex; flex-direction: column; gap: 20px; }
                .input-group label { display: block; font-weight: 800; margin-bottom: 8px; font-size: 13px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; }
                .invite-input { width: 100%; padding: 16px 20px; border: 2px solid var(--border); border-radius: 16px; font-size: 16px; font-weight: 600; font-family: inherit; transition: 0.3s; background: #f8fafc; }
                .invite-input:focus { outline: none; border-color: #000000; background: #ffffff; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
                .submit-invite-btn { background: #000000 !important; margin-top: 10px; }
                .submit-invite-btn:hover { background: #333333 !important; transform: translateY(-2px); }
                .submit-invite-btn:disabled { opacity: 0.7; cursor: not-allowed; transform: none; }
                .error-banner {
                    margin: 20px;
                    padding: 16px 24px;
                    background: #fffafa;
                    border: 1px solid #ffebeb;
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    color: #e53e3e;
                    font-weight: 600;
                    font-size: 14px;
                }
                .error-banner button {
                    margin-left: auto;
                    background: black;
                    color: white;
                    border: none;
                    padding: 6px 14px;
                    border-radius: 8px;
                    font-size: 12px;
                    cursor: pointer;
                }
                .loading-state {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    height: 400px;
                    color: #94a3b8;
                    gap: 16px;
                }
                .spin { animation: spin 2s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
};

export default App;
