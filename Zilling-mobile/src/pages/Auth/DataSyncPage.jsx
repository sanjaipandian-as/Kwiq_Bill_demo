import React from 'react';
import { View, Text, StyleSheet, Dimensions, SafeAreaView, StatusBar } from 'react-native';
import * as Progress from 'react-native-progress';
import { CloudDownload, Server, CheckCircle2, ChevronRight, Info, Clock } from 'lucide-react-native';

const { width } = Dimensions.get('window');

const DataSyncPage = ({ progressMessage, progressValue }) => {
    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" />

            <View style={styles.content}>
                {/* Brand / Logo placeholder */}
                <View style={styles.header}>
                    <View style={styles.brandIcon}>
                        <Server size={28} color="#6366f1" />
                    </View>
                    <Text style={styles.brandName}>KwiqBill</Text>
                </View>

                {/* Main Illustration Area */}
                <View style={styles.illustrationContainer}>
                    <View style={styles.cloudNode}>
                        <CloudDownload size={32} color="#6366f1" />
                    </View>

                    <View style={styles.connector}>
                        <View style={[styles.dot, { backgroundColor: progressValue > 0.3 ? '#6366f1' : '#e2e8f0' }]} />
                        <View style={[styles.dot, { backgroundColor: progressValue > 0.6 ? '#6366f1' : '#e2e8f0' }]} />
                        <View style={[styles.dot, { backgroundColor: progressValue > 0.9 ? '#6366f1' : '#e2e8f0' }]} />
                    </View>

                    <View style={[styles.deviceNode, { borderColor: progressValue === 1 ? '#10b981' : '#e2e8f0' }]}>
                        {progressValue === 1 ? (
                            <CheckCircle2 size={32} color="#10b981" />
                        ) : (
                            <View style={styles.pulseDot} />
                        )}
                    </View>
                </View>

                {/* Text Content */}
                <Text style={styles.title}>Aligning Your Data</Text>
                <Text style={styles.subtitle}>
                    We're securely restoring your store details, products, and sales history from the cloud.
                </Text>

                {/* Progress Section */}
                <View style={styles.progressSection}>
                    <View style={styles.progressLabelRow}>
                        <Text style={styles.currentTask}>{progressMessage?.split(' (Est. time:')[0] || 'Connecting...'}</Text>
                        <Text style={styles.percentageText}>{Math.round(progressValue * 100)}%</Text>
                    </View>

                    <Progress.Bar
                        progress={progressValue}
                        width={width - 60}
                        height={10}
                        color="#6366f1"
                        unfilledColor="#f1f5f9"
                        borderWidth={0}
                        borderRadius={5}
                    />

                    {/* Estimated Time Section */}
                    {progressMessage?.includes('Est. time:') && (
                        <View style={styles.estTimeContainer}>
                            <Clock size={16} color="#6366f1" />
                            <Text style={styles.estTimeLabel}>Estimated Time Remaining: </Text>
                            <Text style={styles.estTimeValue}>{progressMessage.split('Est. time: ')[1].replace(')', '')}</Text>
                        </View>
                    )}
                </View>

                <View style={{ flex: 1 }} />

                {/* Info / Tip Card */}
                <View style={styles.tipCard}>
                    <View style={styles.tipHeader}>
                        <Info size={16} color="#64748b" />
                        <Text style={styles.tipTitle}>Security Note</Text>
                    </View>
                    <Text style={styles.tipText}>
                        Your data is encrypted and backed up directly to your personal Google Drive account. Only you can access it.
                    </Text>
                </View>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    content: {
        flex: 1,
        paddingHorizontal: 30,
        paddingTop: 40,
        paddingBottom: 30,
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 60,
    },
    brandIcon: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: '#f5f3ff',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    brandName: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#1e293b',
        letterSpacing: -0.5,
    },
    illustrationContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 40,
    },
    cloudNode: {
        width: 70,
        height: 70,
        borderRadius: 35,
        backgroundColor: '#f5f3ff',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#e0e7ff',
    },
    deviceNode: {
        width: 70,
        height: 70,
        borderRadius: 35,
        backgroundColor: '#f8fafc',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
    },
    connector: {
        flexDirection: 'row',
        paddingHorizontal: 15,
        gap: 8,
    },
    dot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    pulseDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#cbd5e1',
    },
    title: {
        fontSize: 26,
        fontWeight: '800',
        color: '#0f172a',
        textAlign: 'center',
        marginBottom: 12,
    },
    subtitle: {
        fontSize: 15,
        color: '#64748b',
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 50,
        paddingHorizontal: 10,
    },
    progressSection: {
        width: '100%',
    },
    progressLabelRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        marginBottom: 12,
    },
    estTimeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 16,
        backgroundColor: '#f5f3ff',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 10,
        alignSelf: 'flex-start'
    },
    estTimeLabel: {
        fontSize: 13,
        color: '#475569',
        marginLeft: 8,
        fontWeight: '500'
    },
    estTimeValue: {
        fontSize: 13,
        color: '#6366f1',
        fontWeight: '700'
    },
    currentTask: {
        fontSize: 14,
        fontWeight: '600',
        color: '#475569',
    },
    percentageText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#6366f1',
    },
    tipCard: {
        width: '100%',
        backgroundColor: '#f8fafc',
        padding: 20,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    tipHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    tipTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: '#475569',
        marginLeft: 8,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    tipText: {
        fontSize: 13,
        color: '#64748b',
        lineHeight: 18,
    },
});

export default DataSyncPage;
