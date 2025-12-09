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
  Platform,
  UIManager
} from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import BackButton from '../../../components/BackButton';
import BackgroundLogo from '../../../components/BackgroundLogo';
import { memorialColors, memorialSpacing, memorialBorderRadius, memorialFonts, memorialShadows } from '../../../constants/memorialTheme';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

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
      <tr style="border-bottom: 1px solid #eee;">
        <td style="padding: 8px;">${datePH(r.date)}</td>
        <td style="padding: 8px; text-align: right; color: #0d3b7a; font-weight: bold;">${peso(r.amount)}</td>
        <td style="padding: 8px;">${esc(r.plan_type)}</td>
        <td style="padding: 8px; text-align: center;">${esc(r.or_no)}</td>
      </tr>`
      )
      .join('');

    return `
<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<title>Statement of Account</title>
<style>
  body { font-family: 'Times New Roman', serif; padding: 40px; color: #333; }
  h1 { color: #0d3b7a; text-align: center; font-size: 24px; margin-bottom: 4px; }
  h2 { text-align: center; font-size: 16px; color: #666; font-weight: normal; margin-top: 0; margin-bottom: 30px; letter-spacing: 2px; text-transform: uppercase; }
  .info-box { margin-bottom: 30px; border: 1px solid #ccc; padding: 20px; }
  .info-row { margin-bottom: 8px; }
  .label { font-weight: bold; width: 80px; display: inline-block; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
  th { background: #f0f4fa; color: #0d3b7a; text-align: left; padding: 10px; border-bottom: 2px solid #0d3b7a; font-size: 12px; text-transform: uppercase; }
  td { padding: 10px; border-bottom: 1px solid #eee; font-size: 14px; }
  .num { text-align: right; font-weight: bold; }
  .center { text-align: center; }
  .footer { margin-top: 50px; text-align: center; font-size: 10px; color: #999; border-top: 1px solid #eee; padding-top: 10px; }
</style>
</head>
<body>
  <h1>Maharlikan AssuredLife</h1>
  <h2>Statement of Account</h2>
  
  <div class="info-box">
    <div class="info-row"><span class="label">Name:</span> ${esc([s?.last_name, s?.first_name].filter(Boolean).join(', '))}</div>
    <div class="info-row"><span class="label">AF No:</span> ${esc(s?.maf_no)}</div>
    <div class="info-row"><span class="label">Agent:</span> ${esc(agentName)}</div>
    <div class="info-row"><span class="label">Date:</span> ${new Date().toLocaleDateString()}</div>
  </div>

  <table border="0">
    <thead><tr><th>Plan</th><th class="num">Contract</th><th class="num">Total Paid</th><th class="center">Inst. (mo)</th><th class="num">Balance</th></tr></thead>
    <tbody><tr>
      <td>${esc(s?.plan_type)}</td>
      <td class="num">${peso(s?.contracted_price)}</td>
      <td class="num">${peso(s?.total_paid)}</td>
      <td class="center">${s?.installment}</td>
      <td class="num" style="color: #d97706;">${peso(s?.balance)}</td>
    </tr></tbody>
  </table>

  <h3>Transaction History</h3>
  <table border="0">
    <thead><tr><th>Date</th><th class="num">Payment</th><th>Details</th><th class="center">OR No</th></tr></thead>
    <tbody>${txnRows}</tbody>
  </table>
  
  <div class="footer">
    Generated via Maharlikan AssuredLife Mobile Agent App
  </div>
</body></html>`;
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
        <Text style={[styles.th, { flex: 1.1, textAlign: 'right' }]}>Amount</Text>
        <Text style={[styles.th, { flex: 0.9, textAlign: 'center' }]}>Plan</Text>
        <Text style={[styles.th, { flex: 0.8, textAlign: 'center' }]}>OR No</Text>
      </View>
    ),
    []
  );

  return (
    <BackgroundLogo>
      <View style={styles.container}>
        <Stack.Screen
          options={{
            headerTitle: 'SOA',
            headerTitleStyle: { fontFamily: 'serif', color: memorialColors.primary },
            headerLeft: () => <BackButton />,
            headerBackTitle: "Back",
            headerRight: () => (
              <TouchableOpacity onPress={onExportPdf} style={styles.exportBtn}>
                <Text style={styles.exportText}>Export PDF</Text>
              </TouchableOpacity>
            ),
            headerTransparent: true,
            headerBlurEffect: 'regular',
            headerBackground: () => <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.85)' }} />
          }}
        />

        <ScrollView contentContainerStyle={{ padding: memorialSpacing.lg, paddingTop: 100, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

          {/* Header Card */}
          <View style={styles.card}>
            <View style={styles.headerBlock}>
              <Text style={styles.brandTitle}>Maharlikan AssuredLife</Text>
              <Text style={styles.docTitle}>STATEMENT OF ACCOUNT</Text>
            </View>

            <View style={styles.metaGrid}>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Member:</Text>
                <Text style={styles.metaValue}>{[summary?.last_name, summary?.first_name].filter(Boolean).join(', ')}</Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>AF Number:</Text>
                <Text style={styles.metaValue}>{summary?.maf_no || '—'}</Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Agent:</Text>
                <Text style={styles.metaValue}>{agentName || '—'}</Text>
              </View>
            </View>
          </View>

          {/* Account Summary Table */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Account Summary</Text>
          </View>

          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Plan Type</Text>
                <Text style={styles.summaryValue}>{summary?.plan_type ?? '—'}</Text>
              </View>
              <View style={[styles.summaryItem, { alignItems: 'flex-end' }]}>
                <Text style={styles.summaryLabel}>Contract Price</Text>
                <Text style={styles.summaryValue}>{peso(summary?.contracted_price)}</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Total Paid</Text>
                <Text style={[styles.summaryValue, { color: memorialColors.primary }]}>{peso(summary?.total_paid)}</Text>
              </View>
              <View style={[styles.summaryItem, { alignItems: 'flex-end' }]}>
                <Text style={styles.summaryLabel}>Balance</Text>
                <Text style={[styles.summaryValue, { color: memorialColors.error }]}>{peso(summary?.balance)}</Text>
              </View>
            </View>

            <View style={styles.divider} />
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Installment Status</Text>
                <Text style={styles.summaryValue}>{summary?.installment ? `${summary.installment} months` : '—'}</Text>
              </View>
            </View>
          </View>


          {/* Transactions Table */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Transaction History</Text>
          </View>

          <View style={styles.tableCard}>
            {ListHeader}
            {loading ? (
              <Text style={styles.loadingText}>Loading history...</Text>
            ) : txns.length === 0 ? (
              <Text style={styles.emptyText}>No transactions found</Text>
            ) : (
              <FlatList
                scrollEnabled={false}
                data={txns}
                keyExtractor={(_, i) => String(i)}
                renderItem={({ item }) => (
                  <View style={styles.trRow}>
                    <Text style={[styles.td, { flex: 0.9 }]}>{datePH(item.date)}</Text>
                    <Text style={[styles.tdPrice, { flex: 1.1 }]}>{peso(item.amount)}</Text>
                    <Text style={[styles.tdCenter, { flex: 0.9 }]}>{item.plan_type ?? '-'}</Text>
                    <Text style={[styles.tdCenter, { flex: 0.8 }]}>{item.or_no ?? '—'}</Text>
                  </View>
                )}
              />
            )}
          </View>

        </ScrollView>
      </View>
    </BackgroundLogo>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  exportBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: memorialColors.gold,
    borderRadius: memorialBorderRadius.round
  },
  exportText: {
    color: memorialColors.primaryDark,
    fontWeight: 'bold',
    fontSize: memorialFonts.sm
  },

  headerBlock: {
    alignItems: 'center',
    marginBottom: memorialSpacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: memorialColors.paleGold,
    paddingBottom: memorialSpacing.md,
  },
  brandTitle: {
    fontSize: memorialFonts.lg,
    fontFamily: 'serif',
    color: memorialColors.primary,
    fontWeight: 'bold',
  },
  docTitle: {
    fontSize: memorialFonts.sm,
    color: memorialColors.textMuted,
    letterSpacing: 2,
    marginTop: 2,
  },

  card: {
    backgroundColor: '#fff',
    borderRadius: memorialBorderRadius.lg,
    padding: memorialSpacing.lg,
    marginBottom: memorialSpacing.lg,
    ...memorialShadows.md,
    borderTopWidth: 4,
    borderTopColor: memorialColors.primary,
  },

  metaGrid: {
    gap: 8,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metaLabel: {
    fontSize: memorialFonts.sm,
    color: memorialColors.textMuted,
    fontWeight: '600',
  },
  metaValue: {
    fontSize: memorialFonts.sm,
    color: memorialColors.textPrimary,
    fontWeight: 'bold',
  },

  sectionHeader: {
    marginBottom: memorialSpacing.sm,
    paddingLeft: memorialSpacing.xs,
  },
  sectionTitle: {
    fontSize: memorialFonts.md,
    fontFamily: 'serif',
    color: memorialColors.primary,
    fontWeight: 'bold',
  },

  summaryCard: {
    backgroundColor: memorialColors.white,
    padding: memorialSpacing.lg,
    borderRadius: memorialBorderRadius.lg,
    borderWidth: 1,
    borderColor: memorialColors.silver,
    marginBottom: memorialSpacing.lg,
    ...memorialShadows.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryItem: {
    flex: 1,
  },
  summaryLabel: {
    fontSize: memorialFonts.xs,
    color: memorialColors.textMuted,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  summaryValue: {
    fontSize: memorialFonts.md,
    color: memorialColors.textPrimary,
    fontWeight: 'bold',
  },
  divider: {
    height: 1,
    backgroundColor: memorialColors.border,
    marginVertical: memorialSpacing.md,
  },

  tableCard: {
    backgroundColor: memorialColors.white,
    borderRadius: memorialBorderRadius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: memorialColors.silver,
    ...memorialShadows.sm,
    marginBottom: memorialSpacing.xl,
  },
  thRow: {
    flexDirection: 'row',
    backgroundColor: memorialColors.bgSecondary,
    borderBottomWidth: 1,
    borderColor: memorialColors.border,
    paddingVertical: memorialSpacing.sm,
    paddingHorizontal: memorialSpacing.md,
  },
  th: {
    fontWeight: 'bold',
    color: memorialColors.primary,
    fontSize: memorialFonts.xs,
    textTransform: 'uppercase',
  },
  trRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderColor: memorialColors.bgSecondary,
    paddingVertical: memorialSpacing.sm, // reduced padding for density
    paddingHorizontal: memorialSpacing.md,
    backgroundColor: memorialColors.white,
  },
  td: {
    color: memorialColors.textPrimary,
    fontSize: memorialFonts.sm,
  },
  tdPrice: {
    color: memorialColors.primary,
    fontWeight: 'bold',
    fontSize: memorialFonts.sm,
    textAlign: 'right',
  },
  tdCenter: {
    textAlign: 'center',
    color: memorialColors.textSecondary,
    fontSize: memorialFonts.sm,
  },

  loadingText: {
    textAlign: 'center',
    padding: memorialSpacing.lg,
    color: memorialColors.textMuted,
    fontStyle: 'italic',
  },
  emptyText: {
    textAlign: 'center',
    padding: memorialSpacing.lg,
    color: memorialColors.textMuted,
  },
});
