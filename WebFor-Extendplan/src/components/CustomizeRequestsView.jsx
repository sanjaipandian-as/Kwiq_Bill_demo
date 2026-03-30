import React, { useState } from 'react';
import { format } from 'date-fns';
import { MessageSquare, RefreshCcw, CheckCircle2, Circle, Clock, Check } from 'lucide-react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/admin';
const ADMIN_KEY = import.meta.env.VITE_ADMIN_KEY || 'KWIQ_ADMIN_MASTER_2026';

const CustomizeRequestsView = ({ requests, onRefresh }) => {
    const [statusUpdating, setStatusUpdating] = useState(null);

    const handleUpdateStatus = async (id, newStatus) => {
        try {
            setStatusUpdating(id);
            const url = API_URL.replace('/admin', '') + '/customize-requests/' + id;
            await axios.put(url, { status: newStatus }, {
                headers: { 'x-admin-key': ADMIN_KEY }
            });
            onRefresh();
        } catch (error) {
            alert('Failed to update status');
        } finally {
            setStatusUpdating(null);
        }
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'New': return <span className="req-badge req-new">New Request</span>;
            case 'In Progress': return <span className="req-badge req-prog">Processing</span>;
            case 'Completed': return <span className="req-badge req-comp">Completed</span>;
            case 'Rejected': return <span className="req-badge req-rej">Rejected</span>;
            default: return null;
        }
    };

    return (
        <div className="requests-view">
            <div className="view-header">
                <div className="title-section">
                    <div className="icon-wrapper">
                        <MessageSquare size={24} color="#fff" />
                    </div>
                    <div>
                        <h2>Customization Orders</h2>
                        <p>Manage and process tailor-made requests from users</p>
                    </div>
                </div>
                <button className="pro-btn" onClick={onRefresh}>
                    <RefreshCcw size={18} />
                    Sync Requests
                </button>
            </div>

            <div className="requests-grid">
                {requests && requests.length > 0 ? (
                    requests.map(req => (
                        <div className="req-card" key={req._id}>
                            <div className="req-card-header">
                                <div className="req-identity">
                                    <h3>{req.businessName}</h3>
                                    <p>{req.fullName} &bull; {req.email} &bull; {req.phone}</p>
                                </div>
                                <div className="req-status">
                                    {getStatusBadge(req.status)}
                                    <span className="req-date">{format(new Date(req.createdAt), 'MMM dd, yyyy HH:mm')}</span>
                                </div>
                            </div>
                            
                            <div className="req-card-body">
                                <div className="req-tags">
                                    <div className="tag-group">
                                        <strong>Type:</strong> <span>{req.businessType}</span>
                                    </div>
                                    <div className="tag-group">
                                        <strong>Platform:</strong> <span>{req.platform}</span>
                                    </div>
                                    <div className="tag-group">
                                        <strong>Required Features:</strong>
                                        <div className="feat-chips">
                                            {req.features?.map(f => (
                                                <span key={f} className="feat-chip">{f}</span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="req-description">
                                    <strong>Description:</strong>
                                    <p>{req.description}</p>
                                </div>
                            </div>

                            <div className="req-card-footer">
                                <strong>Update Status:</strong>
                                <div className="action-buttons">
                                    <button 
                                        disabled={statusUpdating === req._id || req.status === 'New'} 
                                        onClick={() => handleUpdateStatus(req._id, 'New')}
                                        className={`stat-btn ${req.status === 'New' ? 'active' : ''}`}
                                    >New</button>
                                    <button 
                                        disabled={statusUpdating === req._id || req.status === 'In Progress'} 
                                        onClick={() => handleUpdateStatus(req._id, 'In Progress')}
                                        className={`stat-btn ${req.status === 'In Progress' ? 'active' : ''}`}
                                    >Processing</button>
                                    <button 
                                        disabled={statusUpdating === req._id || req.status === 'Completed'} 
                                        onClick={() => handleUpdateStatus(req._id, 'Completed')}
                                        className={`stat-btn ${req.status === 'Completed' ? 'active' : ''}`}
                                    >Completed</button>
                                </div>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="empty-state">
                        <MessageSquare size={48} color="#cbd5e1" />
                        <h3>No Customization Requests</h3>
                        <p>All clear! Users haven't submitted any new tailor-made requests yet.</p>
                    </div>
                )}
            </div>

            <style>{`
                .requests-view { padding: 10px; }
                .view-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; }
                .title-section { display: flex; align-items: center; gap: 16px; }
                .icon-wrapper { width: 48px; height: 48px; background: #000; border-radius: 12px; display: flex; align-items: center; justify-content: center; }
                .title-section h2 { margin: 0; font-size: 24px; font-weight: 900; letter-spacing: -0.5px; }
                .title-section p { margin: 4px 0 0; color: #64748b; font-weight: 600; font-size: 14px; }
                
                .pro-btn { background: #000; color: #fff; border: none; padding: 12px 20px; border-radius: 12px; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: 0.2s; }
                .pro-btn:hover { background: #333; transform: translateY(-2px); }

                .requests-grid { display: flex; flex-direction: column; gap: 20px; }
                .req-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 20px; box-shadow: 0 4px 20px rgba(0,0,0,0.03); overflow: hidden; }
                
                .req-card-header { padding: 20px 24px; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: flex-start; background: #f8fafc; }
                .req-identity h3 { margin: 0 0 6px 0; font-size: 18px; font-weight: 900; color: #000; }
                .req-identity p { margin: 0; font-size: 13px; color: #64748b; font-weight: 600; }
                
                .req-status { display: flex; flex-direction: column; align-items: flex-end; gap: 8px; }
                .req-badge { padding: 6px 12px; border-radius: 8px; font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px; }
                .req-new { background: #dbeafe; color: #1e40af; border: 1px solid #bfdbfe; }
                .req-prog { background: #fef9c3; color: #854d0e; border: 1px solid #fde047; }
                .req-comp { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }
                .req-rej { background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; }
                .req-date { font-size: 12px; color: #94a3b8; font-weight: 700; }

                .req-card-body { padding: 24px; }
                .req-tags { display: flex; flex-direction: column; gap: 12px; margin-bottom: 20px; }
                .tag-group { display: flex; align-items: center; gap: 12px; font-size: 14px; }
                .tag-group strong { color: #000; font-weight: 800; min-width: 130px; }
                .tag-group span { color: #475569; font-weight: 600; }
                
                .feat-chips { display: flex; flex-wrap: wrap; gap: 6px; }
                .feat-chip { background: #f1f5f9; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 700; color: #334155; border: 1px solid #e2e8f0; }
                
                .req-description { background: #f8fafc; padding: 16px; border-radius: 12px; border: 1px solid #e2e8f0; }
                .req-description strong { display: block; margin-bottom: 8px; color: #000; font-weight: 800; font-size: 14px; }
                .req-description p { margin: 0; color: #334155; font-size: 14px; line-height: 1.6; font-weight: 500; }

                .req-card-footer { padding: 16px 24px; border-top: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center; background: #fff; }
                .req-card-footer strong { font-size: 13px; color: #64748b; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; }
                .action-buttons { display: flex; gap: 8px; }
                .stat-btn { background: #f1f5f9; border: 1px solid #e2e8f0; padding: 8px 16px; border-radius: 8px; font-size: 12px; font-weight: 800; color: #64748b; cursor: pointer; transition: 0.2s; }
                .stat-btn:hover:not(:disabled) { background: #e2e8f0; color: #000; }
                .stat-btn.active { background: #000; color: #fff; border-color: #000; }
                .stat-btn:disabled { opacity: 0.5; cursor: not-allowed; }

                .empty-state { text-align: center; padding: 80px 20px; background: #fff; border-radius: 20px; border: 1px dashed #cbd5e1; }
                .empty-state h3 { margin: 20px 0 8px 0; font-size: 18px; font-weight: 900; color: #000; }
                .empty-state p { margin: 0; color: #64748b; font-weight: 500; }
            `}</style>
        </div>
    );
};

export default CustomizeRequestsView;
