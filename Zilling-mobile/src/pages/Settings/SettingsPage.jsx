import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, TouchableOpacity, Pressable, TextInput, Alert, ActivityIndicator, Platform, KeyboardAvoidingView, StatusBar, Linking, Dimensions, Image, Modal, Animated, PermissionsAndroid } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import DetailedInvoiceTemplate from './DetailedInvoiceTemplate';
import CompactInvoiceTemplate from './CompactInvoiceTemplate';
import MinimalInvoiceTemplate from './MinimalInvoiceTemplate';
import ClassicInvoiceTemplate from './ClassicInvoiceTemplate';
import ThermalInvoiceTemplate from './ThermalInvoiceTemplate';
import ProfessionalThermalTemplate from './ProfessionalThermalTemplate';
import ManagerPinGate from './ManagerPinGate';
import { BLEPrinter } from 'react-native-thermal-receipt-printer-image-qr';
import * as Device from 'expo-device';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import {
  Store,
  Calculator,
  Layout,
  Printer,
  Save,
  RotateCcw,
  Cloud,
  Plus,
  Trash2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Edit2,
  X,
  MapPin,
  Mail,
  Phone,
  Building,
  AlertCircle,
  LogOut,
  HelpCircle,
  MessageCircle,
  Send,
  Folder,
  Shield,
  Headset,
  ExternalLink,
  Globe,
  MessageSquare,
  FileText,
  Lock,
  CreditCard,
  Upload,
  Image as ImageIcon,
  Database,
  RefreshCw,
  LifeBuoy,
  Search,
  Smartphone,
  Link,
  Bluetooth,
  Zap,
  Clock,
  ShieldCheck,
  CheckCircle,
  User,
  Contact,
  Landmark,
  Fingerprint,
  Crown,
  BadgeCheck,
  Medal,
  Award,
  Gem,
  Sparkles,
  Menu,
  Activity,
  Users
} from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { useToast } from '../../context/ToastContext';
import { useCustomers } from '../../context/CustomerContext';
import { useProducts } from '../../context/ProductContext';
import { useTransactions } from '../../context/TransactionContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';
import services from '../../services/api';
import { testPrinter, resetPrinterConnection } from '../../utils/printUtils';
import { APP_VERSION } from '../../config/version';

const SettingsPage = ({ navigation, route }) => {

  // Trigger clear cache
  const { user, logout, refreshUser } = useAuth();
  const {
    settings, updateSettings, saveFullSettings, syncAllData, syncToCloud, backupDataToCloud,
    forceResync, repairSync, deepRepair, lastEventSyncTime, syncStatus, loading,
    queueLength, isUploading, isLogoUploading, estimatedUploadTime, isConnected, checkQueueStatus,
    addReceptionist, updateReceptionist, toggleReceptionistActive, deleteReceptionist
  } = useSettings();
  const { fetchCustomers } = useCustomers();
  const { fetchProducts } = useProducts();
  const { fetchTransactions } = useTransactions();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState('store');
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const [taxGroups, setTaxGroups] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [localSettings, setLocalSettings] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccessIcon, setShowSuccessIcon] = useState(false);
  const [isLogoutModalVisible, setIsLogoutModalVisible] = useState(false);
  const logoutFadeAnim = React.useRef(new Animated.Value(0)).current;
  const [isResyncModalVisible, setIsResyncModalVisible] = useState(false);
  const resyncFadeAnim = React.useRef(new Animated.Value(0)).current;
  const [isRepairModalVisible, setIsRepairModalVisible] = useState(false);
  const repairFadeAnim = React.useRef(new Animated.Value(0)).current;
  const [isPinVerified, setIsPinVerified] = useState(false);
  const [isChangingPin, setIsChangingPin] = useState(false);
  const previousPinRef = React.useRef(null);
  const [isDiscardModalVisible, setIsDiscardModalVisible] = useState(false);
  const discardFadeAnim = React.useRef(new Animated.Value(0)).current;
  const [isUserModalVisible, setIsUserModalVisible] = useState(false);
  const [userModalMode, setUserModalMode] = useState('add');
  const [editingUserId, setEditingUserId] = useState(null);
  const [userNameInput, setUserNameInput] = useState('');
  const [isPinResetModalVisible, setIsPinResetModalVisible] = useState(false);
  const pinResetFadeAnim = React.useRef(new Animated.Value(0)).current;
  const userModalFadeAnim = React.useRef(new Animated.Value(0)).current;

  // Bluetooth Printer States
  const [pairedDevices, setPairedDevices] = useState([]);
  const [foundDs, setFoundDs] = useState([]);
  const [bleOpend, setBleOpend] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isConnectingMac, setIsConnectingMac] = useState(null);
  const [guideLang, setGuideLang] = useState('en');
  const [isPreviewIGST, setIsPreviewIGST] = useState(false);
  const [isTestingPrinter, setIsTestingPrinter] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [backupLogs, setBackupLogs] = useState([]); // { msg, status }
  const [backupDone, setBackupDone] = useState(false);
  const [animDots, setAnimDots] = useState('');
  const backupLogsBufferRef = React.useRef([]);
  const backupLogsRef = React.useRef(null);
  const [showTerminal, setShowTerminal] = useState(false);

  // --- Swipe Navigation Logic ---
  const tabs = [
    { id: 'store', label: 'Store', icon: Store },
    { id: 'bank', label: 'Bank', icon: CreditCard },
    { id: 'tax', label: 'Tax', icon: Calculator },
    { id: 'invoice', label: 'Invoices', icon: Layout },
    { id: 'print', label: ' Print ', icon: Printer },
    { id: 'access', label: 'Staffs', icon: Users },
    { id: 'backup', label: 'Backups', icon: Save },
    { id: 'contact', label: 'Contact (KWIQ BILL TEAM)', icon: Headset },
    { id: 'logout', label: 'Logout', icon: LogOut },
  ];



  // Animate dots while backing up: '' -> '.' -> '..' -> '...'
  useEffect(() => {
    if (!isBackingUp) { setAnimDots(''); return; }
    const interval = setInterval(() => {
      setAnimDots(d => d.length >= 3 ? '' : d + '.');
    }, 400);
    return () => clearInterval(interval);
  }, [isBackingUp]);

  useEffect(() => {
    if (settings && !isEditing) {
      // Ensure localSettings has base structure to prevent property access crashes
      const robustSettings = {
        store: { address: {}, ...settings.store },
        bankDetails: { ...settings.bankDetails },
        tax: { taxGroups: [], ...settings.tax },
        invoice: { ...settings.invoice },
        security: { managerPin: null, ...settings.security },
        ...settings
      };
      setLocalSettings(JSON.parse(JSON.stringify(robustSettings)));
      if (settings?.tax?.taxGroups) {
        setTaxGroups(settings.tax.taxGroups);
      }
    }
  }, [settings, isEditing]);

  // Handle cross-page navigation (e.g. from Dashboard 'Upgrade' button)
  useEffect(() => {
    if (route?.params?.tab) {
      setActiveTab(route.params.tab);
    }
  }, [route?.params?.tab]);

  useFocusEffect(
    useCallback(() => {
      StatusBar.setBarStyle('light-content');
      if (Platform.OS === 'android') {
        StatusBar.setBackgroundColor('#000000');
      }
      if (activeTab === 'print') {
        initBluetooth();
      }
      // Auto-refresh user profile when settings page is focused
      refreshUser();
    }, [activeTab, initBluetooth, refreshUser])
  );

  useEffect(() => {
    if (activeTab === 'print') {
      initBluetooth();
    }
    // Reset PIN verification when leaving access tab
    if (activeTab !== 'access') {
      setIsPinVerified(false);
    }
  }, [activeTab]);

  const requestBluetoothPermissions = async (manual = false) => {
    if (Platform.OS === 'android') {
      try {
        const sdkVersion = Device.osVersion ? parseInt(Device.osVersion) : 0;
        if (sdkVersion >= 12) {
          const granted = await PermissionsAndroid.requestMultiple([
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          ]);

          const allGranted =
            granted['android.permission.BLUETOOTH_CONNECT'] === PermissionsAndroid.RESULTS.GRANTED &&
            granted['android.permission.BLUETOOTH_SCAN'] === PermissionsAndroid.RESULTS.GRANTED &&
            granted['android.permission.ACCESS_FINE_LOCATION'] === PermissionsAndroid.RESULTS.GRANTED;

          if (allGranted) {
            if (manual) showToast('Communication channels have been successfully established.', 'success', 3000, null, "Permissions Granted");
            return true;
          } else {
            if (manual) showToast('Access was partial or denied. Please adjust permissions in system settings.', 'error', 4000, null, "Access Restricted");
            else showToast('Bluetooth connectivity requires hardware access to discover printers.', 'error', 4000, null, "Permissions Required");
            return false;
          }
        } else {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
          );
          return granted === PermissionsAndroid.RESULTS.GRANTED;
        }
      } catch (err) {
        console.warn(err);
        return false;
      }
    }
    return true;
  };

  const initBluetooth = useCallback(async () => {
    try {
      const hasPermission = await requestBluetoothPermissions();
      if (!hasPermission) return;
      BLEPrinter.init().then(() => {
        setBleOpend(true);
        scanBluetoothDevices();
      }).catch((e) => {
        showToast('The Bluetooth engine failed to initialize. Please check your hardware.', 'error', 4000, null, "Engine Error");
      });
    } catch (e) {
      console.log('Error initializing Bluetooth:', e);
    }
  }, []);

  const scanBluetoothDevices = useCallback(async () => {
    setIsScanning(true);
    try {
      BLEPrinter.getDeviceList().then((devices) => {
        const mappedDevices = devices.map(d => ({
          name: d.device_name,
          address: d.inner_mac_address
        }));
        setFoundDs([]);
        setPairedDevices(mappedDevices);
      }, (er) => {
        setIsScanning(false);
        showToast('Airwaves scan interrupted: ' + (er?.message || er), 'error', 4000, null, "Scan Failed");
      });
    } catch (e) {
      console.log('Catch Scan error', e);
    } finally {
      setTimeout(() => { setIsScanning(false); }, 1500);
    }
  }, []);

  const connectToPrinter = useCallback((printer) => {
    setIsConnectingMac(printer.address);
    BLEPrinter.connectPrinter(printer.address).then((s) => {
      setIsConnectingMac(null);
      showToast(`Successfully paired with ${printer.name || printer.address}.`, 'success', 3500, null, "Printer Connected");
      // Save to local settings
      handleChange('invoice', 'selectedPrinter', {
        name: printer.name,
        address: printer.address
      });
      // Also update global settings immediately for live printer status
      updateSettings('invoice', {
        selectedPrinter: {
          name: printer.name,
          address: printer.address
        }
      });
      if (!isEditing) setIsEditing(true);
    }, (e) => {
      setIsConnectingMac(null);
      showToast(`Connection attempt failed: ${e?.message || e}`, 'error', 4000, null, "Pairing Error");
    });
  }, [isEditing]);

  const unpairPrinter = () => {
    handleChange('invoice', 'selectedPrinter', null);
    updateSettings('invoice', { selectedPrinter: null });
    if (!isEditing) setIsEditing(true);
  };

  const handleLogout = () => {
    if (queueLength > 0) {
      showToast(
        `You have ${queueLength} items pending upload. Please wait for the sync to complete to avoid data loss.`,
        "warning",
        6000,
        null,
        "Sync in Progress"
      );
      return;
    }

    setIsLogoutModalVisible(true);
    Animated.timing(logoutFadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  };

  const closeLogoutModal = () => {
    Animated.timing(logoutFadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      setIsLogoutModalVisible(false);
    });
  };

  const openPinResetModal = () => {
    setIsPinResetModalVisible(true);
    Animated.timing(pinResetFadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  };

  const closePinResetModal = () => {
    Animated.timing(pinResetFadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      setIsPinResetModalVisible(false);
    });
  };

  const confirmLogout = async () => {
    closeLogoutModal();
    await new Promise(r => setTimeout(r, 200));
    showToast("Disconnecting from secure session...", "info", 3000, null, "Signing Out");
    await logout();
  };

  const openResyncModal = () => {
    setIsResyncModalVisible(true);
    Animated.timing(resyncFadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  };

  const closeResyncModal = () => {
    Animated.timing(resyncFadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      setIsResyncModalVisible(false);
    });
  };

  const openRepairModal = () => {
    setIsRepairModalVisible(true);
    Animated.timing(repairFadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  };

  const closeRepairModal = () => {
    Animated.timing(repairFadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      setIsRepairModalVisible(false);
    });
  };

  const [isDeepRepairModalVisible, setIsDeepRepairModalVisible] = useState(false);
  const deepRepairFadeAnim = React.useRef(new Animated.Value(0)).current;

  // --- Settings Menu Toggle State ---
  const [isMenuExpanded, setIsMenuExpanded] = useState(false);
  const menuExpandAnim = React.useRef(new Animated.Value(0)).current;


  const openUserModal = (mode, id = null, initialName = '') => {
    setUserModalMode(mode);
    setEditingUserId(id);
    setUserNameInput(initialName);
    setIsUserModalVisible(true);
    Animated.timing(userModalFadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  };

  const closeUserModal = () => {
    Animated.timing(userModalFadeAnim, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => {
      setIsUserModalVisible(false);
      setUserNameInput('');
      setEditingUserId(null);
    });
  };

  const handleUserModalSubmit = () => {
    if (!userNameInput.trim()) return;
    if (userModalMode === 'add') {
      addReceptionist(userNameInput.trim());
      showToast(`${userNameInput.trim()} has been added.`, "success");
    } else {
      updateReceptionist(editingUserId, userNameInput.trim());
      showToast(`${userNameInput.trim()} has been updated.`, "success");
    }
    closeUserModal();
  };

  const toggleSettingsMenu = () => {
    const toValue = isMenuExpanded ? 0 : 1;
    setIsMenuExpanded(!isMenuExpanded);
    Animated.spring(menuExpandAnim, {
      toValue,
      useNativeDriver: false,
      friction: 8,
      tension: 40
    }).start();
  };

  // ... (keeping existing handlers) ...
  const openDeepRepairModal = () => {
    setIsDeepRepairModalVisible(true);
    Animated.timing(deepRepairFadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  };

  const closeDeepRepairModal = () => {
    Animated.timing(deepRepairFadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      setIsDeepRepairModalVisible(false);
    });
  };

  const confirmDeepRepair = async () => {
    closeDeepRepairModal();
    await new Promise(r => setTimeout(r, 200));
    showToast("Recovering legacy data and syncing events...", "info", 5000, null, "Running Deep Repair");
    const success = await deepRepair();
    if (success) {
      showToast("Deep repair successful. All data restored.", "success", 4000, null, "Success");
      fetchCustomers();
      fetchProducts();
      fetchTransactions();
    } else {
      showToast("Deep repair failed. Please check your Drive connection.", "error", 5000, null, "Failed");
    }
  };

  const confirmRepair = async () => {
    closeRepairModal();
    await new Promise(r => setTimeout(r, 200));
    showToast("Finding and re-syncing blocked events...", "info", 4000, null, "Repairing Sync");
    const success = await repairSync();
    if (success) {
      showToast("Sync repair complete. All cloud data restored.", "success", 4000, null, "Repair Successful");
      fetchCustomers();
      fetchProducts();
      fetchTransactions();
    } else {
      showToast("Repair process failed. Please check your connection.", "error", 5000, null, "Repair Failed");
    }
  };

  const confirmResync = async () => {
    closeResyncModal();
    await new Promise(r => setTimeout(r, 200));
    showToast("Wiping local sync history and rebuilding database...", "info", 4000, null, "Database Recovery");
    const success = await forceResync();
    if (success) {
      showToast("Local database has been fully restored from cloud events.", "success", 4000, null, "Recovery Complete");
      fetchCustomers();
      fetchProducts();
      fetchTransactions();
    } else {
      showToast("Failed to rebuild database. Please contact support if issues persist.", "error", 5000, null, "Recovery Failed");
    }
  };

  // ... (keeping existing save/cancel/change handlers) ...
  const handleSave = async () => {
    if (!localSettings) return;

    const payload = {
      ...localSettings,
      tax: {
        ...localSettings.tax,
        taxGroups: taxGroups
      },
      lastUpdatedAt: new Date()
    };
    setIsSaving(true);
    try {
      // saveFullSettings handles: Local DB, MongoDB, and Settings Drive Sync
      await saveFullSettings(payload);

      // CRITICAL: Update local state immediately with what we just saved 
      // to prevent the useEffect from reverting it if context propagation is delayed.
      setLocalSettings(JSON.parse(JSON.stringify(payload)));

      setUnsavedChanges(false);
      setIsEditing(false);

      // Success animation
      setShowSuccessIcon(true);
      setTimeout(() => setShowSuccessIcon(false), 2000);

      showToast("Configuration saved locally and syncing to cloud.", "success", 3500, null, "Settings Saved");
    } catch (error) {
      console.error("Failed to save settings", error);
      showToast("Configuration could not be saved. Check your internet connection.", "error", 4000, null, "Save Error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (unsavedChanges) {
      setIsDiscardModalVisible(true);
      Animated.timing(discardFadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    } else {
      setIsEditing(false);
    }
  };

  const closeDiscardModal = () => {
    Animated.timing(discardFadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      setIsDiscardModalVisible(false);
    });
  };

  const confirmDiscard = () => {
    closeDiscardModal();
    setIsEditing(false);
    setUnsavedChanges(false);
    // Reset local state to original settings
    setLocalSettings(JSON.parse(JSON.stringify(settings)));
    setTaxGroups(settings?.tax?.taxGroups || []);
  };

  const handleChange = (section, field, value, subField = null) => {
    if (!isEditing) setIsEditing(true);

    setUnsavedChanges(true);
    setLocalSettings(prev => {
      if (!prev) return prev;
      const next = { ...prev };

      // Handle array updates or deep objects if necessary
      if (subField) {
        next[section] = {
          ...next[section],
          [field]: {
            ...next[section][field],
            [subField]: value
          }
        };
      } else {
        // Ensure the section exists (for new sections like bankDetails)
        next[section] = {
          ...(next[section] || {}),
          [field]: value
        };
      }
      return next;
    });
  };


  const pickImage = async () => {
    if (!isEditing) setIsEditing(true);

    // Request permission
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Sorry, we need camera roll permissions to make this work!');
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7, // Increased quality for a clearer logo
      base64: true,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      // Detect mime type or fallback to jpeg
      const mimeType = asset.mimeType || 'image/jpeg';
      const dataUri = `data:${mimeType};base64,${asset.base64}`;
      handleChange('store', 'logo', dataUri);
      handleChange('invoice', 'showLogo', true); // Automatically turn ON logo display on invoices
      showToast("Business logo has been updated.", "success", 3000, null, "Branding Updated");
    }
  };

  const removeLogo = () => {
    if (!isEditing) setIsEditing(true);
    handleChange('store', 'logo', null);
    handleChange('invoice', 'showLogo', false); // Automatically turn OFF logo display on invoices
    showToast("Business logo has been removed.", "info", 3000, null, "Branding Updated");
  };

  const addTaxGroup = () => {
    if (!isEditing) setIsEditing(true);
    const newGroup = {
      id: Date.now().toString(),
      name: 'New Tax Group',
      rate: 0,
      cgst: 0,
      sgst: 0,
      igst: 0,
      active: true
    };
    setTaxGroups([...taxGroups, newGroup]);
    setUnsavedChanges(true);
  };

  const updateTaxGroup = (id, field, value) => {
    if (!isEditing) setIsEditing(true);
    const updated = taxGroups.map(g => {
      if (g.id === id) {
        const updatedGroup = { ...g, [field]: value };
        if (field === 'rate') {
          const rate = parseFloat(value) || 0;
          updatedGroup.igst = rate;
          updatedGroup.cgst = rate / 2;
          updatedGroup.sgst = rate / 2;
        }
        return updatedGroup;
      }
      return g;
    });
    setTaxGroups(updated);
    setUnsavedChanges(true);
  };

  const removeTaxGroup = (id) => {
    if (!isEditing) setIsEditing(true);
    setTaxGroups(taxGroups.filter(g => g.id !== id));
    setUnsavedChanges(true);
  };



  if (loading || !settings || !localSettings) {
    return (
      <View style={[styles.container, styles.center]}>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
        <ActivityIndicator size="large" color="#000" />
        <Text style={{ marginTop: 16, fontSize: 16, fontWeight: '700', color: '#000' }}>Loading Settings...</Text>
      </View>
    );
  }

  const DetailRow = ({ label, value, icon: Icon }) => (
    <View style={styles.detailRow}>
      {Icon && <Icon size={18} color="#64748b" style={styles.detailIcon} />}
      <View style={{ flex: 1 }}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value || 'Not set'}</Text>
      </View>
    </View>
  );

  const renderTabContent = () => {

    switch (activeTab) {
      case 'access':
        if (!isPinVerified) {
          return (
            <View style={{ flex: 1 }}>
              <ManagerPinGate onUnlocked={() => { setIsPinVerified(true); setIsChangingPin(false); }} />
              {isChangingPin && (
                <TouchableOpacity
                  onPress={async () => {
                    // Restore old PIN and go back to staff list
                    if (previousPinRef.current !== null) {
                      await updateSettings('security', { managerPin: previousPinRef.current });
                    }
                    previousPinRef.current = null;
                    setIsChangingPin(false);
                    setIsPinVerified(true);
                  }}
                  activeOpacity={0.7}
                  style={{
                    position: 'absolute',
                    top: Platform.OS === 'ios' ? 56 : 16,
                    right: 16,
                    zIndex: 99,
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: '#f1f5f9',
                    justifyContent: 'center',
                    alignItems: 'center',
                    elevation: 4,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.1,
                    shadowRadius: 4,
                  }}
                >
                  <X size={20} color="#0f172a" />
                </TouchableOpacity>
              )}
            </View>
          );
        }
        return (
          <View style={styles.tabContent}>
            <View style={{ marginBottom: 26, flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              <View style={{ width: 48, height: 48, backgroundColor: '#000', borderRadius: 14, justifyContent: 'center', alignItems: 'center' }}>
                <Contact size={24} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 10, fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 }}>Personnel Tracking</Text>
                <Text style={{ fontSize: 20, fontWeight: '900', color: '#000', letterSpacing: -0.4 }}>Receptionist Management</Text>
                <Text style={{ fontSize: 11, color: '#64748b', fontWeight: '500', lineHeight: 16 }}>
                  Manage receptionists for bill accountability.
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => openUserModal('add')}
                activeOpacity={0.7}
                style={{ width: 36, height: 36, backgroundColor: '#000', borderRadius: 10, justifyContent: 'center', alignItems: 'center' }}
              >
                <Plus size={18} color="#fff" />
              </TouchableOpacity>
            </View>

            <Card style={{ borderRadius: 24, overflow: 'hidden' }}>
              <View style={{ padding: 20, backgroundColor: '#f8fafc', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
                <Text style={{ fontSize: 14, fontWeight: '900', color: '#000' }}>ACTIVE STAFF</Text>
              </View>
              <View style={{ padding: 12 }}>
                {(!settings?.receptionists || settings.receptionists.length === 0) ? (
                  <View style={{ padding: 40, alignItems: 'center' }}>
                    <Contact size={40} color="#e2e8f0" strokeWidth={1} style={{ marginBottom: 12 }} />
                    <Text style={{ fontSize: 13, color: '#94a3b8', fontWeight: '600' }}>No receptionists added yet</Text>
                  </View>
                ) : (
                  settings.receptionists.map((recep, idx) => (
                    <View
                      key={recep.id}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        padding: 16,
                        borderBottomWidth: idx === settings.receptionists.length - 1 ? 0 : 1,
                        borderBottomColor: '#f1f5f9',
                        opacity: recep.is_active ? 1 : 0.5
                      }}
                    >
                      <View style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: recep.is_active ? '#f1f5f9' : '#f8fafc',
                        justifyContent: 'center',
                        alignItems: 'center',
                        marginRight: 12
                      }}>
                        <Contact size={20} color={recep.is_active ? '#000' : '#64748b'} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 15, fontWeight: '700', color: recep.is_active ? '#000' : '#64748b' }}>{recep.name}</Text>
                        <Text style={{ fontSize: 11, color: '#94a3b8', fontWeight: '700' }}>{recep.id}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <TouchableOpacity
                          onPress={() => openUserModal('edit', recep.id, recep.name)}
                          style={{ padding: 8 }}
                        >
                          <Edit2 size={16} color="#64748b" />
                        </TouchableOpacity>
                        <Switch
                          value={recep.is_active === 1}
                          onValueChange={(val) => toggleReceptionistActive(recep.id, val)}
                          trackColor={{ false: '#f1f5f9', true: '#000' }}
                          thumbColor={Platform.OS === 'ios' ? '#fff' : (recep.is_active ? '#fff' : '#f4f3f4')}
                        />
                      </View>
                    </View>
                  ))
                )}
              </View>
            </Card>

            <View style={{ marginTop: 20, padding: 16, backgroundColor: '#f8fafc', borderRadius: 20, borderWidth: 1, borderColor: '#f1f5f9', borderStyle: 'dashed' }}>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <ShieldCheck size={20} color="#64748b" />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: '#0f172a', marginBottom: 4 }}>Accountability Policy</Text>
                  <Text style={{ fontSize: 11, color: '#64748b', lineHeight: 16, fontWeight: '500' }}>
                    Once added, receptionists cannot be deleted to maintain bill history integrity. You can deactivate them to prevent new bills from being assigned.
                  </Text>
                </View>
              </View>
            </View>

            <Text style={{ fontSize: 13, fontWeight: '900', color: '#000', marginTop: 32, marginBottom: 12, letterSpacing: 0.5, uppercase: true }}>VAULT & SECURITY</Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
                <TouchableOpacity 
                  style={{ flex: 1, backgroundColor: '#000', padding: 16, borderRadius: 16, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }}
                  onPress={openPinResetModal}
                >
                    <Lock size={16} color="#fff" />
                    <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800' }}>Change PIN</Text>
                </TouchableOpacity>
            </View>
          </View>
        );

      case 'store':
        return (
          <View style={styles.tabContent}>
            {/* Store Tab Header */}
            <View style={{ marginBottom: 26, flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              <View style={{ width: 48, height: 48, backgroundColor: '#000', borderRadius: 14, justifyContent: 'center', alignItems: 'center' }}>
                <Store size={24} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 10, fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 }}>Business Identity</Text>
                <Text style={{ fontSize: 20, fontWeight: '900', color: '#000', letterSpacing: -0.4 }}>Store Profile</Text>
                <Text style={{ fontSize: 11, color: '#64748b', fontWeight: '500', lineHeight: 16 }}>
                  Manage branding and contact info.
                </Text>
              </View>
              <TouchableOpacity
                onPress={refreshUser}
                activeOpacity={0.7}
                style={{ width: 36, height: 36, backgroundColor: '#f1f5f9', borderRadius: 10, justifyContent: 'center', alignItems: 'center' }}
              >
                <RefreshCw size={18} color="#000" />
              </TouchableOpacity>
            </View>

            {/* Subscription Status Card - Premium Metallic Style */}
            <View style={{ marginBottom: 24 }}>
              <LinearGradient
                colors={user?.plan === 'free' ? ['#f8f9ff', '#f1f5f9'] : ['#1a1a1a', '#000000', '#1a1a1a']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  borderRadius: 28,
                  padding: 24,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderWidth: 1.5,
                  borderColor: user?.plan === 'free' ? '#e2e8f0' : '#333',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 10 },
                  shadowOpacity: 0.15,
                  shadowRadius: 20,
                  elevation: 8,
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                {/* Decorative background circle */}
                <View style={{ position: 'absolute', right: -20, top: -20, width: 120, height: 120, borderRadius: 60, backgroundColor: user?.plan === 'free' ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.03)' }} />

                <View style={{ flex: 1, zIndex: 1 }}>
                  <Text style={{ fontSize: 11, fontWeight: '900', color: user?.plan === 'free' ? '#64748b' : 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 4 }}>
                    Tier Status
                  </Text>
                  <Text style={{ fontSize: 26, fontWeight: '900', color: user?.plan === 'free' ? '#000' : '#fff', letterSpacing: -0.5 }}>
                    {(() => {
                      const planNames = {
                        'free': 'Basic Tier',
                        '1m': 'Bronze Pro',
                        '3m': 'Silver Pro',
                        '1y': 'Gold Annual',
                        '3y': 'Lifetime Pro',
                        '5y': 'Professional Elite'
                      };
                      return planNames[user?.plan] || 'Pro Access';
                    })()}
                  </Text>

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, backgroundColor: user?.plan === 'free' ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.1)', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 }}>
                    <Clock size={12} color={user?.plan === 'free' ? '#64748b' : 'rgba(255,255,255,0.7)'} />
                    <Text style={{ fontSize: 12, fontWeight: '800', color: user?.plan === 'free' ? '#64748b' : 'rgba(255,255,255,0.7)' }}>
                      Valid until {(() => {
                        const date = user?.plan === 'free' ? user?.trialExpiresAt : (user?.planExpiresAt || user?.trialExpiresAt);
                        if (!date || (typeof date === 'string' && date.toLowerCase() === 'n/a')) {
                          return 'Forever';
                        }
                        return new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
                      })()}
                    </Text>
                  </View>
                </View>

                {/* Right Side Visuals */}
                <View style={{ alignItems: 'flex-end', zIndex: 1 }}>
                  {/* Warning Badge for last 30 days */}
                  {(() => {
                    const expiry = user?.plan === 'free' ? new Date(user?.trialExpiresAt) : new Date(user?.planExpiresAt);
                    if (!expiry || isNaN(expiry.getTime())) return null;

                    const diff = expiry.getTime() - Date.now();
                    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
                    if (days <= 15 && days > 0) {
                      return (
                        <View style={{ marginBottom: 12, backgroundColor: '#FF4D4D', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, alignItems: 'center' }}>
                          <Text style={{ fontSize: 12, fontWeight: '900', color: '#fff' }}>{days}D LEFT</Text>
                        </View>
                      );
                    }
                    return null;
                  })()}

                  <View style={{
                    width: 54,
                    height: 54,
                    borderRadius: 18,
                    backgroundColor: user?.plan === 'free' ? '#000' : '#fff',
                    justifyContent: 'center',
                    alignItems: 'center',
                    shadowColor: '#000',
                    shadowOpacity: 0.2,
                    shadowRadius: 10,
                    elevation: 4
                  }}>
                    {(() => {
                      const plan = user?.plan || 'free';
                      if (plan === 'free') return <User size={28} color="#fff" />;
                      if (['3y', '5y'].includes(plan)) return <Gem size={28} color="#38bdf8" />;
                      if (plan === '1y') return <Crown size={28} color="#FFD700" />;
                      return <BadgeCheck size={28} color="#6366f1" />;
                    })()}
                  </View>
                </View>
              </LinearGradient>

              {/* Quick Link to Upgrade/Billing */}
              {user?.plan === 'free' && (
                <TouchableOpacity
                  onPress={() => setActiveTab('contact')}
                  style={{ marginTop: 12, alignSelf: 'center' }}
                >
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#64748b', textDecorationLine: 'underline' }}>
                    Unlock Premium Features • Explore Plans
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Profile Strength Indicator - Gamification */}
            {!isEditing && (
              <View style={{ marginBottom: 24, paddingHorizontal: 4 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text style={{ fontSize: 12, fontWeight: '800', color: '#000' }}>Setup Completeness</Text>
                  <Text style={{ fontSize: 12, fontWeight: '900', color: '#000' }}>
                    {(() => {
                      let points = 0;
                      if (settings?.store?.name) points += 20;
                      if (settings?.store?.logo) points += 20;
                      if (settings?.store?.address?.street) points += 20;
                      if (settings?.store?.contact) points += 20;
                      if (settings?.store?.gstin || settings?.tax?.gstEnabled) points += 20;
                      return points;
                    })()}%
                  </Text>
                </View>
                <View style={{ height: 6, backgroundColor: '#f1f5f9', borderRadius: 3, overflow: 'hidden' }}>
                  <View style={{
                    height: '100%',
                    width: `${(() => {
                      let points = 0;
                      if (settings?.store?.name) points += 20;
                      if (settings?.store?.logo) points += 20;
                      if (settings?.store?.address?.street) points += 20;
                      if (settings?.store?.contact) points += 20;
                      if (settings?.store?.gstin || settings?.tax?.gstEnabled) points += 20;
                      return points;
                    })()}%`,
                    backgroundColor: '#000',
                    borderRadius: 3
                  }} />
                </View>
              </View>
            )}

            {/* Basic Details Card */}
            <Card style={[styles.card, { borderRadius: 28, overflow: 'hidden' }]}>
              <View style={[styles.cardHeader, { backgroundColor: '#f8fafc', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }]}>
                <View style={{ padding: 8, backgroundColor: '#000', borderRadius: 12 }}>
                  <Building size={16} color="#fff" />
                </View>
                <Text style={{ fontSize: 15, fontWeight: '900', color: '#000', letterSpacing: 0.5 }}>IDENTIFICATION</Text>
                {!isEditing && (
                  <TouchableOpacity onPress={() => setIsEditing(true)} style={{ marginLeft: 'auto' }}>
                    <Edit2 size={16} color="#64748b" />
                  </TouchableOpacity>
                )}
              </View>
              <View style={styles.cardPadding}>
                {isEditing ? (
                  <View style={{ gap: 20 }}>
                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>Store Display Name</Text>
                      <View style={[styles.inputFieldContainer, { height: 50, borderRadius: 14 }]}>
                        <Store size={18} color="#94a3b8" style={{ marginRight: 12 }} />
                        <Input
                          value={localSettings?.store?.name || ''}
                          onChangeText={(v) => handleChange('store', 'name', v)}
                          placeholder="e.g. Kwiq Billing Store"
                          style={{ borderWidth: 0, height: '100%', flex: 1, paddingHorizontal: 0, fontWeight: '800' }}
                        />
                      </View>
                    </View>
                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>Legal Business Name</Text>
                      <View style={[styles.inputFieldContainer, { height: 50, borderRadius: 14 }]}>
                        <Building size={18} color="#94a3b8" style={{ marginRight: 12 }} />
                        <Input
                          value={localSettings?.store?.legalName || ''}
                          onChangeText={(v) => handleChange('store', 'legalName', v)}
                          placeholder="As per GST Certificate"
                          style={{ borderWidth: 0, height: '100%', flex: 1, paddingHorizontal: 0, fontWeight: '800' }}
                        />
                      </View>
                    </View>
                    <View style={styles.inputRow}>
                      <View style={[styles.inputGroup, { flex: 1 }]}>
                        <Text style={styles.label}>Contact Number</Text>
                        <View style={[styles.inputFieldContainer, { height: 50, borderRadius: 14 }]}>
                          <Phone size={18} color="#94a3b8" style={{ marginRight: 12 }} />
                          <Input
                            value={localSettings?.store?.contact || ''}
                            onChangeText={(v) => handleChange('store', 'contact', v)}
                            keyboardType="phone-pad"
                            placeholder="Phone"
                            style={{ borderWidth: 0, height: '100%', flex: 1, paddingHorizontal: 0, fontWeight: '800' }}
                          />
                        </View>
                      </View>
                      <View style={[styles.inputGroup, { flex: 1 }]}>
                        <Text style={styles.label}>Official Email</Text>
                        <View style={[styles.inputFieldContainer, { height: 50, borderRadius: 14 }]}>
                          <Mail size={18} color="#94a3b8" style={{ marginRight: 12 }} />
                          <Input
                            value={localSettings?.store?.email || ''}
                            onChangeText={(v) => handleChange('store', 'email', v)}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            placeholder="Optional"
                            style={{ borderWidth: 0, height: '100%', flex: 1, paddingHorizontal: 0, fontWeight: '800' }}
                          />
                        </View>
                      </View>
                    </View>
                  </View>
                ) : (
                  <View style={{ gap: 4 }}>
                    <DetailRow label="Display Name" value={settings?.store?.name} icon={Store} />
                    <View style={{ height: 1.5, backgroundColor: '#f1f5f9', marginVertical: 8 }} />
                    <DetailRow label="Legal Name" value={settings?.store?.legalName} icon={Building} />
                    <View style={{ height: 1.5, backgroundColor: '#f1f5f9', marginVertical: 8 }} />
                    <View style={{ flexDirection: 'row', gap: 24 }}>
                      <View style={{ flex: 1 }}>
                        <DetailRow label="Contact" value={settings?.store?.contact} icon={Phone} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <DetailRow label="Email" value={settings?.store?.email} icon={Mail} />
                      </View>
                    </View>
                  </View>
                )}
              </View>
            </Card>

            {/* Geography Card */}
            <Card style={[styles.card, { borderRadius: 28, marginTop: 16, overflow: 'hidden' }]}>
              <View style={[styles.cardHeader, { backgroundColor: '#f8fafc', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }]}>
                <View style={{ padding: 8, backgroundColor: '#000', borderRadius: 12 }}>
                  <MapPin size={16} color="#fff" />
                </View>
                <Text style={{ fontSize: 15, fontWeight: '900', color: '#000', letterSpacing: 0.5 }}>ADDRESS & LOCATION</Text>
              </View>
              <View style={styles.cardPadding}>
                {isEditing ? (
                  <View style={{ gap: 20 }}>
                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>Street / Building / Area</Text>
                      <View style={[styles.inputFieldContainer, { height: 50, borderRadius: 14 }]}>
                        <MapPin size={18} color="#94a3b8" style={{ marginRight: 12 }} />
                        <Input
                          value={localSettings?.store?.address?.street || ''}
                          onChangeText={(v) => handleChange('store', 'address', v, 'street')}
                          placeholder="Shop No, Building, Area"
                          style={{ borderWidth: 0, height: '100%', flex: 1, paddingHorizontal: 0, fontWeight: '800' }}
                        />
                      </View>
                    </View>
                    <View style={styles.inputRow}>
                      <View style={[styles.inputGroup, { flex: 1.5 }]}>
                        <Text style={styles.label}>City, State</Text>
                        <View style={[styles.inputFieldContainer, { height: 50, borderRadius: 14 }]}>
                          <Building size={18} color="#94a3b8" style={{ marginRight: 12 }} />
                          <Input
                            value={localSettings?.store?.address?.city || ''}
                            onChangeText={(v) => handleChange('store', 'address', v, 'city')}
                            placeholder="City, State"
                            style={{ borderWidth: 0, height: '100%', flex: 1, paddingHorizontal: 0, fontWeight: '800' }}
                          />
                        </View>
                      </View>
                      <View style={[styles.inputGroup, { flex: 1 }]}>
                        <Text style={styles.label}>Pincode</Text>
                        <View style={[styles.inputFieldContainer, { height: 50, borderRadius: 14 }]}>
                          <Input
                            value={localSettings?.store?.address?.pincode || ''}
                            onChangeText={(v) => handleChange('store', 'address', v, 'pincode')}
                            keyboardType="numeric"
                            placeholder="XXXXXX"
                            style={{ borderWidth: 0, height: '100%', flex: 1, paddingHorizontal: 0, fontWeight: '900', letterSpacing: 2 }}
                          />
                        </View>
                      </View>
                    </View>
                  </View>
                ) : (
                  <View style={{ gap: 4 }}>
                    <DetailRow label="Physical Address" value={settings?.store?.address?.street} icon={MapPin} />
                    <View style={{ height: 1.5, backgroundColor: '#f1f5f9', marginVertical: 8 }} />
                    <View style={{ flexDirection: 'row', gap: 24 }}>
                      <View style={{ flex: 1.5 }}>
                        <DetailRow label="City & State" value={settings?.store?.address?.city} icon={Building} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <DetailRow label="Pincode" value={settings?.store?.address?.pincode} icon={MapPin} />
                      </View>
                    </View>
                  </View>
                )}
              </View>
            </Card>

            {/* Visual Assets Card */}
            <Card style={[styles.card, { borderRadius: 28, marginTop: 16, overflow: 'hidden' }]}>
              <View style={[styles.cardHeader, { backgroundColor: '#f8fafc', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }]}>
                <View style={{ padding: 8, backgroundColor: '#000', borderRadius: 12 }}>
                  <ImageIcon size={16} color="#fff" />
                </View>
                <Text style={{ fontSize: 15, fontWeight: '900', color: '#000', letterSpacing: 0.5 }}>BRANDING & ASSETS</Text>
                <View style={{ marginLeft: 'auto', backgroundColor: '#e2e8f0', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}>
                  <Text style={{ fontSize: 9, fontWeight: '900', color: '#475569' }}>CLOUD SYNCED</Text>
                </View>
              </View>

              <View style={styles.cardPadding}>
                <View style={{ flexDirection: 'row', gap: 24, alignItems: 'center' }}>
                  {/* Logo Preview Area - More refined */}
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={isEditing ? pickImage : () => setIsEditing(true)}
                    style={{
                      width: 100,
                      height: 100,
                      borderRadius: 22,
                      backgroundColor: '#fff',
                      borderWidth: 1,
                      borderColor: '#e2e8f0',
                      justifyContent: 'center',
                      alignItems: 'center',
                      overflow: 'hidden',
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.05,
                      shadowRadius: 10,
                      elevation: 1
                    }}
                  >
                    {localSettings?.store?.logo ? (
                      <View style={{ width: '100%', height: '100%', position: 'relative' }}>
                        <Image source={{ uri: localSettings?.store?.logo }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                        {isLogoUploading && (
                          <View style={{
                            position: 'absolute',
                            top: 0, left: 0, right: 0, bottom: 0,
                            backgroundColor: 'rgba(255,255,255,0.7)',
                            justifyContent: 'center',
                            alignItems: 'center'
                          }}>
                            <ActivityIndicator size="small" color="#000" />
                          </View>
                        )}
                      </View>
                    ) : (
                      <View style={{ justifyContent: 'center', alignItems: 'center', padding: 10 }}>
                        {isLogoUploading ? (
                          <ActivityIndicator size="small" color="#000" />
                        ) : (
                          <>
                            <Upload size={24} color="#94a3b8" strokeWidth={2} />
                            <Text style={{ fontSize: 9, fontWeight: '800', color: '#94a3b8', marginTop: 4, textAlign: 'center' }}>UPLOAD LOGO</Text>
                          </>
                        )}
                      </View>
                    )}
                  </TouchableOpacity>

                  {/* Brand Controls */}
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: '900', color: '#000', marginBottom: 4 }}>
                      Logo Identity
                    </Text>
                    <Text style={{ fontSize: 11, color: '#64748b', marginBottom: 12, lineHeight: 16, fontWeight: '500' }}>
                      Add your business logo for professional receipts and invoices.
                    </Text>

                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {isEditing ? (
                        <>
                          <TouchableOpacity
                            onPress={pickImage}
                            style={{
                              backgroundColor: '#000',
                              paddingVertical: 10,
                              paddingHorizontal: 14,
                              borderRadius: 12,
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 6
                            }}
                          >
                            <Upload size={14} color="#fff" />
                            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>
                              {localSettings?.store?.logo ? 'Change' : 'Upload'}
                            </Text>
                          </TouchableOpacity>

                          {localSettings?.store?.logo && (
                            <TouchableOpacity
                              onPress={removeLogo}
                              activeOpacity={0.7}
                              style={{
                                width: 38,
                                height: 38,
                                backgroundColor: '#fef2f2',
                                borderRadius: 12,
                                justifyContent: 'center',
                                alignItems: 'center',
                                borderWidth: 1,
                                borderColor: '#fee2e2'
                              }}
                            >
                              <Trash2 size={16} color="#ef4444" />
                            </TouchableOpacity>
                          )}
                        </>
                      ) : (
                        <TouchableOpacity
                          onPress={() => setIsEditing(true)}
                          style={{
                            paddingVertical: 8,
                            paddingHorizontal: 16,
                            backgroundColor: '#000',
                            borderRadius: 10
                          }}
                        >
                          <Text style={{ fontSize: 12, fontWeight: '800', color: '#fff' }}>Configure Brand</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </View>

                {/* Helpful Insight Tip */}
                <View style={{
                  marginTop: 20,
                  backgroundColor: '#f8fafc',
                  padding: 14,
                  borderRadius: 20,
                  borderWidth: 1.5,
                  borderColor: '#e2e8f0',
                  borderStyle: 'dashed',
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12
                }}>
                  <View style={{ padding: 8, backgroundColor: '#fff', borderRadius: 10 }}>
                    <Layout size={18} color="#000" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, fontWeight: '800', color: '#000' }}>Live Receipt Preview</Text>
                    <Text style={{ fontSize: 10, color: '#64748b', fontWeight: '500', marginTop: 2 }}>Check the 'Invoice' tab to see how your branding looks on a digital layout.</Text>
                  </View>
                </View>
              </View>
            </Card>
          </View>
        );

      case 'bank':
        const bank = localSettings.bankDetails || {};
        const isBankComplete = !!(bank.accountName && bank.accountNumber && bank.bankName);

        return (
          <View style={styles.tabContent}>
            {/* Bank Tab Header */}
            <View style={{ marginBottom: 26, flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              <View style={{ width: 48, height: 48, backgroundColor: '#000', borderRadius: 14, justifyContent: 'center', alignItems: 'center' }}>
                <CreditCard size={24} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 10, fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 }}>Financial Records</Text>
                <Text style={{ fontSize: 20, fontWeight: '900', color: '#000', letterSpacing: -0.4 }}>Bank Details</Text>
                <Text style={{ fontSize: 11, color: '#64748b', fontWeight: '500', lineHeight: 16 }}>
                  Securely manage settlement accounts.
                </Text>
              </View>
            </View>

            {/* Bank Card Preview (View Mode) */}
            {!isEditing && (
              <LinearGradient
                colors={['#000000', '#1a1a1a', '#000000']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.bankCard}
              >
                <View style={styles.bankCardHeader}>
                  <View>
                    <Text style={[styles.bankCardLabel, { color: '#fff', fontSize: 13, opacity: 1, textTransform: 'uppercase' }]}>
                      {bank.bankName || 'BANK NAME'}
                    </Text>
                    <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: '800' }}>
                      {bank.branch ? bank.branch.toUpperCase() : 'BRANCH NOT SET'}
                    </Text>
                  </View>
                  <Building size={24} color="rgba(255,255,255,0.4)" />
                </View>

                <View style={styles.bankCardChip}>
                  <View style={{ position: 'absolute', top: 0, left: '33%', bottom: 0, width: 1, backgroundColor: 'rgba(0,0,0,0.15)' }} />
                  <View style={{ position: 'absolute', top: 0, left: '66%', bottom: 0, width: 1, backgroundColor: 'rgba(0,0,0,0.15)' }} />
                  <View style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 1, backgroundColor: 'rgba(0,0,0,0.15)' }} />
                </View>

                <Text style={styles.bankCardNumber}>
                  {bank.accountNumber
                    ? bank.accountNumber.replace(/(.{4})/g, '$1 ').trim()
                    : '•••• •••• •••• ••••'}
                </Text>

                <View style={styles.bankCardFooter}>
                  <View style={{ flex: 1.5 }}>
                    <Text style={styles.bankCardLabel}>Account Holder</Text>
                    <Text style={styles.bankCardValue} numberOfLines={1}>{bank.accountName || 'HOLDER NAME'}</Text>
                  </View>
                  <View style={{ flex: 1, alignItems: 'flex-end' }}>
                    <Text style={styles.bankCardLabel}>IFSC CODE</Text>
                    <Text style={styles.bankCardValue}>{bank.ifsc || 'XXXX0000XXX'}</Text>
                  </View>
                </View>

                {/* Decorative Pattern Overlay */}
                <View style={{ position: 'absolute', bottom: -30, right: -20, opacity: 0.08 }}>
                  <Landmark size={140} color="#fff" />
                </View>
              </LinearGradient>
            )}

            <View style={styles.card}>
              <View style={[styles.cardHeader, { backgroundColor: 'transparent', borderBottomWidth: 0, paddingBottom: 10 }]}>
                <View style={[styles.headerIconContainer, { backgroundColor: '#000', borderRadius: 12 }]}>
                  <ShieldCheck size={18} color="#fff" />
                </View>
                <Text style={[styles.cardTitle, { fontSize: 16, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 }]}>
                  {isEditing ? 'Configure Bank' : 'Security Status'}
                </Text>
              </View>
              <View style={styles.cardPadding}>
                {isEditing ? (
                  <View style={{ gap: 16 }}>
                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>Account Holder Name</Text>
                      <View style={styles.inputFieldContainer}>
                        <User size={20} color="#000" style={styles.inputIcon} />
                        <Input
                          value={localSettings.bankDetails?.accountName || ''}
                          onChangeText={(v) => handleChange('bankDetails', 'accountName', v)}
                          placeholder="Full name as per bank"
                          style={{ borderWidth: 0, height: 44, flex: 1, fontWeight: '700' }}
                        />
                      </View>
                    </View>

                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>Bank Institution Name</Text>
                      <View style={styles.inputFieldContainer}>
                        <Building size={20} color="#000" style={styles.inputIcon} />
                        <Input
                          value={localSettings.bankDetails?.bankName || ''}
                          onChangeText={(v) => handleChange('bankDetails', 'bankName', v)}
                          placeholder="e.g. State Bank of India"
                          style={{ borderWidth: 0, height: 44, flex: 1, fontWeight: '700' }}
                        />
                      </View>
                    </View>

                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>Account Number</Text>
                      <View style={styles.inputFieldContainer}>
                        <Fingerprint size={20} color="#000" style={styles.inputIcon} />
                        <Input
                          value={localSettings.bankDetails?.accountNumber || ''}
                          onChangeText={(v) => handleChange('bankDetails', 'accountNumber', v)}
                          keyboardType="numeric"
                          placeholder="000000000000"
                          style={{ borderWidth: 0, height: 44, flex: 1, fontWeight: '900', letterSpacing: 1 }}
                        />
                      </View>
                    </View>

                    <View style={styles.inputRow}>
                      <View style={{ flex: 1.2 }}>
                        <Text style={styles.label}>IFSC Code</Text>
                        <View style={styles.inputFieldContainer}>
                          <Input
                            value={localSettings.bankDetails?.ifsc || ''}
                            onChangeText={(v) => handleChange('bankDetails', 'ifsc', v.toUpperCase())}
                            autoCapitalize="characters"
                            placeholder="SBIN0001234"
                            style={{ borderWidth: 0, height: 44, flex: 1, paddingHorizontal: 4, fontWeight: '900', letterSpacing: 0.5 }}
                          />
                        </View>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.label}>Branch</Text>
                        <View style={styles.inputFieldContainer}>
                          <Input
                            value={localSettings.bankDetails?.branch || ''}
                            onChangeText={(v) => handleChange('bankDetails', 'branch', v)}
                            placeholder="Branch"
                            style={{ borderWidth: 0, height: 44, flex: 1, paddingHorizontal: 4, fontWeight: '700' }}
                          />
                        </View>
                      </View>
                    </View>
                  </View>
                ) : (
                  <View style={{ gap: 2 }}>
                    <DetailRow label="Account Verification" value={isBankComplete ? "Verified Profile" : "Incomplete Details"} icon={ShieldCheck} />
                    <DetailRow label="Secure Storage" value="AES-256 Encrypted" icon={Fingerprint} />

                    <TouchableOpacity
                      onPress={() => setIsEditing(true)}
                      activeOpacity={0.7}
                      style={{
                        marginTop: 10,
                        backgroundColor: '#f8fafc',
                        padding: 18,
                        borderRadius: 20,
                        borderWidth: 1.5,
                        borderColor: '#e2e8f0',
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                    >
                      <View>
                        <Text style={{ fontSize: 13, fontWeight: '900', color: '#000' }}>Update Bank Information</Text>
                        <Text style={{ fontSize: 11, color: '#64748b', marginTop: 2, fontWeight: '500' }}>Modify your payout destination</Text>
                      </View>
                      <View style={{ width: 36, height: 36, backgroundColor: '#000', borderRadius: 10, justifyContent: 'center', alignItems: 'center' }}>
                        <Edit2 size={16} color="#fff" />
                      </View>
                    </TouchableOpacity>
                  </View>
                )}

                <View style={{ marginTop: 24, backgroundColor: '#000', padding: 20, borderRadius: 24, borderLeftWidth: 6, borderLeftColor: '#333' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                    <ShieldCheck size={18} color="#fff" style={{ marginRight: 10 }} />
                    <Text style={{ fontSize: 12, color: '#fff', fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 }}>End-to-End Encryption</Text>
                  </View>
                  <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', lineHeight: 16, fontWeight: '600' }}>
                    Your financial details are end-to-end encrypted. We prioritize your privacy—even our systems cannot read your raw bank data without your personal encryption key.
                  </Text>
                </View>
              </View>
            </View>
          </View>
        );

      case 'tax':
        return (
          <View style={styles.tabContent}>
            {/* Tax Tab Header */}
            <View style={{ marginBottom: 26, flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              <View style={{ width: 48, height: 48, backgroundColor: '#000', borderRadius: 14, justifyContent: 'center', alignItems: 'center' }}>
                <Calculator size={24} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 10, fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 }}>Compliance & Taxation</Text>
                <Text style={{ fontSize: 22, fontWeight: '900', color: '#000', letterSpacing: -0.5 }}>Tax Configuration</Text>
                <Text style={{ fontSize: 11, color: '#64748b', fontWeight: '500', lineHeight: 16 }}>
                  Manage GST compliance and product tax slabs.
                </Text>
              </View>
            </View>

            {/* GST Status Dashboard - Professional Summary */}
            <LinearGradient
              colors={localSettings.tax.gstEnabled ? ['#000', '#262626'] : ['#f1f5f9', '#e2e8f0']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                borderRadius: 28,
                padding: 24,
                marginBottom: 24,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderWidth: 1,
                borderColor: localSettings.tax.gstEnabled ? '#333' : '#cbd5e1'
              }}
            >
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <ShieldCheck size={16} color={localSettings.tax.gstEnabled ? '#fff' : '#64748b'} />
                  <Text style={{ fontSize: 11, fontWeight: '900', color: localSettings.tax.gstEnabled ? 'rgba(255,255,255,0.6)' : '#64748b', textTransform: 'uppercase', letterSpacing: 1.5 }}>
                    Compliance Status
                  </Text>
                </View>
                <Text style={{ fontSize: 24, fontWeight: '900', color: localSettings.tax.gstEnabled ? '#fff' : '#000', letterSpacing: -0.5 }}>
                  {localSettings.tax.gstEnabled ? 'GST Enabled' : 'Tax Exempt'}
                </Text>
                <Text style={{ fontSize: 12, color: localSettings.tax.gstEnabled ? 'rgba(255,255,255,0.5)' : '#94a3b8', marginTop: 4, fontWeight: '500' }}>
                  {localSettings.tax.gstEnabled ? 'Calculating taxes for all billing transactions.' : 'All transactions will be calculated without GST.'}
                </Text>
              </View>
              <Switch
                value={localSettings.tax.gstEnabled}
                onValueChange={(v) => handleChange('tax', 'gstEnabled', v)}
                trackColor={{ false: '#cbd5e1', true: 'rgba(255,255,255,0.3)' }}
                thumbColor={localSettings.tax.gstEnabled ? '#fff' : '#f8fafc'}
              />
            </LinearGradient>

            {localSettings.tax.gstEnabled && (
              <>
                {/* GSTIN and Pricing Mode Controls */}
                <Card style={[styles.card, { borderRadius: 28, overflow: 'hidden', padding: 24 }]}>
                  <View style={styles.inputGroup}>
                    <Text style={[styles.label, { fontSize: 14, textTransform: 'uppercase', letterSpacing: 1, color: '#64748b' }]}>Business GSTIN</Text>
                    {isEditing ? (
                      <View style={[styles.inputFieldContainer, { height: 54, borderRadius: 16, borderColor: '#000' }]}>
                        <Building size={18} color="#000" style={{ marginRight: 12 }} />
                        <Input
                          value={localSettings?.store?.gstin || ''}
                          onChangeText={(v) => handleChange('store', 'gstin', v.toUpperCase())}
                          autoCapitalize="characters"
                          placeholder="ENTER 15-DIGIT GSTIN"
                          style={{ borderWidth: 0, height: '100%', flex: 1, paddingHorizontal: 0, fontWeight: '900', letterSpacing: 1.5 }}
                        />
                      </View>
                    ) : (
                      <TouchableOpacity
                        onPress={() => setIsEditing(true)}
                        activeOpacity={0.8}
                        style={{
                          padding: 16,
                          backgroundColor: '#f8fafc',
                          borderRadius: 18,
                          borderWidth: 1.5,
                          borderColor: '#e2e8f0',
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                          <View style={{ padding: 8, backgroundColor: '#fff', borderRadius: 10 }}>
                            <Building size={16} color="#000" />
                          </View>
                          <Text style={{ fontSize: 17, fontWeight: '900', color: settings?.store?.gstin ? '#000' : '#cbd5e1', letterSpacing: 1 }}>
                            {settings?.store?.gstin || 'Add Store GSTIN'}
                          </Text>
                        </View>
                        <Edit2 size={16} color="#64748b" />
                      </TouchableOpacity>
                    )}
                  </View>

                  <View style={{ height: 1.5, backgroundColor: '#f1f5f9', marginVertical: 8 }} />

                  <View style={{ marginTop: 12 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <Text style={[styles.label, { fontSize: 14, textTransform: 'uppercase', letterSpacing: 1, color: '#64748b' }]}>Billing Mode</Text>
                      <View style={{ paddingHorizontal: 8, paddingVertical: 4, backgroundColor: '#f1f5f9', borderRadius: 8 }}>
                        <Text style={{ fontSize: 9, fontWeight: '900', color: '#000' }}>{localSettings?.tax?.priceMode || 'Exclusive'}</Text>
                      </View>
                    </View>

                    <View style={{ flexDirection: 'row', backgroundColor: '#f1f5f9', borderRadius: 20, padding: 6, gap: 6 }}>
                      {['Exclusive', 'Inclusive'].map((mode) => (
                        <TouchableOpacity
                          key={mode}
                          onPress={() => handleChange('tax', 'priceMode', mode)}
                          style={{
                            flex: 1,
                            paddingVertical: 14,
                            alignItems: 'center',
                            borderRadius: 15,
                            backgroundColor: (localSettings?.tax?.priceMode || 'Exclusive') === mode ? '#000' : 'transparent',
                            flexDirection: 'row',
                            justifyContent: 'center',
                            gap: 8
                          }}
                        >
                          {(localSettings?.tax?.priceMode || 'Exclusive') === mode && (
                            <CheckCircle2 size={14} color="#fff" />
                          )}
                          <Text style={{
                            fontSize: 13,
                            fontWeight: '900',
                            color: (localSettings?.tax?.priceMode || 'Exclusive') === mode ? '#fff' : '#64748b'
                          }}>
                            {mode}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <Text style={{ fontSize: 11, color: '#94a3b8', marginTop: 10, textAlign: 'center', fontWeight: '500' }}>
                      {(localSettings?.tax?.priceMode || 'Exclusive') === 'Exclusive'
                        ? 'Tax will be added on top of the product price.'
                        : 'Product price is inclusive of tax component.'}
                    </Text>
                  </View>
                </Card>

                {/* Tax Slabs Visualization */}
                <View style={{ marginTop: 24, marginBottom: 40 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingHorizontal: 4 }}>
                    <View>
                      <Text style={{ fontSize: 20, fontWeight: '900', color: '#000' }}>Defined Slabs</Text>
                      <Text style={{ fontSize: 13, color: '#64748b', fontWeight: '500' }}>Standard tax rates for your inventory</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => isEditing ? addTaxGroup() : setIsEditing(true)}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: isEditing ? '#000' : '#f1f5f9',
                        paddingHorizontal: 16,
                        paddingVertical: 10,
                        borderRadius: 14,
                        gap: 8,
                        borderWidth: 1,
                        borderColor: isEditing ? '#000' : '#e2e8f0'
                      }}
                    >
                      {isEditing ? <Plus size={16} color="#fff" /> : <Edit2 size={14} color="#000" />}
                      <Text style={{ color: isEditing ? '#fff' : '#000', fontSize: 13, fontWeight: '800' }}>
                        {isEditing ? 'New Slab' : 'Edit Slabs'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* List Container */}
                  <View style={{ gap: 16 }}>
                    {taxGroups.length === 0 ? (
                      <View style={{ padding: 40, alignItems: 'center', backgroundColor: '#fff', borderRadius: 28, borderWidth: 1.5, borderColor: '#f1f5f9', borderStyle: 'dashed' }}>
                        <Calculator size={32} color="#cbd5e1" style={{ marginBottom: 12 }} />
                        <Text style={{ color: '#94a3b8', fontWeight: '700', fontSize: 15 }}>No tax slabs defined.</Text>
                      </View>
                    ) : (
                      taxGroups.map((group) => (
                        <View
                          key={group.id}
                          style={{
                            padding: 20,
                            backgroundColor: '#fff',
                            borderRadius: 24,
                            borderWidth: 1.5,
                            borderColor: '#f1f5f9',
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.02,
                            shadowRadius: 10,
                            elevation: 1
                          }}
                        >
                          {isEditing ? (
                            <View style={{ gap: 16 }}>
                              <View style={{ flexDirection: 'row', gap: 12 }}>
                                <View style={{ flex: 1 }}>
                                  <Text style={{ fontSize: 10, fontWeight: '900', color: '#94a3b8', marginBottom: 8, textTransform: 'uppercase' }}>Label Name</Text>
                                  <View style={[styles.inputFieldContainer, { height: 48, borderRadius: 12 }]}>
                                    <Input
                                      value={group.name}
                                      onChangeText={(v) => updateTaxGroup(group.id, 'name', v)}
                                      placeholder="GST 18%"
                                      style={{ borderWidth: 0, height: '100%', flex: 1, paddingHorizontal: 0, fontWeight: '800' }}
                                    />
                                  </View>
                                </View>
                                <View style={{ width: 90 }}>
                                  <Text style={{ fontSize: 10, fontWeight: '900', color: '#94a3b8', marginBottom: 8, textTransform: 'uppercase' }}>Tax %</Text>
                                  <View style={[styles.inputFieldContainer, { height: 48, borderRadius: 12, borderStyle: 'dashed' }]}>
                                    <Input
                                      value={group.rate.toString()}
                                      onChangeText={(v) => updateTaxGroup(group.id, 'rate', v)}
                                      keyboardType="numeric"
                                      style={{ borderWidth: 0, height: '100%', flex: 1, paddingHorizontal: 0, fontWeight: '900', textAlign: 'center' }}
                                    />
                                  </View>
                                </View>
                              </View>
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8 }}>
                                <View style={{ flexDirection: 'row', gap: 12 }}>
                                  <View style={{ backgroundColor: '#f1f5f9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}>
                                    <Text style={{ fontSize: 9, fontWeight: '900', color: '#64748b' }}>C+S: {group.cgst}%</Text>
                                  </View>
                                  <View style={{ backgroundColor: '#f1f5f9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}>
                                    <Text style={{ fontSize: 9, fontWeight: '900', color: '#64748b' }}>IGST: {group.igst}%</Text>
                                  </View>
                                </View>
                                <TouchableOpacity
                                  onPress={() => removeTaxGroup(group.id)}
                                  style={{ padding: 8, backgroundColor: '#fef2f2', borderRadius: 10 }}
                                >
                                  <Trash2 size={16} color="#ef4444" />
                                </TouchableOpacity>
                              </View>
                            </View>
                          ) : (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                              <View style={{ width: 64, height: 64, borderRadius: 18, backgroundColor: '#f8fafc', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#e2e8f0' }}>
                                <Text style={{ fontSize: 20, fontWeight: '900', color: '#000' }}>{group.rate}<Text style={{ fontSize: 12 }}>%</Text></Text>
                              </View>
                              <View style={{ flex: 1 }}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                  <Text style={{ fontSize: 16, fontWeight: '900', color: '#000' }}>{group.name}</Text>
                                  <Sparkles size={14} color="#cbd5e1" />
                                </View>

                                {/* Visual Percentage Bar */}
                                <View style={{ height: 8, backgroundColor: '#f1f5f9', borderRadius: 4, overflow: 'hidden', marginBottom: 10 }}>
                                  <View style={{
                                    height: '100%',
                                    width: `${Math.min(group.rate * 2.5, 100)}%`, // Visual scaling
                                    backgroundColor: '#000',
                                    borderRadius: 4
                                  }} />
                                </View>

                                <View style={{ flexDirection: 'row', gap: 12 }}>
                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                    <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: '#94a3b8' }} />
                                    <Text style={{ fontSize: 11, color: '#64748b', fontWeight: '700' }}>CGST/SGST {group.cgst}%</Text>
                                  </View>
                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                    <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: '#000' }} />
                                    <Text style={{ fontSize: 11, color: '#64748b', fontWeight: '700' }}>IGST {group.igst}%</Text>
                                  </View>
                                </View>
                              </View>
                            </View>
                          )}
                        </View>
                      ))
                    )}
                  </View>
                </View>
              </>
            )}
            <View style={{ height: 40 }} />
          </View>
        );


      case 'invoice':
        return (
          <View style={styles.tabContent}>
            {/* Invoice Tab Header */}
            <View style={{ marginBottom: 26, flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              <View style={{ width: 48, height: 48, backgroundColor: '#000', borderRadius: 14, justifyContent: 'center', alignItems: 'center' }}>
                <Layout size={24} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 10, fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 }}>Design Workspace</Text>
                <Text style={{ fontSize: 22, fontWeight: '900', color: '#000', letterSpacing: -0.5 }}>Invoice Studio</Text>
                <Text style={{ fontSize: 11, color: '#64748b', fontWeight: '500', lineHeight: 16 }}>
                  Choose and customize your business's visual identity.
                </Text>
              </View>
            </View>

            {/* Template Selection Visualizer */}
            <View style={{ marginBottom: 24 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
                <Text style={{ fontSize: 14, fontWeight: '900', color: '#000', textTransform: 'uppercase', letterSpacing: 1.2 }}>Select Template</Text>
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#94a3b8' }}>{localSettings.invoice.template || 'Classic'}</Text>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 12, paddingRight: 20 }}
              >
                {['Classic', 'Compact', 'Detailed', 'Minimal'].map((tmpl) => (
                  <TouchableOpacity
                    key={tmpl}
                    activeOpacity={0.8}
                    onPress={() => handleChange('invoice', 'template', tmpl)}
                    style={{
                      paddingHorizontal: 24,
                      paddingVertical: 14,
                      borderRadius: 18,
                      backgroundColor: (localSettings.invoice.template || 'Classic') === tmpl ? '#000' : '#fff',
                      borderWidth: 1.5,
                      borderColor: (localSettings.invoice.template || 'Classic') === tmpl ? '#000' : '#e2e8f0',
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8
                    }}
                  >
                    {(localSettings.invoice.template || 'Classic') === tmpl && (
                      <CheckCircle2 size={14} color="#fff" />
                    )}
                    <Text style={{
                      fontSize: 14,
                      fontWeight: '900',
                      color: (localSettings.invoice.template || 'Classic') === tmpl ? '#fff' : '#64748b'
                    }}>
                      {tmpl}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Template Preview Area */}
            <View style={{
              backgroundColor: '#f8fafc',
              borderRadius: 0,
              padding: 12,
              borderWidth: 1.5,
              borderColor: '#e2e8f0',
              marginBottom: 24
            }}>
              <View style={{ marginBottom: 12, paddingHorizontal: 12, paddingTop: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  {/* <Sparkles size={14} color="#64748b" /> */}
                  <Text style={{ fontSize: 11, fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Live Preview</Text>
                </View>
                <TouchableOpacity 
                  activeOpacity={0.7}
                  onPress={() => setIsPreviewIGST(!isPreviewIGST)} 
                  style={{ 
                    flexDirection: 'row', 
                    alignItems: 'center', 
                    backgroundColor: '#ffffff', 
                    paddingHorizontal: 12, 
                    paddingVertical: 6, 
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: '#cbd5e1',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.05,
                    shadowRadius: 3,
                    elevation: 2
                  }}
                >
                  <RefreshCw size={11} color="#334155" style={{ marginRight: 6 }} />
                  <Text style={{ fontSize: 10, fontWeight: '800', color: '#334155', letterSpacing: 0.5 }}>
                    {isPreviewIGST ? 'CHANGE TO CGST VIEW' : 'CHANGE TO IGST VIEW'}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={{ borderRadius: 0, overflow: 'hidden', backgroundColor: '#fff', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.1, shadowRadius: 16 }}>
                {(localSettings.invoice.template || 'Classic') === 'Classic' && <ClassicInvoiceTemplate settings={localSettings} data={null} taxType={isPreviewIGST ? 'inter' : 'intra'} />}
                {localSettings.invoice.template === 'Compact' && <CompactInvoiceTemplate settings={localSettings} data={null} taxType={isPreviewIGST ? 'inter' : 'intra'} />}
                {localSettings.invoice.template === 'Detailed' && <DetailedInvoiceTemplate settings={localSettings} taxType={isPreviewIGST ? 'inter' : 'intra'} />}
                {localSettings.invoice.template === 'Minimal' && <MinimalInvoiceTemplate settings={localSettings} taxType={isPreviewIGST ? 'inter' : 'intra'} />}
              </View>

              <Text style={{ fontSize: 10, color: '#94a3b8', textAlign: 'center', marginTop: 12, fontWeight: '700' }}>
                * This is a sample representation of your invoice layout.
              </Text>
            </View>

            {/* Invoice Configuration Options */}
            <View style={{ gap: 16, marginBottom: 40 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <Text style={{ fontSize: 18, fontWeight: '900', color: '#000' }}>Invoice Settings</Text>
                <View style={{ padding: 6, backgroundColor: '#f1f5f9', borderRadius: 8 }}>
                  <Clock size={16} color="#64748b" />
                </View>
              </View>

              <Card style={{ borderRadius: 28, padding: 20 }}>
                {/* Branding Section */}
                <View style={{ marginBottom: 20 }}>
                  <Text style={{ fontSize: 11, fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 }}>Branding & Content</Text>

                  <View style={{ gap: 12 }}>
                    {[
                      { id: 'showLogo', label: 'Show Business Logo', icon: <ImageIcon size={18} color="#000" /> },
                      { id: 'showSignature', label: 'Authorized Signatory', icon: <Fingerprint size={18} color="#000" /> },
                      { id: 'showTaxBreakup', label: 'Detailed Tax Breakup', icon: <Calculator size={18} color="#000" /> }
                    ].map((item) => (
                      <View key={item.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, backgroundColor: '#f8fafc', borderRadius: 16 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                          <View style={{ padding: 8, backgroundColor: '#fff', borderRadius: 10 }}>
                            {item.icon}
                          </View>
                          <Text style={{ fontSize: 14, fontWeight: '700', color: '#334155' }}>{item.label}</Text>
                        </View>
                        <Switch
                          value={localSettings.invoice[item.id]}
                          onValueChange={(v) => handleChange('invoice', item.id, v)}
                          trackColor={{ false: '#e2e8f0', true: '#000' }}
                          thumbColor="#fff"
                        />
                      </View>
                    ))}
                  </View>
                </View>

                <View style={{ height: 1.5, backgroundColor: '#f1f5f9', marginBottom: 20 }} />

                {/* Header & Identifiers */}
                <View style={{ marginBottom: 20 }}>
                  <Text style={{ fontSize: 11, fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 }}>Labels & Notes</Text>

                  <View style={{ gap: 16 }}>
                    <View style={styles.inputGroup}>
                      <Text style={[styles.label, { fontSize: 12, color: '#64748b' }]}>Invoice Title</Text>
                      <View style={[styles.inputFieldContainer, { height: 48, borderRadius: 12 }]}>
                        <Input
                          value={localSettings.invoice.headerTitle}
                          onChangeText={(v) => handleChange('invoice', 'headerTitle', v)}
                          placeholder="e.g. TAX INVOICE"
                          style={{ borderWidth: 0, height: '100%', flex: 1, paddingHorizontal: 0, fontWeight: '800' }}
                        />
                      </View>
                    </View>

                    <View style={styles.inputGroup}>
                      <Text style={[styles.label, { fontSize: 12, color: '#64748b' }]}>Footer Greeting</Text>
                      <View style={[styles.inputFieldContainer, { height: 48, borderRadius: 12 }]}>
                        <Input
                          value={localSettings.invoice.footerNote}
                          onChangeText={(v) => handleChange('invoice', 'footerNote', v)}
                          placeholder="e.g. Thank you for shopping!"
                          style={{ borderWidth: 0, height: '100%', flex: 1, paddingHorizontal: 0, fontWeight: '800' }}
                        />
                      </View>
                    </View>
                  </View>
                </View>
              </Card>
            </View>

            <Card style={[styles.card, { borderLeftWidth: 0, borderRightWidth: 0, borderRadius: 24, paddingVertical: 10, marginTop: 12 }]}>
              <View style={[styles.cardHeader, { backgroundColor: 'transparent', borderBottomWidth: 0, paddingBottom: 10 }]}>
                <View style={[styles.headerIconContainer, { backgroundColor: '#000', borderRadius: 12 }]}>
                  <FileText size={18} color="#fff" />
                </View>
                <Text style={[styles.cardTitle, { fontSize: 16, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 }]}>Bill Template</Text>
              </View>
              <View style={styles.cardPadding}>
                <View style={{ marginBottom: 16 }}>
                  <Text style={styles.sectionSubtitle}>Select Template Type</Text>
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                    {['Professional', 'Standard'].map(tmpl => (
                      <TouchableOpacity
                        key={tmpl}
                        onPress={() => handleChange('invoice', 'billTemplate', tmpl)}
                        style={{
                          flex: 1,
                          paddingVertical: 12,
                          alignItems: 'center',
                          borderRadius: 12,
                          backgroundColor: (localSettings.invoice.billTemplate || 'Professional') === tmpl ? '#000' : '#f1f5f9',
                          borderWidth: 1.5,
                          borderColor: (localSettings.invoice.billTemplate || 'Professional') === tmpl ? '#000' : '#e2e8f0'
                        }}
                      >
                        <Text style={{
                          fontSize: 14,
                          fontWeight: '800',
                          color: (localSettings.invoice.billTemplate || 'Professional') === tmpl ? '#fff' : '#475569'
                        }}>
                          {tmpl}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <Text style={styles.sectionSubtitle}>Bill Receipt Preview</Text>

                <View style={{ marginTop: 16, marginHorizontal: -20, alignItems: 'center' }}>
                  <View style={{ width: '100%', alignItems: 'center' }}>
                    {(localSettings.invoice.billTemplate || 'Professional') === 'Standard' ? (
                      <>
                        <View style={{ marginBottom: 20, width: '100%' }}>
                          <Text style={[styles.helperTextSmall, { paddingHorizontal: 20, marginBottom: 8 }]}>Intra-State Receipt (CGST + SGST)</Text>
                          <View style={{ alignSelf: 'center', padding: 10, backgroundColor: '#f8fafc', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' }}>
                            <ThermalInvoiceTemplate settings={localSettings} taxType="intra" />
                          </View>
                        </View>
                        <View style={{ marginBottom: 20, width: '100%' }}>
                          <Text style={[styles.helperTextSmall, { paddingHorizontal: 20, marginBottom: 8 }]}>Inter-State Receipt (IGST)</Text>
                          <View style={{ alignSelf: 'center', padding: 10, backgroundColor: '#f8fafc', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' }}>
                            <ThermalInvoiceTemplate
                              settings={localSettings}
                              taxType="inter"
                              data={{
                                invoiceNo: '2',
                                date: '14/2/2026',
                                customer: { name: 'Online' },
                                paymentMode: 'UPI',
                                items: [
                                  { name: 'Elec. Kit', quantity: 1, price: 1000, total: 1000 }
                                ],
                                totals: {
                                  subtotal: 1000,
                                  tax: 180,
                                  total: 1180
                                }
                              }}
                            />
                          </View>
                        </View>
                      </>
                    ) : (
                      <View style={{ marginBottom: 20, width: '100%', alignItems: 'center' }}>
                        <Text style={[styles.helperTextSmall, { paddingHorizontal: 20, marginBottom: 8 }]}>Professional Receipt Preview</Text>

                        {/* Language Selection Grid */}
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 20, marginBottom: 16, justifyContent: 'center' }}>
                          {[
                            { id: 'en', label: 'EN' },
                            // { id: 'ta', label: 'தமிழ்' },




                          ].map(l => (
                            <TouchableOpacity
                              key={l.id}
                              onPress={() => handleChange('invoice', 'billLanguage', l.id)}
                              style={{
                                paddingHorizontal: 10,
                                paddingVertical: 6,
                                borderRadius: 8,
                                backgroundColor: (localSettings.invoice.billLanguage || 'en') === l.id ? '#000' : '#f1f5f9',
                                borderWidth: 1.5,
                                borderColor: (localSettings.invoice.billLanguage || 'en') === l.id ? '#000' : '#e2e8f0',
                              }}
                            >
                              <Text style={{ fontSize: 12, fontWeight: '900', color: (localSettings.invoice.billLanguage || 'en') === l.id ? '#fff' : '#64748b' }}>{l.label}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>

                        <View style={{ alignSelf: 'center', padding: 10, backgroundColor: '#f8fafc', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' }}>
                          <ProfessionalThermalTemplate settings={localSettings} forceInter={isPreviewIGST} />
                        </View>

                        {/* IGST Preview Toggle */}
                        <TouchableOpacity
                          activeOpacity={0.7}
                          onPress={() => setIsPreviewIGST(!isPreviewIGST)}
                          style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: '#cbd5e1', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 }}
                        >
                          <RefreshCw size={11} color="#334155" style={{ marginRight: 6 }} />
                          <Text style={{ fontSize: 10, fontWeight: '800', color: '#334155', letterSpacing: 0.5 }}>
                            {isPreviewIGST ? 'CHANGE TO CGST VIEW' : 'CHANGE TO IGST VIEW'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.helperTextSmall, { paddingHorizontal: 20, textAlign: 'center' }]}>Template helps format receipts for thermal printers.</Text>
                </View>
              </View>
            </Card >


            {/* ── Terms & Conditions Card ───────────────────────────────── */}
            <Card style={[styles.card, { borderLeftWidth: 0, borderRightWidth: 0, borderRadius: 24, paddingVertical: 10, marginTop: 12 }]}>
              <View style={[styles.cardHeader, { backgroundColor: 'transparent', borderBottomWidth: 0, paddingBottom: 10 }]}>
                <View style={[styles.headerIconContainer, { backgroundColor: '#000', borderRadius: 12 }]}>
                  <FileText size={18} color="#fff" />
                </View>
                <Text style={[styles.cardTitle, { fontSize: 16, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 }]}>
                  Terms &amp; Conditions
                </Text>
              </View>
              <View style={styles.cardPadding}>
                {/* Toggle */}
                <View style={{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                  paddingVertical: 14, paddingHorizontal: 16,
                  backgroundColor: localSettings.invoice?.showTerms !== false ? '#000' : '#f8fafc',
                  borderRadius: 16, marginBottom: 20,
                }}>
                  <View style={{ flex: 1, marginRight: 16 }}>
                    <Text style={{ fontSize: 14, fontWeight: '800', color: localSettings.invoice?.showTerms !== false ? '#fff' : '#0f172a' }}>
                      Print Terms on Every Receipt
                    </Text>
                    <Text style={{ fontSize: 11, color: localSettings.invoice?.showTerms !== false ? 'rgba(255,255,255,0.65)' : '#64748b', fontWeight: '500', marginTop: 3 }}>
                      {localSettings.invoice?.showTerms !== false ? 'Printed at the bottom of every bill & invoice' : 'Terms hidden — toggle ON to print on receipts'}
                    </Text>
                  </View>
                  <Switch
                    value={localSettings.invoice?.showTerms !== false}
                    onValueChange={(v) => handleChange('invoice', 'showTerms', v)}
                    trackColor={{ false: '#e2e8f0', true: '#333' }}
                    thumbColor="#fff"
                  />
                </View>
                {/* Terms input */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Terms</Text>
                  <TextInput
                    value={localSettings.invoice?.termsAndConditions || ''}
                    onChangeText={(v) => handleChange('invoice', 'termsAndConditions', v)}
                    placeholder="e.g. Goods once sold will not be taken back."
                    placeholderTextColor="#94a3b8"
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                    style={{ borderWidth: 1.5, borderColor: '#000', borderRadius: 14, padding: 14, fontSize: 13, fontWeight: '600', color: '#0f172a', backgroundColor: '#fff', minHeight: 80, lineHeight: 20 }}
                  />
                </View>
                {/* Conditions input */}
                <View style={[styles.inputGroup, { marginTop: 12 }]}>
                  <Text style={styles.label}>Conditions</Text>
                  <TextInput
                    value={localSettings.invoice?.conditionsText || ''}
                    onChangeText={(v) => handleChange('invoice', 'conditionsText', v)}
                    placeholder="e.g. All disputes subject to local jurisdiction only."
                    placeholderTextColor="#94a3b8"
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                    style={{ borderWidth: 1.5, borderColor: '#000', borderRadius: 14, padding: 14, fontSize: 13, fontWeight: '600', color: '#0f172a', backgroundColor: '#fff', minHeight: 80, lineHeight: 20 }}
                  />
                </View>
                <View style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#f8fafc', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', borderStyle: 'dashed' }}>
                  <CheckCircle2 size={14} color="#000" />
                  <Text style={{ fontSize: 11, color: '#475569', fontWeight: '600', flex: 1 }}>
                    Saved to local device, Google Drive &amp; cloud when you tap Save.
                  </Text>
                </View>
              </View>
            </Card>
          </View >
        );

      case 'print':
        const printerGuide = {
          en: {
            title: 'How to Connect',
            steps: [
              'Turn on your Thermal Printer and enable Bluetooth on your phone.',
              'Go to Phone Bluetooth Settings and Pair your printer device.',
              'Return to this page and tap "Scan" below.',
              'Find your printer name in the "Paired Devices" list.',
              'Tap "Connect" to link the printer with Kwiq Bill.'
            ]
          },
          hi: {
            title: 'कैसे कनेक्ट करें?',
            steps: [
              'थर्मल प्रिंटर चालू करें और फोन का ब्लूटूथ ऑन करें।',
              'फोन ब्लूटूथ सेटिंग्स में जाएं और अपने प्रिंटर को पेयर (Pair) करें।',
              'इस पेज पर वापस आएं और नीचे "Scan" पर टैप करें।',
              'सूची में अपने प्रिंटर का नाम ढूंढें।',
              'कनेक्ट करने के लिए "Connect" पर टैप करें।'
            ]
          },
          ta: {
            title: 'இணைப்பது எப்படி?',
            steps: [
              'தெர்மல் பிரிண்டரை ஆன் செய்து உங்கள் போனில் Bluetooth-ஐ இயக்கவும்.',
              'போன் Bluetooth Settings-க்கு சென்று உங்கள் பிரிண்டரை இணைக்கவும் (Pair).',
              'மீண்டும் இந்த பக்கத்திற்கு வந்து கீழே உள்ள "Scan" பட்டனை அழுத்தவும்.',
              'பட்டியலில் உங்கள் பிரிண்டர் பெயரை கண்டறியவும்.',
              'இணைப்பு தர "Connect" பட்டனை அழுத்தவும்.'
            ]
          },
          te: {
            title: 'కనెక్ట్ చేయడం ఎలా?',
            steps: [
              'థర్మల్ ప్రింటర్ ఆన్ చేయండి మరియు ఫోన్ బ్లూటూత్ ఆన్ చేయండి.',
              'ఫోన్ బ్లూటూత్ సెట్టింగ్స్ కి వెళ్లి ప్రింటర్ ని పేర్ (Pair) చేయండి.',
              'తిరిగి ఈ పేజీకి వచ్చి కింద ఉన్న "Scan" బటన్ నొక్కండి.',
              'లిస్ట్ లో మీ ప్రింటర్ పేరును గుర్తించండి.',
              'కనెక్ట్ చేయడానికి "Connect" బటన్ నొక్కండి.'
            ]
          },
          kn: {
            title: 'ಸಂಪರ್ಕಿಸುವುದು ಹೇಗೆ?',
            steps: [
              'ಥರ್ಮಲ್ ಪ್ರಿಂಟರ್ ಆನ್ ಮಾಡಿ ಮತ್ತು ಫೋನ್ ಬ್ಲೂಟೂತ್ ಆನ್ ಮಾಡಿ.',
              'ಫೋನ್ ಬ್ಲೂಟೂತ್ ಸೆಟ್ಟಿಂಗ್‌ಗೆ ಹೋಗಿ ಪ್ರಿಂಟರ್ ಅನ್ನು ಪೇರ್ (Pair) ಮಾಡಿ.',
              'ಮರಳಿ ಈ ಪುಟಕ್ಕೆ ಬಂದು ಕೆಳಗಿರುವ "Scan" ಬಟನ್ ಒತ್ತಿರಿ.',
              'ಪಟ್ಟಿಯಲ್ಲಿ ನಿಮ್ಮ ಪ್ರಿಂಟರ್ ಹೆಸರನ್ನು ಗುರುತಿಸಿ.',
              'ಸಂಪರ್ಕಿಸಲು "Connect" ಬಟನ್ ಒತ್ತಿರಿ.'
            ]
          },
          ml: {
            title: 'എങ്ങനെ കണക്ട് ചെയ്യാം?',
            steps: [
              'തെർമൽ പ്രിന്റർ ഓൺ ചെയ്യുക, ഫോണിലെ ബ്ലൂടൂത്ത് ഓണാക്കുക.',
              'ഫോൺ ബ്ലൂടൂത്ത് സെറ്റിംഗ്‌സിൽ പോയി പ്രിന്റർ പേര് (Pair) ചെയ്യുക.',
              'തിരികെ ഈ പേജിൽ വന്ന് താഴെയുള്ള "Scan" ബട്ടൺ അമർത്തുക.',
              'ലിസ്റ്റിൽ നിങ്ങളുടെ പ്രിന്ററുടെ പേര് കണ്ടെത്തുക.',
              'കണക്ട് ചെയ്യുന്നതിന് "Connect" ബട്ടൺ അമർത്തുക.'
            ]
          },
          mr: {
            title: 'कसे कनेक्ट करायचे?',
            steps: [
              'तुमचा थर्मल प्रिंटर चालू करा आणि तुमच्या फोनवर ब्लूटूथ सक्षम करा.',
              'फोन ब्लूटूथ सेटिंग्जमध्ये जा आणि तुमचे प्रिंटर डिव्हाइस पेअर (Pair) करा.',
              'या पृष्ठावर परत या आणि खाली "Scan" वर टॅप करा.',
              ' "पॅअर्ड डिव्हाइसेस" (Paired Devices) सूचीमध्ये तुमच्या प्रिंटरचे नाव शोधा.',
              'प्रिंटरला Kwiq Bill सह लिंक करण्यासाठी "Connect" वर टॅप करा.'
            ]
          },
          bn: {
            title: 'কিভাবে কানেক্ট করবেন?',
            steps: [
              'আপনার থার্মাল প্রিন্টার অন করুন এবং ফোনে ব্লুটুথ চালু করুন।',
              'ফোনের ব্লুটুথ সেটিংসে গিয়ে আপনার প্রিন্টারটিকে পেয়ার (Pair) করুন।',
              'এই পেজে ফিরে আসুন এবং নিচে "Scan" এ ট্যাপ করুন।',
              ' "পেয়ারড ডিভাইস" (Paired Devices) তালিকায় আপনার প্রিন্টারের নাম খুঁজুন।',
              'Kwiq Bill-এর সাথে প্রিন্টারটি লিঙ্ক করতে "Connect" এ ট্যাপ করুন।'
            ]
          },
          gu: {
            title: 'કેવી રીતે કનેક્ટ કરવું?',
            steps: [
              'તમારું થર્મલ પ્રિન્ટર ચાલુ કરો અને તમારા ફોન પર બ્લૂટૂથ સક્ષમ કરો.',
              'ફોન બ્લૂટૂથ સેટિંગ્સમાં જાઓ અને તમારા પ્રિન્ટર ઉપકરણને પેર (Pair) કરો.',
              'આ પૃષ્ઠ પર પાછા ફરો અને નીચે "Scan" પર ટેપ કરો.',
              ' "પેર્ડ ડિવાઇસીસ" (Paired Devices) સૂચિમાં તમારા પ્રિન્ટરનું નામ શોધો.',
              'પ્રિન્ટરને Kwiq Bill સાથે લિંક કરવા માટે "Connect" પર ટેપ કરો.'
            ]
          },
          pa: {
            title: 'ਕਿਵੇਂ ਕਨੈਕਟ ਕਰੀਏ?',
            steps: [
              'ਆਪਣਾ ਥਰਮਲ ਪ੍ਰਿੰਟਰ ਚਾਲੂ ਕਰੋ ਅਤੇ ਆਪਣੇ ਫੋਨ \'ਤੇ ਬਲੂਟੁੱਥ ਨੂੰ ਚਾਲੂ ਕਰੋ।',
              'ਫੋਨ ਦੀ ਬਲੂਟੁੱਥ ਸੈਟਿੰਗਾਂ ਵਿੱਚ ਜਾਓ ਅਤੇ ਆਪਣੇ ਪ੍ਰਿੰਟਰ ਡਿਵਾਈਸ ਨੂੰ ਪੇਅਰ (Pair) ਕਰੋ।',
              'ਇਸ ਪੰਨੇ \'ਤੇ ਵਾਪਸ ਆਓ ਅਤੇ ਹੇਠਾਂ "Scan" \'ਤੇ ਟੈਪ ਕਰੋ।',
              ' "ਪੇਅਰਡ ਡਿਵਾਈਸਾਂ" (Paired Devices) ਸੂਚੀ ਵਿੱਚ ਆਪਣੇ ਪ੍ਰਿੰਟਰ ਦਾ ਨਾਮ ਲੱਭੋ।',
              'ਪ੍ਰਿੰਟਰ ਨੂੰ Kwiq Bill ਨਾਲ ਲਿੰਕ ਕਰਨ ਲਈ "Connect" \'ਤੇ ਟੈਪ ਕਰੋ।'
            ]
          }
        };
























        const currentGuide = printerGuide[guideLang] || printerGuide.en;

        return (
          <View style={styles.tabContent}>
            {/* Print Tab Header */}
            <View style={{ marginBottom: 26, flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              <View style={{ width: 48, height: 48, backgroundColor: '#000', borderRadius: 14, justifyContent: 'center', alignItems: 'center' }}>
                <Printer size={24} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 10, fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 }}>Hardware Config</Text>
                <Text style={{ fontSize: 20, fontWeight: '900', color: '#000', letterSpacing: -0.4 }}>Print Settings</Text>
                <Text style={{ fontSize: 11, color: '#64748b', fontWeight: '500', lineHeight: 16 }}>
                  Configure thermal POS printers.
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  initBluetooth();
                  requestBluetoothPermissions(true);
                  showToast("Printer list refreshed", "info");
                }}
                activeOpacity={0.7}
                style={{ width: 36, height: 36, backgroundColor: '#f1f5f9', borderRadius: 10, justifyContent: 'center', alignItems: 'center' }}
              >
                <RefreshCw size={18} color="#000" />
              </TouchableOpacity>
            </View>

            {/* Language Switcher Section */}
            <View style={{ marginBottom: 24, paddingHorizontal: 4 }}>
              <Text style={{ fontSize: 13, fontWeight: '900', color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
                Instruction Language
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
                {[
                  { id: 'en', label: 'English', sub: 'En' },
                  { id: 'ta', label: 'தமிழ்', sub: 'Ta' },
                  { id: 'ml', label: 'മലയാളം', sub: 'Ml' },
                  { id: 'te', label: 'తెలుగు', sub: 'Te' },
                  { id: 'kn', label: 'ಕನ್ನಡ', sub: 'Kn' },
                  { id: 'hi', label: 'हिन्दी', sub: 'Hi' },
                  { id: 'mr', label: 'मराठी', sub: 'Mr' },
                  { id: 'bn', label: 'বাংলা', sub: 'Bn' },
                  { id: 'gu', label: 'ગુજરાતી', sub: 'Gu' },
                  { id: 'pa', label: 'ਪੰਜਾਬੀ', sub: 'Pa' },
                ].map(l => (
                  <TouchableOpacity
                    key={l.id}
                    onPress={() => {
                      setGuideLang(l.id);
                      // Haptic or sound effect could be added here
                    }}
                    activeOpacity={0.8}
                    style={{
                      paddingHorizontal: 16,
                      paddingVertical: 12,
                      borderRadius: 16,
                      backgroundColor: guideLang === l.id ? '#000' : '#f8fafc',
                      borderWidth: 1.5,
                      borderColor: guideLang === l.id ? '#000' : '#e2e8f0',
                      alignItems: 'center',
                      minWidth: 85,
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: guideLang === l.id ? 0.2 : 0,
                      shadowRadius: 4,
                      elevation: guideLang === l.id ? 3 : 0
                    }}
                  >
                    <Text style={{
                      fontSize: 14,
                      fontWeight: '900',
                      color: guideLang === l.id ? '#fff' : '#0f172a',
                      marginBottom: 1
                    }}>
                      {l.label}
                    </Text>
                    <Text style={{
                      fontSize: 9,
                      fontWeight: '700',
                      color: guideLang === l.id ? 'rgba(255,255,255,0.6)' : '#94a3b8',
                      textTransform: 'uppercase',
                      letterSpacing: 1
                    }}>
                      {l.sub}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Guide Card - PREMIUM STEPPER THEME */}
            <View style={{
              backgroundColor: '#fff',
              marginBottom: 28,
              borderRadius: 32,
              padding: 24,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.1,
              shadowRadius: 20,
              elevation: 5,
              borderWidth: 1,
              borderColor: '#f1f5f9'
            }}>
              <LinearGradient
                colors={['#f8fafc', '#ffffff']}
                style={{
                  position: 'absolute',
                  top: 0, left: 0, right: 0, bottom: 0,
                  borderRadius: 32
                }}
              />

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                <View style={{ width: 40, height: 40, backgroundColor: '#000', borderRadius: 12, justifyContent: 'center', alignItems: 'center' }}>
                  <HelpCircle size={20} color="#fff" />
                </View>
                <View>
                  <Text style={{ fontSize: 18, fontWeight: '900', color: '#000', letterSpacing: -0.5 }}>
                    {currentGuide.title}
                  </Text>
                  <Text style={{ fontSize: 11, color: '#64748b', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 }}>
                    Setup Instructions
                  </Text>
                </View>
              </View>

              {/* Steps Section - Visual Stepper */}
              <View>
                {currentGuide.steps.map((step, idx) => {
                  const icons = [Smartphone, Bluetooth, Search, Link, CheckCircle];
                  const StepIcon = icons[idx] || Zap;
                  const isLast = idx === currentGuide.steps.length - 1;

                  return (
                    <View key={idx} style={{ flexDirection: 'row', gap: 16 }}>
                      <View style={{ alignItems: 'center' }}>
                        <View style={{
                          width: 32, height: 32,
                          borderRadius: 10,
                          backgroundColor: '#000',
                          justifyContent: 'center',
                          alignItems: 'center',
                          zIndex: 1
                        }}>
                          <StepIcon size={16} color="#fff" />
                        </View>
                        {!isLast && (
                          <View style={{
                            width: 2,
                            flex: 1,
                            backgroundColor: '#f1f5f9',
                            marginVertical: 4
                          }} />
                        )}
                      </View>
                      <View style={{ flex: 1, paddingBottom: isLast ? 0 : 20 }}>
                        <Text style={{ fontSize: 14, color: '#000', lineHeight: 20, fontWeight: '700' }}>
                          {step}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>

            <Card style={[styles.card, { borderLeftWidth: 0, borderRightWidth: 0, borderRadius: 24, paddingVertical: 10 }]}>
              <View style={[styles.cardHeader, { backgroundColor: 'transparent', borderBottomWidth: 0, paddingBottom: 10 }]}>
                <View style={[styles.headerIconContainer, { backgroundColor: '#000', borderRadius: 12 }]}>
                  <Printer size={18} color="#fff" />
                </View>
                <Text style={[styles.cardTitle, { fontSize: 16, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 }]}>Printing Setup</Text>
              </View>
              <View style={styles.cardPadding}>
                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { marginBottom: 12 }]}>Invoice Paper Size (PDF)</Text>
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    {['A4', 'A5'].map(size => (
                      <TouchableOpacity
                        key={size}
                        onPress={() => handleChange('invoice', 'invoicePaperSize', size)}
                        activeOpacity={0.7}
                        style={{
                          flex: 1,
                          padding: 16,
                          borderRadius: 20,
                          backgroundColor: (localSettings.invoice.invoicePaperSize || 'A4') === size ? '#000' : '#f8fafc',
                          borderWidth: 1.5,
                          borderColor: (localSettings.invoice.invoicePaperSize || 'A4') === size ? '#000' : '#e2e8f0',
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 12
                        }}
                      >
                        <FileText size={18} color={(localSettings.invoice.invoicePaperSize || 'A4') === size ? '#fff' : '#64748b'} />
                        <View>
                          <Text style={{ fontSize: 14, fontWeight: '900', color: (localSettings.invoice.invoicePaperSize || 'A4') === size ? '#fff' : '#0f172a' }}>{size}</Text>
                          <Text style={{ fontSize: 10, fontWeight: '700', color: (localSettings.invoice.invoicePaperSize || 'A4') === size ? 'rgba(255,255,255,0.6)' : '#94a3b8' }}>Standard</Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={[styles.inputGroup, { marginTop: 12 }]}>
                  <Text style={[styles.label, { marginBottom: 12 }]}>Bill Receipt Size (Thermal)</Text>
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    {['80mm', '58mm'].map(size => {
                      const Icon = size === '80mm' ? Layout : Smartphone;
                      const isActive = (localSettings.invoice.billPaperSize || '80mm') === size;
                      return (
                        <TouchableOpacity
                          key={size}
                          onPress={() => handleChange('invoice', 'billPaperSize', size)}
                          activeOpacity={0.7}
                          style={{
                            flex: 1,
                            padding: 16,
                            borderRadius: 20,
                            backgroundColor: isActive ? '#000' : '#f8fafc',
                            borderWidth: 1.5,
                            borderColor: isActive ? '#000' : '#e2e8f0',
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 12
                          }}
                        >
                          <Icon size={18} color={isActive ? '#fff' : '#64748b'} />
                          <View>
                            <Text style={{ fontSize: 14, fontWeight: '900', color: isActive ? '#fff' : '#0f172a' }}>{size}</Text>
                            <Text style={{ fontSize: 10, fontWeight: '700', color: isActive ? 'rgba(255,255,255,0.6)' : '#94a3b8' }}>{size === '80mm' ? 'Standard' : 'Compact'}</Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Currency Symbol</Text>
                  {isEditing ? (
                    <Input
                      value={localSettings.defaults.currency}
                      onChangeText={(v) => handleChange('defaults', 'currency', v)}
                    />
                  ) : (
                    <TouchableOpacity onPress={() => setIsEditing(true)}>
                      <View style={styles.readOnlyBadge}>
                        <Text style={styles.readOnlyBadgeText}>{settings.defaults.currency || '₹'}</Text>
                      </View>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </Card>

            <Card style={[styles.card, { marginTop: 16 }]}>
              <View style={styles.cardHeader}>
                <View style={[styles.headerIconContainer, { backgroundColor: '#000' }]}>
                  <Bluetooth size={20} color="#fff" />
                </View>
                <Text style={styles.cardTitle}>Bluetooth Thermal POS</Text>
              </View>
              <View style={styles.cardPadding}>
                <Text style={[styles.sectionSubtitle, { marginBottom: 12 }]}>
                  Connect to a 58mm or 80mm ESC/POS thermal printer natively.
                </Text>

                {localSettings?.invoice?.selectedPrinter && (
                  <>
                    <View style={{
                      marginBottom: 20,
                      borderRadius: 24,
                      overflow: 'hidden',
                      borderWidth: 1,
                      borderColor: '#10b981'
                    }}>
                      <LinearGradient
                        colors={['#f0fdf4', '#ffffff']}
                        style={{ padding: 20 }}
                      >
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                          <View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#10b981' }} />
                              <Text style={{ fontSize: 10, color: '#166534', fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 }}>
                                Natively Connected
                              </Text>
                            </View>
                            <Text style={{ fontSize: 20, fontWeight: '900', color: '#14532d' }}>
                              {localSettings.invoice.selectedPrinter.name}
                            </Text>
                            <Text style={{ fontSize: 12, color: '#166534', fontWeight: '600', opacity: 0.7 }}>
                              Address: {localSettings.invoice.selectedPrinter.address}
                            </Text>
                          </View>
                          <View style={{ width: 44, height: 44, backgroundColor: '#dcfce7', borderRadius: 14, justifyContent: 'center', alignItems: 'center' }}>
                            <Printer size={22} color="#166534" />
                          </View>
                        </View>

                        <View style={{ flexDirection: 'row', gap: 10 }}>
                          <TouchableOpacity
                            onPress={() => {
                              resetPrinterConnection();
                              showToast('Printer link reset. Next print will reconnect.', 'info', 3500, null, 'Reset Done');
                            }}
                            activeOpacity={0.7}
                            style={{ flex: 1, backgroundColor: '#fff', paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, borderColor: '#16a34a', alignItems: 'center' }}
                          >
                            <Text style={{ color: '#166534', fontWeight: '800', fontSize: 13 }}>Reset Link</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={unpairPrinter}
                            activeOpacity={0.7}
                            style={{ flex: 1, backgroundColor: '#16a34a', paddingVertical: 12, borderRadius: 12, alignItems: 'center' }}
                          >
                            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>Unpair Device</Text>
                          </TouchableOpacity>
                        </View>
                      </LinearGradient>
                    </View>

                    <TouchableOpacity
                      onPress={async () => {
                        const printerAddress = localSettings?.invoice?.selectedPrinter?.address;
                        if (!printerAddress) {
                          showToast("Please pair and connect a thermal printer in Settings first.", "printer", 4000, null, "No Printer Linked", require('../../../assets/animations/PrinterError.gif'));
                          return;
                        }

                        setIsTestingPrinter(true);
                        try {
                          const success = await testPrinter(localSettings);
                          if (success) {
                            showToast("Test receipt sent successfully to your printer.", "printer", 4000, null, "Print Successful", require('../../../assets/animations/PrinterError.gif'));
                          }
                        } catch (err) {
                          showToast("Unable to communicate with the printer. Check power and connection.", "printer", 5000, null, "Transmission Failed", require('../../../assets/animations/PrinterError.gif'));
                        } finally {
                          setIsTestingPrinter(false);
                        }
                      }}
                      disabled={isTestingPrinter}
                      activeOpacity={0.8}
                      style={{
                        backgroundColor: isTestingPrinter ? '#64748b' : '#000',
                        paddingVertical: 18,
                        borderRadius: 24,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 12,
                        marginBottom: 24,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.2,
                        shadowRadius: 10,
                        elevation: 4
                      }}
                    >
                      {isTestingPrinter ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Zap size={18} color="#fff" />
                      )}
                      <Text style={{ color: '#fff', fontSize: 15, fontWeight: '900', letterSpacing: 0.5 }}>
                        {isTestingPrinter ? 'SENDING TEST PRINT...' : 'SEND TEST PRINT'}
                      </Text>
                    </TouchableOpacity>
                  </>
                )}

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <Text style={{ fontSize: 14, fontWeight: '800', color: '#334155' }}>Paired Devices</Text>
                  <TouchableOpacity
                    onPress={initBluetooth}
                    disabled={isScanning}
                    style={{ paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#f1f5f9', borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 6 }}
                  >
                    {isScanning ? <ActivityIndicator size="small" color="#000" /> : <RefreshCw size={14} color="#000" />}
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#000' }}>{isScanning ? 'Scanning...' : 'Scan'}</Text>
                  </TouchableOpacity>
                </View>
                {/* Note: this list shows all Bluetooth devices that are OS-paired on this phone.
                    A device will appear here even if it is currently powered off. Tap 'Connect'
                    only when the printer is physically ON and in range. */}
                <Text style={{ fontSize: 11, color: '#94a3b8', fontWeight: '600', marginBottom: 12, fontStyle: 'italic' }}>
                  Shows all OS-paired Bluetooth devices. Turn the printer ON before tapping Connect.
                </Text>

                <View style={{ marginBottom: 12 }}>
                  <TouchableOpacity
                    onPress={() => requestBluetoothPermissions(true)}
                    style={{
                      padding: 12,
                      backgroundColor: '#fff',
                      borderRadius: 12,
                      borderWidth: 1.5,
                      borderColor: '#000',
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      borderStyle: 'dashed'
                    }}
                  >
                    <Shield size={16} color="#000" />
                    <Text style={{ fontSize: 13, fontWeight: '800', color: '#000' }}>Allow Bluetooth Permissions</Text>
                  </TouchableOpacity>
                  <Text style={{ fontSize: 10, color: '#64748b', textAlign: 'center', marginTop: 6 }}>
                    Required for Android 12+ to find nearby printers.
                  </Text>
                </View>

                <View style={{ gap: 10, minHeight: 40 }}>
                  {!bleOpend && (
                    <View style={{ backgroundColor: '#fef2f2', padding: 12, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#fee2e2' }}>
                      <AlertCircle size={16} color="#ef4444" />
                      <Text style={{ color: '#ef4444', fontSize: 13, fontWeight: '700' }}>
                        Bluetooth is disabled. Please turn it on.
                      </Text>
                    </View>
                  )}
                  {bleOpend && pairedDevices.length === 0 && !isScanning && (
                    <View style={{ backgroundColor: '#f8fafc', padding: 16, borderRadius: 16, borderStyle: 'dashed', borderWidth: 1.5, borderColor: '#cbd5e1', alignItems: 'center' }}>
                      <Bluetooth size={24} color="#94a3b8" style={{ marginBottom: 8 }} />
                      <Text style={{ color: '#64748b', fontSize: 13, fontWeight: '700', textAlign: 'center' }}>
                        No paired devices found. Pair the printer in Phone Settings first.
                      </Text>
                    </View>
                  )}
                  {pairedDevices.map((device, i) => (
                    <TouchableOpacity
                      key={i}
                      onPress={() => connectToPrinter(device)}
                      activeOpacity={0.7}
                      style={{
                        padding: 16,
                        backgroundColor: '#fff',
                        borderRadius: 20,
                        borderWidth: 1.5,
                        borderColor: localSettings?.invoice?.selectedPrinter?.address === device.address ? '#10b981' : '#f1f5f9',
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.03,
                        shadowRadius: 5,
                        elevation: 2
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1, marginRight: 10 }}>
                        <View style={{ width: 40, height: 40, backgroundColor: '#f8fafc', borderRadius: 12, justifyContent: 'center', alignItems: 'center', flexShrink: 0 }}>
                          <Printer size={18} color="#000" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 15, fontWeight: '800', color: '#0f172a' }} numberOfLines={1}>
                            {device.name || 'Unknown Device'}
                          </Text>
                          <Text style={{ fontSize: 11, color: '#94a3b8', marginTop: 1, fontWeight: '600' }} numberOfLines={1}>
                            {device.address}
                          </Text>
                        </View>
                      </View>

                      {isConnectingMac === device.address ? (
                        <View style={{ width: 85, alignItems: 'center' }}>
                          <ActivityIndicator size="small" color="#000" />
                        </View>
                      ) : (
                        localSettings?.invoice?.selectedPrinter?.address === device.address ? (
                          <View style={{ minWidth: 85, backgroundColor: '#dcfce7', paddingHorizontal: 8, paddingVertical: 10, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                            <CheckCircle2 size={12} color="#166534" strokeWidth={3.5} />
                            <Text style={{ color: '#166534', fontSize: 10, fontWeight: '900', letterSpacing: 0.5 }}>LINKED</Text>
                          </View>
                        ) : (
                          <View style={{ minWidth: 85, backgroundColor: '#000', paddingHorizontal: 8, paddingVertical: 10, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={{ color: '#fff', fontSize: 10, fontWeight: '900', letterSpacing: 0.5 }}>CONNECT</Text>
                          </View>
                        )
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </Card>
          </View>
        );
      case 'backup':
        return (
          <View style={styles.tabContent}>
            {/* NEW PREMIUM HEADER */}
            <View style={{ marginBottom: 32 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: isConnected ? '#10b981' : '#ef4444' }} />
                    <Text style={{ fontSize: 10, fontWeight: '900', color: '#64748b', textTransform: 'uppercase', letterSpacing: 1 }}>
                      {isConnected ? 'Sync Engine Secured' : 'Sync Engine Offline'}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 28, fontWeight: '900', color: '#000', letterSpacing: -1 }}>Backups</Text>
                  <Text style={{ fontSize: 13, color: '#64748b', fontWeight: '500', marginTop: 4 }}>
                    Monitoring your cloud pulse & data safety.
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    checkQueueStatus();
                    showToast("Checking cloud synchronization heartbeat.", "info", 3000, null, "Sync Engine");
                  }}
                  activeOpacity={0.7}
                  style={{ width: 44, height: 44, backgroundColor: '#fff', borderRadius: 14, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#f1f5f9', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5 }}
                >
                  <RotateCcw size={20} color="#000" />
                </TouchableOpacity>
              </View>
            </View>

            {/* CLOUD PROTECTION DASHBOARD */}
            <View style={{
              backgroundColor: '#fff',
              borderRadius: 32,
              padding: 24,
              marginBottom: 28,
              borderWidth: 1,
              borderColor: '#f1f5f9',
              elevation: 4,
              shadowColor: '#64748b',
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.08,
              shadowRadius: 20
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <View style={{ width: 40, height: 40, backgroundColor: '#000', borderRadius: 12, justifyContent: 'center', alignItems: 'center' }}>
                  <Cloud size={20} color="#fff" />
                </View>
                <View>
                  <Text style={{ fontSize: 16, fontWeight: '900', color: '#000' }}>Cloud Protection</Text>
                  <Text style={{ fontSize: 11, color: '#64748b', fontWeight: '600' }}>Google Drive Mirroring</Text>
                </View>
                <View style={{ marginLeft: 'auto', backgroundColor: isConnected ? '#dcfce7' : '#fee2e2', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}>
                  <Text style={{ fontSize: 10, fontWeight: '900', color: isConnected ? '#166534' : '#991b1b' }}>
                    {isConnected ? 'LIVE' : 'IDLE'}
                  </Text>
                </View>
              </View>

              <Text style={{ fontSize: 13, color: '#475569', lineHeight: 20, marginBottom: 24, fontWeight: '500' }}>
                Your business data is mirrored in the cloud. Access your invoices instantly from any device.
              </Text>

              {/* ── INSTANT CLOUD BACKUP with Performance UI ── */}
              <View style={{
                backgroundColor: '#000',
                borderRadius: 24,
                overflow: 'hidden',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.2,
                shadowRadius: 10,
                elevation: 4
              }}>
                <TouchableOpacity
                  onPress={async () => {
                    if (isBackingUp) return;
                    backupLogsBufferRef.current = [{ msg: 'Initializing backup engine...', status: 'working' }];
                    setBackupLogs([...backupLogsBufferRef.current]);
                    setIsBackingUp(true);
                    setBackupDone(false);
                    setShowTerminal(true);
                    const addLog = (msg, status) => {
                      backupLogsBufferRef.current = [...backupLogsBufferRef.current, { msg, status }];
                      setBackupLogs([...backupLogsBufferRef.current]);
                      setTimeout(() => backupLogsRef.current?.scrollToEnd?.({ animated: true }), 80);
                    };
                    const success = await backupDataToCloud(addLog);
                    setIsBackingUp(false);
                    setBackupDone(!!success);
                    setTimeout(() => setShowTerminal(false), 2500);
                  }}
                  activeOpacity={0.8}
                  style={{
                    backgroundColor: isBackingUp ? '#4338ca' : (backupDone ? '#059669' : '#000'),
                    paddingVertical: 20,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 12
                  }}
                >
                  {isBackingUp ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Upload size={18} color="#fff" />
                  )}
                  <Text style={{ color: '#fff', fontSize: 15, fontWeight: '900', letterSpacing: 0.5 }}>
                    {isBackingUp ? 'SYNCHRONIZING...' : (backupDone ? 'BACKUP COMPLETE' : 'TRIGGER CLOUD BACKUP')}
                  </Text>
                </TouchableOpacity>

                {/* SLKEE TERMINAL LOGS */}
                {showTerminal && backupLogs.length > 0 && (
                  <View style={{ backgroundColor: '#111', padding: 16 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#ef4444' }} />
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#f59e0b' }} />
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#10b981' }} />
                      <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginLeft: 8, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 }}>Console Output</Text>
                    </View>
                    <ScrollView
                      ref={backupLogsRef}
                      style={{ maxHeight: 150 }}
                      onContentSizeChange={() => backupLogsRef.current?.scrollToEnd?.({ animated: true })}
                    >
                      {backupLogs.map((entry, idx) => (
                        <View key={idx} style={{ flexDirection: 'row', gap: 10, marginBottom: 6 }}>
                          <Text style={{ color: entry.status === 'success' ? '#10b981' : (entry.status === 'error' ? '#ef4444' : '#6366f1'), fontSize: 12, fontWeight: '900' }}>
                            {entry.status === 'success' ? '●' : '›'}
                          </Text>
                          <Text style={{ color: '#fff', fontSize: 12, opacity: 0.9, flex: 1, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}>
                            {entry.msg}
                          </Text>
                        </View>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>
            </View>

            {/* ENGINE HEARTBEAT SECTION */}
            <View style={{ marginBottom: 28 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <View>
                  <Text style={{ fontSize: 13, fontWeight: '900', color: '#000', textTransform: 'uppercase', letterSpacing: 1 }}>Sync Status</Text>
                  <Text style={{ fontSize: 11, color: '#94a3b8', fontWeight: '600', marginTop: 2 }}>Real-time engine heartbeat</Text>
                </View>
                <View style={{ backgroundColor: isConnected ? '#dcfce7' : '#fee2e2', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, borderHeight: 1, borderColor: isConnected ? '#bbf7d0' : '#fecaca', flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Activity size={12} color={isConnected ? '#166534' : '#991b1b'} />
                  <Text style={{ fontSize: 11, fontWeight: '900', color: isConnected ? '#166534' : '#991b1b' }}>{isConnected ? 'ONLINE' : 'OFFLINE'}</Text>
                </View>
              </View>

              {/* Queue Display */}
              {queueLength > 0 ? (
                <View style={{
                  backgroundColor: '#fff',
                  borderRadius: 28,
                  padding: 24,
                  borderWidth: 1.5,
                  borderColor: '#f59e0b',
                  flexDirection: 'row',
                  gap: 20
                }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 11, fontWeight: '800', color: '#f59e0b', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Pending Upload</Text>
                    <Text style={{ fontSize: 32, fontWeight: '900', color: '#000' }}>{queueLength} <Text style={{ fontSize: 14, color: '#64748b' }}>Events</Text></Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
                      <Clock size={12} color="#94a3b8" />
                      <Text style={{ fontSize: 12, color: '#94a3b8', fontWeight: '600' }}>Est. {estimatedUploadTime}s remaining</Text>
                    </View>
                  </View>
                  <View style={{ width: 64, height: 64, backgroundColor: '#fff7ed', borderRadius: 20, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#ffedd5' }}>
                    <RefreshCw size={24} color="#f59e0b" />
                  </View>
                </View>
              ) : (
                <View style={{ backgroundColor: '#f8fafc', padding: 20, borderRadius: 24, borderStyle: 'dashed', borderWidth: 1.5, borderColor: '#cbd5e1', alignItems: 'center' }}>
                  <BadgeCheck size={32} color="#94a3b8" style={{ marginBottom: 8 }} />
                  <Text style={{ fontSize: 13, color: '#64748b', fontWeight: '700' }}>Cloud Database is fully synchronized</Text>
                </View>
              )}
            </View>

            {/* Multilingual Warning Section */}
            {queueLength > 0 && (
              <View style={{ marginTop: 24, backgroundColor: '#fff', borderRadius: 24, borderWidth: 1.5, borderColor: '#fca5a5', overflow: 'hidden' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 18, backgroundColor: '#fee2e2', borderBottomWidth: 1.5, borderBottomColor: '#fca5a5' }}>
                  <AlertCircle size={22} color="#dc2626" />
                  <Text style={{ fontSize: 16, fontWeight: '900', color: '#dc2626', textTransform: 'uppercase', letterSpacing: 0.5 }}>Do Not Uninstall!</Text>
                </View>

                <ScrollView style={{ maxHeight: 260, backgroundColor: '#fef2f2' }} nestedScrollEnabled={true}>
                  <View style={{ padding: 20, gap: 24 }}>
                    {/* English */}
                    <View>
                      <Text style={{ fontSize: 12, fontWeight: '800', color: '#dc2626', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>English</Text>
                      <Text style={{ fontSize: 14, color: '#991b1b', lineHeight: 22, fontWeight: '700' }}>
                        Do not uninstall the app or clear data! Your pending bills are stored on this device. Uninstalling will permanently delete them.
                      </Text>
                    </View>
                    {/* Tamil */}
                    <View>
                      <Text style={{ fontSize: 12, fontWeight: '800', color: '#dc2626', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>தமிழ் (Tamil)</Text>
                      <Text style={{ fontSize: 14, color: '#991b1b', lineHeight: 24, fontWeight: '700' }}>
                        ஆப்ஸை அன்இன்ஸ்டால் செய்யவோ அல்லது டேட்டாவை அழிக்கவோ வேண்டாம்! அன்இன்ஸ்டால் செய்தால் உங்கள் பில்கள் நிரந்தரமாக அழிந்துவிடும்.
                      </Text>
                    </View>
                    {/* Malayalam */}
                    <View>
                      <Text style={{ fontSize: 12, fontWeight: '800', color: '#dc2626', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>മലയാളം (Malayalam)</Text>
                      <Text style={{ fontSize: 14, color: '#991b1b', lineHeight: 24, fontWeight: '700' }}>
                        ആപ്പ് അൺഇൻസ്റ്റാൾ ചെയ്യുകയോ ഡാറ്റ മായ്ക്കുകയോ ചെയ്യരുത്! അങ്ങനെ ചെയ്താൽ നിങ്ങളുടെ ഡാറ്റ പൂർണ്ണമായും നഷ്ടപ്പെടും.
                      </Text>
                    </View>
                    {/* Telugu */}
                    <View>
                      <Text style={{ fontSize: 12, fontWeight: '800', color: '#dc2626', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>తెలుగు (Telugu)</Text>
                      <Text style={{ fontSize: 14, color: '#991b1b', lineHeight: 24, fontWeight: '700' }}>
                        యాప్ ను అన్‌ఇన్‌స్టాల్ చేయడం కానీ లేదా డేటాను క్లీన్ చేయడం కానీ చేయకండి! అన్‌ఇన్‌స్టాల్ చేయడం వల్ల మీ డేటా శాశ్వతంగా కోల్పోతారు.
                      </Text>
                    </View>
                    {/* Kannada */}
                    <View>
                      <Text style={{ fontSize: 12, fontWeight: '800', color: '#dc2626', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>ಕನ್ನಡ (Kannada)</Text>
                      <Text style={{ fontSize: 14, color: '#991b1b', lineHeight: 24, fontWeight: '700' }}>
                        ಅಪ್ಲಿಕೇಶನ್ ಅನ್‌ಇನ್‌ಸ್ಟಾಲ್ ಮಾಡಬೇಡಿ ಅಥವಾ ಡೇಟಾ ಕ್ಲಿಯರ್ ಮಾಡಬೇಡಿ! ಅನ್‌ಇನ್‌ಸ್ಟಾಲ್ ಮಾಡುವುದರಿಂದ ಬಿಲ್‌ಗಳು ಶಾಶ್ವತವಾಗಿ ಅಳಿಸಿಹೋಗುತ್ತದೆ.
                      </Text>
                    </View>
                    {/* Hindi */}
                    <View>
                      <Text style={{ fontSize: 12, fontWeight: '800', color: '#dc2626', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>हिंदी (Hindi)</Text>
                      <Text style={{ fontSize: 14, color: '#991b1b', lineHeight: 22, fontWeight: '700' }}>
                        कृपया ऐप को अनइंस्टॉल या डेटा साफ़ न करें! आपके पेंडिंग बिल इसी फ़ोन में हैं। अनइंस्टॉल करने से डेटा हमेशा के लिए डिलीट हो जाएगा।
                      </Text>
                    </View>
                  </View>
                </ScrollView>
              </View>
            )}

            {/* RECOVERY & REPAIR TOOLS - THE SAFE RESCUE THEME */}
            <View style={{ marginBottom: 28 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <View style={{ width: 36, height: 36, backgroundColor: '#f8fafc', borderRadius: 10, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' }}>
                  <ShieldCheck size={18} color="#000" />
                </View>
                <Text style={{ fontSize: 18, fontWeight: '900', color: '#000' }}>Data Recovery Center</Text>
              </View>

              <View style={{ gap: 16 }}>
                {/* Manual Sync */}
                <TouchableOpacity
                  onPress={async () => {
                    if (queueLength > 0) return;
                    showToast("Updating local data with latest cloud changes.", "info", 3000, null, "Synchronizing");
                    const success = await syncAllData();
                    if (success) {
                      showToast("All data records are now up to date.", "success", 3500, null, "Sync Completed");
                      fetchCustomers(); fetchProducts(); fetchTransactions();
                    } else {
                      showToast("Synchronization encountered an error.", "error", 4000, null, "Sync Failed");
                    }
                  }}
                  activeOpacity={0.7}
                  disabled={queueLength > 0}
                  style={{
                    backgroundColor: '#fff',
                    padding: 20,
                    borderRadius: 24,
                    borderWidth: 1.5,
                    borderColor: '#f1f5f9',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 16,
                    opacity: queueLength > 0 ? 0.6 : 1
                  }}
                >
                  <View style={{ width: 44, height: 44, backgroundColor: '#f8fafc', borderRadius: 12, justifyContent: 'center', alignItems: 'center' }}>
                    <RefreshCw size={20} color="#000" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '800', color: '#000' }}>Full Manual Sync</Text>
                    <Text style={{ fontSize: 11, color: '#64748b', fontWeight: '500' }}>Last: {lastEventSyncTime ? new Date(lastEventSyncTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Never'}</Text>
                  </View>
                  <ChevronRight size={18} color="#cbd5e1" />
                </TouchableOpacity>

                {/* Advanced Repair Cards Grid */}
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <TouchableOpacity
                    onPress={openRepairModal}
                    disabled={queueLength > 0}
                    style={{ flex: 1, backgroundColor: '#fff', padding: 20, borderRadius: 24, borderWidth: 1.5, borderColor: '#f1f5f9', alignItems: 'center', opacity: queueLength > 0 ? 0.6 : 1 }}
                  >
                    <View style={{ width: 40, height: 40, backgroundColor: '#f1f5f9', borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 12 }}>
                      <Zap size={20} color="#000" />
                    </View>
                    <Text style={{ fontSize: 14, fontWeight: '900', color: '#000', textAlign: 'center' }}>Quick Repair</Text>
                    <Text style={{ fontSize: 10, color: '#64748b', textAlign: 'center', marginTop: 4 }}>Scan Missed</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={openDeepRepairModal}
                    disabled={queueLength > 0}
                    style={{ flex: 1, backgroundColor: '#000', padding: 20, borderRadius: 24, alignItems: 'center', opacity: queueLength > 0 ? 0.6 : 1 }}
                  >
                    <View style={{ width: 40, height: 40, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 12 }}>
                      <Medal size={20} color="#fff" />
                    </View>
                    <Text style={{ fontSize: 14, fontWeight: '900', color: '#fff', textAlign: 'center' }}>Deep Restore</Text>
                    <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', textAlign: 'center', marginTop: 4 }}>Bulk Recovery</Text>
                  </TouchableOpacity>
                </View>

                {/* Force Re-sync - Danger Zone Styled */}
                <TouchableOpacity
                  onPress={openResyncModal}
                  disabled={queueLength > 0}
                  style={{
                    backgroundColor: '#fff',
                    padding: 18,
                    borderRadius: 20,
                    borderWidth: 1.5,
                    borderColor: '#fee2e2',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    opacity: queueLength > 0 ? 0.6 : 1
                  }}
                >
                  <AlertCircle size={18} color="#ef4444" />
                  <Text style={{ flex: 1, fontSize: 13, fontWeight: '800', color: '#991b1b' }}>Force Database Re-sync</Text>
                  <Text style={{ fontSize: 11, color: '#ef4444', fontWeight: '900' }}>REBUILD</Text>
                </TouchableOpacity>

                {queueLength > 0 && (
                  <View style={{ backgroundColor: '#f8fafc', padding: 16, borderRadius: 16, borderLeftWidth: 4, borderLeftColor: '#f59e0b' }}>
                    <Text style={{ fontSize: 11, color: '#92400e', lineHeight: 18, fontWeight: '700' }}>
                      PRO TIP: Data recovery tools are temporarily locked while synchronization is active to prevent record duplication.
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Local backup section */}
            <Card style={[styles.card, { borderLeftWidth: 0, borderRightWidth: 0, borderRadius: 24, paddingVertical: 10, marginTop: 12 }]}>
              <View style={[styles.cardHeader, { backgroundColor: 'transparent', borderBottomWidth: 0, paddingBottom: 10 }]}>
                <View style={[styles.headerIconContainer, { backgroundColor: '#000', borderRadius: 12 }]}>
                  <Folder size={18} color="#fff" />
                </View>
                <Text style={[styles.cardTitle, { fontSize: 16, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 }]}>Device Protection</Text>
              </View>
              <View style={styles.cardPadding}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', padding: 20, borderRadius: 24, borderWidth: 1, borderColor: '#f1f5f9' }}>
                  <View style={{ flex: 1, marginRight: 16 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <Text style={{ fontSize: 15, fontWeight: '800', color: '#000' }}>Local Auto Save</Text>
                      <View style={{ backgroundColor: '#10b981', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                        <Text style={{ fontSize: 8, fontWeight: '900', color: '#fff' }}>ACTIVE</Text>
                      </View>
                    </View>
                    <Text style={{ fontSize: 12, color: '#64748b', lineHeight: 18 }}>Offline backup files are saved to your storage on every change.</Text>
                  </View>
                  <Switch
                    value={true}
                    disabled={true}
                    thumbColor="#fff"
                    trackColor={{ false: '#f1f5f9', true: '#000' }}
                  />
                </View>

                <View style={{ marginTop: 20, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 8 }}>
                  <View style={{ width: 32, height: 32, backgroundColor: '#f0fdf4', borderRadius: 16, justifyContent: 'center', alignItems: 'center' }}>
                    <Shield size={16} color="#10b981" />
                  </View>
                  <Text style={{ fontSize: 12, color: '#64748b', fontWeight: '500', flex: 1 }}>
                    All local data for Products, Parties, and Invoices is being mirrored for emergency recovery.
                  </Text>
                </View>
              </View>
            </Card>
          </View>
        );
      case 'contact':
        return (
          <View style={styles.tabContent}>
            {/* SUPPORT HERO SECTION */}
            <View style={{ marginBottom: 32 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#10b981' }} />
                    <Text style={{ fontSize: 10, fontWeight: '900', color: '#64748b', textTransform: 'uppercase', letterSpacing: 1 }}>Support is Online</Text>
                  </View>
                  <Text style={{ fontSize: 28, fontWeight: '900', color: '#000', letterSpacing: -1 }}>Help Center</Text>
                  <Text style={{ fontSize: 13, color: '#64748b', fontWeight: '500', marginTop: 4 }}>
                    How can we assist your business today?
                  </Text>
                </View>
                <View style={{ width: 56, height: 56, backgroundColor: '#f8fafc', borderRadius: 18, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#f1f5f9', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10 }}>
                  <Headset size={28} color="#000" />
                </View>
              </View>

              {/* ELITE SUPPORT COMMITMENT TILE */}
              <View
                style={{
                  backgroundColor: '#000',
                  padding: 24,
                  borderRadius: 32,
                  elevation: 12,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 12 },
                  shadowOpacity: 0.25,
                  shadowRadius: 24
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                  <View style={{ width: 48, height: 48, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 14, justifyContent: 'center', alignItems: 'center' }}>
                    <Award size={24} color="#fff" />
                  </View>
                  <View>
                    <Text style={{ color: '#fff', fontSize: 17, fontWeight: '900', letterSpacing: -0.3 }}>Priority Success Guarantee</Text>
                    <Text style={{ color: '#94a3b8', fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 }}>Premium SLA Coverage</Text>
                  </View>
                </View>
                <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, lineHeight: 20, fontWeight: '500' }}>
                  Our success experts are personally committed to your business growth. We ensure every request is handled with priority to keep your billing operations running 100% smoothly.
                </Text>
              </View>
            </View>

            {/* INTERACTIVE CONTACT CHANNELS */}
            <View style={{ gap: 16, marginBottom: 32 }}>
              <Text style={{ fontSize: 13, fontWeight: '900', color: '#000', textTransform: 'uppercase', letterSpacing: 1, marginLeft: 4, marginBottom: 4 }}>Direct Channels</Text>

              {/* WhatsApp Premium Card */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => Linking.openURL('whatsapp://send?phone=+917558175156&text=Hi Kwiq Billing Support, I need help with...')}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: '#fff',
                  padding: 20,
                  borderRadius: 24,
                  borderWidth: 1.5,
                  borderColor: '#000',
                  elevation: 4,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.1,
                  shadowRadius: 10
                }}
              >
                <View style={{ width: 52, height: 52, backgroundColor: '#000', borderRadius: 16, justifyContent: 'center', alignItems: 'center' }}>
                  <MessageCircle size={26} color="#fff" />
                </View>
                <View style={{ flex: 1, marginLeft: 16 }}>
                  <Text style={{ fontSize: 17, fontWeight: '900', color: '#000' }}>Official WhatsApp</Text>
                  <Text style={{ fontSize: 12, color: '#64748b', marginTop: 2, fontWeight: '600' }}>Fastest for screenshots & docs</Text>
                </View>
                <View style={{ backgroundColor: '#dcfce7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}>
                  <Text style={{ fontSize: 9, fontWeight: '900', color: '#166534' }}>ACTIVE</Text>
                </View>
              </TouchableOpacity>

              {/* Call Support Card */}
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => Linking.openURL('tel:+917558175156')}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: '#fff',
                  padding: 20,
                  borderRadius: 24,
                  borderWidth: 1,
                  borderColor: '#f1f5f9',
                  elevation: 2,
                  shadowColor: '#64748b',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.05,
                  shadowRadius: 5
                }}
              >
                <View style={{ width: 52, height: 52, backgroundColor: '#f8fafc', borderRadius: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#f1f5f9' }}>
                  <Phone size={24} color="#000" />
                </View>
                <View style={{ flex: 1, marginLeft: 16 }}>
                  <Text style={{ fontSize: 17, fontWeight: '800', color: '#000' }}>Phone Call</Text>
                  <Text style={{ fontSize: 12, color: '#64748b', marginTop: 2, fontWeight: '600' }}>Speak to a human expert</Text>
                </View>
                <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center' }}>
                  <ChevronRight size={18} color="#94a3b8" />
                </View>
              </TouchableOpacity>

              {/* Email Support Card */}
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => Linking.openURL('mailto:support@kwiqbill.com')}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: '#fff',
                  padding: 20,
                  borderRadius: 24,
                  borderWidth: 1,
                  borderColor: '#f1f5f9'
                }}
              >
                <View style={{ width: 52, height: 52, backgroundColor: '#f8fafc', borderRadius: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#f1f5f9' }}>
                  <Mail size={24} color="#000" />
                </View>
                <View style={{ flex: 1, marginLeft: 16 }}>
                  <Text style={{ fontSize: 17, fontWeight: '800', color: '#000' }}>Email Query</Text>
                  <Text style={{ fontSize: 12, color: '#64748b', marginTop: 2, fontWeight: '600' }}>For complex official issues</Text>
                </View>
                <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center' }}>
                  <ChevronRight size={18} color="#94a3b8" />
                </View>
              </TouchableOpacity>
            </View>

            {/* SERVICE COVERAGE FOOTER */}
            <View style={{ backgroundColor: '#f8fafc', borderRadius: 32, padding: 24, borderWidth: 1, borderColor: '#f1f5f9', marginBottom: 20 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <Clock size={18} color="#000" />
                <Text style={{ fontSize: 15, fontWeight: '900', color: '#000' }}>Service Coverage</Text>
              </View>

              <View style={{ gap: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
                  <Text style={{ fontSize: 13, color: '#64748b', fontWeight: '700' }}>Mon - Sat</Text>
                  <Text style={{ fontSize: 13, color: '#000', fontWeight: '800' }}>09:00 AM — 07:00 PM</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 }}>
                  <Text style={{ fontSize: 13, color: '#64748b', fontWeight: '700' }}>Sunday</Text>
                  <View style={{ backgroundColor: '#fee2e2', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 }}>
                    <Text style={{ fontSize: 10, color: '#ef4444', fontWeight: '900' }}>EMERGENCY ONLY</Text>
                  </View>
                </View>
              </View>

              {/* <View style={{ marginTop: 20, paddingTop: 20, borderTopWidth: 1, borderTopColor: '#f1f5f9', flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#10b981' }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, color: '#64748b', fontWeight: '700' }}>
                    Current wait time: <Text style={{ color: '#10b981', fontWeight: '900' }}>~12 Mins</Text>
                  </Text>
                  <Text style={{ fontSize: 10, color: '#94a3b8', fontWeight: '600', marginTop: 1 }}>Estimated based on current volume</Text>
                </View>
                <View style={{ backgroundColor: '#f0fdf4', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: '#dcfce7' }}>
                  <Text style={{ fontSize: 9, color: '#10b981', fontWeight: '900', letterSpacing: 0.5 }}>LIVE METRIC</Text>
                </View>
              </View> */}
            </View>
          </View>
        );
      case 'logout':
        return (
          <View style={styles.tabContent}>
            {/* NEW PREMIUM HEADER */}
            <View style={{ marginBottom: 32 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <Fingerprint size={12} color="#64748b" />
                    <Text style={{ fontSize: 10, fontWeight: '900', color: '#64748b', textTransform: 'uppercase', letterSpacing: 1 }}>Authenticated Session</Text>
                  </View>
                  <Text style={{ fontSize: 28, fontWeight: '900', color: '#000', letterSpacing: -1 }}>Sign Out</Text>
                  <Text style={{ fontSize: 13, color: '#64748b', fontWeight: '500', marginTop: 4 }}>
                    Securely end your session on this device.
                  </Text>
                </View>
                <View style={{ width: 56, height: 56, backgroundColor: '#fee2e2', borderRadius: 18, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#fecaca' }}>
                  <LogOut size={28} color="#dc2626" />
                </View>
              </View>
            </View>

            {/* SYNC SAFETY DASHBOARD */}
            <View style={{
              backgroundColor: queueLength > 0 ? '#fffbeb' : '#f0fdf4',
              borderRadius: 32,
              padding: 24,
              marginBottom: 28,
              borderWidth: 2,
              borderColor: queueLength > 0 ? '#fde68a' : '#bbf7d0',
              elevation: 4,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.05,
              shadowRadius: 20
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                <View style={{ width: 44, height: 44, backgroundColor: '#fff', borderRadius: 14, justifyContent: 'center', alignItems: 'center', elevation: 2 }}>
                  {queueLength > 0 ? <ActivityIndicator size="small" color="#d97706" /> : <ShieldCheck size={24} color="#16a34a" />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '900', color: '#000' }}>
                    {queueLength > 0 ? 'Data Syncing...' : 'Data Fully Secured'}
                  </Text>
                  <Text style={{ fontSize: 11, color: '#64748b', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 }}>Cloud Protection</Text>
                </View>
              </View>

              {queueLength > 0 ? (
                <View>
                  <Text style={{ fontSize: 13, color: '#92400e', lineHeight: 20, fontWeight: '600' }}>
                    You have <Text style={{ fontWeight: '900' }}>{queueLength} pending events</Text> that haven't been uploaded to the cloud yet. Logging out now might lead to temporary data mismatch until you log back in.
                  </Text>
                  <View style={{ marginTop: 16, height: 6, backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 3, overflow: 'hidden' }}>
                    <View style={{ width: '40%', height: '100%', backgroundColor: '#f59e0b' }} />
                  </View>
                </View>
              ) : (
                <Text style={{ fontSize: 13, color: '#166534', lineHeight: 20, fontWeight: '600' }}>
                  All your records are perfectly mirrored in your Google Drive. You can safely sign out and resume on any other device instantly.
                </Text>
              )}
            </View>

            {/* IMPACT STEPS */}
            <View style={{ marginBottom: 32, paddingHorizontal: 4 }}>
              <Text style={{ fontSize: 13, fontWeight: '900', color: '#000', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 20 }}>Final Security Protocol</Text>

              <View style={{ gap: 24 }}>
                <View style={{ flexDirection: 'row', gap: 16 }}>
                  <View style={{ width: 44, height: 44, backgroundColor: '#f8fafc', borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#f1f5f9' }}>
                    <Database size={18} color="#000" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '800', color: '#000' }}>Device Memory Purged</Text>
                    <Text style={{ fontSize: 12, color: '#64748b', fontWeight: '500', marginTop: 2 }}>Clears encrypted local cache to prevent unauthorized physical access to your records.</Text>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', gap: 16 }}>
                  <View style={{ width: 44, height: 44, backgroundColor: '#f8fafc', borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#f1f5f9' }}>
                    <Fingerprint size={18} color="#000" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '800', color: '#000' }}>Authentication Revoked</Text>
                    <Text style={{ fontSize: 12, color: '#64748b', fontWeight: '500', marginTop: 2 }}>Ends your session globally and requires re-authentication for any future access.</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* THE BIG ACTION */}
            <View style={{ marginTop: 8 }}>
              <TouchableOpacity
                onPress={handleLogout}
                activeOpacity={0.8}
                style={{
                  backgroundColor: queueLength > 0 ? '#64748b' : '#000',
                  paddingVertical: 20,
                  borderRadius: 28,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 12,
                  elevation: 8,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 10 },
                  shadowOpacity: 0.3,
                  shadowRadius: 20
                }}
              >
                <LogOut size={20} color="#fff" />
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: 1 }}>
                  {queueLength > 0 ? 'WAITING FOR SYNC...' : 'SIGN OUT SECURELY'}
                </Text>
              </TouchableOpacity>

              {queueLength > 0 && (
                <Text style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center', marginTop: 16, fontWeight: '700' }}>
                  Logout will be available once all {queueLength} events are in the cloud.
                </Text>
              )}
            </View>

            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={{ paddingVertical: 16, alignItems: 'center', marginTop: 8 }}
            >
              <Text style={{ fontSize: 13, color: '#64748b', fontWeight: '700' }}>Go back to Settings</Text>
            </TouchableOpacity>

            <View style={{ alignItems: 'center', marginTop: 20, opacity: 0.2 }}>
              <Text style={{ fontSize: 10, fontWeight: '900', color: '#000', letterSpacing: 1 }}>KWIQ BILL v1.0.0</Text>
            </View>
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <View style={styles.mainContainer}>
      <View style={styles.headerWrapper}>
        <LinearGradient
          colors={['#000000', '#1a1a1a']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={styles.headerGradient}
        >
          <SafeAreaView edges={['top']}>
            <StatusBar barStyle="light-content" backgroundColor="#000" />

            {/* Custom Header */}
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <TouchableOpacity
                  onPress={() => navigation.goBack()}
                  activeOpacity={0.7}
                  style={styles.backBtn}
                >
                  <ChevronLeft size={22} color="#fff" />
                </TouchableOpacity>
                <View style={{ flexShrink: 1 }}>
                  <Text style={styles.headerTitle}>Settings</Text>
                  {unsavedChanges && (
                    <View style={styles.unsavedBadge}>
                      <View style={styles.unsavedPulse} />
                      <Text style={styles.unsavedText}>Unsaved Edits</Text>
                    </View>
                  )}
                </View>
              </View>
              <View style={styles.headerActions}>
                {isEditing && (
                  <TouchableOpacity onPress={handleCancel} style={[styles.cancelBtn, { backgroundColor: 'rgba(255,255,255,0.1)', borderColor: 'rgba(255,255,255,0.2)' }]}>
                    <X size={20} color="#fff" />
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  onPress={(unsavedChanges && !isSaving) ? handleSave : null}
                  activeOpacity={unsavedChanges ? 0.7 : 1}
                  disabled={isSaving}
                  style={[
                    styles.saveBtn,
                    { backgroundColor: showSuccessIcon ? '#fff' : (unsavedChanges ? '#fff' : 'rgba(255,255,255,0.1)') },
                    (!unsavedChanges || isSaving) && !showSuccessIcon && { opacity: 0.5, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }
                  ]}
                >
                  {isSaving ? (
                    <ActivityIndicator size="small" color="#000" />
                  ) : showSuccessIcon ? (
                    <CheckCircle2 size={20} color="#000" />
                  ) : (
                    <Save size={20} color={unsavedChanges ? "#000" : "rgba(255,255,255,0.4)"} />
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleLogout}
                  style={[styles.cancelBtn, { backgroundColor: 'rgba(239, 68, 68, 0.15)', borderColor: 'rgba(239, 68, 68, 0.3)' }]}
                >
                  <LogOut size={20} color="#f87171" />
                </TouchableOpacity>
              </View>
            </View>
            {/* Tab Navigation grid inside header */}
            {/* Refined Tab Navigation */}
            <View style={[styles.tabBar, { paddingBottom: 10 }]}>
              {/* Row 1: Primary Tabs + More Trigger */}
              <View style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                gap: 8,
                width: '100%',
                marginBottom: 10
              }}>
                {tabs.slice(0, 3).map(tab => {
                  const Icon = tab.icon;
                  const active = activeTab === tab.id;
                  return (
                    <TouchableOpacity
                      key={tab.id}
                      onPress={() => setActiveTab(tab.id)}
                      style={[
                        styles.tabItem,
                        active && styles.tabItemActive,
                        { flex: 1, height: 44 }
                      ]}
                    >
                      <Icon size={14} color={active ? '#000' : 'rgba(255,255,255,0.65)'} />
                      <Text style={[styles.tabText, active ? { color: '#000' } : { color: 'rgba(255,255,255,0.65)' }]}>{tab.label}</Text>
                    </TouchableOpacity>
                  );
                })}

                {/* Professional More Button */}
                <TouchableOpacity
                  onPress={toggleSettingsMenu}
                  activeOpacity={0.8}
                  style={[
                    styles.tabItem,
                    isMenuExpanded && { backgroundColor: '#fff', borderColor: '#fff' },
                    { width: 50, height: 44, justifyContent: 'center' }
                  ]}
                >
                  <Animated.View style={{
                    transform: [{
                      rotate: menuExpandAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0deg', '180deg']
                      })
                    }]
                  }}>
                    <ChevronDown size={18} color={isMenuExpanded ? '#000' : '#fff'} />
                  </Animated.View>
                </TouchableOpacity>
              </View>

              {/* Row 2: Secondary Tabs (Animated Expansion) */}
              <Animated.View style={{
                overflow: 'hidden',
                maxHeight: menuExpandAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 140]
                }),
                opacity: menuExpandAnim,
              }}>
                <View style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: 8,
                  width: '100%',
                  paddingTop: 4
                }}>
                  {tabs.slice(3, 8).map(tab => {
                    const Icon = tab.icon;
                    const active = activeTab === tab.id;
                    const isContact = tab.id === 'contact';
                    const isLogout = tab.id === 'logout';

                    return (
                      <TouchableOpacity
                        key={tab.id}
                        onPress={() => setActiveTab(tab.id)}
                        style={[
                          styles.tabItem,
                          active && styles.tabItemActive,
                          isContact ? { minWidth: '64.5%', height: 44 } : { minWidth: '31%', height: 44 },
                          isLogout && { backgroundColor: 'rgba(239, 68, 68, 0.15)', borderColor: 'rgba(239, 68, 68, 0.3)' }
                        ]}
                      >
                        <Icon size={14} color={isLogout ? '#ef4444' : (active ? '#000' : 'rgba(255,255,255,0.65)')} />
                        <Text style={[styles.tabText, isLogout ? { color: '#ef4444' } : (active ? { color: '#000' } : { color: 'rgba(255,255,255,0.65)' })]}>{tab.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </Animated.View>
            </View>
          </SafeAreaView>
        </LinearGradient>
      </View>

      {/* Custom Logout Confirmation Modal */}
      <Modal
        visible={isLogoutModalVisible}
        transparent
        animationType="none"
        onRequestClose={closeLogoutModal}
      >
        <View style={styles.modalOverlay}>
          <Animated.View
            style={[
              styles.modalBackdrop,
              { opacity: logoutFadeAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.4] }) }
            ]}
          />
          <Pressable style={styles.modalPressable} onPress={closeLogoutModal}>
            <Animated.View
              style={[
                styles.logoutModalContainer,
                {
                  transform: [
                    { scale: logoutFadeAnim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) },
                    { translateY: logoutFadeAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }
                  ],
                  opacity: logoutFadeAnim
                }
              ]}
            >
              <View style={styles.logoutIconContainer}>
                <LogOut size={32} color="#fff" />
              </View>

              <Text style={styles.logoutModalTitle}>Signing Out?</Text>
              <Text style={styles.logoutModalDesc}>
                All local data and cache will be cleared from this device. {"\n\n"}
                <Text style={{ fontWeight: '800', color: '#000' }}>Don't worry:</Text> Your products, parties, and invoices are safely backed up to your Google Drive.
              </Text>

              <View style={styles.logoutModalFooter}>
                <TouchableOpacity
                  onPress={closeLogoutModal}
                  style={styles.logoutModalCancel}
                >
                  <Text style={styles.logoutModalCancelText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={confirmLogout}
                  style={styles.logoutModalConfirm}
                >
                  <Text style={styles.logoutModalConfirmText}>Sign Out</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </Pressable>
        </View>
      </Modal>

      {/* Custom Re-sync Confirmation Modal */}
      <Modal
        visible={isResyncModalVisible}
        transparent
        animationType="none"
        onRequestClose={closeResyncModal}
      >
        <View style={styles.modalOverlay}>
          <Animated.View
            style={[
              styles.modalBackdrop,
              { opacity: resyncFadeAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.4] }) }
            ]}
          />
          <Pressable style={styles.modalPressable} onPress={closeResyncModal}>
            <Animated.View
              style={[
                styles.logoutModalContainer, // Reusing logout modal container styles
                {
                  transform: [
                    { scale: resyncFadeAnim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) },
                    { translateY: resyncFadeAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }
                  ],
                  opacity: resyncFadeAnim
                }
              ]}
            >
              <View style={[styles.logoutIconContainer, { backgroundColor: '#f1f5f9' }]}>
                <RefreshCw size={32} color="#000" />
              </View>

              <Text style={styles.logoutModalTitle}>Force Re-sync?</Text>
              <Text style={styles.logoutModalDesc}>
                This will clear local sync data and re-download everything from your Google Drive. {"\n\n"}
                <Text style={{ fontWeight: '800', color: '#000' }}>Warning:</Text> Your local data will be replaced to match the cloud exactly.
              </Text>

              <View style={styles.logoutModalFooter}>
                <TouchableOpacity
                  onPress={closeResyncModal}
                  style={styles.logoutModalCancel}
                >
                  <Text style={styles.logoutModalCancelText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={confirmResync}
                  style={[styles.logoutModalConfirm, { backgroundColor: '#000' }]}
                >
                  <Text style={styles.logoutModalConfirmText}>Re-sync Now</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </Pressable>
        </View>
      </Modal>

      {/* Custom Repair Sync Confirmation Modal */}
      <Modal
        visible={isRepairModalVisible}
        transparent
        animationType="none"
        onRequestClose={closeRepairModal}
      >
        <View style={styles.modalOverlay}>
          <Animated.View
            style={[
              styles.modalBackdrop,
              { opacity: repairFadeAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.4] }) }
            ]}
          />
          <Pressable style={styles.modalPressable} onPress={closeRepairModal}>
            <Animated.View
              style={[
                styles.logoutModalContainer,
                {
                  transform: [
                    { scale: repairFadeAnim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) },
                    { translateY: repairFadeAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }
                  ],
                  opacity: repairFadeAnim
                }
              ]}
            >
              <View style={[styles.logoutIconContainer, { backgroundColor: '#f1f5f9' }]}>
                <Cloud size={32} color="#000" />
              </View>

              <Text style={styles.logoutModalTitle}>Quick Repair?</Text>
              <Text style={styles.logoutModalDesc}>
                This re-scans for missed individual events. Use this if only a few recent items are missing. {"\n\n"}
                <Text style={{ fontWeight: '800', color: '#000' }}>Note:</Text> This is safe and will not delete your data.
              </Text>

              <View style={styles.logoutModalFooter}>
                <TouchableOpacity
                  onPress={closeRepairModal}
                  style={styles.logoutModalCancel}
                >
                  <Text style={styles.logoutModalCancelText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={confirmRepair}
                  style={[styles.logoutModalConfirm, { backgroundColor: '#000' }]}
                >
                  <Text style={styles.logoutModalConfirmText}>Repair Now</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </Pressable>
        </View>
      </Modal>

      {/* Custom Deep Repair Confirmation Modal */}
      <Modal
        visible={isDeepRepairModalVisible}
        transparent
        animationType="none"
        onRequestClose={closeDeepRepairModal}
      >
        <View style={styles.modalOverlay}>
          <Animated.View
            style={[
              styles.modalBackdrop,
              { opacity: deepRepairFadeAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.4] }) }
            ]}
          />
          <Pressable style={styles.modalPressable} onPress={closeDeepRepairModal}>
            <Animated.View
              style={[
                styles.logoutModalContainer,
                {
                  transform: [
                    { scale: deepRepairFadeAnim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) },
                    { translateY: deepRepairFadeAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }
                  ],
                  opacity: deepRepairFadeAnim
                }
              ]}
            >
              <View style={[styles.logoutIconContainer, { backgroundColor: '#000' }]}>
                <ShieldCheck size={32} color="#fff" />
              </View>

              <Text style={styles.logoutModalTitle}>Deep Data Restore?</Text>
              <Text style={styles.logoutModalDesc}>
                This is the strongest repair. It recovers bulk data from major cloud snapshots and then merges all recent events. {"\n\n"}
                <Text style={{ fontWeight: '800', color: '#000' }}>Recommended:</Text> Use this if large numbers of products are missing.
              </Text>

              <View style={styles.logoutModalFooter}>
                <TouchableOpacity
                  onPress={closeDeepRepairModal}
                  style={styles.logoutModalCancel}
                >
                  <Text style={styles.logoutModalCancelText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={confirmDeepRepair}
                  style={[styles.logoutModalConfirm, { backgroundColor: '#000' }]}
                >
                  <Text style={styles.logoutModalConfirmText}>Run Deep Repair</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </Pressable>
        </View>
      </Modal>

      {/* Custom Discard Changes Confirmation Modal */}
      <Modal
        visible={isDiscardModalVisible}
        transparent
        animationType="none"
        onRequestClose={closeDiscardModal}
      >
        <View style={styles.modalOverlay}>
          <Animated.View
            style={[
              styles.modalBackdrop,
              { opacity: discardFadeAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.4] }) }
            ]}
          />
          <Pressable style={styles.modalPressable} onPress={closeDiscardModal}>
            <Animated.View
              style={[
                styles.logoutModalContainer,
                {
                  transform: [
                    { scale: discardFadeAnim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) },
                    { translateY: discardFadeAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }
                  ],
                  opacity: discardFadeAnim
                }
              ]}
            >
              <View style={[styles.logoutIconContainer, { backgroundColor: '#fff7ed', borderWidth: 1, borderColor: '#ffedd5' }]}>
                <RotateCcw size={32} color="#f97316" />
              </View>

              <Text style={styles.logoutModalTitle}>Discard Edits?</Text>
              <Text style={styles.logoutModalDesc}>
                You have unsaved configuration changes. Reverting will permanently lose these modifications. {"\n\n"}
                <Text style={{ fontWeight: '800', color: '#000' }}>Final Action:</Text> Are you sure you want to discard your progress?
              </Text>

              <View style={styles.logoutModalFooter}>
                <TouchableOpacity
                  onPress={closeDiscardModal}
                  style={styles.logoutModalCancel}
                >
                  <Text style={styles.logoutModalCancelText}>Keep Editing</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={confirmDiscard}
                  style={[styles.logoutModalConfirm, { backgroundColor: '#000' }]}
                >
                  <Text style={styles.logoutModalConfirmText}>Discard All</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </Pressable>
        </View>
      </Modal>

      {/* New Receptionist Modal (Fix for Android Alert.prompt) */}
      <Modal
        visible={isUserModalVisible}
        transparent
        animationType="none"
        onRequestClose={closeUserModal}
      >
        <View style={styles.modalOverlay}>
          <Animated.View
            style={[
              styles.modalBackdrop,
              { opacity: userModalFadeAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.4] }) }
            ]}
          />
          <Pressable style={styles.modalPressable} onPress={closeUserModal}>
            <Animated.View
              style={[
                styles.logoutModalContainer,
                {
                  transform: [
                    { scale: userModalFadeAnim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) },
                    { translateY: userModalFadeAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }
                  ],
                  opacity: userModalFadeAnim
                }
              ]}
            >
              <View style={[styles.logoutIconContainer, { backgroundColor: '#f1f5f9', marginBottom: 12 }]}>
                <Contact size={32} color="#000" />
              </View>

              <Text style={[styles.logoutModalTitle, { marginBottom: 4 }]}>
                {userModalMode === 'add' ? 'New Receptionist' : 'Edit Receptionist'}
              </Text>
              
              <View style={{ width: '100%', marginTop: 24, paddingHorizontal: 4 }}>
                <Text style={[styles.label, { color: '#64748b', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }]}>Staff Full Name</Text>
                <View style={[styles.inputFieldContainer, { backgroundColor: '#f8fafc', borderColor: '#f1f5f9' }]}>
                  <Contact size={20} color="#94a3b8" style={{ marginRight: 12 }} />
                  <TextInput
                    style={[styles.input, { flex: 1, fontSize: 16, fontWeight: '700', color: '#000' }]}
                    placeholder="Enter name (e.g. John Doe)"
                    placeholderTextColor="#cbd5e1"
                    value={userNameInput}
                    onChangeText={setUserNameInput}
                    autoFocus
                  />
                </View>
                <Text style={{ fontSize: 10, color: '#94a3b8', marginTop: 8, fontWeight: '500' }}>
                  This name will appear on the authorized signatory section of the bill.
                </Text>
              </View>

              <View style={[styles.logoutModalFooter, { marginTop: 32 }]}>
                <TouchableOpacity
                  onPress={closeUserModal}
                  style={styles.logoutModalCancel}
                >
                  <Text style={styles.logoutModalCancelText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleUserModalSubmit}
                  style={[styles.logoutModalConfirm, { backgroundColor: '#000' }]}
                >
                  <Text style={styles.logoutModalConfirmText}>
                    {userModalMode === 'add' ? 'Add Staff' : 'Update'}
                  </Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </Pressable>
        </View>
      </Modal>

      {/* Initialize New Master PIN Modal */}
      <Modal
        visible={isPinResetModalVisible}
        transparent
        animationType="none"
        onRequestClose={closePinResetModal}
      >
        <View style={styles.modalOverlay}>
          <Animated.View
            style={[
              styles.modalBackdrop,
              { opacity: pinResetFadeAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.4] }) }
            ]}
          />
          <Pressable style={styles.modalPressable} onPress={closePinResetModal}>
            <Animated.View
              style={[
                styles.logoutModalContainer,
                {
                  transform: [
                    { scale: pinResetFadeAnim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) },
                    { translateY: pinResetFadeAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }
                  ],
                  opacity: pinResetFadeAnim,
                  borderColor: '#000',
                  borderWidth: 2,
                }
              ]}
            >
              <View style={[styles.logoutIconContainer, { backgroundColor: '#000' }]}>
                <Lock size={32} color="#fff" />
              </View>

              <Text style={styles.logoutModalTitle}>Reset Master PIN?</Text>
              <Text style={styles.logoutModalDesc}>
                This will clear your current Manager PIN and reset vault security. {"\n\n"}
                <Text style={{ fontWeight: '800', color: '#000' }}>Process:</Text> You will be asked to set a new 4-digit PIN immediately.
              </Text>

              <View style={styles.logoutModalFooter}>
                <TouchableOpacity
                  onPress={closePinResetModal}
                  style={styles.logoutModalCancel}
                >
                  <Text style={styles.logoutModalCancelText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={async () => {
                    closePinResetModal();
                    previousPinRef.current = settings?.security?.managerPin;
                    await updateSettings('security', { managerPin: null });
                    setIsChangingPin(true);
                    setIsPinVerified(false);
                  }}
                  style={[styles.logoutModalConfirm, { backgroundColor: '#000' }]}
                >
                  <Text style={styles.logoutModalConfirmText}>Reset PIN</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </Pressable>
        </View>
      </Modal>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        enabled={Platform.OS === 'ios'}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={styles.scroller}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 60, flexGrow: 1 }}
          removeClippedSubviews={false}
        >
          {renderTabContent()}
          <View style={styles.footer}>
            <Text style={styles.footerText}>KWIQ BILL • {APP_VERSION}</Text>
            <Text style={{ fontSize: 9, color: '#cbd5e1', fontWeight: '700', marginTop: 4 }}>POWERED BY ZIPPY</Text>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: '#fcfcfe' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerWrapper: { backgroundColor: '#000', borderBottomLeftRadius: 28, borderBottomRightRadius: 28, overflow: 'hidden' },
  headerGradient: {
    paddingBottom: 10,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingVertical: 8, // Reduced from 14
    backgroundColor: 'transparent',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  headerTitle: { fontSize: 26, fontWeight: '900', color: '#fff', letterSpacing: -0.6 },
  unsavedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 4,
    borderColor: 'rgba(251, 191, 36, 0.25)',
    borderWidth: 1,
    alignSelf: 'flex-start'
  },
  unsavedPulse: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fbbf24',
  },
  unsavedText: {
    color: '#fbbf24',
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8
  },
  headerActions: { flexDirection: 'row', gap: 10 },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  saveBtn: {
    height: 44,
    paddingHorizontal: 18,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center'
  },
  cancelBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5
  },
  saveBtnDisabled: { backgroundColor: 'rgba(255,255,255,0.05)', opacity: 0.4 },

  tabBar: {
    backgroundColor: 'transparent',
    marginTop: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    gap: 10,
    justifyContent: 'flex-start'
  },
  tabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  tabItemActive: {
    backgroundColor: '#fff',
    borderColor: '#fff',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8
  },
  tabText: { fontSize: 12, fontWeight: '800', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: 0.5 },
  tabTextActive: { color: '#000' },

  scroller: { flex: 1 },
  tabContent: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40 },
  card: {
    marginBottom: 24,
    backgroundColor: '#fff',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    elevation: 2,
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 20,
    borderBottomWidth: 1.5,
    borderBottomColor: '#f1f5f9',
    backgroundColor: '#fff'
  },
  headerIconContainer: { padding: 8, backgroundColor: '#000', borderRadius: 10 },
  cardTitle: { fontSize: 18, fontWeight: '800', color: '#000' },
  cardPadding: { padding: 20 },
  cardPaddingHorizontal: { paddingHorizontal: 20 },

  detailRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  detailIcon: { marginRight: 14 },
  detailLabel: { fontSize: 12, color: '#64748b', fontWeight: '600', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  detailValue: { fontSize: 16, color: '#000', fontWeight: '700' },

  readOnlyBadge: { backgroundColor: '#f8fafc', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  readOnlyBadgeText: { fontSize: 15, color: '#000', fontWeight: '700' },

  inputGroup: { marginBottom: 22 },
  inputRow: { flexDirection: 'row', gap: 12 },
  label: { fontSize: 14, fontWeight: '800', color: '#000', marginBottom: 10 },
  helperText: { fontSize: 12, color: '#64748b', marginTop: 6, fontWeight: '500' },

  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  mt4: { marginTop: 24 },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, marginBottom: 18 },
  sectionTitle: { fontSize: 22, fontWeight: '900', color: '#000' },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#000', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  addBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },

  matrixCard: {
    marginBottom: 18,
    padding: 18,
    borderLeftWidth: 8,
    borderLeftColor: '#000',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#000',
    backgroundColor: '#fff'
  },
  matrixDisabled: { opacity: 0.6, borderLeftColor: '#f1f5f9' },
  matrixHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  matrixName: { fontSize: 18, fontWeight: '900', color: '#000' },
  matrixInput: { flex: 1, height: 40, borderWidth: 0, paddingHorizontal: 0, fontSize: 18, fontWeight: '900', color: '#000' },
  matrixBody: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  matrixItem: { flex: 1 },
  matrixLabel: { fontSize: 12, color: '#64748b', fontWeight: '700', marginBottom: 8, textTransform: 'uppercase' },
  matrixVal: { fontSize: 17, fontWeight: '800', color: '#000' },
  smallInput: { height: 46, fontSize: 16, borderRadius: 12, borderWidth: 1.5, borderColor: '#000' },

  // --- Bank Card & Professional UI ---
  bankCard: {
    borderRadius: 32,
    padding: 22,
    marginBottom: 24,
    overflow: 'hidden',
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
  },
  bankCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  bankCardChip: {
    width: 44,
    height: 30,
    borderRadius: 6,
    backgroundColor: '#FFD700',
    borderWidth: 1,
    borderColor: '#B8860B',
    marginBottom: 16,
    position: 'relative',
    overflow: 'hidden'
  },
  bankCardNumber: {
    fontSize: 20,
    color: '#fff',
    fontWeight: '800',
    letterSpacing: 3,
    marginBottom: 20,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  bankCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  bankCardLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  bankCardValue: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  inputFieldContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 56,
  },
  inputIcon: {
    marginRight: 12,
  },

  templateScroll: { paddingVertical: 10, paddingHorizontal: 6 },
  templateBtn: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#f1f5f9',
    marginRight: 14,
    backgroundColor: '#fff',
    minWidth: 130,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center' },
  templateActive: { borderColor: '#000', backgroundColor: '#f1f5f9' },
  templateText: { fontWeight: '800', color: '#64748b', fontSize: 15 },
  templateTextActive: { color: '#000' },

  toggleItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  toggleLabel: { fontSize: 16, color: '#000', fontWeight: '700' },

  pickerContainer: { flexDirection: 'row', backgroundColor: '#f1f5f9', padding: 8, borderRadius: 16, marginBottom: 20 },
  pickerItem: { flex: 1, paddingVertical: 14, alignItems: 'center', borderRadius: 12 },
  pickerActive: { backgroundColor: '#000', elevation: 0 },
  pickerText: { fontSize: 14, fontWeight: '800', color: '#64748b' },
  pickerTextActive: { color: '#fff' },

  footer: { padding: 40, alignItems: 'center', borderTopWidth: 1, borderTopColor: '#f1f5f9', marginTop: 20 },
  footerText: { color: '#94a3b8', fontSize: 12, fontWeight: '600', marginBottom: 6 },
  infoBox: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#f5f5f5', padding: 14, borderRadius: 12, marginTop: 20, borderWidth: 1.5, borderColor: '#000' },
  infoText: { flex: 1, fontSize: 13, color: '#000', lineHeight: 18, fontWeight: '700' },

  // Contact Styles
  contactIntro: { fontSize: 14, color: '#64748b', lineHeight: 20, marginBottom: 24 },
  contactItem: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', marginBottom: 8 },
  contactIconBox: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  contactLabel: { fontSize: 12, color: '#64748b', fontWeight: '500', marginBottom: 2 },
  contactValue: { fontSize: 16, color: '#1e293b', fontWeight: '700' },

  // Template Preview Styles
  previewCard: {
    width: 150,
    height: 200,
    backgroundColor: '#fff',
    borderRadius: 0, // Removed corner radius as requested
    borderWidth: 2,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
    marginRight: 16,
    position: 'relative'
  },
  previewActive: {
    borderColor: '#000',
    borderWidth: 3
  },
  previewHeader: { height: 28, backgroundColor: '#f1f5f9', marginBottom: 10, borderRadius: 6, margin: 10 },
  previewLine: { height: 5, backgroundColor: '#e2e8f0', marginBottom: 6, borderRadius: 3, marginHorizontal: 10 },
  previewBlock: { height: 45, backgroundColor: '#f8fafc', margin: 10, borderRadius: 6, borderWidth: 1, borderColor: '#f1f5f9' },
  previewFooter: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 24, backgroundColor: '#f1f5f9' },
  previewLabel: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: '#fff',
    padding: 10,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9'
  },
  previewText: { fontSize: 13, fontWeight: '800', color: '#64748b' },
  previewTextActive: { color: '#000' },

  // Specific Template Styles
  classicHeader: { backgroundColor: '#000' },
  compactBlock: { margin: 5, height: 22 },
  minimalBorder: { borderWidth: 0, backgroundColor: '#fbfbfb' },
  detailedBorder: { borderWidth: 1.5, borderColor: '#000' },

  // --- New Tax UI Styles ---
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 14,
    padding: 6,
    height: 48,
    marginTop: 8
  },
  segmentBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10
  },
  segmentBtnActive: {
    backgroundColor: '#fff',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b'
  },
  segmentTextActive: {
    color: '#000',
    fontWeight: '800'
  },
  helperTextSmall: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 8,
    marginLeft: 4,
    fontWeight: '500'
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
    marginTop: 2
  },
  matrixHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 20
  },
  labelSmall: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94a3b8',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  matrixInputCompact: {
    height: 42,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    fontSize: 15,
    fontWeight: '700',
    paddingHorizontal: 10
  },
  matrixRateInput: {
    height: 42,
    borderWidth: 1.5,
    borderColor: '#000',
    borderRadius: 10,
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
    paddingHorizontal: 0
  },
  matrixRateDisplay: {
    fontSize: 22,
    fontWeight: '900',
    color: '#000',
    letterSpacing: -1
  },
  deleteBtnIcon: {
    padding: 10,
    backgroundColor: '#fff',
    borderRadius: 10,
    marginTop: 18,
    borderWidth: 1.5,
    borderColor: '#000'
  },
  matrixSplitView: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    borderRadius: 12,
    overflow: 'hidden'
  },
  matrixSplitCol: {
    flex: 1,
    padding: 14,
    backgroundColor: '#fafafa'
  },
  splitHeader: {
    fontSize: 10,
    fontWeight: '900',
    color: '#000',
    marginBottom: 2,
    letterSpacing: 0.5
  },
  splitSub: {
    fontSize: 10,
    color: '#64748b',
    marginBottom: 12
  },
  taxComponentRow: {
    gap: 8
  },
  taxCompBadge: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6
  },
  taxCompLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#475569'
  },
  taxCompVal: {
    fontSize: 12,
    fontWeight: '800',
    color: '#000'
  },
  sectionDesc: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 16,
    lineHeight: 18
  },
  actionButton: {
    backgroundColor: '#000',
    paddingVertical: 14,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14
  },
  syncActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  miniSyncBtn: {
    backgroundColor: '#000',
    paddingVertical: 10,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8
  },
  miniSyncBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13
  },
  syncStatusBadge: {
    flex: 1,
    backgroundColor: '#fff',
    paddingVertical: 10,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: '#000'
  },
  syncStatusText: {
    color: '#000',
    fontSize: 12,
    fontWeight: '900'
  },
  divider: {
    height: 1.5,
    backgroundColor: '#e5e5e5',
    marginVertical: 20
  },
  dangerZone: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#000'
  },
  dangerTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#000',
    marginBottom: 4,
    textTransform: 'uppercase'
  },
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10
  },
  dangerButtonText: {
    color: '#000',
    fontWeight: '800',
    fontSize: 13,
    textDecorationLine: 'underline'
  },
  uploadInfoBox: {
    backgroundColor: '#fff',
    borderColor: '#e2e8f0',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
  },
  uploadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  uploadLabel: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  uploadValue: {
    fontSize: 14,
    color: '#0f172a',
    fontWeight: '700',
  },
  queueWarning: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#000',
    gap: 8,
  },
  queueWarningText: {
    fontSize: 12,
    color: '#000',
    flex: 1,
    lineHeight: 18,
    fontWeight: '700'
  },



  // --- Thermal Preview Styles ---
  thermalPaper: {
    width: '100%',
    backgroundColor: '#fff',
    padding: 16,
    marginRight: 16,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  tpStoreName: { fontSize: 16, fontWeight: '900', color: '#000', textAlign: 'center', textTransform: 'uppercase', marginBottom: 4 },
  tpText: { fontSize: 10, color: '#000', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', lineHeight: 14 },
  tpTextCenter: { textAlign: 'center' },
  tpTextRight: { textAlign: 'right' },
  tpTextBold: { fontSize: 10, fontWeight: '700', color: '#000', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  tpHeader: { fontSize: 12, fontWeight: '800', color: '#000', textTransform: 'uppercase', letterSpacing: 1, textAlign: 'center', marginVertical: 6 },
  tpDashedLine: { height: 1, borderWidth: 1, borderColor: '#000', borderStyle: 'dashed', borderRadius: 1, width: '100%', marginVertical: 8 },
  tpRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  tpTotal: { fontSize: 14, fontWeight: '900', color: '#000' },
  tpGxBox: { borderWidth: 1, borderColor: '#000', borderStyle: 'dashed', padding: 4, marginTop: 8 },
  tpGxHeader: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#000', borderStyle: 'dashed', paddingBottom: 4, marginBottom: 4 },
  tpGxRow: { flexDirection: 'row', paddingVertical: 2 },

  // --- A4 Invoice Preview Styles (Classic) ---
  a4Paper: {
    width: '100%',
    backgroundColor: '#fff',
    paddingBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden'
  },
  a4BlueHeader: {
    backgroundColor: '#000',
    width: '100%',
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 0
  },
  a4LogoCircle: {
    display: 'none'
  },
  a4LogoText: { display: 'none' },
  a4Title: {
    fontSize: 36,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 3,
    textTransform: 'uppercase'
  },
  a4MetaRow: { flexDirection: 'row', paddingHorizontal: 24, marginTop: 16 },
  a4MetaGrid: { flexDirection: 'row', gap: 32 },
  a4MetaItem: { alignItems: 'flex-start' },
  a4MetaLabel: { fontSize: 10, fontWeight: '800', color: '#64748b', marginBottom: 2, letterSpacing: 0.5 },
  a4MetaValue: { fontSize: 13, fontWeight: '800', color: '#000' },
  a4PaymentTerms: { fontSize: 10, fontStyle: 'italic', color: '#94a3b8', textAlign: 'center', marginTop: 8, marginBottom: 24 },

  a4AddressRow: { flexDirection: 'row', paddingHorizontal: 24, marginBottom: 30 },
  a4LabelBlue: { fontSize: 11, fontWeight: '900', color: '#000', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  a4NameBold: { fontSize: 14, fontWeight: '800', color: '#000', marginBottom: 4 },
  a4AddressText: { fontSize: 11, color: '#334155', lineHeight: 16 },

  a4TableHeader: { flexDirection: 'row', backgroundColor: '#000', paddingVertical: 10, paddingHorizontal: 24 },
  a4Th: { fontSize: 10, fontWeight: '800', color: '#fff', textTransform: 'uppercase' },
  a4TableRow: { flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 24, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  a4Td: { fontSize: 11, color: '#0f172a', fontWeight: '500' },

  a4TotalRow: { flexDirection: 'row', width: 200, justifyContent: 'space-between', paddingRight: 24, marginBottom: 8 },
  a4TotalLabel: { fontSize: 11, color: '#64748b', fontWeight: '600' },
  a4TotalValue: { fontSize: 11, fontWeight: '700', color: '#000' },
  a4BalanceBox: { flexDirection: 'row', width: 240, justifyContent: 'space-between', backgroundColor: '#000', paddingVertical: 10, paddingHorizontal: 16, marginTop: 12, marginRight: 24, borderRadius: 0 },
  a4BalanceLabel: { fontSize: 12, fontWeight: '900', color: '#fff', letterSpacing: 1 },
  a4BalanceValue: { fontSize: 13, fontWeight: '900', color: '#fff' },

  a4Notes: { fontSize: 11, color: '#334155', paddingHorizontal: 24, marginTop: 4, lineHeight: 16 },
  a4ThankYou: { fontSize: 18, fontWeight: '900', fontStyle: 'italic', color: '#000', paddingLeft: 24 },
  a4Sign: { fontSize: 11, color: '#64748b', fontWeight: '600' },

  // --- Compact Template Styles ---
  compactPaper: {
    width: '100%',
    backgroundColor: '#fff',
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  compactTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#000',
    textAlign: 'center',
    marginBottom: 24,
    textTransform: 'uppercase',
    letterSpacing: 3
  },
  compactStoreName: {
    fontSize: 22,
    fontWeight: '900',
    color: '#000',
    marginBottom: 6
  },
  compactStoreDetails: {
    fontSize: 10,
    color: '#475569',
    lineHeight: 14,
    maxWidth: '95%',
    marginTop: 2
  },
  compactMetaContainer: {
    marginTop: 16,
    marginBottom: 20,
    borderTopWidth: 1.5,
    borderBottomWidth: 1.5,
    borderColor: '#000',
    backgroundColor: '#f5f5f5',
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  compactMetaText: {
    fontSize: 12,
    color: '#000',
    fontWeight: '600',
    marginBottom: 2,
    lineHeight: 18
  },
  compactMetaLabel: {
    fontWeight: '900',
    color: '#000',
    textTransform: 'uppercase',
    fontSize: 12
  },
  compactAddressRow: {
    flexDirection: 'row',
    marginBottom: 24,
    paddingHorizontal: 4
  },
  compactAddressBlock: {
    flex: 1
  },
  compactLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: '#000',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  compactCustomerName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#000',
    marginBottom: 2
  },
  compactTableHeader: {
    flexDirection: 'row',
    backgroundColor: '#000',
    borderTopWidth: 1.5,
    borderLeftWidth: 1.5,
    borderRightWidth: 1.5,
    borderColor: '#000'
  },
  compactTh: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRightWidth: 1,
    borderRightColor: '#333'
  },
  compactTableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#fff'
  },
  compactTd: {
    fontSize: 10,
    color: '#334155',
    fontWeight: '500',
  },

  // --- Modal Styles ---
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  modalPressable: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  logoutModalContainer: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#fff',
    borderRadius: 32,
    padding: 30,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.2,
    shadowRadius: 30,
    elevation: 10,
  },
  logoutIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 22,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  logoutModalTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#000',
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  logoutModalDesc: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 32,
    fontWeight: '500',
  },
  logoutModalFooter: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  logoutModalCancel: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    alignItems: 'center',
  },
  logoutModalCancelText: {
    color: '#64748b',
    fontWeight: '800',
    fontSize: 14,
  },
  logoutModalConfirm: {
    flex: 1.5,
    backgroundColor: '#ef4444',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  logoutModalConfirmText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 14,
  },
  compactTermsBox: {
    flex: 1,
    padding: 12,
    borderRightWidth: 1.5,
    borderColor: '#000'
  },
  compactTotalsBox: {
    width: 200,
  },
  compactTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9'
  },
  compactGrandTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 8,
    backgroundColor: '#f5f5f5',
    borderBottomWidth: 0
  },
  compactFooterText: { fontSize: 10, color: '#334155', lineHeight: 14 },

  // --- Detailed Template Styles ---
  detailedPaper: {
    width: Dimensions.get('window').width - 16,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#000',
    overflow: 'hidden'
  },
  detailedRow: {
    flexDirection: 'row',
    borderColor: '#000'
  },
  detailedCol: {
    borderRightWidth: 1,
    borderColor: '#000',
    padding: 4
  },
  detailedText: {
    fontSize: 9,
    color: '#000',
    fontFamily: 'System', // Use default system font to ensure clean render
    flexWrap: 'wrap'
  },
  detailedBold: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#000'
  },
  detailedCheckBox: {
    width: 10,
    height: 10,
    borderWidth: 1,
    borderColor: '#000',
    marginLeft: 4,
    justifyContent: 'center',
    alignItems: 'center'
  }
});

const InvoiceTemplatePreview = ({ variant, isActive }) => {
  const isClassic = variant === 'Classic';
  const isCompact = variant === 'Compact';
  const isDetailed = variant === 'Detailed';
  const isMinimal = variant === 'Minimal';

  return (
    <View style={[styles.previewCard, isActive && styles.previewActive]}>
      {/* Visual Representation */}
      <View style={{ flex: 1, padding: 2, opacity: isActive ? 1 : 0.6 }}>
        {/* Header */}
        <View style={[
          styles.previewHeader,
          isClassic && { backgroundColor: '#000' },
          isMinimal && { backgroundColor: '#000', height: 20, marginHorizontal: 0, marginTop: 0, borderRadius: 0 }
        ]} />

        {/* Body Content */}
        <View style={{ flex: 1, paddingVertical: 10 }}>
          {/* Lines representing rows */}
          <View style={[styles.previewLine, { width: '65%', backgroundColor: (isClassic || isMinimal) ? '#000' : '#e2e8f0' }]} />
          <View style={[styles.previewLine, { width: '45%' }]} />

          {/* Table/Grid Area */}
          {isCompact ? (
            <>
              <View style={[styles.previewBlock, styles.compactBlock]} />
              <View style={[styles.previewBlock, styles.compactBlock]} />
              <View style={[styles.previewBlock, styles.compactBlock]} />
            </>
          ) : isDetailed ? (
            <View style={[styles.previewBlock, styles.detailedBorder, { height: 70 }]} />
          ) : (
            <View style={[styles.previewBlock, isMinimal && { borderWidth: 0, backgroundColor: '#fcfcfe', borderBottomWidth: 1, borderColor: '#eee' }]} />
          )}

          <View style={[styles.previewLine, { width: '75%', marginTop: 'auto', marginBottom: 35 }]} />
        </View>

        {/* Footer */}
        <View style={[
          styles.previewFooter,
          isMinimal && { backgroundColor: '#000', height: 35, borderRadius: 0 }
        ]} />
      </View>

      {/* Label */}
      <View style={styles.previewLabel}>
        <Text style={[styles.previewText, isActive && styles.previewTextActive]}>{variant}</Text>
        {isActive && <CheckCircle2 size={14} color="#000" style={{ marginTop: 4 }} />}
      </View>


    </View>
  );
};

export default SettingsPage;
