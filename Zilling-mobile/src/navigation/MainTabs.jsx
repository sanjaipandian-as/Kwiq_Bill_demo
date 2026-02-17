import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Dimensions } from 'react-native';
const { createBottomTabNavigator } = require('@react-navigation/bottom-tabs');
import {
  Home,
  ShoppingCart,
  Package,
  Users,
  Menu as MenuIcon
} from 'lucide-react-native';

import Dashboard from '../pages/Dashboard';
import Billing from '../pages/Billing/BillingPage';
import Products from '../pages/Products/ProductListScreen';
import Customers from '../pages/customers/CustomerPage';
import Settings from '../pages/Settings/SettingsPage';

const { width } = Dimensions.get('window');
const Tab = createBottomTabNavigator();

const CustomTabBar = ({ state, descriptors, navigation }) => {
  return (
    <View style={styles.tabBarContainer}>
      <View style={styles.bottomBar}>
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
              navigation.navigate(route.name);
            }
          };

          const renderIcon = (color, size) => {
            const iconProps = { color, size: size || 22, strokeWidth: isFocused ? 2.5 : 2 };
            switch (route.name) {
              case 'Dashboard': return <Home {...iconProps} />;
              case 'Billing': return <ShoppingCart {...iconProps} />;
              case 'Products': return <Package {...iconProps} />;
              case 'Customers': return <Users {...iconProps} />;
              case 'Settings': return <MenuIcon {...iconProps} />;
              default: return null;
            }
          };

          return (
            <TouchableOpacity
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              onPress={onPress}
              style={styles.tabItem}
              activeOpacity={0.7}
            >
              <View style={styles.iconContainer}>
                {renderIcon(isFocused ? '#000000' : '#94a3b8', isFocused ? 24 : 22)}
              </View>
              <Text style={[styles.tabLabel, { color: isFocused ? '#000000' : '#94a3b8', fontWeight: isFocused ? '800' : '600' }]}>
                {label}
              </Text>
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
  tabBarContainer: {
    width: width,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingBottom: Platform.OS === 'ios' ? 30 : 12,
  },
  bottomBar: {
    flexDirection: 'row',
    width: '100%',
    height: 64,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 32,
    marginBottom: 4,
  },
  tabLabel: {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
});

