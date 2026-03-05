import React from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, SafeAreaView, StatusBar, Dimensions, Platform } from 'react-native';
import { ChevronLeft, Fingerprint } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

export default function PrivacyPolicy() {
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
                                <Fingerprint size={32} color="rgba(255,255,255,0.2)" />
                            </View>
                        </View>

                        <View style={styles.headerContent}>
                            <Text style={styles.headerTitle}>Privacy Policy</Text>
                            <Text style={styles.headerSubtitle}>Data stewardship & protocols</Text>
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
                    <Text style={styles.sectionTitle}>1. Axiomatic Commitment to Confidentiality</Text>
                    <Text style={styles.paragraph}>
                        Kwiq Bill ("Corporation") maintains an unwavering commitment to the preservation of user data integrity and the sanctity of private communications. This Privacy Policy serves as the definitive exposition of our rigorous methodologies regarding the acquisition, orchestration, and dissemination of information harvested via the Application's ecosystem.
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>2. Taxonomy of Collected Information</Text>
                    <Text style={styles.paragraph}>
                        In the course of providing the Services, the Corporation may aggregate diverse datasets, including but not limited to: unique device identifiers, transactional metadata, and user-inputted commercial records. We employ sophisticated cryptographic protocols to ensure that all data ingestion processes remain commensurate with top-tier industry standards of digital security and confidentiality.
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>3. Methodological Utilization of Data</Text>
                    <Text style={styles.paragraph}>
                        The processed datasets are utilized exclusively for the optimization of the Application's algorithmic performance, the enhancement of user experiences, and the fulfillment of statutory obligations. The Corporation categorically eschews any third-party data brokerage activities and remains committed to the principle of data minimization throughout the lifecycle of the information.
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>4. Cryptographic Safeguards and Integration</Text>
                    <Text style={styles.paragraph}>
                        We utilize high-entropy encryption standards to secure data both in transit and at rest. Furthermore, our integration with secondary cloud infrastructures (e.g., Google Drive) is governed by strict OAuth protocols, ensuring that the Corporation never maintains unauthorized access to a User's broader digital repository.
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>5. Rights of the Data Subject</Text>
                    <Text style={styles.paragraph}>
                        Under various global data protection frameworks, the User maintains the prerogative to access, rectify, or demand the erasure of their processed information. Such petitions must be formally articulated via the designated communication channels provided within the Application's diagnostic interfaces.
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>6. Policy Permutations and Revisions</Text>
                    <Text style={styles.paragraph}>
                        The Corporation reserves the right to implement periodic modifications to this Policy. Such revisions shall be effective immediately upon their manifestation within the Application. Continued engagement with our programmatic infrastructure post-revision shall be construed as explicit endorsement and ratification of the updated stipulations.
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

