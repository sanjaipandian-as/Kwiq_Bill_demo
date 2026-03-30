import React from 'react';
import { NavLink } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { useAuth } from '../../context/AuthContext';
import {
    LayoutDashboard,
    Receipt,
    Package,
    Users,
    FileText,
    BarChart3,
    Wallet,
    Settings,
    ScanBarcode,
    LogOut,
    Menu
} from 'lucide-react';
import { useNavigate } from "react-router-dom";

const Sidebar = ({ isOpen = true, toggleSidebar, isMobile, onCloseMobile }) => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const handleLogout = async () => {
        await logout();
        navigate("/login", { replace: true });
    };
    const navItems = [
        { label: 'Dashboard', icon: LayoutDashboard, path: '/' },
        { label: 'Billing', icon: Receipt, path: '/billing' },
        { label: 'Products', icon: Package, path: '/products' },
        { label: 'Customers', icon: Users, path: '/customers' },
        { label: 'Invoices', icon: FileText, path: '/invoices' },
        { label: 'Reports', icon: BarChart3, path: '/reports' },
        { label: 'GST Reports', icon: FileText, path: '/gst-reports' },
        { label: 'Expenses', icon: Wallet, path: '/expenses' },
        { label: 'Settings', icon: Settings, path: '/settings' },
        { label: 'Barcode', icon: ScanBarcode, path: '/barcode' },
    ];

    const userName = user?.name || 'User';
    const userEmail = user?.email || '';
    const userInitials = userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

    return (
        <div className="flex h-full w-full flex-col border-r border-black bg-white shadow-sm">
            {/* Logo Area */}
            {/* Logo Area */}
            <div className={cn("flex h-16 items-center border-b border-theme transition-all", isOpen ? "justify-between px-4" : "justify-center px-0")}>
                <div
                    className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={toggleSidebar}
                    aria-label="Toggle sidebar"
                >
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-main text-white shadow-sm">
                        <Receipt size={20} strokeWidth={2.5} />
                    </div>
                    {isOpen && (
                        <span className="text-xl font-bold text-body-primary tracking-tight">KWIQBILL</span>
                    )}
                </div>
                {/* Mobile Close Toggle */}
                <div className="flex items-center gap-2">
                    {onCloseMobile && (
                        <button
                            onClick={onCloseMobile}
                            className="md:hidden p-1.5 rounded-md hover:bg-slate-100 text-slate-600 hover:text-body-primary transition-colors"
                        >
                            <LogOut size={18} className="rotate-180" /> {/* temporary icon or X */}
                        </button>
                    )}
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
                {navItems.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive }) =>
                            cn(
                                "flex items-center gap-3 rounded-lg py-2.5 text-sm font-medium transition-all duration-200",
                                isOpen ? "px-3" : "justify-center px-0",
                                isActive
                                    ? "bg-slate-100 text-primary-main shadow-sm"
                                    : "text-body-secondary hover:bg-slate-50 hover:text-body-primary"
                            )
                        }
                        title={!isOpen ? item.label : undefined}
                        onClick={() => onCloseMobile && onCloseMobile()}
                    >
                        {({ isActive }) => (
                            <>
                                <item.icon
                                    size={20}
                                    className={cn("transition-colors flex-shrink-0", isActive ? "text-primary-main" : "text-slate-400 group-hover:text-slate-600")}
                                    strokeWidth={isActive ? 2.5 : 2}
                                />
                                {isOpen && <span>{item.label}</span>}
                            </>
                        )}
                    </NavLink>
                ))}
            </nav>

            {/* User / Footer */}
            <div className={cn("border-t border-theme", isOpen ? "p-4" : "p-2")}>
                <div className={cn(
                    "flex items-center transition-all duration-200",
                    isOpen
                        ? "gap-3 rounded-lg bg-slate-50 p-3 shadow-inner border border-slate-100"
                        : "flex-col justify-center gap-2"
                )}>
                    <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-full bg-primary-main border-2 border-white shadow-sm flex items-center justify-center text-white font-semibold text-sm">
                        {userInitials || 'U'}
                    </div>
                    {isOpen && (
                        <div className="flex-1 overflow-hidden min-w-0">
                            <p className="truncate text-sm font-semibold text-body-primary">{userName}</p>
                            <p className="truncate text-xs text-body-secondary">{userEmail || 'Store Manager'}</p>
                        </div>
                    )}
                    <button
                        onClick={handleLogout}
                        className={cn(
                            "text-slate-400 hover:text-red-600 transition-colors rounded-md hover:bg-red-50 flex-shrink-0",
                            isOpen ? "p-1.5" : "p-2 hover:bg-transparent"
                        )}
                        title="Logout"
                        aria-label="Logout"
                    >
                        <LogOut size={isOpen ? 18 : 20} />
                    </button>
                </div>
            </div>
        </div >
    );
};

export default Sidebar;
