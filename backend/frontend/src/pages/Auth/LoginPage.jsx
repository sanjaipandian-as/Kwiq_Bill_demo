import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { Card } from "../../components/ui/Card";
import { Lock, AlertCircle, WifiOff, Clock } from "lucide-react";
import PrivacyPolicyModal from "../../components/PrivacyPolicyModal";
import logoImage from "../../assets/logo.png";

const LoginPage = () => {
  const { authStatus, loginWithGoogle, setTokenAndAuthenticate, daysUntilExpiry } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState("");
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const from = location.state?.from?.pathname || "/";

  // Track online/offline status
  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  // ✅ Redirect AFTER auth succeeds
  useEffect(() => {
    if (authStatus === "authenticated") {
      navigate(from, { replace: true });
    }
  }, [authStatus, from, navigate]);

  // ✅ Listen for Electron Google Auth Token
  useEffect(() => {
    if (window.electron) {
      window.electron.onGoogleAuthSuccess((token) => {
        console.log("✅ Received token from Electron, authenticating...");
        setTokenAndAuthenticate(token);
      });
    }
  }, [setTokenAndAuthenticate]);

  const isExpired = authStatus === "token-expired";

  return (
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-2 bg-slate-50">

      {/* Left Side: Logo Area */}
      <div className="hidden md:flex flex-col items-center justify-center bg-[#050505] p-12 relative overflow-hidden">
        {/* Decorative background blur blobs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-[100px] animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '1.5s' }}></div>

        <img
          src={logoImage}
          alt="Kwiq Bill Logo"
          className="w-full max-w-md h-auto object-contain drop-shadow-2xl z-10"
        />
        <div className="z-10 mt-8 text-center space-y-2">
          <h2 className="text-white text-3xl font-bold tracking-tight">Welcome to Kwiqbill</h2>
          <p className="text-slate-400 font-medium tracking-wide">Minimalistic Offline-First Invoicing</p>
        </div>
      </div>

      {/* Right Side: Login Form Area */}
      <div className="flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-8 space-y-6 bg-white shadow-xl text-center border-0 ring-1 ring-slate-200">

          {/* Mobile Logo Fallback (Hidden on Desktop) */}
          <div className="md:hidden flex justify-center mb-4">
            <div className="bg-[#050505] p-4 rounded-2xl w-full flex justify-center items-center shadow-inner">
              <img src={logoImage} alt="Kwiq Bill Logo" className="w-48 h-auto object-contain" />
            </div>
          </div>

          <div className="space-y-2">
            <div className="mx-auto bg-blue-600 text-white p-3 rounded-full w-fit shadow-md shadow-blue-500/20">
              <Lock size={24} />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Sign in</h1>
            <p className="text-slate-500">Continue with your Google account</p>
          </div>

          {/* ── Token Expired Notice ── */}
          {isExpired && (
            <div className="bg-red-50 border border-red-200 p-4 rounded-lg text-left space-y-1">
              <div className="flex items-center gap-2 text-red-700 font-semibold text-sm">
                <Clock size={16} />
                Session Expired
              </div>
              <p className="text-xs text-red-600">
                Your offline session has expired. Please connect to the internet and sign in again to continue using the app.
              </p>
            </div>
          )}

          {/* ── Offline Warning ── */}
          {!isOnline && !isExpired && (
            <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg text-left space-y-1">
              <div className="flex items-center gap-2 text-amber-700 font-semibold text-sm">
                <WifiOff size={16} />
                No Internet Connection
              </div>
              <p className="text-xs text-amber-700">
                You are currently offline. An internet connection is required to sign in. Your existing session remains valid offline.
              </p>
            </div>
          )}

          {/* ── Default Backup Info (only when online and not expired) ── */}
          {isOnline && !isExpired && (
            <div className="bg-blue-50/50 p-4 rounded-lg text-left space-y-2 border border-blue-100">
              <h3 className="font-semibold text-blue-900 text-sm">Offline-Ready App</h3>
              <p className="text-xs text-blue-800">
                After signing in, the app works completely offline. Your session is valid for 30 days.
              </p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm flex items-center gap-2 justify-center">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <button
            onClick={() => {
              if (!isOnline) {
                setError("Internet connection required to sign in.");
                return;
              }
              try {
                loginWithGoogle();
              } catch (err) {
                console.error("Google Login Error:", err);
                setError(err.message || "Unable to start Google login.");
              }
            }}
            disabled={!isOnline}
            className={`w-full h-11 rounded-lg font-medium transition shadow-sm text-white flex items-center justify-center gap-2 ${isOnline
              ? "bg-slate-900 hover:bg-slate-800 cursor-pointer"
              : "bg-slate-300 cursor-not-allowed"
              }`}
            title={!isOnline ? "Internet connection required" : ""}
          >
            {isOnline ? "Sign in with Google" : "Offline — Cannot Sign In"}
          </button>

          <div className="pt-4 border-t border-slate-100 mt-6">
            <button
              onClick={() => setShowPrivacy(true)}
              className="text-xs text-slate-500 hover:text-slate-800 font-medium transition-colors"
            >
              Privacy &amp; Data Security Policy
            </button>
          </div>
        </Card>
      </div>

      <PrivacyPolicyModal
        isOpen={showPrivacy}
        onClose={() => setShowPrivacy(false)}
      />
    </div>
  );
};

export default LoginPage;
