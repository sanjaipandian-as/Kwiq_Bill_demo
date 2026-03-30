import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from "react";
import services from "../services/api";

const AuthContext = createContext(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
};

/**
 * Decode a JWT without verifying the signature (client-side only).
 * Returns the payload or null on failure.
 */
function decodeJWT(token) {
  try {
    const base64Url = token.split(".")[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

/**
 * Returns days remaining until token expiry.
 * Negative = already expired.
 */
function getDaysUntilExpiry(token) {
  const payload = decodeJWT(token);
  if (!payload?.exp) return null;
  const nowMs = Date.now();
  const expMs = payload.exp * 1000;
  return Math.floor((expMs - nowMs) / (1000 * 60 * 60 * 24));
}

/**
 * Returns the expiry Date of a token, or null.
 */
function getTokenExpiresAt(token) {
  const payload = decodeJWT(token);
  if (!payload?.exp) return null;
  return new Date(payload.exp * 1000);
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [authStatus, setAuthStatus] = useState("loading");
  const [isOffline, setIsOffline] = useState(false);
  const [tokenExpiresAt, setTokenExpiresAt] = useState(null);
  const [daysUntilExpiry, setDaysUntilExpiry] = useState(null);

  // Update expiry info from current token
  const refreshExpiryInfo = useCallback((token) => {
    if (!token) {
      setTokenExpiresAt(null);
      setDaysUntilExpiry(null);
      return;
    }
    setTokenExpiresAt(getTokenExpiresAt(token));
    setDaysUntilExpiry(getDaysUntilExpiry(token));
  }, []);

  // ✅ Check auth state on app load with Retry Logic + Offline Fallback
  useEffect(() => {
    let retries = 0;
    const maxRetries = 50; // 15 seconds (300ms * 50)

    const checkAuth = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          // If there's no token, don't even bother hitting the server
          setUser(null);
          setAuthStatus("unauthenticated");
          return;
        }

        const res = await services.auth.getCurrentUser();
        const userData = res.data;
        setUser(userData);
        setAuthStatus("authenticated");
        setIsOffline(false);

        // Cache user profile for offline use
        localStorage.setItem("user", JSON.stringify(userData));

        // Update expiry info
        refreshExpiryInfo(token);

        // Send token to Electron for auto-backup timer on initial load
        if (window.electron?.setToken) {
          window.electron.setToken(token);
        }
      } catch (err) {
        // ── Network / backend unreachable: retry then try offline fallback ──
        if (err.code === "ERR_NETWORK") {
          if (retries < maxRetries) {
            retries++;
            setTimeout(checkAuth, 300);
            return;
          }

          // Retries exhausted – try offline fallback
          const token = localStorage.getItem("token");
          if (token) {
            const days = getDaysUntilExpiry(token);

            if (days !== null && days > 0) {
              // Token is still valid → authenticate offline
              const cachedUser = localStorage.getItem("user");
              const userData = cachedUser ? JSON.parse(cachedUser) : { name: "Offline User" };
              setUser(userData);
              setAuthStatus("authenticated");
              setIsOffline(true);
              refreshExpiryInfo(token);
              console.log(`✅ Offline mode: token valid for ${days} more day(s).`);

              // Still send token to Electron (for backup timer awareness)
              if (window.electron?.setToken) {
                window.electron.setToken(token);
              }
              return;
            } else if (days !== null && days <= 0) {
              // Token has expired while offline
              console.warn("❌ Offline mode: token has expired. Forcing logout.");
              localStorage.removeItem("token");
              localStorage.removeItem("user");
              setUser(null);
              setAuthStatus("token-expired");
              return;
            }
          }

          // No token at all
          setUser(null);
          setAuthStatus("unauthenticated");
          return;
        }

        // ── Auth errors (401) ──
        if (err.response?.status !== 401) {
          console.error("Auth check failed", err);
        }
        setUser(null);
        setAuthStatus("unauthenticated");
      }
    };

    checkAuth();
  }, [refreshExpiryInfo]);

  // ── Periodic expiry check (every hour while app is open) ──
  useEffect(() => {
    const intervalId = setInterval(() => {
      const token = localStorage.getItem("token");
      if (!token) return;
      const days = getDaysUntilExpiry(token);
      setDaysUntilExpiry(days);
      if (days !== null && days <= 0 && authStatus === "authenticated") {
        console.warn("Token expired during session – logging out.");
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        setUser(null);
        setAuthStatus("token-expired");
        if (window.electron?.setToken) window.electron.setToken(null);
      }
    }, 60 * 60 * 1000); // every hour

    return () => clearInterval(intervalId);
  }, [authStatus]);

  // ✅ Start Google OAuth (backend handles everything)
  // CRITICAL: Backend runs on port 5001, NOT 5000!
  const loginWithGoogle = () => {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    window.open(`${apiUrl}/auth/google`, "_blank");
  };

  // ✅ Logout (backend-side)
  const logout = useCallback(async () => {
    try {
      await services.auth.logout();
    } finally {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      setUser(null);
      setAuthStatus("unauthenticated");
      setIsOffline(false);
      setTokenExpiresAt(null);
      setDaysUntilExpiry(null);

      // Notify Electron to stop auto-backup timer
      if (window.electron?.setToken) {
        window.electron.setToken(null);
      }
    }
  }, []);

  // ✅ Set token and authenticate (for Electron OAuth callback)
  const setTokenAndAuthenticate = useCallback(async (token) => {
    localStorage.setItem("token", token);
    try {
      const res = await services.auth.getCurrentUser();
      const userData = res.data;
      localStorage.setItem("user", JSON.stringify(userData));
      setUser(userData);
      setAuthStatus("authenticated");
      setIsOffline(false);
      refreshExpiryInfo(token);

      // Send token to Electron for auto-backup timer
      if (window.electron?.setToken) {
        window.electron.setToken(token);
      }
    } catch (err) {
      console.error("Failed to authenticate with token:", err);
      localStorage.removeItem("token");
      setAuthStatus("unauthenticated");
    }
  }, [refreshExpiryInfo]);

  // ✅ Direct Login Helper (for OAuth / Instant Access)
  const loginSuccess = useCallback((token, userData) => {
    localStorage.setItem("token", token);
    if (userData) {
      localStorage.setItem("user", JSON.stringify(userData));
      setUser(userData);
    }
    setAuthStatus("authenticated");
    setIsOffline(false);
    refreshExpiryInfo(token);

    if (!userData) {
      services.auth.getCurrentUser()
        .then((res) => {
          setUser(res.data);
          localStorage.setItem("user", JSON.stringify(res.data));
        })
        .catch(console.error);
    }
  }, [refreshExpiryInfo]);

  const value = useMemo(() => ({
    user,
    authStatus,       // "loading" | "authenticated" | "unauthenticated" | "token-expired"
    isOffline,
    tokenExpiresAt,
    daysUntilExpiry,
    logout,
    loginSuccess,
    loginWithGoogle,
    setTokenAndAuthenticate,
  }), [user, authStatus, isOffline, tokenExpiresAt, daysUntilExpiry, logout, loginSuccess, setTokenAndAuthenticate]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
