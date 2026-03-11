import React, { createContext, useContext, useState, useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { useToast } from './ToastContext'; // Make sure to use ToastContext if available

const NetworkContext = createContext();

export const useNetwork = () => useContext(NetworkContext);

export const NetworkProvider = ({ children }) => {
    const [isConnected, setIsConnected] = useState(true);
    const [wasOffline, setWasOffline] = useState(false);
    const { showToast } = useToast();

    useEffect(() => {
        const unsubscribe = NetInfo.addEventListener(state => {
            const online = state.isConnected === true;

            if (!online && isConnected) {
                // Just went offline
                setWasOffline(true);
                showToast("You are offline. Data will be saved locally and synced later.", "warning");
            } else if (online && !isConnected && wasOffline) {
                // Just came back online
                showToast("Back online! Resuming pending syncs...", "success");
            }

            setIsConnected(online);
        });

        return () => unsubscribe();
    }, [isConnected, wasOffline]);

    return (
        <NetworkContext.Provider value={{ isConnected, wasOfflinePreviously: wasOffline, setWasOffline }}>
            {children}
        </NetworkContext.Provider>
    );
};
