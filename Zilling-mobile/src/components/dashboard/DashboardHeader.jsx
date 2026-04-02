import React from 'react';
import { View, Text, StyleSheet, Pressable, Image, Animated, Easing } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Menu, Clock, ChevronDown } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

const StatTile = React.memo(({ title, value, sub }) => (
  <View style={styles.statTile}>
    <Text style={styles.statTileTitle}>{title}</Text>
    <Text style={styles.statTileValue}>{value}</Text>
    <Text style={styles.statTileSub}>{sub}</Text>
  </View>
));

const CustomSyncLoader = () => {
  const anim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.loop(
      Animated.timing(anim, {
        toValue: 12,
        duration: 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  return (
    <View style={styles.loaderSmall}>
      {[...Array(12)].map((_, i) => {
        const opacity = anim.interpolate({
          inputRange: [i, i + 1, i + 2],
          outputRange: [1, 0.25, 1],
          extrapolate: 'clamp'
        });

        return (
          <Animated.View
            key={i}
            style={[
              styles.loaderBar,
              {
                transform: [
                  { rotate: `${i * 30}deg` },
                  { translateY: -6 }
                ],
                opacity: anim.interpolate({
                  inputRange: [
                    Math.max(0, i - 1),
                    i,
                    Math.min(12, i + 1)
                  ],
                  outputRange: [0.25, 1, 0.25],
                  extrapolate: 'clamp'
                })
              }
            ]}
          />
        );
      })}
    </View>
  );
};

const DashboardHeader = ({
  user,
  storeLogo,
  isSyncing,
  onMenuPress,
  dateFilter,
  onDatePickerPress,
  totalInvoices,
  paidCount,
  pendingCount
}) => {
  return (
    <View style={styles.headerWrapper}>
      <LinearGradient
        colors={['#000000', '#1a1a1a']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={styles.headerGradient}
      >
        <SafeAreaView edges={['top']}>
          <View style={styles.topBar}>
            <View style={styles.leftSection}>
              <Pressable onPress={onMenuPress} style={styles.hamburger}>
                <Menu size={24} color="#fff" />
              </Pressable>
              <View>
                <Text style={styles.greeting}>Hello,</Text>
                <Text style={styles.userName}>{user?.name || user?.email?.split('@')[0] || 'Administrator'}</Text>
              </View>
            </View>

            <View style={styles.rightActions}>
              {isSyncing && (
                <View style={styles.syncIndicator}>
                  <CustomSyncLoader />
                  <Text style={styles.syncText}>Syncing...</Text>
                </View>
              )}
              <Image
                source={storeLogo ? { uri: storeLogo } : require('../../../assets/kwiq.png')}
                style={styles.topLogo}
                resizeMode="contain"
              />
            </View>
          </View>

          <Pressable style={styles.dateFilterSection} onPress={onDatePickerPress}>
            <View style={styles.dateFilterContent}>
              <Text style={styles.dateFilterLabel}>Period</Text>
              <View style={styles.dateFilterValueRow}>
                <Text style={styles.dateFilterValue}>{dateFilter}</Text>
                <ChevronDown size={18} color="#fff" />
              </View>
            </View>
          </Pressable>

          <View style={styles.summaryCard}>
            <StatTile title="Total Invoices" value={totalInvoices} sub={dateFilter} />
            <View style={styles.vDivider} />
            <StatTile title="Paid" value={paidCount} sub={dateFilter} />
            <View style={styles.vDivider} />
            <StatTile title="Pending" value={pendingCount} sub={dateFilter} />
          </View>
        </SafeAreaView>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  headerWrapper: { backgroundColor: '#fff' },
  headerGradient: { paddingBottom: 40, borderBottomLeftRadius: 40, borderBottomRightRadius: 40 },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    marginBottom: 25
  },
  leftSection: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  greeting: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '600' },
  userName: { fontSize: 22, fontWeight: '900', color: '#fff', letterSpacing: -0.5 },
  rightActions: { flexDirection: 'row', alignItems: 'center' },
  hamburger: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  topLogo: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff' },
  syncIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(34, 197, 94, 0.4)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 12,
    marginRight: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  loaderSmall: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loaderBar: {
    position: 'absolute',
    width: 2,
    height: 5,
    backgroundColor: '#fff',
    borderRadius: 2,
  },
  syncText: { color: '#fff', fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
  dateFilterSection: {
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  dateFilterContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  dateFilterLabel: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase' },
  dateFilterValueRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dateFilterValue: { fontSize: 16, fontWeight: '700', color: '#fff' },
  summaryCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 20,
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  statTile: { flex: 1 },
  statTileTitle: { fontSize: 11, color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', marginBottom: 5 },
  statTileValue: { fontSize: 22, fontWeight: '900', color: '#1e293b' },
  statTileSub: { fontSize: 9, color: '#64748b', marginTop: 4 },
  vDivider: { width: 1, backgroundColor: '#f1f5f9', marginHorizontal: 12, height: '70%', alignSelf: 'center' },
});

export default React.memo(DashboardHeader);
