import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { AlertTriangle, X, WifiOff, RefreshCw } from "lucide-react";

/**
 * TokenExpiryBanner
 * Shows a sticky warning below the title bar when the session is about to expire.
 * Only renders when authenticated.
 */
const TokenExpiryBanner = () => {
    const { authStatus, daysUntilExpiry, isOffline } = useAuth();
    const [dismissed, setDismissed] = useState(false);

    // Only show when authenticated
    if (authStatus !== "authenticated") return null;
    if (dismissed) return null;
    if (daysUntilExpiry === null) return null;

    // Only show if ≤ 7 days remaining
    if (daysUntilExpiry > 7) return null;

    const isUrgent = daysUntilExpiry <= 2;
    const isExpiringSoon = daysUntilExpiry <= 7;

    const handleRenewClick = () => {
        // Open Google auth in a new window (requires internet)
        // Use environment variable for backend URL
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
        window.open(`${apiUrl}/auth/google`, "_blank");
    };

    const bgClass = isUrgent
        ? "bg-red-600 text-white"
        : "bg-amber-500 text-white";

    const expiryText =
        daysUntilExpiry === 0
            ? "Your session expires today!"
            : daysUntilExpiry === 1
                ? "Your session expires tomorrow!"
                : `Your session expires in ${daysUntilExpiry} days.`;

    return (
        <div
            className={`w-full z-50 flex items-center justify-between px-4 py-2 text-sm font-medium shadow-md ${bgClass}`}
            style={{ minHeight: "36px" }}
        >
            {/* Left side */}
            <div className="flex items-center gap-2 flex-1 min-w-0">
                {isOffline ? (
                    <WifiOff size={15} className="shrink-0" />
                ) : (
                    <AlertTriangle size={15} className="shrink-0" />
                )}
                <span className="truncate">
                    {isOffline && "⚠️ Offline Mode — "}
                    {expiryText}{" "}
                    <span className="opacity-90 font-normal">
                        Connect to internet and sign in again to renew.
                    </span>
                </span>
            </div>

            {/* Right side: Renew + Dismiss */}
            <div className="flex items-center gap-3 ml-4 shrink-0">
                <button
                    onClick={handleRenewClick}
                    className="flex items-center gap-1 text-white underline underline-offset-2 hover:opacity-80 transition font-semibold text-xs"
                    title="Renew your session (internet required)"
                >
                    <RefreshCw size={13} />
                    Renew Now
                </button>
                <button
                    onClick={() => setDismissed(true)}
                    className="hover:opacity-70 transition"
                    title="Dismiss this warning"
                >
                    <X size={15} />
                </button>
            </div>
        </div>
    );
};

export default TokenExpiryBanner;
