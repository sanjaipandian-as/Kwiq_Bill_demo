import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator, Pressable, Image,
  Dimensions, Animated, StatusBar, SafeAreaView, Platform, ScrollView
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { ShieldCheck, Lock, CloudUpload, CircleGauge, BarChart3 } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useNavigation } from '@react-navigation/native';
import BrandLockup from '../../components/ui/BrandLockup';
import KwiqBillText from '../../components/ui/KwiqBillText';

import DataSyncPage from './DataSyncPage';
import { APP_VERSION } from '../../config/version';


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
      // codes: 12501 (cancelled), 12502 (in progress), 10 (developer error)
      if (err.code === statusCodes.SIGN_IN_CANCELLED) {
        // User closed the popup, don't show an error
        setError(null);
      } else if (err.code === statusCodes.IN_PROGRESS) {
        // Already trying to sign in
        setError('Login already in progress.');
      } else {
        // For other errors (including DEVELOPER_ERROR), show a more helpful message
        // but avoid scaring them with SHA-1 talk unless it's likely a persistent issue
        console.error('Google Sign-In Error:', err);
        setError('Unable to sign in. Please try again or check your connection.');
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
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              bounces={false}
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
                  {/* <View style={styles.premiumBadge}>
                    <Text style={styles.premiumBadgeText}>PREMIUM BUSINESS SUITE</Text>
                  </View> */}
                  <KwiqBillText width={width * 0.65} height={40} variant="black" />
                  <Text style={styles.descriptionText}>
                    The most advanced invoicing & business management ecosystem
                    for the modern entrepreneur.
                  </Text>
                </View>

                {/* Features Highlight */}
                <View style={styles.featuresContainer}>
                  <View style={styles.featureItem}>
                    <LinearGradient
                      colors={['#F8FAFC', '#F1F5F9']}
                      style={styles.featureIconBg}
                    >
                      <CircleGauge size={20} color="#000000" strokeWidth={2.5} />
                    </LinearGradient>
                    <View style={styles.featureTextFull}>
                      <Text style={styles.featureTitle}>Fast</Text>
                      <Text style={styles.featureSubtext}>Instant Billing</Text>
                    </View>
                  </View>

                  <View style={styles.featureItem}>
                    <LinearGradient
                      colors={['#F8FAFC', '#F1F5F9']}
                      style={styles.featureIconBg}
                    >
                      <CloudUpload size={20} color="#000000" strokeWidth={2.5} />
                    </LinearGradient>
                    <View style={styles.featureTextFull}>
                      <Text style={styles.featureTitle}>Cloud Sync</Text>
                      <Text style={styles.featureSubtext}>Always Secure</Text>
                    </View>
                  </View>

                  <View style={styles.featureItem}>
                    <LinearGradient
                      colors={['#F8FAFC', '#F1F5F9']}
                      style={styles.featureIconBg}
                    >
                      <BarChart3 size={20} color="#000000" strokeWidth={2.5} />
                    </LinearGradient>
                    <View style={styles.featureTextFull}>
                      <Text style={styles.featureTitle}>Insights</Text>
                      <Text style={styles.featureSubtext}>Smart Growth</Text>
                    </View>
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
                      <ShieldCheck size={12} color="#94A3B8" />
                      <Text style={styles.trustBadgeText}>BANK-GRADE SECURITY</Text>
                    </View>
                    <View style={styles.badgeDot} />
                    <View style={styles.trustBadge}>
                      <Lock size={12} color="#94A3B8" />
                      <Text style={styles.trustBadgeText}>AES-256 ENCRYPTED</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.policyContainer}>
                  <Text style={styles.policyText}>By signing in, you agree to our</Text>
                  <Text style={styles.policyText}>
                    <Text style={styles.linkText} onPress={() => navigation.navigate('TermsOfService')}>
                      Terms of Service
                    </Text>
                    {' & '}
                    <Text style={styles.linkText} onPress={() => navigation.navigate('PrivacyPolicy')}>
                      Privacy Policy
                    </Text>
                  </Text>
                </View>


                {/* ── FOOTER ── */}
                <View style={styles.footer}>
                  <View style={styles.footerLine} />
                  <Text style={styles.footerCopy}>© 2026 Kwiq Bill · {APP_VERSION}</Text>
                </View>

              </View>
            </ScrollView>
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
  },
  scrollContent: {
    flexGrow: 1,
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
    paddingBottom: 20,
    alignItems: 'center',
  },
  welcomeSection: {
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 10,
  },
  premiumBadge: {
    backgroundColor: '#000000',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 100,
    marginBottom: 12,
  },
  premiumBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
  descriptionText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
    marginTop: 8,
    paddingHorizontal: 20,
    fontWeight: '600',
  },
  featuresContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 4,
    marginBottom: 20,
    marginTop: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02,
    shadowRadius: 10,
    elevation: 2,
  },
  featureItem: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  featureIconBg: {
    width: 48,
    height: 48,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    marginBottom: 10,
  },
  featureTextFull: {
    alignItems: 'center',
  },
  featureTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  featureSubtext: {
    fontSize: 9,
    fontWeight: '700',
    color: '#94A3B8',
    marginTop: 1,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
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
    marginTop: 20,
    gap: 12,
  },
  trustBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  trustBadgeText: {
    fontSize: 8,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.8,
  },
  badgeDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#CBD5E1',
  },

  /* ── Copy & Policy ── */
  policyContainer: {
    marginTop: 20,
    alignItems: 'center',
    gap: 2,
  },
  policyText: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 16,
    fontWeight: '600',
  },
  linkText: {
    color: '#000000',
    fontWeight: '800',
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
    paddingTop: 20,
    paddingBottom: 20,
    paddingHorizontal: 40,
    marginTop: 'auto',
  },
  footerLine: {
    width: 40,
    height: 2,
    backgroundColor: '#F1F5F9',
    marginBottom: 12,
  },
  footerCopy: {
    fontSize: 11,
    color: '#000000ff',
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
});