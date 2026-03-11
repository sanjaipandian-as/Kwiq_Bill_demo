import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator, Pressable, Image,
  Dimensions, Animated, StatusBar, SafeAreaView, Platform
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



  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.pageContent}>
          <Animated.View
            style={[
              styles.fullPage,
              { opacity: fadeAnim, transform: [{ translateY: slideUpAnim }] },
            ]}
          >
            {/* ── HERO: Premium Dark Section ── */}
            <LinearGradient
              colors={['#000000', '#121212', '#1a1a1a']}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={styles.heroSection}
            >
              <View style={styles.heroDecorCircle1} />
              <View style={styles.heroDecorCircle2} />
              <View style={styles.brandRow}>
                <BrandLockup width={width * 0.75} height={110} variant="light" />
              </View>
            </LinearGradient>

            {/* ── MAIN CONTENT: Premium Mono Section ── */}
            <View style={styles.mainCard}>
              <View style={styles.welcomeSection}>
                <View style={styles.darkDivider} />
                <Text style={styles.welcomeLabel}>Welcome to</Text>
                <KwiqBillText width={width * 0.58} height={32} variant="black" />
                <Text style={styles.descriptionText}>
                  Elevate your business with the most advanced invoicing and
                  management tool designed for modern entrepreneurs.
                </Text>
              </View>

              {/* Features Highlight */}
              <View style={styles.featuresContainer}>
                <View style={styles.featureItem}>
                  <View style={styles.featureIconBg}>
                    <Zap size={22} color="#000000" />
                  </View>
                  <Text style={styles.featureText}>Fast</Text>
                </View>
                <View style={styles.featureItem}>
                  <View style={styles.featureIconBg}>
                    <CloudUpload size={22} color="#000000" />
                  </View>
                  <Text style={styles.featureText}>Cloud Sync</Text>
                </View>
                <View style={styles.featureItem}>
                  <View style={styles.featureIconBg}>
                    <BarChart3 size={22} color="#000000" />
                  </View>
                  <Text style={styles.featureText}>Insights</Text>
                </View>
              </View>

              <View style={styles.authContainer}>
                <View style={styles.dividerRow}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>GET STARTED</Text>
                  <View style={styles.dividerLine} />
                </View>

                {error && (
                  <View style={styles.errorBox}>
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}

                {/* Primary Action: Solid Black Google Button */}
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
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <>
                        <View style={styles.googleIconBg}>
                          <Image
                            source={{
                              uri: 'https://www.google.com/images/branding/googleg/1x/googleg_standard_color_64dp.png',
                            }}
                            style={styles.googleIcon}
                          />
                        </View>
                        <Text style={styles.googleBtnText}>Continue with Google</Text>
                      </>
                    )}
                  </Pressable>
                </Animated.View>

                {/* Security Badges: Minimalist */}
                <View style={styles.trustBadgeRow}>
                  <View style={styles.trustBadge}>
                    <ShieldCheck size={14} color="#64748B" />
                    <Text style={styles.trustBadgeText}>SECURE</Text>
                  </View>
                  <View style={styles.badgeSeparator} />
                  <View style={styles.trustBadge}>
                    <Lock size={14} color="#64748B" />
                    <Text style={styles.trustBadgeText}>ENCRYPTED</Text>
                  </View>
                </View>
              </View>

              <Text style={styles.policyText}>
                By signing in, you agree to our{' '}
                <Text style={styles.linkText} onPress={() => navigation.navigate('TermsOfService')}>
                  Terms of Service
                </Text>
                {' & '}
                <Text style={styles.linkText} onPress={() => navigation.navigate('PrivacyPolicy')}>
                  Privacy Policy
                </Text>.
              </Text>
            </View>

            {/* ── FOOTER ── */}
            <View style={styles.footer}>
              <View style={styles.footerLine} />
              <Text style={styles.footerCopy}>© 2026 Kwiq Bill · v2.0.4</Text>
            </View>
          </Animated.View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  safeArea: {
    flex: 1,
  },
  pageContent: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },

  fullPage: {
    flex: 1,
    justifyContent: 'space-between',
  },

  /* ── Hero section ── */
  heroSection: {
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 40 : 60,
    paddingBottom: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#000',
  },
  heroDecorCircle1: {
    position: 'absolute',
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: 'rgba(255,255,255,0.03)',
    top: -80,
    right: -80,
  },
  heroDecorCircle2: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.02)',
    bottom: -40,
    left: -40,
  },
  brandRow: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* ── Main body section ── */
  mainCard: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 10,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  welcomeSection: {
    alignItems: 'center',
    marginBottom: 8,
  },
  darkDivider: {
    width: 40,
    height: 3,
    backgroundColor: '#000000',
    borderRadius: 2,
    marginBottom: 8,
  },
  welcomeLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 2,
    letterSpacing: 0.5,
  },
  descriptionText: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 4,
    paddingHorizontal: 10,
    fontWeight: '500',
  },
  featuresContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 10,
    marginBottom: 12,
  },
  featureItem: {
    alignItems: 'center',
    gap: 4,
  },
  featureIconBg: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  featureText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  authContainer: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 24,
    elevation: 3,
    marginBottom: 0,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#F1F5F9',
  },
  dividerText: {
    paddingHorizontal: 14,
    fontSize: 11,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 1.5,
  },



  /* ── Premium Action Button ── */
  btnWrap: {
    width: '100%',
  },
  googleBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
    paddingVertical: 14,
    borderRadius: 20,
    gap: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 10,
  },
  googleBtnPressed: {
    backgroundColor: '#1a1a1a',
    transform: [{ scale: 0.98 }],
  },
  googleBtnDisabled: {
    opacity: 0.7,
  },
  googleIconBg: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  googleIcon: {
    width: 16,
    height: 16,
  },
  googleBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },

  /* ── Trust Badges ── */
  trustBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    gap: 16,
  },
  trustBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  trustBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 1,
  },
  badgeSeparator: {
    width: 1,
    height: 12,
    backgroundColor: '#E2E8F0',
  },

  /* ── Copy & Policy ── */
  policyText: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 16,
  },
  linkText: {
    color: '#000000',
    fontWeight: '800',
    textDecorationLine: 'underline',
  },
  errorBox: {
    backgroundColor: '#FEF2F2',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FECACA',
    width: '100%',
    marginBottom: 12,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
    paddingBottom: 20,
    paddingHorizontal: 40,
  },
  footerLine: {
    width: 40,
    height: 2,
    backgroundColor: '#F1F5F9',
    marginBottom: 12,
  },
  footerCopy: {
    fontSize: 11,
    color: '#CBD5E1',
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
});