import React from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, SafeAreaView, StatusBar, Dimensions, Platform } from 'react-native';
import { ChevronLeft, Scale } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

export default function TermsOfService() {
    const navigation = useNavigation();

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#000000" />

            {/* ── HEADER ── */}
            <View style={styles.headerWrapper}>
                <LinearGradient
                    colors={['#000000', '#1A1A1A']}
                    style={styles.headerGradient}
                >
                    <SafeAreaView edges={['top']}>
                        <View style={styles.headerTop}>
                            <Pressable
                                onPress={() => navigation.goBack()}
                                style={({ pressed }) => [
                                    styles.backBtn,
                                    pressed && styles.backBtnPressed
                                ]}
                            >
                                <ChevronLeft size={24} color="#FFF" />
                            </Pressable>

                            <View style={styles.headerIconWrap}>
                                <Scale size={32} color="rgba(255,255,255,0.2)" />
                            </View>
                        </View>

                        <View style={styles.headerContent}>
                            <Text style={styles.headerTitle}>Terms of Service</Text>
                            <Text style={styles.headerSubtitle}>Legal concordat & usage parameters</Text>
                        </View>
                    </SafeAreaView>

                    {/* Decorative element */}
                    <View style={styles.decorCircle} />
                </LinearGradient>
            </View>

            {/* ── CONTENT ── */}
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.metaRow}>
                    <View style={styles.badge}>
                        <Text style={styles.badgeText}>v2.0.4</Text>
                    </View>
                    <Text style={styles.lastUpdated}>Effective as of March 5, 2026</Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>1. Preamble and Acceptance</Text>
                    <Text style={styles.paragraph}>
                        This Agreement constitutes a legally binding concordat between the individual or entity accessing the Application ("User") and Kwiq Bill ("Corporation"). By facilitating the instantiation of the Application or engaging with its programmatic interfaces, the User hereby irrevocably acknowledges, represents, and warrants that they have perused, apprehended, and acceded to be bound by the exhaustive stipulations set forth herein.
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>2. Scope of Licensed Utility</Text>
                    <Text style={styles.paragraph}>
                        The Corporation hereby grants the User a non-exclusive, non-transferable, revocable prerogative to utilize the Application strictly for the purposive management of commercial invoicing and inventory tracking. Any unauthorized circumvention of the programmatic safeguards, reverse engineering, or clandestine extraction of the source code is strictly prohibited and shall be prosecuted to the maximum extent permissible under statutory regulations.
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>3. Intellectual Property Indefeasibility</Text>
                    <Text style={styles.paragraph}>
                        All proprietary algorithms, graphical interfaces, and nomenclature associated with the Application are the exclusive intellectual property of the Corporation. No provision within this Agreement shall be interpreted as a conveyance of ownership or an assignment of copyrights. Any infringement upon these proprietary assets shall result in immediate rescission of access and potential litigation.
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>4. Disclaimer of Warranties</Text>
                    <Text style={styles.paragraph}>
                        The Application is provided on an "as-is" and "as-available" basis, devoid of any express or implied warranties. The Corporation disclaims all representations pertaining to the unfailing accuracy, perpetual availability, or fitness for a particular commercial purpose. The User assumes all existential risks associated with the reliance upon the data generated by the programmatic infrastructure.
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>5. Indemnification and Liability Limitation</Text>
                    <Text style={styles.paragraph}>
                        In no event shall the Corporation be liable for any indirect, incidental, or consequential damages arising from the maloperation of the Application. The User agrees to indemnify and hold harmless the Corporation from any liabilities or fiscal exigencies resulting from the User's breach of these stipulations.
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>6. Jurisdictional Governance</Text>
                    <Text style={styles.paragraph}>
                        These Terms shall be governed by and construed in accordance with the prevailing legal frameworks of the governing jurisdiction. Any disputes arising from the interpretation of this Agreement shall be adjudicated within the specialized tribunals designated by the Corporation.
                    </Text>
                </View>

                <View style={styles.endPadding} />
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFFFFF' },

    /* ── Header Styles ── */
    headerWrapper: {
        backgroundColor: '#000',
        borderBottomLeftRadius: 32,
        borderBottomRightRadius: 32,
        overflow: 'hidden',
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
    },
    headerGradient: {
        paddingBottom: 32,
    },
    headerTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: Platform.OS === 'android' ? 24 : 12,
    },
    backBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    backBtnPressed: {
        backgroundColor: 'rgba(255,255,255,0.2)',
        transform: [{ scale: 0.95 }],
    },
    headerIconWrap: {
        paddingRight: 8,
    },
    headerContent: {
        paddingHorizontal: 24,
        marginTop: 20,
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: '800',
        color: '#FFF',
        letterSpacing: -0.8,
    },
    headerSubtitle: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.5)',
        marginTop: 4,
        fontWeight: '600',
    },
    decorCircle: {
        position: 'absolute',
        width: 150,
        height: 150,
        borderRadius: 75,
        backgroundColor: 'rgba(255,255,255,0.03)',
        top: -30,
        right: -40,
    },

    /* ── Content Styles ── */
    scrollView: {
        flex: 1,
    },
    content: {
        paddingHorizontal: 24,
        paddingTop: 32,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 32,
        gap: 10,
    },
    badge: {
        backgroundColor: '#F1F5F9',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    badgeText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#64748B',
    },
    lastUpdated: {
        fontSize: 13,
        color: '#94A3B8',
        fontWeight: '600',
        fontStyle: 'italic',
    },
    section: {
        marginBottom: 32,
    },
    sectionTitle: {
        fontSize: 17,
        fontWeight: '800',
        color: '#000000',
        marginBottom: 12,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    paragraph: {
        fontSize: 15,
        color: '#334155',
        lineHeight: 24,
        textAlign: 'justify',
        fontWeight: '500',
    },
    endPadding: {
        height: 60,
    },
});

