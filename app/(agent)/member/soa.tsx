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
import { useLocalSearchParams, Stack, useFocusEffect } from 'expo-router';
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

type MemberStatus = 'Active' | 'Warning' | 'Lapsable' | 'Lapsed' | 'Completed';

type SoaData = {
  member_id: number;
  maf_no: AnyStr;
  first_name: AnyStr;
  last_name: AnyStr;
  plan_type: AnyStr;
  contracted_price: number;
  monthly_due: number;
  address?: AnyStr;
  birth_date?: AnyStr;
  total_paid: number;
  balance: number;
  installment: string; // Formatted string
  agent_name?: string;
  payments: SoaTxn[];
  status: MemberStatus;
  statusColor: string;
  amount_due_calculated?: number;
};


type SoaTxn = {
  date: string; // formatted or raw
  amount: number;
  plan_type: AnyStr;
  or_no?: AnyStr;
  payment_for?: AnyStr;
  // Calculated / Joined fields
  running_balance: number;
  installment_no: number;
  collector_name: string;
  is_reinstatement?: boolean; // New Field
};



// ... inside FlatList renderItem ...




const peso = (v: AnyNum) => {
  const n = Number(v ?? 0);
  if (Number.isNaN(n)) return '₱0.00';
  return n.toLocaleString('en-PH', { style: 'currency', currency: 'PHP' });
};

const datePH = (d?: string | null) => {
  if (!d) return '';
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? '' : dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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

  const [data, setData] = useState<SoaData | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        setLoading(true);
        try {
          // 1. Fetch Member
          const { data: member, error: mErr } = await supabase
            .from('members')
            .select('id, maf_no, first_name, last_name, plan_type, contracted_price, monthly_due, address, birth_date, agent_id, created_at, plan_start_date')
            .eq('id', memberId)
            .maybeSingle();

          if (mErr) throw mErr;
          if (!member) throw new Error("Member not found");

          // 2. Fetch Agent (Main Agent)
          let agentName = "";
          let agentsMap = new Map<number, string>();

          // Helper to fetch agent name
          const fetchAgentName = async (aid: number) => {
            if (agentsMap.has(aid)) return agentsMap.get(aid)!;
            const { data: ag } = await supabase.from('agents').select('firstname, lastname').eq('id', aid).maybeSingle();
            const finalName = ag ? `${ag.firstname} ${ag.lastname}` : 'Unknown';
            agentsMap.set(aid, finalName);
            return finalName;
          };

          if (member.agent_id) {
            const { data: ag } = await supabase.from('agents').select('firstname, lastname').eq('id', member.agent_id).maybeSingle();
            if (ag) agentName = [ag.lastname, ag.firstname].filter(Boolean).join(', ').toUpperCase();
          }

          // 3. Fetch Collections (Source of Truth)
          const { data: collections, error: cErr } = await supabase
            .from('collections')
            .select('date_paid, payment, plan_type, or_no, payment_for, created_at, collector_id, agent_id, is_reinstatement')
            .eq('member_id', memberId)
            .order('date_paid', { ascending: true });

          if (cErr) throw cErr;

          const rawPayments = collections || [];
          const payments: SoaTxn[] = [];

          const contracted = Number(member.contracted_price) || 0;
          const monthlyDue = Number(member.monthly_due) || 0;

          let cumulativePaid = 0;

          for (const c of rawPayments) {
            const amt = Number(c.payment) || 0;
            cumulativePaid += amt;

            // Calculate Running Balance
            const runningBal = Math.max(0, contracted - cumulativePaid);

            // Calculate Installment Count
            let inst = 0;
            if (monthlyDue > 0) {
              inst = Math.floor(cumulativePaid / monthlyDue);
            }

            // Determine Collector Name
            const cid = c.collector_id || c.agent_id;
            const cName = cid ? await fetchAgentName(cid) : '—';

            payments.push({
              date: c.date_paid || c.created_at,
              amount: amt,
              plan_type: c.plan_type,
              or_no: c.or_no,
              payment_for: c.payment_for,
              running_balance: runningBal,
              installment_no: inst,
              collector_name: cName,
              is_reinstatement: c.is_reinstatement
            });
          }

          // 4. Calculations (Totals)
          const totalPaid = cumulativePaid;
          const balance = Math.max(0, contracted - totalPaid);
          const installmentVal = monthlyDue > 0 ? totalPaid / monthlyDue : 0;
          const installment = installmentVal.toFixed(0);

          // 5. Determine Status (Based on SQL Logic: Months Behind)
          let status: MemberStatus = 'Active';
          let statusColor = '#22c55e'; // Green

          // Logic Replicated from SQL:
          // months_since_start = (YearDiff * 12) + MonthDiff (Using AGE equivalent)
          // months_behind = months_since_start - count(payments)

          // Start Date Priority: plan_start_date -> first payment date -> created_at
          let startDateVal = member.plan_start_date ? new Date(member.plan_start_date).getTime() : null;
          if (!startDateVal) {
            startDateVal = new Date(member.created_at || Date.now()).getTime();
          }
          const startDate = new Date(startDateVal);

          const currentDate = new Date();

          // Calculate Months Passed (Emulating Postgres AGE month part)
          // (YearDiff * 12) + MonthDiff
          let monthsSinceStart = (currentDate.getFullYear() - startDate.getFullYear()) * 12 + (currentDate.getMonth() - startDate.getMonth());

          // Adjustment: If current day is before the start day of the month, subtract 1 month
          // This makes it act like a full month interval (AGE styleish)
          const dayOfCurrent = currentDate.getDate();
          const dayOfStart = startDate.getDate();
          if (dayOfCurrent < dayOfStart) {
            monthsSinceStart -= 1;
          }

          // Ensure non-negative
          monthsSinceStart = Math.max(0, monthsSinceStart);

          // Count valid payments
          const monthsPaid = rawPayments.length;
          const monthsBehind = Math.max(0, monthsSinceStart - monthsPaid);

          if (balance <= 0) {
            status = 'Completed';
            statusColor = '#22c55e';
          } else {
            // Warning: >= 1 AND < 2
            if (monthsBehind >= 1 && monthsBehind < 2) {
              status = 'Warning';
              statusColor = '#eab308'; // Yellow
            }
            // Lapsable (At Risk): >= 2 AND < 3
            else if (monthsBehind >= 2 && monthsBehind < 3) {
              status = 'Lapsable';
              statusColor = '#f97316'; // Orange
            }
            // Lapsed: >= 3
            else if (monthsBehind >= 3) {
              status = 'Lapsed';
              statusColor = '#ef4444'; // Red
            }
            // Otherwise Active (< 1)
            else {
              status = 'Active';
              statusColor = '#22c55e'; // Green
            }
          }

          // 6. Amount Due Calculation
          // Active: 0
          // Warning: monthly_due
          // Lapsable: monthly_due * 2
          // Lapsed: monthly_due + 100
          let amountDueVal = 0;
          if (status === 'Active' || status === 'Completed') {
            amountDueVal = 0;
          } else if (status === 'Warning') {
            amountDueVal = monthlyDue;
          } else if (status === 'Lapsable') {
            amountDueVal = monthlyDue * 2;
          } else if (status === 'Lapsed') {
            amountDueVal = monthlyDue + 100;
          }

          if (alive) {
            setData({
              member_id: member.id,
              maf_no: member.maf_no,
              first_name: member.first_name,
              last_name: member.last_name,
              plan_type: member.plan_type,
              contracted_price: contracted,
              monthly_due: monthlyDue,
              address: member.address,
              birth_date: member.birth_date,
              total_paid: totalPaid,
              balance,
              installment,
              agent_name: agentName,
              payments, // ASC order
              status,
              statusColor,
              amount_due_calculated: amountDueVal
            });
          }

        } catch (err) {
          console.error(err);
        } finally {
          if (alive) setLoading(false);
        }
      })();

      return () => { alive = false; };
    }, [memberId])
  );

  const buildPdfHtml = useCallback(() => {
    if (!data) return '';

    // PDF Table Rows
    const txnRows = data.payments
      .map(
        (r) => `
      <tr>
        <td style="padding: 6px;">${datePH(r.date)}</td>
        <td style="padding: 6px; text-align: right;">${peso(r.amount)}</td>
        <td style="padding: 6px; text-align: center;">${esc(r.or_no || '-')}</td>
        <td style="padding: 6px; text-align: center;">${r.installment_no}</td>
        <td style="padding: 6px; text-align: right;">${peso(r.running_balance)}</td>
        <td style="padding: 6px;">${esc(r.collector_name)}</td>
      </tr>`
      )
      .join('');

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Statement of Account</title>
    <style>
        body { font-family: Helvetica, sans-serif; padding: 40px; color: #333; }
        h1 { color: #000; text-align: left; font-size: 24px; font-weight: bold; margin-bottom: 0; }
        h2 { text-align: left; font-size: 14px; color: #666; font-weight: normal; margin-top: 5px; margin-bottom: 30px; }
        
        .header-section { margin-bottom: 30px; }
        .meta-table { width: 100%; margin-bottom: 20px; font-size: 12px; border-collapse: collapse; }
        .meta-table th { text-align: left; background: #f5f5f5; padding: 8px; border: 1px solid #ddd; }
        .meta-table td { padding: 8px; border: 1px solid #ddd; }

        .summary-header { font-size: 14px; font-weight: bold; margin-bottom: 10px; margin-top: 20px; }
        .summary-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 12px; }
        .summary-table th { background: #263248; color: #fff; padding: 10px; text-align: center; border: 1px solid #263248; }
        .summary-table td { padding: 10px; border: 1px solid #ddd; text-align: center; font-weight: bold; }

        .tx-header { font-size: 14px; font-weight: bold; margin-bottom: 10px; text-align: center; text-decoration: underline; text-transform: uppercase; color: #0d3b7a; }
        .tx-table { width: 100%; border-collapse: collapse; font-size: 10px; }
        .tx-table th { background: #0d3b7a; color: #fff; padding: 8px; text-align: center; text-transform: uppercase; }
        .tx-table td { padding: 6px; border-bottom: 1px solid #eee; }
        .tx-table tr:nth-child(even) { background-color: #f9f9f9; }
        
        .footer { margin-top: 40px; font-size: 10px; color: #999; text-align: left; }
        
        .signatures { margin-top: 60px; display: flex; justify-content: space-between; page-break-inside: avoid; }
        .sig-block { width: 40%; text-align: center; }
        .sig-line { border-top: 1px solid #000; margin-bottom: 8px; }
        .sig-label { font-size: 12px; font-weight: bold; color: #333; }
        .sig-name { font-size: 11px; color: #555; margin-top: 10px; }

    </style>
</head>
<body>
    <div class="header-section">
        <h1>Statement of Account</h1>
        <h2>Maharlikan Mortuary Care Services</h2>
        <div>AF No: <strong>${esc(data.maf_no)}</strong></div>
        <div style="font-size: 10px; color: #888; margin-top: 4px;">Generated: ${new Date().toLocaleDateString('en-PH')}</div>
    </div>

    <table class="meta-table">
        <thead>
            <tr><th>Name</th><th>Address</th><th>Plan</th><th>Birth Date</th><th>Agent</th><th>Status</th></tr>
        </thead>
        <tbody>
            <tr>
                <td>${esc(data.last_name)}, ${esc(data.first_name)}</td>
                <td>${esc(data.address)}</td>
                <td>${esc(data.plan_type)}</td>
                <td>${esc(data.birth_date)}</td>
                <td>${esc(data.agent_name)}</td>
                <td style="color: ${data.statusColor}; font-weight: bold;">${data.status}</td>
            </tr>
        </tbody>
    </table>

    <div class="summary-header">Summary</div>
    <table class="summary-table">
        <thead>
            <tr><th>Contracted Price</th><th>Total Paid</th><th>Installment Paid</th><th>Balance</th></tr>
        </thead>
        <tbody>
            <tr>
                <td>${peso(data.contracted_price)}</td>
                <td>${peso(data.total_paid)}</td>
                <td>${data.installment} mo.</td>
                <td>${peso(data.balance)}</td>
            </tr>
        </tbody>
    </table>

    <div class="tx-header">COLLECTION HISTORY</div>
    <table class="tx-table">
        <thead>
            <tr>
                <th style="text-align: left">DATE</th>
                <th style="text-align: right">AMOUNT</th>
                <th>OR #</th>
                <th>INSTALLMENT</th>
                <th style="text-align: right">BALANCE</th>
                <th style="text-align: left">COLLECTOR</th>
            </tr>
        </thead>
        <tbody>
            ${txnRows}
        </tbody>
    </table>

    <div class="footer">
        Maharlikan Mortuary Care Services • Generated automatically by the system
    </div>

    <div class="signatures">
        <div class="sig-block">
            <div class="sig-line"></div>
            <div class="sig-label">Manager Signature</div>
        </div>
        <div class="sig-block">
            <div class="sig-line"></div>
            <div class="sig-label">Member Signature</div>
            <div class="sig-name">${esc(data.first_name)} ${esc(data.last_name)}</div>
        </div>
    </div>

</body>
</html>`;
  }, [data]);

  const onExportPdf = useCallback(async () => {
    try {
      const html = buildPdfHtml();
      if (!html) return;
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

  // ListHeader removed as it is now inlined in the ScrollView for strict width control

  return (
    <BackgroundLogo>
      <View style={styles.container}>
        <Stack.Screen
          options={{
            headerTitle: 'SOA',
            headerTitleStyle: { fontFamily: 'serif', color: memorialColors.primary },
            headerLeft: () => <BackButton />,
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
                <Text style={styles.metaLabel}>AF Number:</Text>
                <Text style={styles.metaValue}>{data?.maf_no || '—'}</Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Member:</Text>
                <Text style={styles.metaValue}>{[data?.last_name, data?.first_name].filter(Boolean).join(', ')}</Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Sales Executive:</Text>
                <Text style={styles.metaValue}>{data?.agent_name || '—'}</Text>
              </View>
              {/* Member Status */}
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Status:</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: data?.statusColor || '#ccc' }} />
                  <Text style={[styles.metaValue, { color: data?.statusColor }]}>
                    {data?.status || '—'}
                  </Text>
                </View>
              </View>
              {data?.status === 'Lapsed' && (
                <View style={styles.warningBox}>
                  <Text style={styles.warningText}>⚠ Reinstate this member to be active.</Text>
                </View>
              )}
            </View>
          </View>

          {/* Account Summary Table */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Account Summary</Text>
          </View>

          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Package Type</Text>
                <Text style={styles.summaryValue}>{data?.plan_type ?? '—'}</Text>
              </View>
              <View style={[styles.summaryItem, { alignItems: 'flex-end' }]}>
                <Text style={styles.summaryLabel}>Contract Price</Text>
                <Text style={styles.summaryValue}>{peso(data?.contracted_price)}</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Total Paid</Text>
                <Text style={[styles.summaryValue, { color: memorialColors.primary }]}>{peso(data?.total_paid)}</Text>
              </View>
              <View style={[styles.summaryItem, { alignItems: 'flex-end' }]}>
                <Text style={styles.summaryLabel}>Balance</Text>
                <Text style={[styles.summaryValue, { color: memorialColors.error }]}>{peso(data?.balance)}</Text>
              </View>
            </View>

            <View style={styles.divider} />
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Total Installment</Text>
                <Text style={styles.summaryValue}>{data?.installment ? `${data.installment} months` : '—'}</Text>
              </View>
              <View style={[styles.summaryItem, { alignItems: 'flex-end' }]}>
                <Text style={styles.summaryLabel}>Amount Due</Text>
                <Text style={[styles.summaryValue, { color: memorialColors.error, fontWeight: 'bold' }]}>
                  {peso(data?.amount_due_calculated)}
                </Text>
              </View>
            </View>
          </View>


          {/* Transactions Table */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Collection History</Text>
          </View>

          <View style={styles.tableCard}>
            <ScrollView horizontal showsHorizontalScrollIndicator={true} contentContainerStyle={{ flexGrow: 1, flexDirection: 'column', minWidth: 760, paddingHorizontal: 4 }}>
              {/* Header Row */}
              <View style={[styles.thRow, { paddingHorizontal: 0, minWidth: 760, flex: 1 }]}>
                <Text style={[styles.th, { flex: 1.1, minWidth: 110, paddingLeft: 12 }]}>DATE</Text>
                <Text style={[styles.th, { flex: 1, minWidth: 100, textAlign: 'center' }]}>OR #</Text>
                <Text style={[styles.th, { flex: 1.2, minWidth: 120, textAlign: 'right' }]}>AMOUNT</Text>
                <Text style={[styles.th, { flex: 1, minWidth: 100, textAlign: 'center' }]}>INST. #</Text>
                <Text style={[styles.th, { flex: 1.3, minWidth: 130, textAlign: 'right' }]}>BALANCE</Text>
                <Text style={[styles.th, { flex: 2, minWidth: 200, paddingLeft: 16 }]}>COLLECTOR</Text>
              </View>

              {loading ? (
                <Text style={styles.loadingText}>Loading history...</Text>
              ) : !data?.payments?.length ? (
                <Text style={styles.emptyText}>No collections found</Text>
              ) : (
                <FlatList
                  scrollEnabled={false}
                  data={data.payments}
                  keyExtractor={(_, i) => String(i)}
                  renderItem={({ item }) => (
                    <View style={[styles.trRow, { paddingHorizontal: 0, minWidth: 760, flex: 1 }]}>
                      <Text style={[styles.td, { flex: 1.1, minWidth: 110, paddingLeft: 12 }]}>{datePH(item.date)}</Text>
                      <Text style={[styles.tdCenter, { flex: 1, minWidth: 100 }]}>{item.or_no || '—'}</Text>
                      <View style={{ flex: 1.2, minWidth: 120, alignItems: 'flex-end', paddingRight: 4 }}>
                        <Text style={[styles.tdPrice, { textAlign: 'right' }]}>{peso(item.amount)}</Text>
                        {item.is_reinstatement && (
                          <View style={{ backgroundColor: '#dcfce7', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 2, marginTop: 2 }}>
                            <Text style={{ fontSize: 9, color: '#16a34a', fontWeight: 'bold' }}>REINSTATED</Text>
                          </View>
                        )}
                      </View>
                      <Text style={[styles.tdCenter, { flex: 1, minWidth: 100 }]}>{item.installment_no}</Text>
                      <Text style={[styles.tdPrice, { flex: 1.3, minWidth: 130, color: memorialColors.textSecondary }]}>{peso(item.running_balance)}</Text>
                      <Text style={[styles.td, { flex: 2, minWidth: 200, paddingLeft: 16, fontSize: 11 }]} numberOfLines={1}>{item.collector_name}</Text>
                    </View>
                  )}
                />
              )}
            </ScrollView>
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
    alignItems: 'center',
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

  warningBox: {
    marginTop: 10,
    backgroundColor: '#fee2e2',
    padding: 8,
    borderRadius: 4,
    borderLeftWidth: 3,
    borderLeftColor: '#ef4444'
  },
  warningText: {
    color: '#b91c1c',
    fontSize: 12,
    fontWeight: 'bold'
  }
});
