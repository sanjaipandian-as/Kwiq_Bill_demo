import React, { useState } from 'react';
import { 
  TrendingUp, TrendingDown, DollarSign, Users, CreditCard, 
  ArrowUpRight, Target, BarChart3, PieChart, Calendar
} from 'lucide-react';
import { motion } from 'framer-motion';

const RevenueView = ({ users, revenueRecords }) => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));

    // Calculate real revenue from records
    const totalRevenue = revenueRecords.reduce((sum, rec) => sum + parseFloat(rec.amount || 0), 0);
    const monthlyRevenue = revenueRecords
        .filter(rec => {
            const date = new Date(rec.paymentDate);
            return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
        })
        .reduce((sum, rec) => sum + parseFloat(rec.amount || 0), 0);
    
    // Pro/Active segments
    const proUsers = users.length;
    const totalUsers = users.length;
    const arpu = totalRevenue / (totalUsers || 1);
    
    // Health Metrics Logic
    const newSubs = users.filter(u => new Date(u.createdAt) > thirtyDaysAgo).length;
    const blockedUsers = users.filter(u => u.isBlocked).length;
    const expiredUsers = 0;
    
    const churnCount = blockedUsers + expiredUsers;
    const retentionRate = totalUsers > 0 
        ? Math.max(0, Math.min(100, ((totalUsers - churnCount) / totalUsers) * 100))
        : 100;

    const [timeframe, setTimeframe] = useState('monthly');

    // charts calculation...
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentYear = now.getFullYear();
    
    const monthlyAgg = months.map((month, idx) => {
        const amount = revenueRecords
            .filter(r => new Date(r.paymentDate).getMonth() === idx && new Date(r.paymentDate).getFullYear() === currentYear)
            .reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);
        return { month, amount };
    });

    const revenueData = monthlyAgg.slice(-7);
    const hasData = revenueData.some(d => d.amount > 0);
    const maxAmount = Math.max(...revenueData.map(d => d.amount)) || 1000;

    return (
        <div className="revenue-page">
            <div className="revenue-grid">
                <div className="stat-card">
                    <div className="card-header">
                        <div className="icon shadow-emerald"><DollarSign size={20} /></div>
                        {monthlyRevenue > 0 && <span className="trend positive"><ArrowUpRight size={14} /> ACTIVE GROWTH</span>}
                    </div>
                    <div className="card-body">
                        <p className="label">Monthly Recurring Revenue</p>
                        <h2 className="value">₹{monthlyRevenue.toLocaleString()}</h2>
                        <p className="sub-value">Total Realized: ₹{totalRevenue.toLocaleString()}</p>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="card-header">
                        <div className="icon shadow-blue"><Users size={20} /></div>
                    </div>
                    <div className="card-body">
                        <p className="label">Avg. Revenue Per User</p>
                        <h2 className="value">₹{arpu.toFixed(2)}</h2>
                        <p className="sub-value">Across {totalUsers} Businesses</p>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="card-header">
                        <div className="icon shadow-purple"><Target size={20} /></div>
                    </div>
                    <div className="card-body">
                        <p className="label">Conversion Rate</p>
                        <h2 className="value">{((proUsers / (totalUsers || 1)) * 100).toFixed(1)}%</h2>
                        <p className="sub-value">{proUsers} Professional Licenses</p>
                    </div>
                </div>
            </div>

            <div className="chart-section">
                <div className="chart-card">
                    <div className="chart-header">
                        <div>
                            <h3>Revenue Growth Forecast</h3>
                            <p>Actual earnings tracked across system nodes</p>
                        </div>
                        <div className="time-filters">
                            <button className={timeframe === 'monthly' ? 'active' : ''}>Monthly</button>
                        </div>
                    </div>
                    
                    {!hasData ? (
                        <div className="empty-chart-state">
                            <BarChart3 size={40} />
                            <p>No revenue records detected for {currentYear}</p>
                            <span>Transaction signals will appear here once users upgrade.</span>
                        </div>
                    ) : (
                        <div className="revenue-chart">
                            {revenueData.map((d, i) => (
                                <div key={i} className="chart-column">
                                    <motion.div 
                                        initial={{ height: 0 }} 
                                        animate={{ height: `${(d.amount / maxAmount) * 100}%` }}
                                        transition={{ duration: 0.8, delay: i * 0.1 }}
                                        className="column-bar"
                                    >
                                        <div className="bar-tooltip">₹{d.amount.toLocaleString()}</div>
                                    </motion.div>
                                    <span className="column-label">{d.month}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="churn-card">
                    <h3>Customer Health</h3>
                    <div className="metric-box">
                        <div className="circular-progress">
                            <svg viewBox="0 0 36 36" className="circular-chart green">
                                <path className="circle-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                <path 
                                    className="circle" 
                                    strokeDasharray={`${retentionRate}, 100`} 
                                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" 
                                />
                                <text x="18" y="20.35" className="percentage">{Math.round(retentionRate)}%</text>
                            </svg>
                        </div>
                        <p>Retention Rate</p>
                    </div>
                    <div className="churn-stats">
                        <div className="item"><span>New Subscriptions</span><strong>+{newSubs}</strong></div>
                        <div className="item"><span>Churned Accounts</span><strong style={{ color: churnCount > 0 ? '#ef4444' : 'inherit' }}>-{churnCount}</strong></div>
                    </div>
                </div>
            </div>

            <style>{`
                .revenue-page { display: flex; flex-direction: column; gap: 30px; }
                .revenue-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
                
                .stat-card { 
                    background: white; 
                    padding: 24px; 
                    border-radius: 24px; 
                    border: 1px solid #eef2f6;
                    transition: 0.3s;
                }
                .stat-card:hover { transform: translateY(-5px); border-color: #000; }
                
                .card-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
                .icon { width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: white; }
                .shadow-emerald { background: #10b981; box-shadow: 0 8px 16px rgba(16, 185, 129, 0.2); }
                .shadow-blue { background: #3b82f6; box-shadow: 0 8px 16px rgba(59, 130, 246, 0.2); }
                .shadow-purple { background: #8b5cf6; box-shadow: 0 8px 16px rgba(139, 92, 246, 0.2); }
                
                .trend { font-size: 11px; font-weight: 800; padding: 4px 8px; border-radius: 100px; display: flex; align-items: center; gap: 4px; }
                .trend.positive { background: #f0fdf4; color: #16a34a; }
                
                .card-body .label { color: #64748b; font-size: 13px; font-weight: 600; margin-bottom: 4px; }
                .card-body .value { font-size: 32px; font-weight: 900; margin: 0; letter-spacing: -1px; }
                .card-body .sub-value { font-size: 11px; font-weight: 700; color: #94a3b8; margin: 6px 0 0; text-transform: uppercase; letter-spacing: 0.5px; }

                .chart-section { display: grid; grid-template-columns: 2fr 1fr; gap: 24px; }
                .chart-card { background: white; border-radius: 24px; border: 1px solid #eef2f6; padding: 30px; min-height: 420px; display: flex; flex-direction: column; }
                .chart-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; }
                .chart-header h3 { margin: 0; font-size: 18px; font-weight: 800; }
                .chart-header p { margin: 4px 0 0; color: #64748b; font-size: 13px; }
                
                .empty-chart-state { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #94a3b8; text-align: center; gap: 10px; }
                .empty-chart-state p { margin: 0; font-weight: 800; color: #64748b; font-size: 16px; }
                .empty-chart-state span { font-size: 13px; font-weight: 600; max-width: 240px; }

                .time-filters { display: flex; gap: 4px; background: #f1f5f9; padding: 4px; border-radius: 10px; border: 1.5px solid #e2e8f0; }
                .time-filters button { border: none; background: transparent; color: #64748b; padding: 8px 16px; font-size: 11px; font-weight: 800; cursor: pointer; border-radius: 7px; transition: 0.2s; text-transform: uppercase; letter-spacing: 0.5px; }
                .time-filters button.active { background: #000000; color: #ffffff; box-shadow: 0 4px 12px rgba(0,0,0,0.2); }

                .revenue-chart { height: 260px; display: flex; align-items: flex-end; justify-content: space-between; padding: 0 10px; margin-top: auto; }
                .chart-column { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 15px; max-width: 60px; position: relative; }
                .column-bar { width: 100%; background: #000; border-radius: 10px 10px 4px 4px; position: relative; cursor: pointer; }
                .column-bar:hover { background: #333; }
                .bar-tooltip { position: absolute; top: -30px; left: 50%; transform: translateX(-50%); background: #000; color: white; font-size: 10px; padding: 2px 6px; border-radius: 4px; opacity: 0; transition: 0.2s; }
                .column-bar:hover .bar-tooltip { opacity: 1; top: -35px; }
                .column-label { font-size: 12px; font-weight: 700; color: #94a3b8; }

                .churn-card { background: white; border-radius: 24px; border: 1px solid #eef2f6; padding: 30px; display: flex; flex-direction: column; align-items: center; }
                .churn-card h3 { width: 100%; margin: 0 0 30px; font-size: 16px; font-weight: 800; }
                
                .circular-progress { width: 140px; margin-bottom: 20px; }
                .circular-chart { display: block; margin: 10px auto; max-width: 100%; max-height: 250px; }
                .circle-bg { fill: none; stroke: #f1f5f9; stroke-width: 3.2; }
                .circle { fill: none; stroke: #10b981; stroke-width: 3.2; stroke-linecap: round; }
                .percentage { fill: #000; font-family: inherit; font-size: 6px; font-weight: 900; text-anchor: middle; }

                .churn-stats { width: 100%; display: flex; flex-direction: column; gap: 12px; margin-top: auto; }
                .churn-stats .item { display: flex; justify-content: space-between; font-size: 13px; font-weight: 600; color: #64748b; border-top: 1px solid #f1f5f9; padding-top: 12px; }
                .churn-stats .item strong { color: #000; }
            `}</style>
        </div>
    );
};

export default RevenueView;
