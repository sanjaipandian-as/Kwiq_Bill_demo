import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FileText, BarChart3, Percent, Package, IndianRupee, Settings } from 'lucide-react-native';

const IconButton = React.memo(({ icon: Icon, label, color, onPress }) => (
  <Pressable style={styles.iconBtnWrapper} onPress={onPress}>
    <LinearGradient
      colors={color === '#22c55e' ? ['#22c55e', '#16a34a'] : ['#ef4444', '#dc2626']}
      style={styles.iconSquare}
    >
      <Icon size={24} color="#fff" />
    </LinearGradient>
    <Text style={styles.iconLabel}>{label}</Text>
  </Pressable>
));

const ActionGrid = ({ onAction }) => {
  return (
    <View style={styles.actionGrid}>
      <IconButton icon={FileText} label="Create Invoice" color="#22c55e" onPress={() => onAction('Billing')} />
      <IconButton icon={BarChart3} label="Reports" color="#22c55e" onPress={() => onAction('Reports')} />
      <IconButton icon={Percent} label="GST" color="#22c55e" onPress={() => onAction('GST')} />
      <IconButton icon={Package} label="Products" color="#22c55e" onPress={() => onAction('Products')} />
      <IconButton icon={IndianRupee} label="Expenses" color="#ef4444" onPress={() => onAction('Expenses')} />
      <IconButton icon={Settings} label="Settings" color="#ef4444" onPress={() => onAction('Settings')} />
    </View>
  );
};

const styles = StyleSheet.create({
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 10, paddingTop: 15 },
  iconBtnWrapper: { width: '33.3%', alignItems: 'center', marginBottom: 25 },
  iconSquare: { width: 66, height: 66, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 10, elevation: 2 },
  iconLabel: { fontSize: 12, fontWeight: '700', color: '#475569', textAlign: 'center', marginTop: 4 },
});

export default React.memo(ActionGrid);
