import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Dimensions, Animated } from 'react-native';
const { createBottomTabNavigator } = require('@react-navigation/bottom-tabs');
import {
  LayoutDashboard,
  ReceiptText,
  Boxes,
  UserRound,
  Settings2,
  CloudSync
} from 'lucide-react-native';

import Dashboard from '../pages/Dashboard';
import Billing from '../pages/Billing/BillingPage';
import Products from '../pages/Products/ProductListScreen';
import Customers from '../pages/customers/CustomerPage';
import Settings from '../pages/Settings/SettingsPage';
import { useSettings } from '../context/SettingsContext';
import { debouncedTabNavigate } from '../utils/navigationUtils';
import { DeviceEventEmitter } from 'react-native';
import { SYNC_EVENTS } from '../services/OneWaySyncService';

const { width } = Dimensions.get('window');
const Tab = createBottomTabNavigator();

const SyncStatusBadge = () => {
    const { isUploading } = useSettings();
    const [isSyncing, setIsSyncing] = React.useState(false);
    const [opacity] = React.useState(new Animated.Value(0));

    React.useEffect(() => {
        const sub1 = DeviceEventEmitter.addListener(SYNC_EVENTS.SYNC_STARTED, () => setIsSyncing(true));
        const sub2 = DeviceEventEmitter.addListener(SYNC_EVENTS.SYNC_COMPLETED, () => setIsSyncing(false));
        return () => {
            sub1.remove();
            sub2.remove();
        };
    }, []);

    React.useEffect(() => {
        if (isUploading || isSyncing) {
            Animated.timing(opacity, { toValue: 1, duration: 400, useNativeDriver: true }).start();
        } else {
            Animated.timing(opacity, { toValue: 0, duration: 400, useNativeDriver: true }).start();
        }
    }, [isUploading, isSyncing]);

    return (
        <Animated.View style={[styles.syncBadge, { opacity }]}>
            <CloudSync color="#3b82f6" size={12} strokeWidth={2.5} />
            <Text style={styles.syncText}>{isSyncing ? "Checking Cloud..." : "Syncing Data..."}</Text>
        </Animated.View>
    );
};

const CustomTabBar = ({ state, descriptors, navigation }) => {
  return (
    <View style={styles.navWrapper}>
      <SyncStatusBadge />
      <View style={styles.dockInner}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const label = options.tabBarLabel !== undefined ? options.tabBarLabel : options.title !== undefined ? options.title : route.name;
          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              debouncedTabNavigate(navigation, route.name);
            }
          };

          const renderIcon = (isFocused) => {
            const iconProps = {
              color: isFocused ? '#ffffff' : '#94a3b8',
              size: isFocused ? 24 : 22,
              strokeWidth: isFocused ? 2.5 : 2
            };
            switch (route.name) {
              case 'Dashboard': return <LayoutDashboard {...iconProps} />;
              case 'Billing': return <ReceiptText {...iconProps} />;
              case 'Products': return <Boxes {...iconProps} />;
              case 'Customers': return <UserRound {...iconProps} />;
              case 'Settings': return <Settings2 {...iconProps} />;
              default: return null;
            }
          };

          return (
            <TouchableOpacity
              key={route.key}
              onPress={onPress}
              style={[styles.tabBtn, isFocused && styles.tabBtnActive]}
              activeOpacity={0.8}
            >
              <View style={[styles.iconBox, isFocused && styles.iconBoxActive]}>
                {renderIcon(isFocused)}
              </View>
              {isFocused && (
                <Text style={styles.activeLabel}>
                  {label === 'Billing' ? 'Bill' : label === 'Products' ? 'Stock' : label === 'Customers' ? 'Parties' : label}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

export default function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{ headerShown: false }}
      tabBar={props => <CustomTabBar {...props} />}
    >
      <Tab.Screen name="Dashboard" component={Dashboard} options={{ tabBarLabel: 'Home' }} />
      <Tab.Screen name="Billing" component={Billing} options={{ tabBarLabel: 'Bill' }} />
      <Tab.Screen name="Products" component={Products} options={{ tabBarLabel: 'Stock' }} />
      <Tab.Screen name="Customers" component={Customers} options={{ tabBarLabel: 'Parties' }} />
      <Tab.Screen name="Settings" component={Settings} options={{ tabBarLabel: 'Menu' }} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  navWrapper: {
    position: 'absolute',
    bottom: 0,
    width: width,
    backgroundColor: '#ffffff',
    paddingBottom: Platform.OS === 'ios' ? 34 : 10,
    borderTopWidth: 1.5,
    borderTopColor: '#f1f5f9',
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    height: Platform.OS === 'ios' ? 98 : 78,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.04,
    shadowRadius: 15,
    elevation: 8,
    overflow: 'hidden', // Ensures the curve clips the inner content
  },
  dockInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
  },
  tabBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    width: width / 5.2,
  },
  tabBtnActive: {
    // maybe minor vertical shift logic
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 12, // More squared with soft corners
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    backgroundColor: 'transparent',
  },
  iconBoxActive: {
    backgroundColor: '#000000',
    borderRadius: 14,
    // Intense bloom shadow for the square pill
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
  },
  activeLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: '#000000',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  syncBadge: {
    position: 'absolute',
    top: -30,
    right: 36,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  syncText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#3b82f6',
    marginLeft: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  }
});
