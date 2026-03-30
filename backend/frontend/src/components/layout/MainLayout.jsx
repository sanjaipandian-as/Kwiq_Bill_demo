import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import { Drawer } from '../ui/Drawer';
import { Menu } from 'lucide-react';
import { Button } from '../ui/Button';

const MainLayout = () => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const location = useLocation();

    // Close mobile menu on route change
    useEffect(() => {
        setIsMobileMenuOpen(false);
    }, [location.pathname]);

    return (
        <div className="flex h-full bg-app overflow-hidden">
            {/* Desktop Sidebar (Hidden on mobile) with Black Border */}
            <div
                className={`hidden md:flex h-full transition-all duration-300 ease-in-out border-r-2 border-black ${isSidebarOpen ? 'w-56' : 'w-20'}`}
            >
                <Sidebar isOpen={isSidebarOpen} toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />
            </div>

            {/* Mobile Drawer Sidebar */}
            <Drawer
                isOpen={isMobileMenuOpen}
                onClose={() => setIsMobileMenuOpen(false)}
                title="Menu"
                width="w-64"
                className="p-0"
            >
                <div className="h-full">
                    {/* Pass isOpen=true always for the mobile drawer version so texts are visible */}
                    <Sidebar isOpen={true} />
                </div>
            </Drawer>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col h-full overflow-hidden">
                {/* Mobile Header */}
                <header className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-theme z-10">
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setIsMobileMenuOpen(true)}
                            className="-ml-2"
                        >
                            <Menu size={24} className="text-slate-700" />
                        </Button>
                        <span className="font-semibold text-lg text-slate-800">Kwiqbill</span>
                    </div>
                </header>

                <main className="flex-1 overflow-auto relative">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default MainLayout;
