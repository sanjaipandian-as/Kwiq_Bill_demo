import { useEffect, useRef } from 'react';

const useKeyboardShortcuts = (keyMap) => {
    // 1. Keep a mutable ref to the latest keyMap
    // This allows the event listener to access the *latest* handlers without needing to re-bind
    // the DOM listener every time the component re-renders.
    const savedKeyMap = useRef(keyMap);

    // Update ref whenever keyMap changes (which is on every render usually)
    useEffect(() => {
        savedKeyMap.current = keyMap;
    }, [keyMap]);

    useEffect(() => {
        const handleKeyDown = (event) => {
            // Check if input is focused (ignore keys if typing in input, unless it's a function key)
            const tagName = document.activeElement.tagName.toLowerCase();
            const isInputFocused = tagName === 'input' || tagName === 'textarea';

            // Allow F-keys and shortcuts (Alt/Ctrl) even in inputs
            // Also allow Delete and Arrow keys for grid navigation
            const isGridNavigationKey = ['Delete', 'ArrowUp', 'ArrowDown'].includes(event.key);
            
            // Logic restored to original matching pattern for safety
            if (event.key.startsWith('F') || event.altKey || (event.ctrlKey && ['p', 'm', 't', 'w'].includes(event.key.toLowerCase()))) {
                event.preventDefault();
            } else if (isInputFocused && !isGridNavigationKey) {
                // If typing in input and not a special hotkey or grid navigation key, let it behave normally.
                return;
            }

            // Construct key identifier (e.g., "Ctrl+S", "F2", "Enter")
            let key = event.key;
            if (event.ctrlKey && key !== 'Control') key = `Ctrl+${key.toUpperCase()}`;
            if (event.altKey && key !== 'Alt') key = `Alt+${key.toUpperCase()}`;
            if (event.shiftKey && key !== 'Shift') key = `Shift+${key.toUpperCase()}`;

            // Check match from Ref
            const currentMap = savedKeyMap.current;
            const handler = currentMap[key] || currentMap[event.key];

            if (handler) {
                // Prevent default for grid navigation keys
                if (isGridNavigationKey) {
                    event.preventDefault();
                }
                handler(event);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, []); // Empty dependency array -> stable listener!
};

export default useKeyboardShortcuts;
