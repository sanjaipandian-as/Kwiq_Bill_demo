import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator, Pressable, Image,
  Dimensions, Animated, StatusBar, SafeAreaView, ScrollView, Platform
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { ShieldCheck, Lock, CloudUpload, Zap, BarChart3 } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useNavigation } from '@react-navigation/native';
import BrandLockup from '../../components/ui/BrandLockup';
import KwiqBillText from '../../components/ui/KwiqBillText';

import DataSyncPage from './DataSyncPage';

const { width, height } = Dimensions.get('window');

export default function LoginPage() {
  const { googleLogin } = useAuth();
  const navigation = useNavigation();
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncMessage, setSyncMessage] = useState('Initializing...');
  const [syncStats, setSyncStats] = useState(null);
  const [error, setError] = useState(null);

  // Main fade + slide
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideUpAnim = useRef(new Animated.Value(40)).current;


  // Button scale animation
  const btnScale = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    // Phase 1: Main content fade in
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
      }),
      Animated.spring(slideUpAnim, {
        toValue: 0,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Phase 2: Button pop-in
      Animated.spring(btnScale, {
        toValue: 1,
        tension: 65,
        friction: 6,
        useNativeDriver: true,
      }).start();
    });
  }, []);

  const handleGoogleLogin = async () => {
    try {
      setIsAuthenticating(true);
      setError(null);

      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const signInResult = await GoogleSignin.signIn();

      const idToken = signInResult.data?.idToken || signInResult.idToken;
      const userProfile = signInResult.data?.user || signInResult.user;

      if (idToken && userProfile) {
        setIsAuthenticating(false);
        setIsSyncing(true);

        const onProgress = (msg, progress, stats) => {
          setSyncMessage(msg);
          if (progress !== undefined) setSyncProgress(progress);
          if (stats !== undefined) setSyncStats(stats);
        };

        await googleLogin(idToken, userProfile, onProgress);
      } else {
        throw new Error('Failed to get user details from Google');
      }
    } catch (err) {
      setIsSyncing(false);
      if (err.code === statusCodes.SIGN_IN_CANCELLED) {
        setError('Login cancelled.');
      } else if (err.code === statusCodes.DEVELOPER_ERROR) {
        setError('Config Error. Check SHA-1/Package Name.');
      } else {
        setError(err.message || 'Login failed.');
      }
    } finally {
      setIsAuthenticating(false);
    }
  };

  if (isSyncing) {
    return (
      <DataSyncPage
        progressMessage={syncMessage}
        progressValue={syncProgress}
        syncStats={syncStats}
      />
    );
  }

  const featureItems = [
    { icon: Zap, title: 'Fast Billing', desc: 'Create invoices\nin seconds' },
    { icon: CloudUpload, title: 'Cloud Sync', desc: 'Data backed up\nto Drive' },
    { icon: BarChart3, title: 'Reports', desc: 'Track sales &\nexpenses' },
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <Animated.View
            style={[
              styles.fullPage,
              { opacity: fadeAnim, transform: [{ translateY: slideUpAnim }] },
            ]}
          >
            {/* ── HERO: Gradient Brand Section ── */}
            <LinearGradient
              colors={['#000000', '#1A1A1A', '#262626']}
              start={{ x: 0.2, y: 0 }}
              end={{ x: 0.8, y: 1 }}
              style={styles.heroSection}
            >
              {/* Decorative circles */}
              <View style={styles.heroDecorCircle1} />
              <View style={styles.heroDecorCircle2} />

              <View style={styles.brandRow}>
                <BrandLockup width={width * 0.82} height={125} variant="light" />
              </View>
            </LinearGradient>

            {/* ── MAIN CONTENT: White Card ── */}
            <View style={styles.mainCard}>
              {/* Welcome heading */}
              <View style={styles.welcomeSection}>
                <View style={styles.divider} />
                <Text style={styles.welcomeLabel}>Welcome to</Text>
                <KwiqBillText width={width * 0.52} height={32} />
                <Text style={styles.descriptionText}>
                  Sign in to access your store, manage inventory, and keep your data synced across devices.
                </Text>
              </View>

              {/* Feature highlights */}
              <View style={styles.featuresGrid}>
                {featureItems.map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <View
                      key={index}
                      style={styles.featureCard}
                    >
                      <View style={styles.featureIconWrap}>
                        <Icon size={20} color="#334155" />
                      </View>
                      <Text style={styles.featureTitle}>{item.title}</Text>
                      <Text style={styles.featureDesc}>{item.desc}</Text>
                    </View>
                  );
                })}
              </View>

              {/* Error */}
              {error && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              {/* Google Sign-In Button */}
              <Animated.View style={[styles.btnWrap, { transform: [{ scale: btnScale }] }]}>
                <Pressable
                  style={({ pressed }) => [
                    styles.googleBtn,
                    pressed && styles.googleBtnPressed,
                    isAuthenticating && styles.googleBtnDisabled,
                  ]}
                  onPress={handleGoogleLogin}
                  disabled={isAuthenticating}
                >
                  {isAuthenticating ? (
                    <ActivityIndicator color="#196BA7" />
                  ) : (
                    <>
                      <Image
                        source={{
                          uri: 'https://www.google.com/images/branding/googleg/1x/googleg_standard_color_64dp.png',
                        }}
                        style={styles.googleIcon}
                      />
                      <Text style={styles.googleBtnText}>Sign in with Google</Text>
                    </>
                  )}
                </Pressable>
              </Animated.View>


              {/* Trust & Efficiency Badge */}
              <View style={styles.trustBadgeRow}>
                <View style={styles.trustBadge}>
                  <ShieldCheck size={12} color="#64748b" />
                  <Text style={styles.trustBadgeText}>Bank-Grade Security</Text>
                </View>
                <View style={styles.badgeSeparator} />
                <View style={styles.trustBadge}>
                  <Lock size={12} color="#64748b" />
                  <Text style={styles.trustBadgeText}>Privacy First</Text>
                </View>
              </View>

              <Text style={styles.policyText}>
                By signing in, you agree to our{' '}
                <Text
                  style={styles.linkText}
                  onPress={() => navigation.navigate('TermsOfService')}
                >
                  Terms of Service
                </Text>
                {' & '}
                <Text
                  style={styles.linkText}
                  onPress={() => navigation.navigate('PrivacyPolicy')}
                >
                  Privacy Policy
                </Text>.
              </Text>
            </View>

            {/* ── BOTTOM: Footer ── */}
            <View style={styles.footer}>
              <View style={styles.footerLine} />
              <Text style={styles.footerCopy}>© 2026 Kwiq Bill · Version 2.0.4</Text>
            </View>

          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F4F8',
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    backgroundColor: '#F0F4F8',
  },
  fullPage: {
    flex: 1,
    minHeight: height - (Platform.OS === 'android' ? 0 : 0), // Use full height
    justifyContent: 'space-between',
  },

  /* ── Hero gradient section ── */
  heroSection: {
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 20 : 40,
    paddingBottom: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    overflow: 'hidden',
    position: 'relative',
  },
  heroDecorCircle1: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.04)',
    top: -40,
    right: -40,
  },
  heroDecorCircle2: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.03)',
    bottom: -20,
    left: -30,
  },
  brandRow: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* ── Main white card ── */
  mainCard: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 24,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  welcomeSection: {
    alignItems: 'center',
    marginBottom: 28,
  },
  divider: {
    width: 44,
    height: 3.5,
    backgroundColor: '#000000',
    borderRadius: 2,
    marginBottom: 14,
  },
  welcomeLabel: {
    fontSize: 17,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  descriptionText: {
    fontSize: 13.5,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 21,
    marginTop: 10,
    paddingHorizontal: 8,
  },

  /* ── Feature cards ── */
  featuresGrid: {
    flexDirection: 'row',
    width: '100%',
    gap: 10,
    marginBottom: 24,
  },
  featureCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E8EEF4',
    shadowColor: '#94a3b8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  featureIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  featureTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 3,
  },
  featureDesc: {
    fontSize: 10.5,
    color: '#94a3b8',
    textAlign: 'center',
    fontWeight: '500',
    lineHeight: 14,
  },

  /* ── Google button ── */
  btnWrap: {
    width: '100%',
  },
  googleBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1.2,
    borderColor: '#E2E8F0',
    gap: 10,
    shadowColor: '#1e293b',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  googleBtnPressed: {
    backgroundColor: '#F1F5F9',
    transform: [{ scale: 0.97 }],
    elevation: 1,
  },
  googleBtnDisabled: {
    opacity: 0.6,
  },
  googleIcon: {
    width: 22,
    height: 22,
  },
  googleBtnText: {
    fontSize: 15.5,
    fontWeight: '700',
    color: '#1e293b',
    letterSpacing: 0.2,
  },

  /* ── Policy ── */
  policyText: {
    fontSize: 11.5,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 17,
  },
  linkText: {
    color: '#000000',
    fontWeight: '700',
    textDecorationLine: 'underline',
  },

  /* ── Error ── */
  errorBox: {
    backgroundColor: '#fef2f2',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
    width: '100%',
    marginBottom: 14,
  },
  errorText: {
    color: '#dc2626',
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '500',
  },

  /* ── Trust Badges ── */
  trustBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    gap: 12,
  },
  trustBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EDF2F7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 22,
  },
  trustBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  badgeSeparator: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#E2E8F0',
  },

  /* ── Footer ── */
  footer: {
    alignItems: 'center',
    paddingBottom: 36,
    paddingHorizontal: 40,
  },
  footerLine: {
    width: '35%',
    height: 1.5,
    backgroundColor: '#EEF2F7',
    marginBottom: 18,
  },
  footerCopy: {
    fontSize: 10.5,
    color: '#94a3b8',
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
});