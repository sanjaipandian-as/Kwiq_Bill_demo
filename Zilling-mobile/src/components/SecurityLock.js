import React, { useEffect, useState, useRef } from 'react';
import { AppState, View, Text, StyleSheet, Modal, AppStateStatus } from 'react-native';

const INACTIVITY_TIMEOUT = 60000; // 60 seconds

export default function SecurityLock({ children }) {
  const appState = useRef(AppState.currentState);
  const [isLocked, setIsLocked] = useState(false);
  const [appStateVisible, setAppStateVisible] = useState(appState.current);
  
  const inactivityTimer = useRef(null);

  const lockApp = () => {
    // Here we would also dispatch an action to clear sensitive memory slices
    setIsLocked(true);
  };

  const resetInactivityTimer = () => {
    if (inactivityTimer.current) {
      clearTimeout(inactivityTimer.current);
    }
    // Only set timer if we are in foreground and not already locked
    if (appStateVisible === 'active' && !isLocked) {
        inactivityTimer.current = setTimeout(() => {
            lockApp();
        }, INACTIVITY_TIMEOUT);
    }
  };

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // App has come to the foreground!
        // It's up to the user to unlock it
      } else if (nextAppState === 'background') {
        // Immediately lock and wipe RAM when going to background
        lockApp();
      }

      appState.current = nextAppState;
      setAppStateVisible(appState.current);
      resetInactivityTimer();
    });

    // Start initial timer
    resetInactivityTimer();

    return () => {
      subscription.remove();
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    };
  }, [appStateVisible, isLocked]);

  return (
    <View style={styles.container} onTouchStart={resetInactivityTimer}>
      {children}
      <Modal visible={isLocked} transparent={false} animationType="fade">
        <View style={styles.lockedContainer}>
          <Text style={styles.lockText}>App Locked</Text>
          <Text style={styles.subText}>Return to settings or use biometrics to unlock.</Text>
          {/* A PIN keypad would go here */}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  lockedContainer: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center'
  },
  lockText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8
  },
  subText: {
    color: '#aaa',
    fontSize: 14
  }
});
