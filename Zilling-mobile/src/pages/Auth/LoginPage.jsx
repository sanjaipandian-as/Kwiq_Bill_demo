import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator, Pressable, Image, Platform
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { ShieldCheck, Zap } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useNavigation } from '@react-navigation/native'; // Added this import

import DataSyncPage from './DataSyncPage';

export default function LoginPage() {
  const { googleLogin } = useAuth();
  const navigation = useNavigation();
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false); // New state for custom sync screen
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncMessage, setSyncMessage] = useState('Initializing...');
  const [error, setError] = useState(null);

  const handleGoogleLogin = async () => {
    try {
      setIsAuthenticating(true);
      setError(null);

      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const signInResult = await GoogleSignin.signIn();

      const idToken = signInResult.data?.idToken || signInResult.idToken;
      const userProfile = signInResult.data?.user || signInResult.user;

      if (idToken && userProfile) {
        // Switch to Sync UI immediately
        setIsAuthenticating(false);
        setIsSyncing(true);

        // Define progress callback
        const onProgress = (msg, progress) => {
          setSyncMessage(msg);
          if (progress !== undefined) setSyncProgress(progress);
        };

        // Pass callback to googleLogin
        await googleLogin(idToken, userProfile, onProgress);

        // Navigation will happen automatically via AuthContext user state change
      } else {
        throw new Error('Failed to get user details from Google');
      }
    } catch (err) {
      setIsSyncing(false); // Revert UI on error
      if (err.code === statusCodes.SIGN_IN_CANCELLED) {
        setError('Login cancelled.');
      } else if (err.code === statusCodes.DEVELOPER_ERROR) {
        setError('Config Error. Check SHA-1/Package Name.');
      } else {
        setError(err.message || 'Login failed.');
        console.error('Detailed Error:', err);
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
      />
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#0f172a', '#1e293b', '#334155']} style={styles.background} />

      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <LinearGradient colors={['#2563eb', '#3b82f6']} style={styles.logoGradient}>
              <Zap size={40} color="white" />
            </LinearGradient>
          </View>
          <Text style={styles.brandName}>Kwiq Billing</Text>
          <Text style={styles.tagline}>Smart Billing for Modern Business</Text>
        </View>

        <View style={styles.authCard}>
          <Text style={styles.welcomeText}>Welcome Back</Text>
          <Text style={styles.instructionText}>Use your Google Account to sync your billing data.</Text>

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <Pressable
            style={({ pressed }) => [
              styles.googleBtn,
              pressed && styles.googleBtnPressed,
              isAuthenticating && styles.googleBtnDisabled
            ]}
            onPress={handleGoogleLogin}
            disabled={isAuthenticating}
          >
            {isAuthenticating ? (
              <ActivityIndicator color="#0f172a" />
            ) : (
              <>
                <Image
                  source={{ uri: 'https://www.google.com/images/branding/googleg/1x/googleg_standard_color_64dp.png' }}
                  style={styles.googleIcon}
                />
                <Text style={styles.googleBtnText}>Continue with Google</Text>
              </>
            )}
          </Pressable>

          <View style={styles.footerNote}>
            <ShieldCheck size={14} color="#64748b" />
            <Text style={styles.secureText}>Secure Enterprise Login</Text>
          </View>
        </View>
        <Text style={styles.copyright}>© 2026 Kwiq Billing Inc.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  background: { ...StyleSheet.absoluteFillObject },
  content: { flex: 1, padding: 30, justifyContent: 'center', alignItems: 'center' },
  header: { alignItems: 'center', marginBottom: 50 },
  logoContainer: { width: 80, height: 80, borderRadius: 24, overflow: 'hidden', marginBottom: 16 },
  logoGradient: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  brandName: { fontSize: 36, fontWeight: '900', color: '#fff' },
  tagline: { fontSize: 14, color: '#94a3b8', marginTop: 8 },
  authCard: { width: '100%', backgroundColor: 'white', borderRadius: 32, padding: 32, alignItems: 'center' },
  welcomeText: { fontSize: 24, fontWeight: '800', color: '#0f172a', marginBottom: 10 },
  instructionText: { fontSize: 14, color: '#64748b', textAlign: 'center', marginBottom: 30 },
  googleBtn: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', paddingVertical: 16, borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', gap: 12 },
  googleBtnPressed: { opacity: 0.7, backgroundColor: '#f8fafc' },
  googleBtnDisabled: { opacity: 0.5 },
  googleBtnText: { fontSize: 16, fontWeight: '700', color: '#1e293b' },
  googleIcon: { width: 24, height: 24 },
  errorBox: { backgroundColor: '#fee2e2', padding: 12, borderRadius: 12, width: '100%', marginBottom: 20 },
  errorText: { color: '#dc2626', textAlign: 'center' },
  skipText: { color: '#94a3b8', textDecorationLine: 'underline' },
  footerNote: { flexDirection: 'row', alignItems: 'center', marginTop: 24, gap: 6 },
  secureText: { fontSize: 12, color: '#94a3b8' },
  copyright: { position: 'absolute', bottom: 30, color: '#475569' }
});