import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Code, PenTool, TrendingUp, Settings, LifeBuoy } from 'lucide-react-native';

const WhatWeDo = ({ navigation }) => {
  const coreServices = [
    {
      category: "Engineering",
      icon: <Code size={24} color="#000" />,
      services: "Web Development (12) • Mobile Apps (6)"
    },
    {
      category: "Creative & Design",
      icon: <PenTool size={24} color="#000" />,
      services: "Branding (8) • UI/UX Design (6)"
    },
    {
      category: "Marketing & Sales",
      icon: <TrendingUp size={24} color="#000" />,
      services: "Digital Marketing (6) • E-commerce (6)"
    },
    {
      category: "Strategy & Systems",
      icon: <Settings size={24} color="#000" />,
      services: "Analytics (6) • Hosting (5) • Innovation (6)"
    },
    {
      category: "Support",
      icon: <LifeBuoy size={24} color="#000" />,
      services: "Content & Video (6) • IT Staffing (6) • Consulting (5)"
    }
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <ArrowLeft color="#111" size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Core Services</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.heroHeadline}>End-to-End Enterprise Solutions.</Text>
        <Text style={styles.heroSub}>
          Delivering specialized capabilities across five core divisions to accelerate your digital growth.
        </Text>
        
        <View style={styles.servicesGrid}>
          {coreServices.map((section, idx) => (
             <View key={idx} style={styles.featureCard}>
               <View style={styles.featureHeader}>
                 <View style={styles.iconBox}>
                   {section.icon}
                 </View>
                 <Text style={styles.featureTitle}>{section.category}</Text>
               </View>
               <View style={styles.divider} />
               <Text style={styles.featureDesc}>{section.services}</Text>
             </View>
          ))}
        </View>
        
        <View style={styles.bottomLinkGroup}>
           <Text style={styles.closingNote}>Discover more on our official channels:</Text>
           <Text style={styles.socialText}>Instagram • Twitter • LinkedIn</Text>
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
  heroHeadline: { fontSize: 36, fontWeight: '900', color: '#000', lineHeight: 44, marginBottom: 12, letterSpacing: -1 },
  heroSub: { fontSize: 16, color: '#666', lineHeight: 26, fontWeight: '500', marginBottom: 35 },
  servicesGrid: { gap: 16 },
  featureCard: {
      backgroundColor: '#fff',
      padding: 24,
      borderRadius: 20,
      borderWidth: 1.5,
      borderColor: '#eaeaea',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.04,
      shadowRadius: 12,
      elevation: 3
  },
  featureHeader: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 16 },
  iconBox: { width: 50, height: 50, backgroundColor: '#f5f5f5', borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  featureTitle: { fontSize: 20, fontWeight: '900', color: '#111', letterSpacing: -0.5 },
  divider: { height: 1, backgroundColor: '#f0f0f0', marginBottom: 16 },
  featureDesc: { fontSize: 14, color: '#555', lineHeight: 24, fontWeight: '600' },
  bottomLinkGroup: { marginTop: 40, alignItems: 'center', padding: 20, backgroundColor: '#f8f8f8', borderRadius: 16 },
  closingNote: { fontSize: 13, fontWeight: '700', color: '#666', marginBottom: 6 },
  socialText: { fontSize: 15, fontWeight: '900', color: '#000', letterSpacing: 0.5 }
});

export default WhatWeDo;
