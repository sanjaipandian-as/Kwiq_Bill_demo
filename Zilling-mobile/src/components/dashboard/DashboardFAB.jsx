import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FileText } from 'lucide-react-native';

const DashboardFAB = ({ onPress }) => {
  return (
    <View style={styles.fabContainer}>
      <TouchableOpacity 
        style={styles.fab} 
        onPress={onPress}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={['#000', '#1a1a1a']}
          style={styles.fabGradient}
        >
          <View style={styles.fabContent}>
            <FileText size={22} color="#fff" strokeWidth={2.5} />
            <Text style={styles.fabText}>NEW BILL</Text>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  fabContainer: {
    position: 'absolute',
    bottom: 100,
    right: 25,
    zIndex: 999,
  },
  fab: {
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 15,
  },
  fabGradient: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  fabContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  fabText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
});

export default React.memo(DashboardFAB);
