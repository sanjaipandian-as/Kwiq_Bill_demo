import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions, SafeAreaView, StatusBar, Animated, Platform, ActivityIndicator, Modal } from 'react-native';
import { ShieldCheck, Cloud, CheckCircle2, FileCheck, FileWarning, Info } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import BrandLockup from '../../components/ui/BrandLockup';
import KwiqLoader from '../../components/ui/KwiqLoader';
import { APP_VERSION } from '../../config/version';


const { width } = Dimensions.get('window');

const DataSyncPage = ({ progressMessage, progressValue, syncStats }) => {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const barWidth = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        // Main fade entry
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
        }).start();
    }, []);

    useEffect(() => {
        Animated.timing(barWidth, {
            toValue: progressValue,
            duration: 400,
            useNativeDriver: false,
        }).start();
    }, [progressValue]);

    const isComplete = progressValue >= 1;

    // ─── DYNAMIC METRICS LOGIC ───
    // If syncStats are passed (from real-time event processing), use them.
    // If not, we show '0' or placeholder text until we know the actual counts.
    const totalFiles = syncStats?.total !== undefined ? syncStats.total : '---';
    const syncedCount = syncStats?.synced !== undefined ? syncStats.synced : 0;
    const errorCount = syncStats?.errors || 0;

    // ─── POPUP LOGIC ───
    const isAligning = progressMessage?.includes('Aligning') || progressMessage?.includes('Finalizing');
    const timeMatch = progressMessage?.match(/\(Est\. time: (.*?)\)/);
    const estTime = timeMatch ? timeMatch[1] : null;

    // Determine the message based on complete state
    let displayMessage = progressMessage?.split(' (Est. time:')[0] || 'Aligning Your Data...';
    if (isComplete) {
        displayMessage = "Data was aligned. Opening app...";
    }

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#000000" />

            {/* ── TOP HERO: Curved Black Header ── */}
            <View style={styles.heroWrapper}>
                <LinearGradient
                    colors={['#000000', '#1A1A1A']}
                    style={styles.heroGradient}
                >
                    <SafeAreaView edges={['top']}>
                        <View style={styles.heroContent}>
                            <BrandLockup width={width * 0.85} height={110} variant="light" />
                        </View>
                    </SafeAreaView>
                </LinearGradient>
            </View>

            <View style={styles.contentWrapper}>
                <Animated.View style={[styles.inner, { opacity: fadeAnim }]}>

                    <View style={styles.syncContainer}>
                        <View style={styles.titleSection}>
                            <Text style={styles.mainHeading}>Data Synchronization</Text>
                            <Text style={styles.subHeading}>
                                We are carefully retrieving your records from the cloud. This process ensures your data remains safe and error-free.
                            </Text>
                        </View>

                        {/* ── PROGRESS SECTION: High-Contrast Mono ── */}
                        <View style={styles.progressBox}>
                            <View style={styles.statusRow}>
                                <View style={styles.indicatorRow}>
                                    {isComplete ? (
                                        <CheckCircle2 size={24} color="#000000" />
                                    ) : (
                                        <KwiqLoader size={24} color="#000000" />
                                    )}
                                    <View>
                                        <Text style={styles.statusLabel}>Current Status</Text>
                                        <Text style={[styles.statusText, isComplete && styles.statusTextDone]}>
                                            {isComplete ? 'Sync Complete' : (isAligning ? 'Aligning Data' : 'Syncing Cloud Records')}
                                        </Text>
                                    </View>
                                </View>
                                <Text style={styles.percentageText}>{Math.round(progressValue * 100)}%</Text>
                            </View>

                            <View style={styles.barContainer}>
                                <View style={styles.barTrack}>
                                    <Animated.View
                                        style={[
                                            styles.barFill,
                                            {
                                                width: barWidth.interpolate({
                                                    inputRange: [0, 1],
                                                    outputRange: ['0%', '100%'],
                                                }),
                                            }
                                        ]}
                                    />
                                </View>
                                <View style={styles.taskLabelRow}>
                                    <Cloud size={14} color="#666666" />
                                    <Text style={styles.currentTaskText} numberOfLines={1}>
                                        {progressMessage || 'Preparing cloud channel...'}
                                    </Text>
                                </View>
                            </View>
                        </View>

                        {/* ── SYNC METRICS: Vertical Improved Layout ── */}
                        <View style={styles.metricsContainer}>
                            <View style={styles.metricItemMono}>
                                <View style={styles.metricIconBox}>
                                    <FileCheck size={20} color="#000000" />
                                </View>
                                <View style={styles.metricContent}>
                                    <Text style={styles.metricTitle}>Total Cloud Records</Text>
                                    <Text style={styles.metricSubtitle}>Awaiting bitwise verification from cloud</Text>
                                </View>
                                {totalFiles === '---' ? (
                                    <ActivityIndicator size="small" color="#000000" style={{ marginLeft: 12 }} />
                                ) : (
                                    <Text style={styles.metricValueLarge}>{totalFiles}</Text>
                                )}
                            </View>

                            <View style={styles.metricsTwoColumn}>
                                <View style={styles.metricSmallMono}>
                                    <View style={styles.metricIconBoxSmall}>
                                        <CheckCircle2 size={14} color="#000000" />
                                    </View>
                                    <View>
                                        <Text style={styles.labelSmallMono}>Synced</Text>
                                        {!syncStats ? (
                                            <ActivityIndicator size="small" color="#000000" style={{ marginTop: 2 }} />
                                        ) : (
                                            <Text style={styles.valueSmallMono}>{syncedCount}</Text>
                                        )}
                                    </View>
                                </View>
                                <View style={styles.metricSmallMono}>
                                    <View style={styles.metricIconBoxSmall}>
                                        <FileWarning size={14} color="#000000" />
                                    </View>
                                    <View>
                                        <Text style={styles.labelSmallMono}>Errors</Text>
                                        <Text style={styles.valueSmallMono}>{errorCount}</Text>
                                    </View>
                                </View>
                            </View>
                        </View>

                        {/* ── REASSURANCE: Mono Style ── */}
                        <View style={styles.infoNoteMono}>
                            <View style={styles.infoIconWrapMono}>
                                <Info size={18} color="#000000" />
                            </View>
                            <Text style={styles.infoNoteTextMono}>
                                This page may take a moment to load as we are safely fetching your files from your Drive to prevent any errors. Thank you for your patience!
                            </Text>
                        </View>
                    </View>

                    {/* ── FOOTER: Updated Version Channel ── */}
                    <View style={styles.footer}>
                        <View style={styles.securityRowMono}>
                            <ShieldCheck size={14} color="#000000" />
                            <Text style={styles.securityTextMono}>BANK-GRADE AES-256 PROTECTION</Text>
                        </View>
                        <Text style={styles.versionTextMono}>{APP_VERSION} · SECURE DATA CHANNEL · STABLE</Text>

                    </View>
                </Animated.View>
            </View>

            {/* ── ALIGNMENT POPUP ── */}
            <Modal
                transparent={true}
                visible={isAligning}
                animationType="fade"
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContainer}>
                        <LinearGradient
                            colors={['#000000', '#1A1A1A']}
                            style={styles.modalGradient}
                        >
                            {isComplete ? (
                                <CheckCircle2 size={48} color="#FFFFFF" />
                            ) : (
                                <KwiqLoader size={48} color="#FFFFFF" />
                            )}
                            <Text style={styles.modalTitle}>{displayMessage}</Text>
                            <Text style={styles.modalDesc}>
                                {isComplete
                                    ? "Your inventory and store data are perfectly synced and ready."
                                    : "We are optimizing and indexing your cloud records for high-speed local access."
                                }
                            </Text>

                            {(estTime && !isComplete) && (
                                <View style={styles.timeBadge}>
                                    <Text style={styles.timeBadgeLabel}>ESTIMATED TIME</Text>
                                    <Text style={styles.timeBadgeValue}>{estTime}</Text>
                                </View>
                            )}
                        </LinearGradient>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    heroWrapper: {
        backgroundColor: '#000',
        borderBottomLeftRadius: 40,
        borderBottomRightRadius: 40,
        overflow: 'hidden',
    },
    heroGradient: {
        paddingBottom: 40,
        paddingTop: Platform.OS === 'android' ? 40 : 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    heroContent: {
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 10,
        paddingRight: 25,
    },
    contentWrapper: {
        flex: 1,
        marginTop: 0,
    },
    inner: {
        flex: 1,
        justifyContent: 'space-between',
        paddingBottom: 24,
    },
    syncContainer: {
        width: '100%',
        paddingHorizontal: 24,
        paddingTop: 10,
    },
    titleSection: {
        alignItems: 'center',
        marginBottom: 28,
    },
    mainHeading: {
        fontSize: 24,
        fontWeight: '900',
        color: '#000000',
        letterSpacing: -1,
        marginBottom: 8,
    },
    subHeading: {
        fontSize: 14,
        color: '#666666',
        textAlign: 'center',
        lineHeight: 20,
        fontWeight: '600',
        paddingHorizontal: 12,
    },
    progressBox: {
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 24,
        borderWidth: 1.5,
        borderColor: '#000000',
        marginBottom: 20,
    },
    statusRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    indicatorRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        flex: 1,
    },
    statusLabel: {
        fontSize: 10,
        fontWeight: '800',
        color: '#999999',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    statusText: {
        fontSize: 14,
        fontWeight: '800',
        color: '#000000',
    },
    statusTextDone: {
        color: '#000000',
    },
    percentageText: {
        fontSize: 28,
        fontWeight: '900',
        color: '#000000',
        fontVariant: ['tabular-nums'],
    },
    barContainer: {
        width: '100%',
        gap: 12,
    },
    barTrack: {
        height: 12,
        backgroundColor: '#EEEEEE',
        borderRadius: 6,
        overflow: 'hidden',
    },
    barFill: {
        height: '100%',
        backgroundColor: '#000000',
        borderRadius: 6,
    },
    taskLabelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    currentTaskText: {
        fontSize: 12,
        color: '#999999',
        fontWeight: '700',
    },

    /* ── Metrics: Vertical Professional Mono ── */
    metricsContainer: {
        gap: 10,
        marginBottom: 20,
    },
    metricItemMono: {
        width: '100%',
        backgroundColor: '#F9F9F9',
        borderRadius: 20,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#EEEEEE',
    },
    metricIconBox: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
        borderWidth: 1,
        borderColor: '#EEEEEE',
    },
    metricContent: {
        flex: 1,
    },
    metricTitle: {
        fontSize: 14,
        fontWeight: '800',
        color: '#000000',
    },
    metricSubtitle: {
        fontSize: 11,
        color: '#999999',
        fontWeight: '600',
        marginTop: 2,
    },
    metricValueLarge: {
        fontSize: 22,
        fontWeight: '900',
        color: '#000000',
        marginLeft: 12,
    },
    metricsTwoColumn: {
        flexDirection: 'row',
        gap: 10,
    },
    metricSmallMono: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        borderWidth: 1,
        borderColor: '#EEEEEE',
    },
    metricIconBoxSmall: {
        width: 28,
        height: 28,
        borderRadius: 8,
        backgroundColor: '#F5F5F5',
        justifyContent: 'center',
        alignItems: 'center',
    },
    labelSmallMono: {
        fontSize: 10,
        color: '#999999',
        fontWeight: '800',
        textTransform: 'uppercase',
    },
    valueSmallMono: {
        fontSize: 16,
        fontWeight: '900',
        color: '#000000',
    },

    /* ── Info Note Mono ── */
    infoNoteMono: {
        flexDirection: 'row',
        backgroundColor: '#000000',
        padding: 16,
        borderRadius: 20,
        gap: 14,
        alignItems: 'center',
    },
    infoIconWrapMono: {
        backgroundColor: '#FFFFFF',
        padding: 8,
        borderRadius: 12,
    },
    infoNoteTextMono: {
        flex: 1,
        fontSize: 12,
        color: '#FFFFFF',
        fontWeight: '600',
        lineHeight: 18,
    },

    /* ── Footer Mono ── */
    footer: {
        alignItems: 'center',
        gap: 6,
        marginTop: 'auto',
    },
    securityRowMono: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: 8,
        gap: 6,
    },
    securityTextMono: {
        fontSize: 10,
        fontWeight: '900',
        color: '#000000',
        paddingTop: 1,
        letterSpacing: 1,
    },
    versionTextMono: {
        fontSize: 8,
        fontWeight: '800',
        color: '#272727ff',
        letterSpacing: 0.5,
    },

    /* ── Modal Styles ── */
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 30,
    },
    modalContainer: {
        width: '100%',
        borderRadius: 32,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
    },
    modalGradient: {
        padding: 40,
        alignItems: 'center',
    },
    modalTitle: {
        fontSize: 22,
        fontWeight: '900',
        color: '#FFFFFF',
        marginTop: 24,
        textAlign: 'center',
        letterSpacing: -0.5,
    },
    modalDesc: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.6)',
        textAlign: 'center',
        marginTop: 12,
        lineHeight: 20,
        fontWeight: '500',
    },
    timeBadge: {
        marginTop: 30,
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 16,
        alignItems: 'center',
    },
    timeBadgeLabel: {
        fontSize: 10,
        fontWeight: '900',
        color: '#666666',
        letterSpacing: 1,
    },
    timeBadgeValue: {
        fontSize: 18,
        fontWeight: '900',
        color: '#000000',
        marginTop: 2,
    },
});

export default DataSyncPage;
