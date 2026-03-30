import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const ScrollToTop = () => {
    const { pathname } = useLocation();

    useEffect(() => {
        // 1. Scroll window (for global/auth pages)
        window.scrollTo(0, 0);

        // 2. Scroll dashboard main content if present
        const mainContent = document.querySelector('main');
        if (mainContent) {
            mainContent.scrollTo(0, 0);
        }
    }, [pathname]);

    return null;
};

export default ScrollToTop;
