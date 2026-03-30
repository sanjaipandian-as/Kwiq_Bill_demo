import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, ActivityIndicator, RefreshControl, Linking } from 'react-native';

import CustomizeForm from './CustomizeForm';
import DonationModal from './DonationModal';
import { Info, Briefcase, ShoppingBag, Heart, ExternalLink, ChevronRight, MessageSquare, Clock, CheckCircle } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import services from '../../../../services/api';

const STORAGE_KEY = '@kwiq_bill_customize_order';

const Contact = () => {
  const navigation = useNavigation();
  const [formVisible, setFormVisible] = useState(false);
  const [donateVisible, setDonateVisible] = useState(false);
  const [activeRequest, setActiveRequest] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchRequestStatus = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const { email } = JSON.parse(stored);
        if (email) {
          const res = await services.requests.getMyStatus(email);
          if (res.data && res.data.data) {
              setActiveRequest(res.data.data);
          } else {
              setActiveRequest(null);
          }
        }
      }
    } catch (error) {
       console.error("Status fetch failed", error);
    } finally {
      setLoadingStatus(false);
      setRefreshing(false);
    }
  };

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    fetchRequestStatus();
  }, []);

  useEffect(() => {
    fetchRequestStatus();
  }, []);

  const getStatusContent = () => {
      if (!activeRequest) return null;
      switch(activeRequest.status) {
          case 'New':
            return {
                title: 'Request Received',
                message: 'We have received your requirements! A senior architect is being assigned to review your business scope.',
                color: '#3b82f6',
                step: 1
            };
          case 'In Progress':
            return {
                title: 'Requirement Update',
                message: 'Your customize is now processing our team will reach out you with in 24hrs.',
                color: '#f59e0b',
                step: 2
            };
          case 'Completed':
            return {
                title: 'Order Finalized',
                message: 'Great news! Your custom features are ready. Our team has integrated the updates into your account.',
                color: '#10b981',
                step: 3
            };
          default:
            return null;
      }
  };

  const statusInfo = getStatusContent();

  return (
    <ScrollView 
        style={styles.container} 
        contentContainerStyle={styles.content} 
        showsVerticalScrollIndicator={false}
        refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#000" colors={["#000"]} />
        }
    >
      
      {/* Introduction Header */}
      {/* <View style={styles.headerContainer}>
        <View style={styles.headerBadge}>
          <Text style={styles.headerBadgeText}>KWIQ BILL</Text>
        </View>
        <Text style={styles.headerTitle}>Contact & Info</Text>
        <Text style={styles.headerSubtitle}>Discover our vision, reach out for customized orders, and support our journey.</Text>
      </View> */}

      {/* Who Are We Card */}
      <TouchableOpacity 
          style={[styles.navCardSolid, { backgroundColor: '#000' }]} 
          activeOpacity={0.9}
          onPress={() => navigation.navigate('WhoWeAre')}
      >
        <View style={styles.navCardLeft}>
          <View style={[styles.iconBoxLarge, { backgroundColor: '#1f2937' }]}>
            <Info color="#fff" size={28} />
          </View>
          <View style={styles.navCardText}>
             <Text style={[styles.navCardTitleBig, { color: '#fff' }]}>Who Are We?</Text>
             <Text style={[styles.navCardSubBig, { color: '#9ca3af' }]}>Zippy Digital Solutions</Text>
          </View>
        </View>
        <ChevronRight color="#fff" size={24} />
      </TouchableOpacity>

      {/* What We Do Card */}
      <TouchableOpacity 
          style={[styles.navCardSolid, { backgroundColor: '#fff', borderWidth: 2, borderColor: '#000' }]} 
          activeOpacity={0.7}
          onPress={() => navigation.navigate('WhatWeDo')}
      >
        <View style={styles.navCardLeft}>
          <View style={[styles.iconBoxLarge, { backgroundColor: '#f3f4f6' }]}>
            <Briefcase color="#000" size={28} />
          </View>
          <View style={styles.navCardText}>
             <Text style={[styles.navCardTitleBig, { color: '#000' }]}>What We Do.</Text>
             <Text style={[styles.navCardSubBig, { color: '#4b5563' }]}>Explore Core Services</Text>
          </View>
        </View>
        <ChevronRight color="#000" size={24} />
      </TouchableOpacity>

      <View style={styles.divider} />

      {/* Request Status (Visible if active request found) */}
      {statusInfo && (
        <View style={styles.statusSection}>
            <Text style={styles.actionSectionTitle}>Current Requirement Progress</Text>
            <View style={styles.premiumStatusCard}>
               <View style={styles.statusHeader}>
                  <View style={styles.statusBadgeRow}>
                     <View style={[styles.statusIndicator, { backgroundColor: statusInfo.color }]} />
                     <Text style={styles.statusBadgeText}>{activeRequest.status.toUpperCase()}</Text>
                  </View>
                  <Text style={styles.statusTime}>Updated: {new Date(activeRequest.updatedAt).toLocaleDateString()}</Text>
               </View>
               
               <View style={styles.statusBody}>
                  <View style={[styles.statusIconWrapper, { borderColor: statusInfo.color + '22' }]}>
                     {activeRequest.status === 'Completed' ? <CheckCircle color="#10b981" size={24} /> : (activeRequest.status === 'New' ? <MessageSquare color="#3b82f6" size={24} /> : <Clock color="#f59e0b" size={24} />)}
                  </View>
                  <View style={styles.statusTextContent}>
                     <Text style={styles.statusMessageTitle}>
                        {statusInfo.title}
                     </Text>
                     <Text style={styles.statusMessageBody}>
                        {statusInfo.message}
                     </Text>
                  </View>
               </View>
               
               {/* Stepped Progress Tracker */}
               <View style={styles.stepperContainer}>
                  <View style={styles.stepperBaseLine} />
                  <View style={[styles.stepperActiveLine, { width: `${(statusInfo.step - 1) * 50}%` }]} />
                  
                  <View style={styles.stepsRow}>
                     <View style={[styles.stepDot, statusInfo.step >= 1 && styles.stepDotActive]}>
                        <View style={styles.stepDotInner} />
                        <Text style={styles.stepLabel}>Sent</Text>
                     </View>
                     <View style={[styles.stepDot, statusInfo.step >= 2 && styles.stepDotActive]}>
                        <View style={styles.stepDotInner} />
                        <Text style={styles.stepLabel}>Review</Text>
                     </View>
                     <View style={[styles.stepDot, statusInfo.step >= 3 && styles.stepDotActive]}>
                        <View style={styles.stepDotInner} />
                        <Text style={styles.stepLabel}>Ready</Text>
                     </View>
                  </View>
               </View>
            </View>
        </View>
      )}

      {/* Action Buttons */}
      <Text style={styles.actionSectionTitle}>Help Center & Actions</Text>

      {/* Customize Order */}
      <TouchableOpacity 
        style={styles.actionCardWhite} 
        activeOpacity={0.7}
        onPress={() => setFormVisible(true)}
      >
        <View style={styles.actionCardLeft}>
          <View style={styles.iconWrapperNeutral}>
            <ShoppingBag color="#000" size={22} />
          </View>
          <View style={styles.actionCardTextContainer}>
            <Text style={styles.actionCardTitle}>Customize Order</Text>
            <Text style={styles.actionCardSubtitle}>Get a tailor-made plan or custom features for your store.</Text>
          </View>
        </View>
        <ChevronRight color="#000" size={20} />
      </TouchableOpacity>

      {/* Donation Page */}
      <TouchableOpacity 
        style={styles.actionCardBlack} 
        activeOpacity={0.8}
        onPress={() => setDonateVisible(true)}
      >
        <View style={styles.actionCardLeft}>
          <View style={styles.iconWrapperWhite}>
            <Heart color="#000" size={22} fill="#000" />
          </View>
          <View style={styles.actionCardTextContainer}>
            <Text style={[styles.actionCardTitle, { color: '#fff' }]}>Support our journey</Text>
            <Text style={[styles.actionCardSubtitle, { color: '#d1d5db' }]}>Love Kwiq Bill? Support our development with a small donation.</Text>
          </View>
        </View>
        <ExternalLink color="#fff" size={20} />
      </TouchableOpacity>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>Designed for the future of billing.</Text>
        <Text style={styles.footerBrand}>© KWIQ BILL</Text>
        <TouchableOpacity 
          onPress={() => Linking.openURL('https://www.zippydigitalsolutions.in')}
          activeOpacity={0.7}
        >
          <Text style={styles.footerLink}>POWERED BY ZIPPY</Text>
        </TouchableOpacity>
      </View>


      <CustomizeForm visible={formVisible} onClose={() => setFormVisible(false)} />
      <DonationModal visible={donateVisible} onClose={() => setDonateVisible(false)} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  content: {
    padding: 24,
    paddingBottom: 60,
  },
  headerContainer: {
    marginBottom: 40,
    marginTop: 10,
  },
  headerBadge: {
    backgroundColor: '#000',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 16,
  },
  headerBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2,
  },
  headerTitle: {
    fontSize: 34,
    fontWeight: '900',
    color: '#000',
    letterSpacing: -1,
    marginBottom: 12,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#475569',
    fontWeight: '500',
    lineHeight: 24,
  },
  sectionContainer: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
    navCardSolid: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 24,
        borderRadius: 24,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 4,
    },
    iconBoxLarge: {
        width: 56,
        height: 56,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    navCardLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    navCardTitleBig: {
        fontSize: 20,
        fontWeight: '900',
        marginBottom: 4,
        letterSpacing: -0.5,
    },
    navCardSubBig: {
        fontSize: 14,
        fontWeight: '600',
    },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#000',
    letterSpacing: -0.5,
  },
  sectionContent: {
    paddingLeft: 54, // align with text after icon (40 icon + 14 margin)
  },
  sectionText: {
    fontSize: 15,
    lineHeight: 24,
    color: '#334155',
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginVertical: 10,
    marginBottom: 30,
  },
  actionSectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 16,
  },
  actionCardWhite: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },
  actionCardBlack: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#000',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  actionCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconWrapperNeutral: {
    width: 48,
    height: 48,
    backgroundColor: '#f1f5f9',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconWrapperWhite: {
    width: 48,
    height: 48,
    backgroundColor: '#fff',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionCardTextContainer: {
    marginLeft: 16,
    flex: 1,
    paddingRight: 12,
  },
  actionCardTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#000',
    marginBottom: 4,
  },
  actionCardSubtitle: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
    lineHeight: 18,
  },
  footer: {
    marginTop: 40,
    alignItems: 'center',
    paddingTop: 30,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  footerText: {
    fontSize: 13,
    color: '#94a3b8',
    fontWeight: '500',
    marginBottom: 6,
  },
  footerBrand: {
    fontSize: 14,
    fontWeight: '800',
    color: '#000',
    letterSpacing: 1,
  },
  footerLink: {
    fontSize: 9, 
    color: '#cbd5e1', 
    fontWeight: '700', 
    marginTop: 8,
    textDecorationLine: 'underline',
    letterSpacing: 1.5
  },

  // Status Card Styles
  statusSection: {
    marginBottom: 24,
  },
  premiumStatusCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  statusIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  bgSuccess: { backgroundColor: '#10b981' },
  bgWarning: { backgroundColor: '#f59e0b' },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#64748b',
    letterSpacing: 0.5,
  },
  statusTime: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
  },
  statusBody: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 16,
  },
  statusIconWrapper: {
    width: 48,
    height: 48,
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  statusTextContent: {
    flex: 1,
  },
  statusMessageTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#000',
    marginBottom: 2,
  },
  statusMessageBody: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    lineHeight: 18,
  },
  progressContainer: {
    marginTop: 4,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#f1f5f9',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    width: '65%', // Example progress point
    backgroundColor: '#000',
  },
  progressText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94a3b8',
    textTransform: 'uppercase',
  },
  // Stepper Styles
  stepperContainer: {
    marginTop: 10,
    height: 40,
    justifyContent: 'center',
  },
  stepperBaseLine: {
    height: 3,
    backgroundColor: '#f1f5f9',
    position: 'absolute',
    left: '5%',
    right: '5%',
    top: '40%',
  },
  stepperActiveLine: {
    height: 3,
    backgroundColor: '#000',
    position: 'absolute',
    left: '5%',
    top: '40%',
    transition: '0.3s',
  },
  stepsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: '2%',
  },
  stepDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepDotActive: {
    borderColor: '#000',
  },
  stepDotInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#f1f5f9',
  },
  stepDotActiveInner: {
    backgroundColor: '#000',
  },
  stepLabel: {
    position: 'absolute',
    top: 24,
    fontSize: 10,
    fontWeight: '900',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign: 'center',
    width: 60,
    left: -20,
  }
});

export default Contact;
