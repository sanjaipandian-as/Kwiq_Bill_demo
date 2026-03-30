import React from 'react';

const BlockingOverlay = ({ message, onLogout }) => {
    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(10px)',
            zIndex: 9999,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            color: 'white',
            textAlign: 'center',
            padding: '20px',
            animation: 'fadeIn 0.5s ease-out'
        }}>
            <div style={{
                maxWidth: '500px',
                backgroundColor: '#1E1E1E',
                padding: '40px',
                borderRadius: '24px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center'
            }}>
                <div style={{
                    fontSize: '64px',
                    marginBottom: '24px',
                    filter: 'drop-shadow(0 0 10px rgba(239, 68, 68, 0.5))'
                }}>
                    🚫
                </div>
                <h1 style={{
                    fontSize: '28px',
                    fontWeight: 'bold',
                    marginBottom: '16px',
                    color: '#EF4444'
                }}>
                    Access restricted
                </h1>
                <p style={{
                    fontSize: '16px',
                    color: '#94A3B8',
                    lineHeight: '1.6',
                    marginBottom: '32px'
                }}>
                    {message || "Your account has been blocked or your subscription has expired. Please contact support to continue using the application."}
                </p>

                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    width: '100%'
                }}>
                    <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
                        <button
                            onClick={() => window.location.href = 'mailto:support@kwiqbill.com'}
                            style={{
                                flex: 1,
                                padding: '12px 24px',
                                backgroundColor: '#334155',
                                color: 'white',
                                border: 'none',
                                borderRadius: '12px',
                                cursor: 'pointer',
                                fontWeight: '600',
                                transition: 'all 0.2s'
                            }}
                            onMouseOver={(e) => e.target.style.backgroundColor = '#475569'}
                            onMouseOut={(e) => e.target.style.backgroundColor = '#334155'}
                        >
                            Contact Support
                        </button>
                        <button
                            onClick={onLogout}
                            style={{
                                flex: 1,
                                padding: '12px 24px',
                                backgroundColor: '#EF4444',
                                color: 'white',
                                border: 'none',
                                borderRadius: '12px',
                                cursor: 'pointer',
                                fontWeight: '600',
                                transition: 'all 0.2s'
                            }}
                            onMouseOver={(e) => e.target.style.backgroundColor = '#DC2626'}
                            onMouseOut={(e) => e.target.style.backgroundColor = '#EF4444'}
                        >
                            Log out
                        </button>
                    </div>

                    <button
                        onClick={() => {
                            if (window.electron?.windowControls?.close) {
                                window.electron.windowControls.close();
                            } else {
                                window.close();
                            }
                        }}
                        style={{
                            width: '100%',
                            padding: '12px 24px',
                            backgroundColor: 'transparent',
                            color: '#94A3B8',
                            border: '1px solid #334155',
                            borderRadius: '12px',
                            cursor: 'pointer',
                            fontWeight: '600',
                            transition: 'all 0.2s'
                        }}
                        onMouseOver={(e) => {
                            e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                            e.target.style.color = 'white';
                        }}
                        onMouseOut={(e) => {
                            e.target.style.backgroundColor = 'transparent';
                            e.target.style.color = '#94A3B8';
                        }}
                    >
                        Exit Application
                    </button>
                </div>

                <div style={{ marginTop: '24px', fontSize: '12px', color: '#475569' }}>
                    Kwiqbill Compliance Engine v1.0
                </div>
            </div>
            <style jsx>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: scale(0.95); }
                    to { opacity: 1; transform: scale(1); }
                }
            `}</style>
        </div>
    );
};

export default BlockingOverlay;
