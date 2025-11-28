// app/(member)/soa.tsx
import 'react-native-reanimated';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import BackButton from '../../../components/BackButton';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

type AnyNum = number | string | null | undefined;
type AnyStr = string | null | undefined;

type SoaSummary = {
  member_id: number;
  maf_no: AnyStr;
  first_name: AnyStr;
  last_name: AnyStr;
  plan_type: AnyStr;
  contracted_price: AnyNum;
  total_paid: AnyNum;
  balance: AnyNum;
  monthly_due?: AnyNum;
  status?: AnyStr;
  agent_id?: number | null;
  installment?: string;
};

type SoaTxn = {
  member_id: number;
  date: string;
  amount: AnyNum;
  plan_type: AnyStr;
  or_no?: AnyStr;
};

const peso = (v: AnyNum) => {
  const n = Number(v ?? 0);
  if (Number.isNaN(n)) return String(v ?? '');
  return n.toLocaleString('en-PH', { style: 'currency', currency: 'PHP' });
};
const datePH = (d?: string | null) => {
  if (!d) return '';
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? '' : dt.toLocaleDateString('en-PH');
};
const esc = (s: AnyStr) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

export default function SOAScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const memberId = Number(id);
  const { width } = useWindowDimensions();

  const [summary, setSummary] = useState<SoaSummary | null>(null);
  const [agentName, setAgentName] = useState<string>('');
  const [txns, setTxns] = useState<SoaTxn[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setErrorMsg(null);

      const { data: s } = await supabase
        .from('soa_summary')
        .select('*')
        .eq('member_id', memberId)
        .maybeSingle();

      if (s) {
        const plan = String(s.plan_type ?? '').toUpperCase();
        const monthlyDue =
          Number(s.monthly_due) > 0
            ? Number(s.monthly_due)
            : plan.includes('A1')
            ? 498
            : plan.includes('B1')
            ? 348
            : plan.includes('A2')
            ? 500
            : 350;
        const months = monthlyDue > 0 ? Number(s.total_paid || 0) / monthlyDue : 0;
        (s as any).installment = months.toFixed(1);
      }
      if (alive) setSummary((s as SoaSummary) ?? null);

      const { data: m } = await supabase
        .from('members')
        .select('agent_id')
        .eq('id', memberId)
        .maybeSingle();

      const agentId = m?.agent_id ?? (s as any)?.agent_id ?? null;
      if (agentId) {
        const { data: a } = await supabase
          .from('agents')
          .select('firstname, lastname, middlename')
          .eq('id', agentId)
          .maybeSingle();

        const full = [
          (a?.lastname ?? '').toUpperCase(),
          a?.firstname ?? '',
          a?.middlename ?? '',
        ]
          .filter(Boolean)
          .join(', ')
          .replace(/\s+,/g, ',');
        if (alive) setAgentName(full || '');
      }

      let rows: SoaTxn[] = [];
      const { data: t1 } = await supabase
        .from('soa_transactions')
        .select('member_id, date, amount, plan_type, or_no')
        .eq('member_id', memberId)
        .order('date', { ascending: true });

      rows = (t1 ?? []).length ? (t1 as SoaTxn[]) : [];

      if (!rows.length) {
        const { data: t2 } = await supabase
          .from('collections')
          .select('member_id, created_at, amount, or_no')
          .eq('member_id', memberId)
          .order('created_at', { ascending: true });
        rows = (t2 ?? []).map((r: any) => ({
          member_id: r.member_id,
          date: r.created_at,
          amount: r.amount,
          plan_type: s?.plan_type ?? null,
          or_no: r.or_no || null,
        }));
      }

      if (alive) setTxns(rows);
      if (alive) setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [memberId]);

  const buildPdfHtml = useCallback(() => {
    const s = summary;
    const txnRows = txns
      .map(
        (r) => `
      <tr>
        <td>${datePH(r.date)}</td>
        <td class="num">${peso(r.amount)}</td>
        <td>${esc(r.plan_type)}</td>
        <td>${esc(r.or_no)}</td>
      </tr>`
      )
      .join('');

    return `
<!doctype html>
<html>
<head><meta charset="utf-8"/>
<title>Statement of Account</title></head>
<body>
<h2>Maharlikan AssuredLife</h2>
<p><b>AF No:</b> ${esc(s?.maf_no)}<br><b>Name:</b> ${esc(
      [s?.last_name, s?.first_name].filter(Boolean).join(', ')
    )}<br><b>Agent:</b> ${esc(agentName)}</p>
<table border="1" cellspacing="0" cellpadding="6" width="100%">
<thead><tr><th>Plan</th><th>Contract</th><th>Paid</th><th>Inst.</th><th>Bal.</th></tr></thead>
<tbody><tr>
<td>${esc(s?.plan_type)}</td>
<td>${peso(s?.contracted_price)}</td>
<td>${peso(s?.total_paid)}</td>
<td>${s?.installment}</td>
<td>${peso(s?.balance)}</td>
</tr></tbody></table>
<h3>Transactions</h3>
<table border="1" cellspacing="0" cellpadding="6" width="100%">
<thead><tr><th>Date</th><th>Payment</th><th>Plan</th><th>OR No</th></tr></thead>
<tbody>${txnRows}</tbody>
</table></body></html>`;
  }, [summary, txns, agentName]);

  const onExportPdf = useCallback(async () => {
    try {
      const html = buildPdfHtml();
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          UTI: 'com.adobe.pdf',
          mimeType: 'application/pdf',
        });
      } else Alert.alert('PDF saved', uri);
    } catch (e: any) {
      Alert.alert('Export failed', e?.message ?? 'Unable to export PDF');
    }
  }, [buildPdfHtml]);

  const ListHeader = useMemo(
    () => (
      <View style={styles.thRow}>
        <Text style={[styles.th, { flex: 0.9 }]}>Date</Text>
        <Text style={[styles.th, { flex: 1.1 }]}>Payment</Text>
        <Text style={[styles.th, { flex: 0.9 }]}>Plan Type</Text>
        <Text style={[styles.th, { flex: 0.6 }]}>OR No</Text>
      </View>
    ),
    []
  );

  return (
    <ScrollView style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Statement of Account',
          headerLeft: () => <BackButton />,
          headerRight: () => (
            <TouchableOpacity onPress={onExportPdf} style={styles.exportBtn}>
              <Text style={styles.exportText}>Export PDF</Text>
            </TouchableOpacity>
          ),
        }}
      />

<View style={styles.card}>
  <Text style={styles.h1}>Maharlikan AssuredLife</Text>
  <Text style={styles.meta}>Statement of Account</Text>

  <View style={{ height: 12 }} />

  <Text><Text style={styles.label}>AF No:</Text> {summary?.maf_no ?? ''}</Text>
  <Text><Text style={styles.label}>Name:</Text> {[summary?.last_name, summary?.first_name].filter(Boolean).join(', ')}</Text>
  <Text><Text style={styles.label}>Agent:</Text> {agentName || '—'}</Text>

  <View style={{ height: 16 }} />

  {/* --- Two-Row Summary Layout --- */}
  <View style={styles.table}>
    {/* Row 1 header */}
    <View style={[styles.thRow, { borderBottomWidth: 1, borderColor: '#d1d5db' }]}>
      <Text style={[styles.th, { flex: 1.3 }]}>Plan Type</Text>
      <Text style={[styles.th, { flex: 1 }]}>Contracted Price</Text>
      <Text style={[styles.th, { flex: 0.9 }]}>Total Paid</Text>
    </View>
    {/* Row 1 content */}
    <View style={[styles.trRow, { paddingVertical: 10 }]}>
      <Text style={[styles.td, { flex: 1.4 }]}>{summary?.plan_type ?? ''}</Text>
      <Text style={[styles.tdPrice, { flex: 1 }]}>{peso(summary?.contracted_price)}</Text>
      <Text style={[styles.tdPrice, { flex: 1 }]}>{peso(summary?.total_paid)}</Text>
    </View>

    {/* nice spacing divider */}
    <View style={{ borderBottomWidth: 1, borderColor: '#e5e7eb', marginVertical: 10 }} />

    {/* Row 2 header */}
    <View style={[styles.thRow, { borderBottomWidth: 1, borderColor: '#d1d5db' }]}>
      <Text style={[styles.th, { flex: 0.4 }]}>Installment (mo.)</Text>
      <Text style={[styles.th, { flex: 0.3 }]}>Balance</Text>
    </View>
    {/* Row 2 content */}
    <View style={[styles.trRow, { paddingVertical: 10 }]}>
      <Text style={[styles.tdCenter, { flex: 1.1 }]}>
        {summary?.installment ? `${summary.installment} mo.` : '—'}
      </Text>
      <Text style={[styles.tdPrice, { flex: 1.5 }]}>{peso(summary?.balance)}</Text>
    </View>
  </View>
</View>


      <View style={styles.card}>
        <Text style={styles.h2}>Transaction Details</Text>
        {loading ? (
          <Text>Loading…</Text>
        ) : txns.length === 0 ? (
          <Text>No transactions found</Text>
        ) : (
          <FlatList
            scrollEnabled={false}
            data={txns}
            keyExtractor={(_, i) => String(i)}
            renderItem={({ item }) => (
              <View style={styles.trRow}>
                <Text style={[styles.td, { flex: 0.9 }]}>{datePH(item.date)}</Text>
                <Text style={[styles.tdPrice, { flex: 1.1 }]}>{peso(item.amount)}</Text>
                <Text style={[styles.td, { flex: 0.9 }]}>{item.plan_type ?? ''}</Text>
                <Text style={[styles.tdCenter, { flex: 0.6   }]}>{item.or_no ?? '—'}</Text>
              </View>
            )}
            ListHeaderComponent={ListHeader}
          />
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#eef3fb', padding: 16 },

  exportBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  exportText: { color: '#0d3b7a', fontWeight: '800' },

  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#d7dee9',
  },

  h1: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0b4aa2',
    marginBottom: 2,
  },
  meta: {
    color: '#6b7280',
    fontSize: 13,
    marginBottom: 8,
  },
  label: {
    fontWeight: '700',
    color: '#111827',
  },

  table: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },

  thRow: {
    flexDirection: 'row',
    backgroundColor: '#e8edf8',
    borderBottomWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingHorizontal: 10,
  },

  th: {
    fontWeight: '700',
    color: '#0b4aa2',
    fontSize: 12.5,
    textAlign: 'center',
  },

  trRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderColor: '#f1f3f9',
    paddingVertical: 7,
    paddingHorizontal: 10,
  },

  // --- Data cells ---
  td: {
    flex: 1,
    color: '#111827',
    fontSize: 13,
    textAlign: 'center',
  },
  tdPrice: {
    color: '#0d3b7a',
    fontWeight: '700',
    fontSize: 13,
    textAlign: 'right',
    letterSpacing: 0.3,
    paddingRight: 6, // ensures spacing before next column
  },
  tdCenter: {
    flex: 1,
    textAlign: 'center',
    color: '#111827',
    fontSize: 13,
  },

  h2: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0b4aa2',
    marginBottom: 8,
  },

  divider: {
    borderBottomWidth: 1,
    borderColor: '#e5e7eb',
    marginVertical: 8,
  },
});
