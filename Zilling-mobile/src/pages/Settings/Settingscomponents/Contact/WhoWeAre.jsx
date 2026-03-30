import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, CheckCircle2, Mail } from 'lucide-react-native';

const WhoWeAre = ({ navigation }) => {
  const advantages = [
    { title: "Custom Strategies", desc: "Tailored roadmaps and unique KPIs." },
    { title: "Expert Team", desc: "Senior developers and UX specialists." },
    { title: "Innovative Technology", desc: "AI integration and cloud-native frameworks." },
    { title: "Proven Experience", desc: "Over 50+ real-world projects completed." },
    { title: "Affordable Pricing", desc: "ROI-optimized and transparent costs." },
    { title: "Client-Centric Approach", desc: "24/7 support and agile feedback." },
    { title: "End-to-End Solutions", desc: "Full-stack management from design to deployment." },
    { title: "Post-Delivery Support", desc: "Maintenance and SLA guarantees." },
    { title: "Scalable Options", desc: "Modular code ready for enterprise growth." },
    { title: "Creative Excellence", desc: "Award-winning brand identity and modern UI/UX." }
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <ArrowLeft color="#111" size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Zippy Digital Solutions</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.heroSection}>
          <View style={styles.logoBadge}>
             <Text style={styles.logoBadgeText}>ZIPPY DIGITAL</Text>
          </View>
          <Text style={styles.heroHeadline}>Transforming Ideas into Experiences.</Text>
          <Text style={styles.heroSub}>
            The architects behind Kwiq Bill. We are an elite digital agency blending Engineering, Creative Design, Marketing, Strategy, and Support into world-class digital realities.
          </Text>
        </View>

        <View style={styles.contactCard}>
          <Mail color="#000" size={24} />
          <View style={styles.contactText}>
             <Text style={styles.contactTitle}>Get In Touch</Text>
             <Text style={styles.contactEmail}>hello@zippydigital.com</Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Why Choose Zippy?</Text>
            <Text style={styles.sectionSub}>10 Key Advantages</Text>
        </View>

        <View style={styles.listContainer}>
          {advantages.map((item, index) => (
            <View key={index} style={styles.listItem}>
               <View style={styles.listNumberBox}>
                  <Text style={styles.listNumberText}>{(index + 1).toString().padStart(2, '0')}</Text>
               </View>
               <View style={styles.listContent}>
                  <Text style={styles.listTitle}>{item.title}</Text>
                  <Text style={styles.listDesc}>{item.desc}</Text>
               </View>
               <CheckCircle2 color="#111" size={20} />
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 20, 
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#ebebeb'
  },
  backButton: { width: 44, height: 44, justifyContent: 'center', alignItems: 'flex-start' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#111', letterSpacing: 0.5 },
  scrollContent: { padding: 24, paddingBottom: 60 },
  heroSection: { marginBottom: 30, alignItems: 'flex-start' },
  logoBadge: { 
    backgroundColor: '#000', 
    paddingHorizontal: 16, 
    paddingVertical: 8, 
    borderRadius: 8, 
    marginBottom: 20 
  },
  logoBadgeText: { color: '#fff', fontSize: 13, fontWeight: '900', letterSpacing: 2 },
  heroHeadline: { fontSize: 38, fontWeight: '900', color: '#000', lineHeight: 46, marginBottom: 16, letterSpacing: -1 },
  heroSub: { fontSize: 15, color: '#555', lineHeight: 24, fontWeight: '500' },
  
  contactCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#fff',
      padding: 24,
      borderRadius: 20,
      borderWidth: 2,
      borderColor: '#000',
      marginBottom: 40,
      gap: 16
  },
  contactText: { flex: 1 },
  contactTitle: { fontSize: 14, fontWeight: '800', color: '#666', marginBottom: 2 },
  contactEmail: { fontSize: 18, fontWeight: '900', color: '#000' },

  sectionHeader: { marginBottom: 20 },
  sectionTitle: { fontSize: 24, fontWeight: '900', color: '#000', letterSpacing: -0.5 },
  sectionSub: { fontSize: 14, fontWeight: '600', color: '#888', marginTop: 4 },
  
  listContainer: { backgroundColor: '#fff', borderRadius: 24, padding: 8, borderWidth: 1, borderColor: '#eee' },
  listItem: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  listNumberBox: { width: 40, height: 40, backgroundColor: '#f5f5f5', borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  listNumberText: { fontSize: 15, fontWeight: '900', color: '#aaa' },
  listContent: { flex: 1, paddingRight: 10 },
  listTitle: { fontSize: 16, fontWeight: '800', color: '#111', marginBottom: 4 },
  listDesc: { fontSize: 13, color: '#666', fontWeight: '500', lineHeight: 18 }
});

export default WhoWeAre;
