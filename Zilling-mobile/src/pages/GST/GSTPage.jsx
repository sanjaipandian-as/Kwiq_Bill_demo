import React, { useMemo, useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Pressable,
    Dimensions,
    LayoutAnimation,
    Platform,
    UIManager,
    StatusBar,
    Modal,
    Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import {
    ChevronLeft,
    Download,
    TrendingUp,
    Calendar,
    ArrowUpRight,
    ShieldCheck,
    Clock,
    CircleSlash,
    ArrowRight,
    Globe,
    Building2,
    Landmark,
    Filter,
    X,
    ChevronRight,
    CalendarDays,
    ChevronLeft as ChevronLeftIcon,
    ChevronRight as ChevronRightIcon
} from 'lucide-react-native';
import { useTransactions } from '../../context/TransactionContext';
import * as XLSX from 'xlsx';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

// Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width } = Dimensions.get('window');

// --- Premium Component: Stat Card ---
const ModernStat = ({ label, value, subValue, icon: Icon, isPrimary = false, flex = 1 }) => (
    <View style={[styles.statCard, isPrimary && styles.primaryStatCard, { flex }]}>
        <View style={styles.statHeader}>
            <View style={[styles.statIconContainer, { backgroundColor: isPrimary ? 'rgba(255,255,255,0.15)' : '#000' }]}>
                <Icon size={16} color={isPrimary ? '#fff' : '#fff'} />
            </View>
            <Text style={[styles.statLabel, isPrimary && { color: 'rgba(255,255,255,0.6)' }]}>{label}</Text>
        </View>
        <View style={styles.statBody}>
            <Text style={[styles.statValue, isPrimary && { color: '#fff' }]}>₹{value}</Text>
            {subValue && (
                <View style={styles.statSubRow}>
                    <Text style={[styles.statSubText, isPrimary && { color: 'rgba(255,255,255,0.5)' }]}>{subValue}</Text>
                </View>
            )}
        </View>
    </View>
);

// --- Premium Component: Info Row ---
const TrackingRow = ({ title, description, date, isLast = false }) => (
    <View style={styles.trackingRow}>
        <View style={styles.trackingLeft}>
            <View style={styles.trackingDotContainer}>
                <View style={styles.trackingDot} />
                {!isLast && <View style={styles.trackingLine} />}
            </View>
            <View style={styles.trackingContent}>
                <Text style={styles.trackingTitle}>{title}</Text>
                <Text style={styles.trackingDesc}>{description}</Text>
            </View>
        </View>
        <View style={styles.trackingRight}>
            <Clock size={12} color="#94a3b8" />
            <Text style={styles.trackingDate}>{date}</Text>
        </View>
    </View>
);

export default function GSTPage() {
    const navigation = useNavigation();
    const { transactions } = useTransactions();
    const [period, setPeriod] = useState('Today');
    const [selectedCustomDate, setSelectedCustomDate] = useState(null);
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [isCalendarOpen, setIsCalendarOpen] = useState(false);

    // Calendar State
    const [currentCalView, setCurrentCalView] = useState(new Date());

    const filteredTransactions = useMemo(() => {
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        let filtered = transactions;

        if (period === 'Today') {
            filtered = transactions.filter(t => new Date(t.date) >= startOfToday);
        } else if (period === 'Yesterday') {
            const yesterday = new Date(startOfToday);
            yesterday.setDate(yesterday.getDate() - 1);
            filtered = transactions.filter(t => {
                const d = new Date(t.date);
                return d >= yesterday && d < startOfToday;
            });
        } else if (period === 'This Week') {
            const startOfWeek = new Date(startOfToday);
            startOfWeek.setDate(startOfToday.getDate() - startOfToday.getDay());
            filtered = transactions.filter(t => new Date(t.date) >= startOfWeek);
        } else if (period === 'This Month') {
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            filtered = transactions.filter(t => new Date(t.date) >= startOfMonth);
        } else if (period === 'This Year') {
            const startOfYear = new Date(now.getFullYear(), 0, 1);
            filtered = transactions.filter(t => new Date(t.date) >= startOfYear);
        } else if (period === 'All Time') {
            filtered = transactions;
        } else if (period === 'Custom' && selectedCustomDate) {
            const targetDate = new Date(selectedCustomDate);
            targetDate.setHours(0, 0, 0, 0);
            const endDate = new Date(targetDate);
            endDate.setDate(targetDate.getDate() + 1);
            filtered = transactions.filter(t => {
                const d = new Date(t.date);
                return d >= targetDate && d < endDate;
            });
        }
        return filtered;
    }, [transactions, period, selectedCustomDate]);

    const gstData = useMemo(() => {
        let totalSales = 0;
        let totalGST = 0;
        let sgst = 0;
        let cgst = 0;
        let igst = 0;
        let taxableValue = 0;

        filteredTransactions.forEach(t => {
            const tax = parseFloat(t.tax || t.taxAmount || 0);
            const t_totals = t.totals || {};

            let final_sgst = parseFloat(t_totals.sgst || 0);
            let final_cgst = parseFloat(t_totals.cgst || 0);
            let final_igst = parseFloat(t_totals.igst || 0);

            if (final_sgst === 0 && final_cgst === 0 && final_igst === 0 && tax > 0) {
                if (t.taxType === 'inter') {
                    final_igst = tax;
                } else {
                    final_sgst = tax / 2;
                    final_cgst = tax / 2;
                }
            }

            totalSales += parseFloat(t.total || 0);
            totalGST += tax;
            sgst += final_sgst;
            cgst += final_cgst;
            igst += final_igst;
            taxableValue += parseFloat(t.subtotal || 0);
        });

        const formation = (val) => val.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

        return {
            totalSales: formation(totalSales),
            totalGST: formation(totalGST),
            sgst: formation(sgst),
            cgst: formation(cgst),
            igst: formation(igst),
            taxableValue: formation(taxableValue)
        };
    }, [filteredTransactions]);

    const handleExportExcel = async () => {
        if (filteredTransactions.length === 0) {
            Alert.alert("No Data", "There are no transactions in this period to export.");
            return;
        }

        try {
            // Map data to the format shown in the user's image
            const exportData = filteredTransactions.map(t => {
                const date = new Date(t.date);
                const formattedDate = `${String(date.getDate()).padStart(2, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${date.getFullYear()}`;

                const tax = parseFloat(t.tax || t.taxAmount || 0);
                const t_totals = t.totals || {};

                let s = parseFloat(t_totals.sgst || 0);
                let c = parseFloat(t_totals.cgst || 0);
                let i = parseFloat(t_totals.igst || 0);

                if (s === 0 && c === 0 && i === 0 && tax > 0) {
                    if (t.taxType === 'inter') i = tax;
                    else { s = tax / 2; c = tax / 2; }
                }

                return {
                    "Invoice Date": formattedDate,
                    "Invoice Number": t.id?.substring(0, 8) || "N/A",
                    "Customer Name": t.customerName || "Guest",
                    "GSTIN": t.customerGstin || "",
                    "State": t.taxType === 'inter' ? 'Inter-State' : 'State',
                    "Taxable Value": parseFloat(t.subtotal || 0).toFixed(2),
                    "CGST Amount": c.toFixed(2),
                    "SGST Amount": s.toFixed(2),
                    "IGST Amount": i.toFixed(2),
                    "Total Tax": tax.toFixed(2),
                    "Invoice Total": parseFloat(t.total || 0).toFixed(2)
                };
            });

            // Create worksheet
            const ws = XLSX.utils.json_to_sheet(exportData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "GST Report");

            // Generate base64 string
            const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });

            // Define file path
            const fileName = `GST_Report_${period.replace(' ', '_')}_${Date.now()}.xlsx`;
            const fileUri = FileSystem.documentDirectory + fileName;

            // Write file to local storage
            await FileSystem.writeAsStringAsync(fileUri, wbout, { encoding: 'base64' });

            // Handle Download/Save to Storage
            if (Platform.OS === 'android' && FileSystem.StorageAccessFramework) {
                try {
                    const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
                    if (permissions.granted) {
                        const newUri = await FileSystem.StorageAccessFramework.createFileAsync(
                            permissions.directoryUri,
                            fileName,
                            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                        );
                        await FileSystem.writeAsStringAsync(newUri, wbout, { encoding: FileSystem.EncodingType.Base64 });
                        Alert.alert("Success", "GST report downloaded successfully to your selected folder.");
                        return;
                    }
                } catch (safError) {
                    console.warn('SAF Error, falling back to Share:', safError);
                }
            }

            // Fallback for iOS or if SAF is denied/fails
            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(fileUri, {
                    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    dialogTitle: 'Save GST Report',
                    UTI: 'com.microsoft.excel.xlsx'
                });
            } else {
                Alert.alert("Success", "Report saved to temporary storage: " + fileUri);
            }
        } catch (error) {
            console.error("Export Error:", error);
            Alert.alert("Error", "Failed to generate Excel report.");
        }
    };

    const changePeriod = (p) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setPeriod(p);
        setIsFilterOpen(false);
    };

    const handleCustomDateSelect = (date) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setSelectedCustomDate(date);
        setPeriod('Custom');
        setIsCalendarOpen(false);
    };

    const getPeriodLabel = () => {
        if (period === 'Custom' && selectedCustomDate) {
            const d = new Date(selectedCustomDate);
            return `${d.getDate()} ${d.toLocaleString('default', { month: 'short' })} ${d.getFullYear()}`;
        }
        return period;
    };

    // Calendar Helpers
    const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
    const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

    const calendarHeader = currentCalView.toLocaleString('default', { month: 'long', year: 'numeric' });
    const daysArr = Array.from({ length: getDaysInMonth(currentCalView.getFullYear(), currentCalView.getMonth()) }, (_, i) => i + 1);
    const startPadding = Array.from({ length: getFirstDayOfMonth(currentCalView.getFullYear(), currentCalView.getMonth()) });

    const shiftMonth = (offset) => {
        const newDate = new Date(currentCalView.getFullYear(), currentCalView.getMonth() + offset, 1);
        setCurrentCalView(newDate);
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#fff" />
            <SafeAreaView style={styles.safeArea} edges={['top']}>
                {/* Header */}
                <View style={styles.header}>
                    <Pressable onPress={() => navigation.goBack()} style={styles.iconBtn}>
                        <ChevronLeft size={22} color="#000" />
                    </Pressable>
                    <View style={styles.headerMain}>
                        <Text style={styles.headerTitle}>GST Analytics</Text>
                        <Text style={styles.headerSubtitle}>Compliance Tracking</Text>
                    </View>
                    <Pressable style={styles.iconBtn} onPress={handleExportExcel}>
                        <Download size={18} color="#000" />
                    </Pressable>
                </View>

                {/* Main Filter Bar - Liquid Pilled Selection */}
                <View style={styles.mainFilterBar}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
                        {['Today', 'Yesterday', 'This Week', 'This Month'].map(p => (
                            <Pressable
                                key={p}
                                style={[styles.filterPill, period === p && styles.activeFilterPill]}
                                onPress={() => changePeriod(p)}
                            >
                                <Text style={[styles.filterPillText, period === p && styles.activeFilterPillText]}>
                                    {p === 'This Week' ? 'Week' : p === 'This Month' ? 'Month' : p}
                                </Text>
                            </Pressable>
                        ))}
                        <Pressable
                            style={[styles.filterPill, period === 'Custom' && styles.activeFilterPill]}
                            onPress={() => setIsCalendarOpen(true)}
                        >
                            <Calendar size={14} color={period === 'Custom' ? '#fff' : '#64748b'} style={{ marginRight: 6 }} />
                            <Text style={[styles.filterPillText, period === 'Custom' && styles.activeFilterPillText]}>
                                {period === 'Custom' ? getPeriodLabel() : 'Custom'}
                            </Text>
                        </Pressable>
                    </ScrollView>
                    <Pressable style={styles.filterTrigger} onPress={() => setIsFilterOpen(true)}>
                        <Filter size={18} color="#000" />
                    </Pressable>
                </View>

                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Hero Visualization */}
                    <View style={styles.heroCard}>
                        <View style={styles.heroHeader}>
                            <View>
                                <Text style={styles.heroLabel}>Net Tax Payable</Text>
                                <Text style={styles.heroAmount}>₹{gstData.totalGST}</Text>
                            </View>
                            <View style={styles.heroIconBox}>
                                <ShieldCheck size={24} color="#fff" />
                            </View>
                        </View>
                        <View style={styles.heroFooter}>
                            <View style={styles.heroStatItem}>
                                <Text style={styles.heroStatLabel}>GROSS SALES</Text>
                                <Text style={styles.heroStatValue}>₹{gstData.totalSales}</Text>
                            </View>
                            <View style={styles.heroStatDivider} />
                            <View style={styles.heroStatItem}>
                                <Text style={styles.heroStatLabel}>TAXABLE VALUE</Text>
                                <Text style={styles.heroStatValue}>₹{gstData.taxableValue}</Text>
                            </View>
                        </View>
                    </View>

                    <Text style={styles.sectionHeader}>Tax Breakdown</Text>

                    {/* Improved Component Grid */}
                    <View style={styles.taxGroup}>
                        <View style={styles.statsGrid}>
                            <ModernStat
                                label="SGST"
                                value={gstData.sgst}
                                subValue="State Component"
                                icon={Building2}
                            />
                            <ModernStat
                                label="CGST"
                                value={gstData.cgst}
                                subValue="Central Component"
                                icon={Landmark}
                            />
                        </View>

                        <View style={styles.fullWidthStat}>
                            <ModernStat
                                label="IGST (Integrated Tax)"
                                value={gstData.igst}
                                subValue="Inter-state Transactions"
                                icon={Globe}
                            />
                        </View>
                    </View>

                    {/* Compliance Section */}
                    <View style={styles.timelineSection}>
                        <View style={styles.sectionHeadRow}>
                            <Text style={styles.sectionHeaderNoTop}>Compliance Timeline</Text>
                            <ArrowRight size={14} color="#cbd5e1" />
                        </View>

                        <View style={styles.whiteCard}>
                            <TrackingRow
                                title="GSTR-1"
                                description="Invoice-wise Outward supplies data"
                                date="Monthly"
                            />
                            <TrackingRow
                                title="GSTR-3B"
                                description="Monthly self-declaration summary"
                                date="Monthly"
                                isLast={true}
                            />
                        </View>
                    </View>

                    {/* Pro Footer */}
                    <View style={styles.advisoryBox}>
                        <CircleSlash size={16} color="#94a3b8" />
                        <Text style={styles.advisoryText}>
                            Calculated from internal transaction logs. Always verify with your actual GST portal records before final settlement.
                        </Text>
                    </View>
                </ScrollView>
            </SafeAreaView>

            {/* Filter Drawer */}
            <Modal
                visible={isFilterOpen}
                transparent
                animationType="fade"
                onRequestClose={() => setIsFilterOpen(false)}
            >
                <Pressable style={styles.modalOverlay} onPress={() => setIsFilterOpen(false)}>
                    <View style={styles.filterModal}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>History Settings</Text>
                            <Pressable onPress={() => setIsFilterOpen(false)} style={styles.modalCloseBtn}>
                                <X size={18} color="#64748b" />
                            </Pressable>
                        </View>

                        <ScrollView style={styles.modalScroll}>
                            {[
                                { id: 'Today', label: 'Today', icon: Clock },
                                { id: 'Yesterday', label: 'Yesterday', icon: Clock },
                                { id: 'This Week', label: 'This Week', icon: Calendar },
                                { id: 'This Month', label: 'This Month', icon: Calendar },
                                { id: 'This Year', label: 'This Year', icon: Calendar },
                                { id: 'All Time', label: 'All Time', icon: Globe },
                            ].map(item => (
                                <Pressable
                                    key={item.id}
                                    style={[styles.filterItem, period === item.id && styles.activeFilterItem]}
                                    onPress={() => changePeriod(item.id)}
                                >
                                    <View style={styles.filterItemLeft}>
                                        <item.icon size={18} color={period === item.id ? '#000' : '#94a3b8'} />
                                        <Text style={[styles.filterItemLabel, period === item.id && styles.activeFilterItemLabel]}>{item.label}</Text>
                                    </View>
                                    <ChevronRight size={16} color="#cbd5e1" />
                                </Pressable>
                            ))}
                        </ScrollView>
                    </View>
                </Pressable>
            </Modal>

            {/* Premium Specific Date Picker Modal */}
            <Modal
                visible={isCalendarOpen}
                transparent
                animationType="fade"
                onRequestClose={() => setIsCalendarOpen(false)}
            >
                <Pressable style={styles.modalOverlay} onPress={() => setIsCalendarOpen(false)}>
                    <View style={styles.premiumCal}>
                        <View style={styles.calTop}>
                            <View style={styles.calNav}>
                                <Pressable onPress={() => shiftMonth(-1)} style={styles.calNavBtn}>
                                    <ChevronLeftIcon size={20} color="#000" />
                                </Pressable>
                                <Text style={styles.calMonthLabel}>{calendarHeader}</Text>
                                <Pressable onPress={() => shiftMonth(1)} style={styles.calNavBtn}>
                                    <ChevronRightIcon size={20} color="#000" />
                                </Pressable>
                            </View>
                            <Pressable onPress={() => setIsCalendarOpen(false)} style={styles.calClose}>
                                <X size={20} color="#94a3b8" />
                            </Pressable>
                        </View>

                        <View style={styles.calWeekRow}>
                            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                                <Text key={i} style={styles.calWeekText}>{d}</Text>
                            ))}
                        </View>

                        <View style={styles.calGrid}>
                            {startPadding.map((_, i) => (
                                <View key={`p-${i}`} style={styles.calDayCell} />
                            ))}
                            {daysArr.map(day => {
                                const isSelected = selectedCustomDate &&
                                    selectedCustomDate.getDate() === day &&
                                    selectedCustomDate.getMonth() === currentCalView.getMonth() &&
                                    selectedCustomDate.getFullYear() === currentCalView.getFullYear();
                                return (
                                    <Pressable
                                        key={day}
                                        style={[styles.calDayCell, isSelected && styles.calDayActive]}
                                        onPress={() => handleCustomDateSelect(new Date(currentCalView.getFullYear(), currentCalView.getMonth(), day))}
                                    >
                                        <Text style={[styles.calDayText, isSelected && styles.calDayTextActive]}>{day}</Text>
                                    </Pressable>
                                );
                            })}
                        </View>

                        <Pressable
                            style={styles.calTodayBtn}
                            onPress={() => handleCustomDateSelect(new Date())}
                        >
                            <Text style={styles.calTodayText}>Go to Today</Text>
                        </Pressable>
                    </View>
                </Pressable>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#ffffff' },
    safeArea: { flex: 1 },

    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingBottom: 20,
        backgroundColor: '#fff',
        gap: 16
    },
    iconBtn: {
        width: 48,
        height: 48,
        borderRadius: 16,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: '#f1f5f9',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 5,
        elevation: 2
    },
    headerMain: { flex: 1 },
    headerTitle: { fontSize: 24, fontWeight: '900', color: '#000', letterSpacing: -0.8 },
    headerSubtitle: { fontSize: 13, fontWeight: '700', color: '#94a3b8', marginTop: 1, textTransform: 'uppercase', letterSpacing: 0.5 },

    // Main Filter Bar - Liquid Style
    mainFilterBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingVertical: 12,
        backgroundColor: '#fff',
        gap: 12
    },
    filterScroll: { gap: 8, paddingRight: 20 },
    filterPill: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 14,
        backgroundColor: '#f8fafc',
        borderWidth: 1.5,
        borderColor: '#f1f5f9'
    },
    activeFilterPill: {
        backgroundColor: '#000',
        borderColor: '#000'
    },
    filterPillText: { fontSize: 13, fontWeight: '800', color: '#64748b' },
    activeFilterPillText: { color: '#fff' },
    filterTrigger: {
        width: 44,
        height: 44,
        borderRadius: 14,
        backgroundColor: '#fff',
        borderWidth: 1.5,
        borderColor: '#000',
        alignItems: 'center',
        justifyContent: 'center'
    },

    scrollContent: { paddingBottom: 120 },

    heroCard: {
        marginHorizontal: 20,
        backgroundColor: '#000',
        borderRadius: 32,
        padding: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 15 },
        shadowOpacity: 0.25,
        shadowRadius: 25,
        elevation: 15,
        marginBottom: 30,
        marginTop: 10
    },
    heroHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 },
    heroLabel: { fontSize: 11, fontWeight: '900', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 1.5 },
    heroAmount: { fontSize: 40, fontWeight: '900', color: '#fff', marginTop: 4, letterSpacing: -1 },
    heroIconBox: { width: 56, height: 56, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    heroFooter: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 24, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)' },
    heroStatItem: { flex: 1 },
    heroStatLabel: { fontSize: 9, fontWeight: '900', color: 'rgba(255,255,255,0.4)', marginBottom: 4, letterSpacing: 0.5 },
    heroStatValue: { fontSize: 16, fontWeight: '900', color: '#fff' },
    heroStatDivider: { width: 1.5, height: 24, backgroundColor: 'rgba(255,255,255,0.1)', marginHorizontal: 15 },

    sectionHeader: { fontSize: 11, fontWeight: '900', color: '#94a3b8', letterSpacing: 1.5, textTransform: 'uppercase', marginHorizontal: 24, marginBottom: 16, marginTop: 10 },
    sectionHeaderNoTop: { fontSize: 11, fontWeight: '900', color: '#94a3b8', letterSpacing: 1.5, textTransform: 'uppercase' },
    sectionHeadRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: 24, marginBottom: 16 },

    taxGroup: { marginHorizontal: 20, gap: 12 },
    statsGrid: { flexDirection: 'row', gap: 12 },
    fullWidthStat: { marginTop: 0 },
    statCard: {
        backgroundColor: '#fff',
        borderRadius: 24,
        padding: 20,
        borderWidth: 1.5,
        borderColor: '#f1f5f9',
        justifyContent: 'space-between',
        minHeight: 120,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.02,
        shadowRadius: 10,
        elevation: 2
    },
    statHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
    statIconContainer: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    statLabel: { fontSize: 12, fontWeight: '900', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 },
    statBody: { gap: 4 },
    statValue: { fontSize: 24, fontWeight: '900', color: '#000', letterSpacing: -0.5 },
    statSubRow: { flexDirection: 'row', alignItems: 'center' },
    statSubText: { fontSize: 11, fontWeight: '700', color: '#94a3b8' },

    timelineSection: { marginTop: 35 },
    whiteCard: { marginHorizontal: 20, backgroundColor: '#fff', borderRadius: 28, padding: 20, borderWidth: 1.5, borderColor: '#f1f5f9' },
    trackingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 16 },
    trackingLeft: { flexDirection: 'row', flex: 1, gap: 16 },
    trackingDotContainer: { alignItems: 'center', width: 16 },
    trackingDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#000', marginTop: 4, borderWidth: 2, borderColor: '#fff', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 2, elevation: 1 },
    trackingLine: { width: 2, flex: 1, backgroundColor: '#f1f5f9', marginVertical: 8 },
    trackingContent: { flex: 1 },
    trackingTitle: { fontSize: 16, fontWeight: '900', color: '#000' },
    trackingDesc: { fontSize: 12, fontWeight: '600', color: '#64748b', marginTop: 4, lineHeight: 18 },
    trackingRight: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#f8fafc', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: '#f1f5f9' },
    trackingDate: { fontSize: 11, fontWeight: '900', color: '#000' },

    advisoryBox: { marginHorizontal: 20, marginTop: 40, backgroundColor: '#f8fafc', borderRadius: 20, padding: 20, flexDirection: 'row', gap: 16, alignItems: 'center', borderWidth: 1, borderColor: '#f1f5f9' },
    advisoryText: { flex: 1, fontSize: 11, fontWeight: '700', color: '#94a3b8', lineHeight: 18 },

    // Modal Styles
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
    filterModal: { backgroundColor: '#fff', borderTopLeftRadius: 40, borderTopRightRadius: 40, padding: 28, paddingBottom: 50, maxHeight: '80%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 },
    modalTitle: { fontSize: 20, fontWeight: '900', color: '#000', letterSpacing: -0.5 },
    modalCloseBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#f8fafc', alignItems: 'center', justifyContent: 'center' },
    modalScroll: { marginBottom: 10 },
    filterItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 18, borderBottomWidth: 1.5, borderColor: '#f8fafc' },
    activeFilterItem: { backgroundColor: '#f8fafc', paddingHorizontal: 16, borderRadius: 20, borderColor: 'transparent', marginHorizontal: -16 },
    filterItemLeft: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    filterItemLabel: { fontSize: 16, fontWeight: '800', color: '#64748b' },
    activeFilterItemLabel: { color: '#000', fontWeight: '900' },

    // Premium Calendar Styles
    premiumCal: { backgroundColor: '#fff', borderTopLeftRadius: 40, borderTopRightRadius: 40, padding: 28, paddingBottom: 50 },
    calTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 },
    calNav: { flexDirection: 'row', alignItems: 'center', gap: 24 },
    calNavBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc', borderRadius: 12, borderWidth: 1, borderColor: '#f1f5f9' },
    calMonthLabel: { fontSize: 18, fontWeight: '900', color: '#000' },
    calClose: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#f8fafc', alignItems: 'center', justifyContent: 'center' },

    calWeekRow: { flexDirection: 'row', marginBottom: 20 },
    calWeekText: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '900', color: '#94a3b8', letterSpacing: 1 },

    calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
    calDayCell: { width: width / 7 - 12, height: 48, margin: 2, alignItems: 'center', justifyContent: 'center', borderRadius: 14 },
    calDayActive: { backgroundColor: '#000' },
    calDayText: { fontSize: 15, fontWeight: '800', color: '#475569' },
    calDayTextActive: { color: '#fff', fontWeight: '900' },

    calTodayBtn: { marginTop: 30, height: 56, borderRadius: 20, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
    calTodayText: { fontSize: 15, fontWeight: '900', color: '#fff' }
});
