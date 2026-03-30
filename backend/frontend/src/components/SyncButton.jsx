
import React, { useState, useEffect } from 'react';
import { RefreshCw, CheckCircle, AlertCircle, Cloud, CloudOff } from 'lucide-react';
import { Button } from './ui/Button';
import { syncService } from '../services/syncService';
import { cn } from '../lib/utils';
import { toast } from 'react-hot-toast';

const SyncButton = () => {
    const [status, setStatus] = useState('idle'); // idle, syncing, success, error
    const [lastSynced, setLastSynced] = useState(null);
    const [message, setMessage] = useState('');

    useEffect(() => {
        checkStatus();
    }, []);

    const checkStatus = async () => {
        try {
            const res = await syncService.getBackupStatus();
            if (res.lastSyncAt) {
                setLastSynced(new Date(res.lastSyncAt));
            }
        } catch (error) {
            console.error("Failed to check sync status", error);
        }
    };

    const handleSync = async () => {
        if (status === 'syncing') return;

        setStatus('syncing');
        setMessage('Syncing...');

        try {
            const res = await syncService.triggerSync();
            if (res.success) {
                setStatus('success');
                setMessage(`Synced ${res.applied} events`);
                setLastSynced(new Date());
                toast.success(`Sync Complete: ${res.applied} new items applied`);

                // Return to idle after a delay
                setTimeout(() => {
                    setStatus('idle');
                    setMessage('');
                }, 3000);
            } else {
                throw new Error(res.message || "Sync failed");
            }
        } catch (error) {
            console.error("Sync Error Details:", error);

            // Check for authentication errors (401 status or authRequired flag)
            const isAuthError = error.response?.status === 401 || error.response?.data?.authRequired;
            const errMsg = error.response?.data?.error || error.message;

            setStatus('error');
            setMessage('Sync Failed');

            if (isAuthError) {
                toast.error(
                    "Authentication expired! Please log out and log back in to restore sync functionality.",
                    { duration: 8000 }
                );
            } else {
                toast.error("Sync Failed: " + errMsg);
            }

            setTimeout(() => {
                setStatus('idle');
                setMessage('');
            }, 5000);
        }
    };

    return (
        <div className="flex items-center gap-3">
            {lastSynced && (
                <span className="text-xs text-slate-400 hidden md:inline-block">
                    Last synced: {lastSynced.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
            )}

            <Button
                variant="outline"
                size="sm"
                onClick={handleSync}
                className={cn(
                    "relative overflow-hidden transition-all duration-300 border-slate-200",
                    status === 'syncing' ? "bg-blue-50 text-blue-600 border-blue-200" :
                        status === 'success' ? "bg-emerald-50 text-emerald-600 border-emerald-200" :
                            status === 'error' ? "bg-rose-50 text-rose-600 border-rose-200" :
                                "bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                )}
                disabled={status === 'syncing'}
            >
                <div className="flex items-center gap-2">
                    {status === 'syncing' && <RefreshCw size={14} className="animate-spin" />}
                    {status === 'success' && <CheckCircle size={14} />}
                    {status === 'error' && <AlertCircle size={14} />}
                    {status === 'idle' && <Cloud size={14} />}

                    <span className="font-medium text-xs">
                        {status === 'idle' ? 'Sync' :
                            status === 'syncing' ? 'Syncing...' :
                                status === 'success' ? 'Up to date' : 'Retry'}
                    </span>
                </div>
            </Button>

            <Button
                variant="ghost"
                size="sm"
                title="Force Push Local Data to Drive/Mobile (Resets Drive Events). Use this to initialize the mobile app or fix sync issues."
                onClick={async () => {
                    if (!window.confirm("⚠️ Force Push to Mobile?\n\nThis will DELETE existing Drive events and replace them with 4 Snapshot files (Products, Customers, Invoices, Expenses).\n\nUse this to initialize the mobile app.\n\nContinue?")) return;

                    const toastId = toast.loading("Pushing snapshots...");
                    try {
                        const res = await syncService.pushAllData(true);
                        toast.success(res.message, { id: toastId });
                        setLastSynced(new Date());
                    } catch (e) {
                        toast.error("Push failed: " + e.message, { id: toastId });
                    }
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 h-auto text-slate-500 hover:text-blue-600 hover:bg-blue-50/50 rounded-lg border border-transparent hover:border-blue-100 transition-all group"
            >
                <Cloud size={14} className="opacity-70 group-hover:opacity-100" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Force Push</span>
            </Button>
        </div >
    );
};

export default SyncButton;
