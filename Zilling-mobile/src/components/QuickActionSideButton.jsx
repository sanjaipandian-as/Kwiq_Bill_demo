import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Pressable,
  PanResponder,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Scan,
  FilePlus,
  ReceiptText,
  PackagePlus,
  UserPlus,
  ShieldCheck,
  Save,
  BarChart3,
  Headset,
  ChevronLeft,
  LayoutGrid,
} from 'lucide-react-native';

const { width, height } = Dimensions.get('window');

const QuickActionSideButton = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [isOpen, setIsOpen] = useState(false);
  const animation = useRef(new Animated.Value(0)).current;

  // Draggable position
  const panY = useRef(new Animated.Value(height * 0.4)).current;
  const [isInHeader, setIsInHeader] = useState(false);

  // Monitor position for color changes
  useEffect(() => {
    const listener = panY.addListener(({ value }) => {
      // Threshold for the top black header section (approx 130px)
      if (value < 130) {
        setIsInHeader(true);
      } else {
        setIsInHeader(false);
      }
    });

    return () => panY.removeListener(listener);
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (e, gestureState) => {
        let newY = gestureState.moveY - 50; // Offset for centered handle
        
        // 🚀 BOUNDS PROTECTION: Respect insets (Notch & Nav Bar)
        const minY = insets.top + 10;
        const maxY = height - insets.bottom - 70;
        
        if (newY < minY) newY = minY;
        if (newY > maxY) newY = maxY;
        
        panY.setValue(newY);
      },
      onPanResponderRelease: (e, gestureState) => {
        // If movement was minimal, treat as a tap
        if (Math.abs(gestureState.dy) < 5 && Math.abs(gestureState.dx) < 5) {
          toggleMenu();
        }
      },
    })
  ).current;

  const toggleMenu = () => {
    const toValue = isOpen ? 0 : 1;
    setIsOpen(!isOpen);
    Animated.spring(animation, {
      toValue,
      friction: 8,
      tension: 40,
      useNativeDriver: true,
    }).start();
  };

  const navigateTo = (screen, params = {}) => {
    toggleMenu();
    setTimeout(() => {
      // 🛡️ INTELLIGENT ROUTING: 
      // Screens in MainTabs must be navigated via 'Main' stack screen 
      // to keep the bottom navigation bar visible.
      const tabScreens = ['Billing', 'Products', 'Customers', 'Settings'];
      if (tabScreens.includes(screen)) {
        navigation.navigate('Main', { 
            screen,
            params // Pass inner params (like { tab: 'access' } for Settings)
        });
      } else {
        navigation.navigate(screen, params);
      }
    }, 150);
  };

  const translateX = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [90, 0],
  });

  const actions = [
    { label: 'Scan', icon: Scan, screen: 'Barcode' },
    { label: 'Bill', icon: FilePlus, screen: 'Billing' },
    { label: 'Expense', icon: ReceiptText, screen: 'Expenses' },
    { label: 'Stock', icon: PackagePlus, screen: 'Products' },
    { label: 'Parties', icon: UserPlus, screen: 'Customers' },
    { label: 'Staff', icon: ShieldCheck, screen: 'Settings', params: { tab: 'access' } },
    { label: 'Backup', icon: Save, screen: 'Settings', params: { tab: 'backup' } },
    { label: 'Reports', icon: BarChart3, screen: 'Reports' },
    { label: 'Help', icon: Headset, screen: 'Settings', params: { tab: 'contact' } },
  ];

  return (
    <View style={styles.container} pointerEvents="box-none">
      {isOpen && <Pressable style={styles.backdrop} onPress={toggleMenu} />}

      <Animated.View style={[
        styles.menuContainer, 
        { 
            transform: [{ translateX }],
            top: insets.top + 20,
            bottom: insets.bottom + 20
        }
      ]}>
        <View style={styles.menuContent}>
          <View style={styles.actionsColumn}>
            {actions.map((action, index) => (
              <TouchableOpacity
                key={index}
                style={styles.actionItem}
                onPress={() => navigateTo(action.screen, action.params)}
              >
                <View style={styles.iconBox}>
                   <action.icon size={22} color="#fff" strokeWidth={2} />
                </View>
                <Text style={styles.itemLabel} numberOfLines={1}>{action.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Animated.View>

      {!isOpen && (
        <Animated.View 
          style={[
            styles.handleWrapper, 
            { top: panY }
          ]} 
          {...panResponder.panHandlers}
        >
          <View style={[
            styles.handleBar,
            isInHeader && styles.handleBarInHeader
          ]}>
            <ChevronLeft size={16} color={isInHeader ? "#000" : "#fff"} strokeWidth={3} />
          </View>
        </Animated.View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 9999 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.05)' },
  handleWrapper: {
    position: 'absolute',
    right: 0,
    width: 24,
    height: 100,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  handleBar: {
    width: 24,
    height: 60,
    backgroundColor: '#000',
    borderTopLeftRadius: 15,
    borderBottomLeftRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 4,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 8,
  },
  handleBarInHeader: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  menuContainer: {
    position: 'absolute',
    top: 40,
    right: 0,
    bottom: 40,
    width: 80,
    elevation: 30,
    shadowColor: '#000',
    shadowOffset: { width: -10, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
  },
  menuContent: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    borderTopLeftRadius: 30,
    borderBottomLeftRadius: 30,
    overflow: 'hidden',
    paddingVertical: 10,
    borderWidth: 1.5,
    borderRightWidth: 0,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  actionsColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  actionItem: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 3,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  itemLabel: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '900',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    opacity: 0.8,
  },
});

export default QuickActionSideButton;






