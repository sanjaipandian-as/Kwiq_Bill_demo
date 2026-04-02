import * as NavigationBar from 'expo-navigation-bar';
import { useEffect } from 'react';
import { Platform } from 'react-native';

/**
 * Optimized Navigation Bar hook for Modals/Drawers
 * @param {string} color - Background color
 * @param {'light' | 'dark'} buttonStyle - Icon style ('light' for white icons, 'dark' for black icons)
 * @param {boolean} trigger - Whether to apply the color changes
 */
export function useNavBarColor(color = '#ffffff', buttonStyle = 'dark', trigger = true) {
  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const updateSync = async () => {
      try {
        if (trigger) {
          const apply = async () => {
             // For Edge-to-Edge, 'transparent' + 'absolute' is the only way to avoid gray 
             const barColor = (color === '#ffffff' || color === 'white') ? '#00000000' : color;
             
             try { 
               if (NavigationBar.setPositionAsync) await NavigationBar.setPositionAsync('absolute');
               await NavigationBar.setBackgroundColorAsync(barColor); 
             } catch (e) {}

             await NavigationBar.setButtonStyleAsync(buttonStyle);

             if (NavigationBar.setEnforceNavigationBarContrast) {
               await NavigationBar.setEnforceNavigationBarContrast(false);
             }
          };

          await apply();
          // Persistent re-application for transition safety
          setTimeout(apply, 300);
          setTimeout(apply, 800);
          setTimeout(apply, 1500);
        }
      } catch (err) {}
    };

    updateSync();
  }, [trigger, color, buttonStyle]);
}
