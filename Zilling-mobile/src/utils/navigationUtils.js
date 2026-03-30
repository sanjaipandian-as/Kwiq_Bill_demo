import { CommonActions } from '@react-navigation/native';

let lastNavTime = 0;
const NAV_DEBOUNCE_MS = 500;

/**
 * Debounced navigation helper to prevent rapid double-taps 
 * from freezing the app or corrupting navigation state.
 */
export const debouncedNavigate = (navigation, screen, params = {}) => {
  const now = Date.now();
  if (now - lastNavTime < NAV_DEBOUNCE_MS) {
    console.log('[Navigation] Debounced: Rapid click ignored.');
    return;
  }
  lastNavTime = now;
  navigation.navigate(screen, params);
};

/**
 * Debounced tab navigation helper.
 */
export const debouncedTabNavigate = (navigation, routeName) => {
  const now = Date.now();
  if (now - lastNavTime < NAV_DEBOUNCE_MS) {
      console.log('[Navigation] Tab Debounced: Rapid click ignored.');
      return;
  }
  lastNavTime = now;
  navigation.navigate(routeName);
};
