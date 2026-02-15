import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, TouchableOpacity, Pressable, TextInput, Alert, ActivityIndicator, Platform, KeyboardAvoidingView, StatusBar, Linking, Dimensions, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import DetailedInvoiceTemplate from './DetailedInvoiceTemplate';
import MinimalInvoiceTemplate from './MinimalInvoiceTemplate';
import ClassicInvoiceTemplate from './ClassicInvoiceTemplate';
import CompactInvoiceTemplate from './CompactInvoiceTemplate';
import ThermalInvoiceTemplate from './ThermalInvoiceTemplate';
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
  CreditCard,
  Upload,
  Image as ImageIcon
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

const SettingsPage = ({ navigation }) => {
  // Trigger clear cache
  const { logout } = useAuth();
  const { settings, updateSettings, saveFullSettings, syncAllData, syncToCloud, forceResync, lastEventSyncTime, syncStatus, loading, queueLength, isUploading } = useSettings();
  const { fetchCustomers } = useCustomers();
  const { fetchProducts } = useProducts();
  const { fetchTransactions } = useTransactions();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState('store');
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const [taxGroups, setTaxGroups] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [localSettings, setLocalSettings] = useState(null);

  useEffect(() => {
    if (settings && !isEditing) {
      setLocalSettings(JSON.parse(JSON.stringify(settings)));
      if (settings.tax?.taxGroups) {
        setTaxGroups(settings.tax.taxGroups);
      }
    }
  }, [settings, isEditing]);

  useFocusEffect(
    useCallback(() => {
      StatusBar.setBarStyle('dark-content');
      if (Platform.OS === 'android') {
        StatusBar.setBackgroundColor('#ffffff');
      }
    }, [])
  );

  const handleLogout = () => {
    if (queueLength > 0) {
      Alert.alert(
        "Sync in Progress",
        `You have ${queueLength} items pending upload. Logging out now will cause PERMANENT DATA LOSS for these items.\n\nPlease wait for the "Uploading Details" to show 0 items before logging out.`,
        [{ text: "OK, I'll Wait" }]
      );
      return;
    }

    Alert.alert(
      "Confirm Logout",
      "Are you sure you want to log out? Local data will be cleared.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Logout",
          style: "destructive",
          onPress: async () => {
            await logout();
            // Navigation reset is handled by AuthStack usually, but ensures safety
          }
        }
      ]
    );
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
    try {
      await saveFullSettings(payload);
      setUnsavedChanges(false);
      setIsEditing(false);
      Alert.alert('Success', 'Settings saved successfully');
    } catch (error) {
      console.error("Failed to save settings", error);
      Alert.alert('Error', 'Failed to save settings. Local state updated.');
    }
  };

  const handleCancel = () => {
    if (unsavedChanges) {
      Alert.alert(
        'Discard Changes?',
        'You have unsaved changes. Are you sure you want to discard them?',
        [
          { text: 'No', style: 'cancel' },
          {
            text: 'Yes',
            onPress: () => {
              setIsEditing(false);
              setUnsavedChanges(false);
              // Reset local state to original settings
              setLocalSettings(JSON.parse(JSON.stringify(settings)));
              setTaxGroups(settings?.tax?.taxGroups || []);
            }
          },
        ]
      );
    } else {
      setIsEditing(false);
    }
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
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      // Create data URI
      const base64Img = `data:${asset.mimeType};base64,${asset.base64}`;
      handleChange('store', 'logo', base64Img);
    }
  };

  const removeLogo = () => {
    if (!isEditing) setIsEditing(true);
    handleChange('store', 'logo', null);
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

  const tabs = [
    { id: 'store', label: 'Store', icon: Store },
    { id: 'bank', label: 'Bank', icon: CreditCard },
    { id: 'tax', label: 'Tax', icon: Calculator },
    { id: 'invoice', label: 'Invoice', icon: Layout },
    { id: 'print', label: 'Print', icon: Printer },
    { id: 'backup', label: 'Backup', icon: Save },
    { id: 'contact', label: 'Contact', icon: HelpCircle },
    { id: 'logout', label: 'Logout', icon: LogOut },
  ];

  if (loading || !settings || !localSettings) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#000" />
        <Text style={{ marginTop: 12, fontWeight: '600' }}>Loading Settings...</Text>
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
      case 'store':
        return (
          <View style={styles.tabContent}>
            <Card style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={[styles.headerIconContainer, { backgroundColor: '#10b981' }]}>
                  <Building size={20} color="#fff" />
                </View>
                <Text style={styles.cardTitle}>Basic Details</Text>
              </View>
              <View style={styles.cardPadding}>
                {isEditing ? (
                  <>
                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>Store Display Name</Text>
                      <Input
                        value={localSettings.store.name}
                        onChangeText={(v) => handleChange('store', 'name', v)}
                        placeholder="e.g. Kwiq Billing Store"
                      />
                    </View>
                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>Legal Business Name</Text>
                      <Input
                        value={localSettings.store.legalName}
                        onChangeText={(v) => handleChange('store', 'legalName', v)}
                        placeholder="As per GST Certificate"
                      />
                    </View>
                    <View style={styles.inputRow}>
                      <View style={[styles.inputGroup, { flex: 1 }]}>
                        <Text style={styles.label}>Contact Number</Text>
                        <Input
                          value={localSettings.store.contact}
                          onChangeText={(v) => handleChange('store', 'contact', v)}
                          keyboardType="phone-pad"
                        />
                      </View>
                    </View>
                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>Email Address</Text>
                      <Input
                        value={localSettings.store.email}
                        onChangeText={(v) => handleChange('store', 'email', v)}
                        keyboardType="email-address"
                      />
                    </View>
                  </>
                ) : (
                  <TouchableOpacity onPress={() => setIsEditing(true)}>
                    <DetailRow label="Store Display Name" value={settings.store.name} icon={Store} />
                    <DetailRow label="Legal Business Name" value={settings.store.legalName} icon={Building} />
                    <DetailRow label="Contact Number" value={settings.store.contact} icon={Phone} />
                    <DetailRow label="Email Address" value={settings.store.email} icon={Mail} />
                  </TouchableOpacity>
                )}
              </View>
            </Card>

            <Card style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={[styles.headerIconContainer, { backgroundColor: '#000' }]}>
                  <MapPin size={20} color="#fff" />
                </View>
                <Text style={styles.cardTitle}>Location & Address</Text>
              </View>
              <View style={styles.cardPadding}>
                {isEditing ? (
                  <>
                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>Street Address</Text>
                      <Input
                        value={localSettings.store.address?.street}
                        onChangeText={(v) => handleChange('store', 'address', v, 'street')}
                      />
                    </View>
                    <View style={styles.inputRow}>
                      <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                        <Text style={styles.label}>City</Text>
                        <Input
                          value={localSettings.store.address?.city}
                          onChangeText={(v) => handleChange('store', 'address', v, 'city')}
                        />
                      </View>
                      <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                        <Text style={styles.label}>Pincode</Text>
                        <Input
                          value={localSettings.store.address?.pincode}
                          onChangeText={(v) => handleChange('store', 'address', v, 'pincode')}
                          keyboardType="numeric"
                        />
                      </View>
                    </View>
                  </>
                ) : (
                  <TouchableOpacity onPress={() => setIsEditing(true)}>
                    <DetailRow label="Street Address" value={settings.store.address?.street} icon={MapPin} />
                    <DetailRow label="City" value={settings.store.address?.city} />
                    <DetailRow label="Pincode" value={settings.store.address?.pincode} />
                  </TouchableOpacity>
                )}
              </View>
            </Card>

            <Card style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={[styles.headerIconContainer, { backgroundColor: '#8b5cf6' }]}>
                  <ImageIcon size={20} color="#fff" />
                </View>
                <Text style={styles.cardTitle}>Store Logo</Text>
              </View>
              <View style={styles.cardPadding}>
                {localSettings.store.logo ? (
                  <View style={{ alignItems: 'center' }}>
                    <View style={{ position: 'relative' }}>
                      <Image
                        source={{ uri: localSettings.store.logo }}
                        style={{ width: 120, height: 120, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#fff' }}
                      />
                      {isEditing && (
                        <TouchableOpacity
                          onPress={removeLogo}
                          style={{
                            position: 'absolute',
                            top: -10,
                            right: -10,
                            backgroundColor: '#ef4444',
                            borderRadius: 15,
                            width: 30,
                            height: 30,
                            alignItems: 'center',
                            justifyContent: 'center',
                            elevation: 4,
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.2,
                            shadowRadius: 2
                          }}
                        >
                          <Trash2 size={16} color="#fff" />
                        </TouchableOpacity>
                      )}
                    </View>
                    {isEditing && (
                      <TouchableOpacity
                        onPress={pickImage}
                        style={{ marginTop: 12, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, backgroundColor: '#f1f5f9' }}
                      >
                        <Text style={{ fontSize: 12, color: '#64748b', fontWeight: '600' }}>Change Logo</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ) : (
                  <TouchableOpacity
                    onPress={isEditing ? pickImage : () => setIsEditing(true)}
                    activeOpacity={0.7}
                    style={{
                      width: '100%',
                      height: 120,
                      borderRadius: 12,
                      backgroundColor: '#f8fafc',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 2,
                      borderColor: '#e2e8f0',
                      borderStyle: 'dashed'
                    }}
                  >
                    <View style={{ backgroundColor: '#ede9fe', padding: 12, borderRadius: 30, marginBottom: 8 }}>
                      <Upload size={24} color="#8b5cf6" />
                    </View>
                    <Text style={{ fontSize: 14, color: '#475569', fontWeight: '600' }}>Upload Store Logo</Text>
                    <Text style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>Square (1:1) recommended</Text>
                  </TouchableOpacity>
                )}

                <View style={{ marginTop: 20, backgroundColor: '#f0fdf4', padding: 12, borderRadius: 10, flexDirection: 'row', alignItems: 'flex-start' }}>
                  <RotateCcw size={16} color="#16a34a" style={{ marginTop: 2, marginRight: 10 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, color: '#166534', fontWeight: '700' }}>Cloud Sync Active</Text>
                    <Text style={{ fontSize: 11, color: '#16a34a', marginTop: 2, lineHeight: 16 }}>
                      Your logo is securely stored and synced to your Google Drive. It will appear on all your digital and printed invoices.
                    </Text>
                  </View>
                </View>
              </View>
            </Card>
          </View>
        );

      case 'bank':
        return (
          <View style={styles.tabContent}>
            <Card style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={[styles.headerIconContainer, { backgroundColor: '#3b82f6' }]}>
                  <Building size={20} color="#fff" />
                </View>
                <Text style={styles.cardTitle}>Bank Account Details</Text>
              </View>
              <View style={styles.cardPadding}>
                {isEditing ? (
                  <>
                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>Account Name</Text>
                      <Input
                        value={localSettings.bankDetails?.accountName || ''}
                        onChangeText={(v) => handleChange('bankDetails', 'accountName', v)}
                        placeholder="e.g. Kwiq Bill Store"
                      />
                    </View>
                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>Bank Name</Text>
                      <Input
                        value={localSettings.bankDetails?.bankName || ''}
                        onChangeText={(v) => handleChange('bankDetails', 'bankName', v)}
                        placeholder="e.g. HDFC Bank"
                      />
                    </View>
                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>Account Number</Text>
                      <Input
                        value={localSettings.bankDetails?.accountNumber || ''}
                        onChangeText={(v) => handleChange('bankDetails', 'accountNumber', v)}
                        keyboardType="numeric"
                      />
                    </View>
                    <View style={styles.inputRow}>
                      <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                        <Text style={styles.label}>IFSC Code</Text>
                        <Input
                          value={localSettings.bankDetails?.ifsc || ''}
                          onChangeText={(v) => handleChange('bankDetails', 'ifsc', v.toUpperCase())}
                          autoCapitalize="characters"
                        />
                      </View>
                      <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                        <Text style={styles.label}>Branch</Text>
                        <Input
                          value={localSettings.bankDetails?.branch || ''}
                          onChangeText={(v) => handleChange('bankDetails', 'branch', v)}
                        />
                      </View>
                    </View>
                  </>
                ) : (
                  <TouchableOpacity onPress={() => setIsEditing(true)}>
                    <DetailRow label="Account Name" value={settings.bankDetails?.accountName} icon={CreditCard} />
                    <DetailRow label="Bank Name" value={settings.bankDetails?.bankName} icon={Building} />
                    <DetailRow label="Account Number" value={settings.bankDetails?.accountNumber} />
                    <DetailRow label="IFSC Code" value={settings.bankDetails?.ifsc} />
                    <DetailRow label="Branch" value={settings.bankDetails?.branch} />
                  </TouchableOpacity>
                )}

                <View style={{ marginTop: 16, backgroundColor: '#eff6ff', padding: 12, borderRadius: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <CheckCircle2 size={16} color="#3b82f6" style={{ marginRight: 8 }} />
                    <Text style={{ fontSize: 12, color: '#1e40af', fontWeight: '600' }}>Cloud Sync Active</Text>
                  </View>
                  <Text style={{ fontSize: 11, color: '#3b82f6', marginTop: 4 }}>
                    These details are securely saved to your local device and synced to your cloud account (MongoDB & Drive) when you save.
                  </Text>
                </View>
              </View>
            </Card>
          </View>
        );

      case 'tax':
        return (
          <View style={styles.tabContent}>
            {/* GST Global Toggle Section */}
            <Card style={styles.card}>
              <View style={styles.cardPadding}>
                <View style={styles.toggleRow}>
                  <View>
                    <Text style={styles.cardTitle}>GST Configuration</Text>
                    <Text style={styles.helperText}>Enable tax calculations & compliance</Text>
                  </View>
                  <Switch
                    value={localSettings.tax.gstEnabled}
                    onValueChange={(v) => handleChange('tax', 'gstEnabled', v)}
                    trackColor={{ false: '#f1f5f9', true: '#000000' }}
                  />
                </View>

                {localSettings.tax.gstEnabled && (
                  <>
                    <View style={styles.divider} />

                    {/* GSTIN Input */}
                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>GSTIN Number</Text>
                      {isEditing ? (
                        <Input
                          value={localSettings.store.gstin}
                          onChangeText={(v) => handleChange('store', 'gstin', v.toUpperCase())}
                          autoCapitalize="characters"
                          placeholder="22AAAAA0000A1Z5"
                        />
                      ) : (
                        <TouchableOpacity onPress={() => setIsEditing(true)}>
                          <View style={styles.readOnlyBadge}>
                            <Text style={styles.readOnlyBadgeText}>{settings.store.gstin || 'Not set'}</Text>
                          </View>
                        </TouchableOpacity>
                      )}
                    </View>

                    {/* Default Preference Toggle */}
                    <View style={[styles.inputGroup, { marginTop: 16 }]}>
                      <Text style={styles.label}>Default Billing Type</Text>
                      <View style={styles.segmentedControl}>
                        <TouchableOpacity
                          style={[
                            styles.segmentBtn,
                            (localSettings.tax.defaultTaxType || 'intra') === 'intra' && styles.segmentBtnActive
                          ]}
                          onPress={() => handleChange('tax', 'defaultTaxType', 'intra')}
                        >
                          <Text style={[
                            styles.segmentText,
                            (localSettings.tax.defaultTaxType || 'intra') === 'intra' && styles.segmentTextActive
                          ]}>Intrastate (Local)</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            styles.segmentBtn,
                            (localSettings.tax.defaultTaxType || 'intra') === 'inter' && styles.segmentBtnActive
                          ]}
                          onPress={() => handleChange('tax', 'defaultTaxType', 'inter')}
                        >
                          <Text style={[
                            styles.segmentText,
                            (localSettings.tax.defaultTaxType || 'intra') === 'inter' && styles.segmentTextActive
                          ]}>Interstate (Outside)</Text>
                        </TouchableOpacity>
                      </View>
                      <Text style={styles.helperTextSmall}>
                        Choose which tax mode is applied by default for new customers.
                      </Text>
                    </View>
                  </>
                )}
              </View>
            </Card>

            {/* Tax Matrix Section */}
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>Tax Slabs Matrix</Text>
                <Text style={styles.sectionSubtitle}>Define tax rates and see calculated components</Text>
              </View>
              {isEditing && (
                <TouchableOpacity onPress={addTaxGroup} style={[styles.addBtn, { backgroundColor: '#10b981' }]}>
                  <Plus size={18} color="#fff" />
                  <Text style={styles.addBtnText}>Add Slab</Text>
                </TouchableOpacity>
              )}
            </View>

            {taxGroups.map((group) => (
              <Card key={group.id} style={[styles.matrixCard, !group.active && styles.matrixDisabled]}>
                {/* Card Header: Name & Rate */}
                <View style={styles.matrixHeaderRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.labelSmall}>SLAB NAME</Text>
                    {isEditing ? (
                      <Input
                        style={styles.matrixInputCompact}
                        value={group.name}
                        onChangeText={(v) => updateTaxGroup(group.id, 'name', v)}
                        placeholder="e.g. GST 18%"
                      />
                    ) : (
                      <Text style={styles.matrixName}>{group.name}</Text>
                    )}
                  </View>

                  <View style={{ width: 100, alignItems: 'center' }}>
                    <Text style={styles.labelSmall}>RATE (%)</Text>
                    {isEditing ? (
                      <Input
                        style={styles.matrixRateInput}
                        keyboardType="numeric"
                        value={group.rate.toString()}
                        onChangeText={(v) => updateTaxGroup(group.id, 'rate', v)}
                      />
                    ) : (
                      <Text style={styles.matrixRateDisplay}>{group.rate}%</Text>
                    )}
                  </View>

                  {isEditing && (
                    <TouchableOpacity onPress={() => removeTaxGroup(group.id)} style={styles.deleteBtnIcon}>
                      <Trash2 size={20} color="#ef4444" />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Card Body: Split View */}
                <View style={styles.matrixSplitView}>
                  {/* Intrastate (Local) */}
                  <View style={[styles.matrixSplitCol, { borderRightWidth: 1, borderRightColor: '#f1f5f9' }]}>
                    <Text style={styles.splitHeader}>INTRASTATE</Text>
                    <Text style={styles.splitSub}>Within State</Text>

                    <View style={styles.taxComponentRow}>
                      <View style={styles.taxCompBadge}>
                        <Text style={styles.taxCompLabel}>CGST</Text>
                        <Text style={styles.taxCompVal}>{group.cgst}%</Text>
                      </View>
                      <View style={styles.taxCompBadge}>
                        <Text style={styles.taxCompLabel}>SGST</Text>
                        <Text style={styles.taxCompVal}>{group.sgst}%</Text>
                      </View>
                    </View>
                  </View>

                  {/* Interstate (Remote) */}
                  <View style={styles.matrixSplitCol}>
                    <Text style={styles.splitHeader}>INTERSTATE</Text>
                    <Text style={styles.splitSub}>Outside State</Text>

                    <View style={styles.taxComponentRow}>
                      <View style={[styles.taxCompBadge, { backgroundColor: '#eff6ff' }]}>
                        <Text style={[styles.taxCompLabel, { color: '#1d4ed8' }]}>IGST</Text>
                        <Text style={[styles.taxCompVal, { color: '#1e3a8a' }]}>{group.igst || group.rate}%</Text>
                      </View>
                    </View>
                  </View>
                </View>
              </Card>


            ))}
            <View style={{ height: 40 }} />
          </View>
        );

      case 'invoice':
        return (
          <View style={styles.tabContent}>
            <Card style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={[styles.headerIconContainer, { backgroundColor: '#10b981' }]}>
                  <Layout size={20} color="#fff" />
                </View>
                <Text style={styles.cardTitle}>Template Design</Text>
              </View>
              <View style={styles.cardPadding}>
                {/* Template Selector */}
                <View style={styles.segmentedControl}>
                  {['Classic', 'Compact', 'Detailed', 'Minimal'].map(tmpl => (
                    <TouchableOpacity
                      key={tmpl}
                      onPress={() => handleChange('invoice', 'template', tmpl)}
                      style={[
                        styles.segmentBtn,
                        (localSettings.invoice.template || 'Classic') === tmpl && styles.segmentBtnActive
                      ]}
                    >
                      <Text style={[
                        styles.segmentText,
                        (localSettings.invoice.template || 'Classic') === tmpl && styles.segmentTextActive
                      ]}>{tmpl}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Detailed Previews */}
                {(localSettings.invoice.template || 'Classic') === 'Classic' && (
                  <View style={{ marginTop: 16, marginHorizontal: -20 }}>
                    <Text style={[styles.sectionSubtitle, { marginBottom: 10, paddingHorizontal: 20 }]}>Classic Template Preview</Text>
                    <View style={{ width: '100%' }}>
                      <View style={{ paddingHorizontal: 0, alignItems: 'center', gap: 20 }}>
                        <View style={{ width: '100%', marginBottom: 10 }}>
                          <Text style={[styles.helperTextSmall, { paddingHorizontal: 20, marginBottom: 8 }]}>Intra-State Invoice (CGST + SGST)</Text>
                          <ClassicInvoiceTemplate settings={localSettings} data={null} />
                        </View>
                        <View style={{ width: '100%' }}>
                          <Text style={[styles.helperTextSmall, { paddingHorizontal: 20, marginBottom: 8 }]}>Inter-State Invoice (IGST)</Text>
                          <ClassicInvoiceTemplate
                            settings={localSettings}
                            data={{
                              invoiceNo: '#INV-1002',
                              date: '15/10/2026',
                              customer: { name: 'Jane Smith', address: 'XYZ Corp, Bangalore' },
                              items: [
                                { name: 'Electronics Kit', quantity: 1, price: 1000, total: 1000 }
                              ],
                              totals: {
                                subtotal: 1000,
                                tax: 180,
                                igst: 180,
                                total: 1180
                              },
                              taxType: 'inter'
                            }}
                          />
                        </View>
                      </View>
                    </View>
                    <Text style={[styles.detailedText, { marginTop: 8, color: '#64748b', textAlign: 'center', paddingHorizontal: 20 }]}>System Generated Invoice</Text>
                  </View>
                )}

                {/* Fallback for other templates if needed */}
                {/* Detailed Previews for Compact */}
                {(localSettings.invoice.template === 'Compact') && (
                  <View style={{ marginTop: 16, marginHorizontal: -20 }}>
                    <Text style={[styles.sectionSubtitle, { marginBottom: 10, paddingHorizontal: 20 }]}>Compact Template Preview</Text>
                    <View style={{ width: '100%' }}>
                      <View style={{ paddingHorizontal: 0, alignItems: 'center', gap: 20 }}>
                        <View style={{ width: '100%', marginBottom: 10 }}>
                          <Text style={[styles.helperTextSmall, { paddingHorizontal: 20, marginBottom: 8 }]}>Intra-State Invoice (CGST + SGST)</Text>
                          <CompactInvoiceTemplate settings={localSettings} data={null} />
                        </View>
                        <View style={{ width: '100%' }}>
                          <Text style={[styles.helperTextSmall, { paddingHorizontal: 20, marginBottom: 8 }]}>Inter-State Invoice (IGST)</Text>
                          <CompactInvoiceTemplate
                            settings={localSettings}
                            data={{
                              invoiceNo: '#INV-1002',
                              date: '15/10/2026',
                              dueDate: '15/10/2026',
                              customer: { name: 'Jane Smith', address: 'XYZ Corp, Bangalore' },
                              items: [
                                { name: 'Electronics Kit', quantity: 1, price: 1000, total: 1000 }
                              ],
                              totals: {
                                subtotal: 1000,
                                tax: 180,
                                igst: 180,
                                total: 1180
                              },
                              taxType: 'inter'
                            }}
                          />
                        </View>
                      </View>
                    </View>
                    <Text style={[styles.detailedText, { marginTop: 8, color: '#64748b', textAlign: 'center', paddingHorizontal: 20 }]}>System Generated Invoice</Text>
                  </View>
                )}


                {/* Detailed Previews */}
                {(localSettings.invoice.template === 'Detailed') && (
                  <View style={{ marginTop: 16, marginHorizontal: -20 }}>
                    <Text style={[styles.sectionSubtitle, { marginBottom: 10, paddingHorizontal: 20 }]}>Detailed Template Preview</Text>
                    <View style={{ width: '100%' }}>
                      <DetailedInvoiceTemplate settings={localSettings} />
                    </View>
                    <Text style={[styles.detailedText, { marginTop: 8, color: '#64748b', textAlign: 'center', paddingHorizontal: 20 }]}>System Generated Invoice</Text>
                  </View>
                )}

                {/* Minimal Previews */}
                {(localSettings.invoice.template === 'Minimal') && (
                  <View style={{ marginTop: 16, marginHorizontal: -20 }}>
                    <Text style={[styles.sectionSubtitle, { marginBottom: 10, paddingHorizontal: 20 }]}>Minimal Template Preview</Text>
                    <View style={{ width: '100%' }}>
                      {/* Intra-State */}
                      <View style={{ marginBottom: 20 }}>
                        <Text style={[styles.helperTextSmall, { paddingHorizontal: 20, marginBottom: 8 }]}>Intra-State Invoice (CGST + SGST)</Text>
                        <MinimalInvoiceTemplate taxType="intra" />
                      </View>
                      {/* Inter-State */}
                      <View>
                        <Text style={[styles.helperTextSmall, { paddingHorizontal: 20, marginBottom: 8 }]}>Inter-State Invoice (IGST)</Text>
                        <MinimalInvoiceTemplate
                          taxType="inter"
                          data={{
                            invoiceNo: '#INV-INT-001',
                            date: '15/10/2026',
                            dueDate: '15/10/2026',
                            billTo: 'Jane Smith (Bangalore)',
                            items: [
                              { desc: 'Electronics Kit', hsn: '8542', qty: 1, price: '1000.00', tax: '18%', amount: '1000.00' }
                            ],
                            subtotal: '1000.00',
                            total: '1180.00',
                            taxAmount: '180.00'
                          }}
                        />
                      </View>
                    </View>
                    <Text style={[styles.detailedText, { marginTop: 8, color: '#64748b', textAlign: 'center', paddingHorizontal: 20 }]}>System Generated Invoice</Text>
                  </View>
                )}
              </View>
            </Card>

            <Card style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={[styles.headerIconContainer, { backgroundColor: '#6366f1' }]}>
                  <FileText size={20} color="#fff" />
                </View>
                <Text style={styles.cardTitle}>Bill Template</Text>
              </View>
              <View style={styles.cardPadding}>
                <Text style={styles.sectionSubtitle}>Standard Receipt Preview</Text>

                <View style={{ marginTop: 16, marginHorizontal: -20 }}>
                  <View style={{ width: '100%' }}>
                    {/* PREVIEW 1: INTRA-STATE (CGST + SGST) */}
                    <View style={{ marginBottom: 20 }}>
                      <Text style={[styles.helperTextSmall, { paddingHorizontal: 20, marginBottom: 8 }]}>Intra-State Receipt (CGST + SGST)</Text>
                      <ThermalInvoiceTemplate settings={localSettings} taxType="intra" />
                    </View>

                    {/* PREVIEW 2: INTER-STATE (IGST) */}
                    <View style={{ marginBottom: 20 }}>
                      <Text style={[styles.helperTextSmall, { paddingHorizontal: 20, marginBottom: 8 }]}>Inter-State Receipt (IGST)</Text>
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
                  <Text style={[styles.helperTextSmall, { paddingHorizontal: 20 }]}>Standard thermal layout used for all bill prints.</Text>
                </View>
              </View>
            </Card>

            <Card style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={[styles.headerIconContainer, { backgroundColor: '#000' }]}>
                  <Calculator size={20} color="#fff" />
                </View>
                <Text style={styles.cardTitle}>Visual Toggles</Text>
              </View>
              <View style={styles.cardPadding}>
                {[
                  { key: 'showLogo', label: 'Show Store Logo' },
                  { key: 'showTaxBreakup', label: 'Tax Breakup Table' },
                  { key: 'showQrcode', label: 'UPI QR Code' },
                  { key: 'showTerms', label: 'Terms & Conditions' },
                ].map(opt => (
                  <View key={opt.key} style={styles.toggleItem}>
                    <Text style={styles.toggleLabel}>{opt.label}</Text>
                    <Switch
                      value={localSettings.invoice[opt.key]}
                      onValueChange={(v) => handleChange('invoice', opt.key, v)}
                      trackColor={{ false: '#f1f5f9', true: '#000000' }}
                    />
                  </View>
                ))}
              </View>
            </Card>
          </View>
        );

      case 'print':
        return (
          <View style={styles.tabContent}>
            <Card style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={[styles.headerIconContainer, { backgroundColor: '#000' }]}>
                  <Printer size={20} color="#fff" />
                </View>
                <Text style={styles.cardTitle}>Printing Setup</Text>
              </View>
              <View style={styles.cardPadding}>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Invoice Paper Size (PDF)</Text>
                  <View style={styles.pickerContainer}>
                    {['A4', 'A5'].map(size => (
                      <TouchableOpacity
                        key={size}
                        onPress={() => handleChange('invoice', 'invoicePaperSize', size)}
                        style={[
                          styles.pickerItem,
                          (localSettings.invoice.invoicePaperSize || 'A4') === size && styles.pickerActive
                        ]}
                      >
                        <Text style={[styles.pickerText, (localSettings.invoice.invoicePaperSize || 'A4') === size && styles.pickerTextActive]}>
                          {size}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Bill Receipt Size (Thermal)</Text>
                  <View style={styles.pickerContainer}>
                    {['80mm', '58mm'].map(size => (
                      <TouchableOpacity
                        key={size}
                        onPress={() => handleChange('invoice', 'billPaperSize', size)}
                        style={[
                          styles.pickerItem,
                          (localSettings.invoice.billPaperSize || '80mm') === size && styles.pickerActive
                        ]}
                      >
                        <Text style={[styles.pickerText, (localSettings.invoice.billPaperSize || '80mm') === size && styles.pickerTextActive]}>
                          {size}
                        </Text>
                      </TouchableOpacity>
                    ))}
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
          </View>
        );
      case 'backup':
        return (
          <View style={styles.tabContent}>
            {/* Cloud Sync Section */}
            <Card style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={[styles.headerIconContainer, { backgroundColor: '#3b82f6' }]}>
                  <Cloud size={20} color="#fff" />
                </View>
                <Text style={styles.cardTitle}>Cloud Backup & Sync</Text>
              </View>
              <View style={styles.cardPadding}>
                <Text style={styles.sectionDesc}>
                  Secure your data by syncing with Google Drive. Access your information across multiple devices and never lose a single invoice.
                </Text>

                <TouchableOpacity
                  onPress={async () => {
                    showToast("Backing up to Cloud...", "info");
                    const success = await syncToCloud();
                    if (success) {
                      showToast("Backup Successful!", "success");
                    } else {
                      showToast("Backup Failed. Check your connection.", "error");
                    }
                  }}
                  style={styles.actionButton}
                >
                  <Cloud size={18} color="#fff" />
                  <Text style={styles.actionButtonText}>Instant Cloud Backup</Text>
                </TouchableOpacity>

                {/* --- Uploading Details Section --- */}
                <View style={{ marginTop: 20, marginBottom: 10 }}>
                  <Text style={[styles.cardTitle, { fontSize: 16, marginBottom: 8 }]}>Uploading Details</Text>

                  <View style={styles.uploadInfoBox}>
                    <View style={styles.uploadRow}>
                      <Text style={styles.uploadLabel}>Pending Uploads:</Text>
                      <Text style={[styles.uploadValue, { color: queueLength > 0 ? '#ef4444' : '#10b981' }]}>
                        {queueLength} items
                      </Text>
                    </View>

                    <View style={[styles.uploadRow, { marginTop: 8 }]}>
                      <Text style={styles.uploadLabel}>Status:</Text>
                      {isUploading ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <ActivityIndicator size="small" color="#3b82f6" style={{ marginRight: 6 }} />
                          <Text style={{ color: '#3b82f6', fontWeight: '600' }}>Syncing to Drive...</Text>
                        </View>
                      ) : (
                        <Text style={styles.uploadValue}>Idle</Text>
                      )}
                    </View>

                    {queueLength > 0 && (
                      <View style={[styles.uploadRow, { marginTop: 8 }]}>
                        <Text style={styles.uploadLabel}>Est. Time:</Text>
                        <Text style={styles.uploadValue}>~{queueLength * 2} seconds</Text>
                      </View>
                    )}

                    {queueLength > 0 && (
                      <View style={styles.queueWarning}>
                        <AlertCircle size={14} color="#b45309" />
                        <Text style={styles.queueWarningText}>
                          Do not logout or force re-sync until all pending items are uploaded (0 items).
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
                {/* ------------------------------------- */}

                {/* Real-time Status Indicator */}
                {(syncStatus && syncStatus !== 'Ready') ? (
                  <View style={{
                    backgroundColor: '#fffbeb',
                    borderColor: '#fef3c7',
                    borderWidth: 1,
                    borderRadius: 10,
                    padding: 8,
                    marginTop: 12,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8
                  }}>
                    <ActivityIndicator size="small" color="#d97706" />
                    <Text style={{ fontSize: 12, color: '#d97706', fontWeight: '800', flex: 1 }}>
                      Live Status: {syncStatus}
                    </Text>
                  </View>
                ) : null}

                {queueLength === 0 ? (
                  <>
                    <View style={[styles.syncActionsRow, { marginTop: 12 }]}>
                      <TouchableOpacity
                        onPress={async () => {
                          showToast("Syncing...", "info");
                          const success = await syncAllData();
                          if (success) {
                            showToast("Sync Completed Successfully", "success");
                            fetchCustomers();
                            fetchProducts();
                            fetchTransactions();
                          } else {
                            showToast("Sync Failed", "error");
                          }
                        }}
                        style={[styles.miniSyncBtn, { flex: 1.5 }]}
                      >
                        <RotateCcw size={16} color="#fff" />
                        <Text style={styles.miniSyncBtnText}>Sync Now</Text>
                      </TouchableOpacity>

                      <View style={styles.syncStatusBadge}>
                        <CheckCircle2 size={12} color="#059669" />
                        <Text style={styles.syncStatusText}>
                          {lastEventSyncTime ? new Date(lastEventSyncTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Never'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.divider} />

                    <View style={styles.dangerZone}>
                      <Text style={styles.dangerTitle}>Advanced Recovery</Text>
                      <Text style={[styles.helperText, { marginBottom: 12, fontSize: 11 }]}>
                        Force Re-sync clears your local meta-data and attempts to rebuild your database by re-importing every event from Google Drive. Use this only if you notice missing data or sync errors.
                      </Text>

                      <TouchableOpacity
                        onPress={() => {
                          Alert.alert(
                            "Force Full Re-sync?",
                            "This will clear local sync history and re-download all events from Drive. Your local data will be updated to match the Cloud exactly.",
                            [
                              { text: "Cancel", style: "cancel" },
                              {
                                text: "Yes, Re-sync",
                                onPress: async () => {
                                  showToast("Resetting Sync State...", "info");
                                  const success = await forceResync();
                                  if (success) {
                                    showToast("Re-sync Completed", "success");
                                    fetchCustomers();
                                    fetchProducts();
                                    fetchTransactions();
                                  } else {
                                    showToast("Re-sync Failed", "error");
                                  }
                                }
                              }
                            ]
                          );
                        }}
                        style={styles.dangerButton}
                      >
                        <RotateCcw size={16} color="#ef4444" />
                        <Text style={styles.dangerButtonText}>Force Re-sync (Fix Missing Data)</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                ) : (
                  <View style={{ marginTop: 20, padding: 12, backgroundColor: '#f1f5f9', borderRadius: 8, alignItems: 'center' }}>
                    <Shield size={24} color="#64748b" style={{ marginBottom: 8 }} />
                    <Text style={{ fontWeight: '600', color: '#475569', textAlign: 'center' }}>
                      Sync Actions Locked
                    </Text>
                    <Text style={{ fontSize: 12, color: '#64748b', textAlign: 'center', marginTop: 4 }}>
                      Please wait for pending uploads to finish before initiating manual syncs to prevent data conflicts.
                    </Text>
                  </View>
                )}
              </View>
            </Card>

            {/* Local backup section */}
            <Card style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={[styles.headerIconContainer, { backgroundColor: '#10b981' }]}>
                  <Folder size={20} color="#fff" />
                </View>
                <Text style={styles.cardTitle}>Local Device Backup</Text>
              </View>
              <View style={styles.cardPadding}>
                <View style={styles.toggleRow}>
                  <View style={{ flex: 1, marginRight: 10 }}>
                    <Text style={[styles.cardTitle, { fontSize: 15 }]}>Real-time Auto Save</Text>
                    <Text style={styles.helperText}>Automatically export JSON backups to your phone's storage every time you add or edit something.</Text>
                  </View>
                  <Switch
                    value={localSettings.defaults?.autoSave}
                    onValueChange={(v) => handleChange('defaults', 'autoSave', v)}
                    trackColor={{ false: '#f1f5f9', true: '#10b981' }}
                  />
                </View>

                {localSettings.defaults?.autoSave ? (
                  <View style={[styles.infoBox, { marginTop: 12, backgroundColor: '#f0fdf4', borderColor: '#d1fae5' }]}>
                    <Shield size={16} color="#10b981" />
                    <Text style={[styles.infoText, { color: '#065f46' }]}>
                      Active: Local files for Customers, Products, and Invoices are being updated instantly on every change.
                    </Text>
                  </View>
                ) : (
                  <View style={[styles.infoBox, { marginTop: 12, backgroundColor: '#fff7ed', borderColor: '#ffedd5' }]}>
                    <AlertCircle size={16} color="#f97316" />
                    <Text style={[styles.infoText, { color: '#9a3412' }]}>
                      Disabled: Enable this to keep a fresh copy of your data in your phone's downloads folder.
                    </Text>
                  </View>
                )}
              </View>
            </Card>
          </View>
        );
      case 'contact':
        return (
          <View style={styles.tabContent}>
            <View style={{ padding: 10, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ backgroundColor: '#eff6ff', padding: 10, borderRadius: 12 }}>
                <Headset size={28} color="#2563eb" />
              </View>
              <View>
                <Text style={{ fontSize: 24, fontWeight: '900', color: '#1e293b' }}>Help & Support</Text>
                <Text style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>Get in touch with Kwiq Billing team.</Text>
              </View>
            </View>

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => Linking.openURL('tel:+919159317290')}
              style={[styles.contactCard, { borderColor: '#e0f2fe' }]}
            >
              <View style={[styles.contactIconCircle, { backgroundColor: '#f0f9ff' }]}>
                <Phone size={24} color="#0284c7" />
              </View>
              <View style={{ flex: 1, marginLeft: 16 }}>
                <Text style={styles.contactLabel}>Call Us</Text>
                <Text style={styles.contactValue}>+91 91593 17290</Text>
              </View>
              <ChevronRight size={20} color="#94a3b8" />
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => Linking.openURL('mailto:support@kwiqbill.com')}
              style={[styles.contactCard, { borderColor: '#f0fdf4' }]}
            >
              <View style={[styles.contactIconCircle, { backgroundColor: '#f0fdf4' }]}>
                <Mail size={24} color="#16a34a" />
              </View>
              <View style={{ flex: 1, marginLeft: 16 }}>
                <Text style={styles.contactLabel}>Email Support</Text>
                <Text style={styles.contactValue}>support@kwiqbill.com</Text>
              </View>
              <ChevronRight size={20} color="#94a3b8" />
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => Linking.openURL('whatsapp://send?phone=+919159317290&text=Hi Kwiq Billing Support, I need help with...')}
              style={[styles.contactCard, { borderColor: '#f0fdf4', borderLeftWidth: 5, borderLeftColor: '#25D366' }]}
            >
              <View style={[styles.contactIconCircle, { backgroundColor: '#ecfdf5' }]}>
                <MessageCircle size={24} color="#059669" />
              </View>
              <View style={{ flex: 1, marginLeft: 16 }}>
                <Text style={styles.contactLabel}>WhatsApp Chat</Text>
                <Text style={styles.contactValue}>+91 91593 17290</Text>
              </View>
              <View style={{ backgroundColor: '#25D366', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 }}>
                <Text style={{ color: '#fff', fontSize: 10, fontWeight: '900' }}>ONLINE</Text>
              </View>
            </TouchableOpacity>

            <View style={{ marginTop: 20, padding: 20, backgroundColor: '#f8fafc', borderRadius: 24, alignItems: 'center' }}>
              <HelpCircle size={40} color="#94a3b8" style={{ marginBottom: 12 }} />
              <Text style={{ fontSize: 16, fontWeight: '800', color: '#475569', textAlign: 'center' }}>Need immediate help?</Text>
              <Text style={{ fontSize: 13, color: '#94a3b8', textAlign: 'center', marginTop: 4, lineHeight: 20 }}>
                Our support team is available from 9 AM to 7 PM (Mon-Sat). We usually respond within 2 hours.
              </Text>
            </View>
          </View>
        );
      case 'logout':
        return (
          <View style={styles.tabContent}>
            <Card style={styles.card}>
              <View style={styles.cardPadding}>
                <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                  <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#fef2f2', justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
                    <LogOut size={32} color="#ef4444" />
                  </View>
                  <Text style={{ fontSize: 20, fontWeight: '800', color: '#1e293b', marginBottom: 8 }}>Sign Out</Text>
                  <Text style={{ fontSize: 14, color: '#64748b', textAlign: 'center', marginBottom: 24, paddingHorizontal: 20 }}>
                    Are you sure you want to sign out? Your unsaved local data might be lost if not synced.
                  </Text>

                  <TouchableOpacity
                    onPress={handleLogout}
                    style={{
                      backgroundColor: '#ef4444',
                      paddingVertical: 14,
                      paddingHorizontal: 32,
                      borderRadius: 14,
                      width: '100%',
                      alignItems: 'center',
                      elevation: 4,
                      shadowColor: '#ef4444',
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.3,
                      shadowRadius: 8
                    }}
                  >
                    <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>Log Out</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Card>
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      {/* Custom Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <ChevronLeft size={24} color="#1e293b" />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>Settings</Text>
            {unsavedChanges && (
              <View style={styles.unsavedBadge}>
                <AlertCircle size={10} color="#92400e" />
                <Text style={styles.unsavedText}>Unsaved Changes</Text>
              </View>
            )}
          </View>
        </View>
        <View style={styles.headerActions}>
          {isEditing && (
            <TouchableOpacity onPress={handleCancel} style={styles.cancelBtn}>
              <X size={20} color="#64748b" />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={unsavedChanges ? handleSave : null}
            activeOpacity={unsavedChanges ? 0.7 : 1}
            style={[
              styles.saveBtn,
              { backgroundColor: unsavedChanges ? '#10b981' : '#f1f5f9' },
              !unsavedChanges && { opacity: 0.5, borderWidth: 1, borderColor: '#e2e8f0' }
            ]}
          >
            <Save size={20} color={unsavedChanges ? "#fff" : "#94a3b8"} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabScroll}>
          {tabs.map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                onPress={() => setActiveTab(tab.id)}
                style={[
                  styles.tabItem,
                  active && styles.tabItemActive,
                  active && tab.id === 'logout' && { backgroundColor: '#ef4444', borderColor: '#ef4444' }
                ]}
              >
                <Icon
                  size={18}
                  color={active ? '#fff' : (tab.id === 'logout' ? '#ef4444' : '#000')}
                />
                <Text style={[
                  styles.tabText,
                  active && styles.tabTextActive,
                  !active && tab.id === 'logout' && { color: '#ef4444' }
                ]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView style={styles.scroller} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
          {renderTabContent()}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Version 1.0.0 (Build 2026.1)</Text>
            <Text style={styles.footerText}>
              Last Sync: {settings.lastUpdatedAt ? new Date(settings.lastUpdatedAt).toLocaleString() : 'Never'}
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 18,
    backgroundColor: '#fff',
    borderBottomWidth: 1.5,
    borderBottomColor: '#000',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerTitle: { fontSize: 28, fontWeight: '900', color: '#000', letterSpacing: -0.5 },
  unsavedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#fff', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginTop: 4, borderColor: '#ef4444', borderWidth: 1 },
  unsavedText: { color: '#ef4444', fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  headerActions: { flexDirection: 'row', gap: 12 },
  backBtn: { padding: 4 },
  saveBtn: { backgroundColor: '#10b981', padding: 12, borderRadius: 12, elevation: 0, shadowOpacity: 0 },
  editBtn: { backgroundColor: '#000', padding: 12, borderRadius: 12, elevation: 0 },
  cancelBtn: { backgroundColor: '#f1f5f9', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  saveBtnDisabled: { backgroundColor: '#e2e8f0', opacity: 0.5 },

  tabBar: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  tabScroll: { paddingHorizontal: 16, paddingVertical: 14 },
  tabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
    marginRight: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  tabItemActive: { backgroundColor: '#000', borderColor: '#000' },
  tabText: { fontSize: 14, fontWeight: '700', color: '#64748b' },
  tabTextActive: { color: '#fff' },

  scroller: { flex: 1 },
  tabContent: { padding: 20 },
  card: {
    marginBottom: 24,
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    backgroundColor: '#fafafa'
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
    borderLeftColor: '#ef4444',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff'
  },
  matrixDisabled: { opacity: 0.6, borderLeftColor: '#cbd5e1' },
  matrixHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  matrixName: { fontSize: 18, fontWeight: '900', color: '#000' },
  matrixInput: { flex: 1, height: 40, borderWidth: 0, paddingHorizontal: 0, fontSize: 18, fontWeight: '900', color: '#000' },
  matrixBody: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  matrixItem: { flex: 1 },
  matrixLabel: { fontSize: 12, color: '#64748b', fontWeight: '700', marginBottom: 8, textTransform: 'uppercase' },
  matrixVal: { fontSize: 17, fontWeight: '800', color: '#000' },
  smallInput: { height: 46, fontSize: 16, borderRadius: 12, borderWidth: 1.5, borderColor: '#000' },

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
  infoBox: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#f0fdf4', padding: 14, borderRadius: 12, marginTop: 20, borderWidth: 1, borderColor: '#10b981' },
  infoText: { flex: 1, fontSize: 13, color: '#065f46', lineHeight: 18, fontWeight: '500' },

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
    borderRadius: 16,
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
    backgroundColor: '#fef2f2',
    borderRadius: 10,
    marginTop: 18
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
    backgroundColor: '#f0fdf4',
    paddingVertical: 10,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#d1fae5'
  },
  syncStatusText: {
    color: '#059669',
    fontSize: 12,
    fontWeight: '800'
  },
  divider: {
    height: 1.5,
    backgroundColor: '#f1f5f9',
    marginVertical: 20
  },
  dangerZone: {
    backgroundColor: '#fff5f5',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#fee2e2'
  },
  dangerTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#b91c1c',
    marginBottom: 4
  },
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10
  },
  dangerButtonText: {
    color: '#ef4444',
    fontWeight: '700',
    fontSize: 13
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
    backgroundColor: '#fff7ed',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ffedd5',
    gap: 8,
  },
  queueWarningText: {
    fontSize: 12,
    color: '#9a3412',
    flex: 1,
    lineHeight: 18,
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
    backgroundColor: '#0047AB', // Reference Image Blue
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
  a4LabelBlue: { fontSize: 11, fontWeight: '900', color: '#0047AB', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  a4NameBold: { fontSize: 14, fontWeight: '800', color: '#000', marginBottom: 4 },
  a4AddressText: { fontSize: 11, color: '#334155', lineHeight: 16 },

  a4TableHeader: { flexDirection: 'row', backgroundColor: '#0047AB', paddingVertical: 10, paddingHorizontal: 24 },
  a4Th: { fontSize: 10, fontWeight: '800', color: '#fff', textTransform: 'uppercase' },
  a4TableRow: { flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 24, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  a4Td: { fontSize: 11, color: '#0f172a', fontWeight: '500' },

  a4TotalRow: { flexDirection: 'row', width: 200, justifyContent: 'space-between', paddingRight: 24, marginBottom: 8 },
  a4TotalLabel: { fontSize: 11, color: '#64748b', fontWeight: '600' },
  a4TotalValue: { fontSize: 11, fontWeight: '700', color: '#000' },
  a4BalanceBox: { flexDirection: 'row', width: 240, justifyContent: 'space-between', backgroundColor: '#0047AB', paddingVertical: 10, paddingHorizontal: 16, marginTop: 12, marginRight: 24, borderRadius: 0 },
  a4BalanceLabel: { fontSize: 12, fontWeight: '900', color: '#fff', letterSpacing: 1 },
  a4BalanceValue: { fontSize: 13, fontWeight: '900', color: '#fff' },

  a4Notes: { fontSize: 11, color: '#334155', paddingHorizontal: 24, marginTop: 4, lineHeight: 16 },
  a4ThankYou: { fontSize: 18, fontWeight: '800', fontStyle: 'italic', color: '#0047AB', paddingLeft: 24 },
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
    color: '#855E01',
    textAlign: 'center',
    marginBottom: 24,
    textTransform: 'uppercase',
    letterSpacing: 3
  },
  compactStoreName: {
    fontSize: 22,
    fontWeight: '900',
    color: '#855E01',
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
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#C29811', // Darker Gold
    backgroundColor: '#FDF6E3', // Very light beige
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
    color: '#855E01',
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
    color: '#855E01',
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
    backgroundColor: '#855E01', // Solid Brown
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#855E01'
  },
  compactTh: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRightWidth: 1,
    borderRightColor: '#A07409' // Slightly lighter line for separation
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
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRightWidth: 1,
    borderRightColor: '#E2E8F0'
  },
  compactFooter: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#855E01',
    marginTop: 20
  },
  compactTermsBox: {
    flex: 1,
    padding: 12,
    borderRightWidth: 1,
    borderColor: '#855E01'
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
    backgroundColor: '#FDF6E3', // Match Meta Bar
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
          isMinimal && { backgroundColor: 'transparent', borderWidth: 0 }
        ]} />

        {/* Body Content */}
        <View style={{ flex: 1 }}>
          {/* Lines representing rows */}
          <View style={[styles.previewLine, { width: '65%', backgroundColor: isClassic ? '#000' : '#e2e8f0' }]} />
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
            <View style={styles.previewBlock} />
          )}

          <View style={[styles.previewLine, { width: '75%', marginTop: 'auto', marginBottom: 35 }]} />
        </View>

        {/* Footer */}
        <View style={[
          styles.previewFooter,
          isMinimal && { backgroundColor: 'transparent', borderTopWidth: 1.5, borderTopColor: '#000' }
        ]} />
      </View>

      {/* Label */}
      <View style={styles.previewLabel}>
        <Text style={[styles.previewText, isActive && styles.previewTextActive]}>{variant}</Text>
        {isActive && <CheckCircle2 size={14} color="#10b981" style={{ marginTop: 4 }} />}
      </View>


    </View>
  );
};

export default SettingsPage;
