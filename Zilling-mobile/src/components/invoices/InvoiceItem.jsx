import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { FileText, Clock, Printer, Download, Trash2, ChevronRight, CheckCircle2, AlertCircle, PieChart } from 'lucide-react-native';

const getStatusStyle = (status) => {
  switch (status?.toUpperCase()) {
    case 'PAID': return { solidBg: '#0f172a', border: '#1e293b', text: '#fff', icon: CheckCircle2, label: 'PAID' };
    case 'PARTIAL':
    case 'PARTIALLY PAID': return { solidBg: '#fff7ed', border: '#ffedd5', text: '#ea580c', icon: PieChart, label: 'P.PAID' };
    case 'UNPAID': return { solidBg: '#fef2f2', border: '#fee2e2', text: '#ef4444', icon: AlertCircle, label: 'UNPAID' };
    default: return { solidBg: '#f8fafc', border: '#f1f5f9', text: '#64748b', icon: FileText, label: (status || 'Unknown').toUpperCase() };
  }
};

const InvoiceItem = ({ item, settings, onPress, onPrint, onDownload, onDelete, onPreview }) => {
  const status = getStatusStyle(item.status);
  const initial = (item.customerName || 'G').charAt(0).toUpperCase();

  return (
    <TouchableOpacity
      style={styles.invoiceModernCard}
      onPress={() => onPress(item)}
      activeOpacity={0.8}
    >
      <View style={styles.cardMainRow}>
        <View style={styles.avatarContainer}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>

        <View style={styles.infoContainer}>
          <View style={styles.nameHeader}>
            <Text style={styles.modernCustomerName} numberOfLines={1}>{item.customerName || 'Guest Customer'}</Text>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.modernAmount}>₹{(item.total || 0).toLocaleString()}</Text>
              <Text style={styles.timeText}>
                {new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
          </View>

          <View style={styles.metaRow}>
            <View style={styles.idTag}>
              <Text style={styles.idTagText}>#{item.invoiceNumber || item.id?.toString().slice(-6).toUpperCase()}</Text>
            </View>
            <View style={styles.templateTag}>
              <FileText size={10} color="#64748b" />
              <Text style={styles.templateTagText}>{settings?.invoice?.billTemplate || 'Professional'}</Text>

            </View>
            <View style={styles.dateMeta}>
              <Clock size={10} color="#94a3b8" />
              <Text style={styles.dateMetaText}>
                {new Date(item.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
              </Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.cardSeparator} />

      <View style={styles.cardActionFooter}>
        <View style={[styles.statusModernPill, { backgroundColor: status.solidBg, borderColor: status.border }]}>
          <status.icon size={12} color={status.text} strokeWidth={3} />
          <Text style={[styles.statusModernText, { color: status.text }]}>{status.label}</Text>
        </View>

        <View style={styles.actionGroup}>
          <TouchableOpacity onPress={() => onPrint(item)} style={styles.modernIconAction}>
            <Printer size={16} color="#475569" strokeWidth={2.5} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onDownload(item)} style={styles.modernIconAction}>
            <Download size={16} color="#475569" strokeWidth={2.5} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onDelete(item)} style={styles.modernIconActionDanger}>
            <Trash2 size={16} color="#ef4444" strokeWidth={2.5} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onPreview(item)} style={styles.modernOpenBtn}>
            <Text style={styles.modernOpenText}>View Bill</Text>
            <ChevronRight size={12} color="#fff" strokeWidth={4} />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  invoiceModernCard: { backgroundColor: '#fff', marginHorizontal: 20, marginBottom: 15, borderRadius: 24, padding: 16, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10 },
  cardMainRow: { flexDirection: 'row', gap: 15 },
  avatarContainer: { width: 50, height: 50, borderRadius: 16, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  avatarText: { fontSize: 20, fontWeight: '900', color: '#0f172a' },
  infoContainer: { flex: 1 },
  nameHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  modernCustomerName: { fontSize: 15, fontWeight: '800', color: '#0f172a', flex: 1, marginRight: 10 },
  modernAmount: { fontSize: 16, fontWeight: '900', color: '#000' },
  timeText: { fontSize: 10, color: '#94a3b8', fontWeight: '700', marginTop: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  idTag: { backgroundColor: '#0f172a', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  idTagText: { fontSize: 10, fontWeight: '800', color: '#fff' },
  templateTag: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  templateTagText: { fontSize: 10, fontWeight: '800', color: '#000' },

  dateMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 'auto' },
  dateMetaText: { fontSize: 11, fontWeight: '700', color: '#64748b' },
  cardSeparator: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 14 },
  cardActionFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusModernPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 50, borderWidth: 1, gap: 6 },
  statusModernText: { fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
  actionGroup: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  modernIconAction: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#f8fafc', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  modernIconActionDanger: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#fef2f2', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#fee2e2' },
  modernOpenBtn: { backgroundColor: '#000', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 6 },
  modernOpenText: { fontSize: 11, fontWeight: '800', color: '#fff' },
});

export default React.memo(InvoiceItem);
