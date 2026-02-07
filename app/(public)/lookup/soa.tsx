// app/(public)/lookup/soa.tsx
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
  UIManager,
  ActivityIndicator
} from 'react-native';
import { useLocalSearchParams, Stack, useFocusEffect, router } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import BackButton from '../../../components/BackButton';
import BackgroundLogo from '../../../components/BackgroundLogo';
import { memorialColors, memorialSpacing, memorialBorderRadius, memorialFonts, memorialShadows } from '../../../constants/memorialTheme';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { calculateContestability } from '../../../utils/contestability';

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
  contestability_period: number;
  inception_date: string;
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
  is_reinstatement?: boolean;
};

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

export default function PublicSOAScreen() {
  // 🔹 Public Param Adaptation
  const params = useLocalSearchParams();
  const mafParam = (params.maf_no as string)?.trim();
  const lastParam = (params.last as string)?.trim();

  const [data, setData] = useState<SoaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        setLoading(true);
        setErrorMsg(null);
        try {
          if (!mafParam || !lastParam) throw new Error("Missing search parameters.");

          // 1. LOOKUP MEMBER ID first
          const { data: members, error: searchErr } = await supabase
            .from('members')
            .select('id, maf_no, first_name, last_name, plan_type, contracted_price, monthly_due, address, birth_date, agent_id, created_at, plan_start_date, date_joined')
            .eq('maf_no', mafParam)
            .ilike('last_name', `%${lastParam}%`)
            .limit(1);

          if (searchErr) throw searchErr;
          if (!members || members.length === 0) {
            throw new Error("No record found. Please check your AF No. and Last Name.");
          }

          const member = members[0];
          const memberId = member.id;

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

          let lastActivityDate = new Date(member.plan_start_date || member.created_at);

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

            // --- Reinstatement Logic (Client-Side Dynamic) ---
            const paymentDate = new Date(c.date_paid || c.created_at);
            let isReinstated = false;

            if (!isNaN(lastActivityDate.getTime()) && !isNaN(paymentDate.getTime())) {
              // Calculate gap in months
              let monthsDiff = (paymentDate.getFullYear() - lastActivityDate.getFullYear()) * 12;
              monthsDiff += paymentDate.getMonth() - lastActivityDate.getMonth();

              // If gap is >= 3 months, mark reinstated
              if (monthsDiff >= 3) {
                isReinstated = true;
              }
            }
            // Update last activity date
            lastActivityDate = paymentDate;
            // --------------------------------------------------

            payments.push({
              date: c.date_paid || c.created_at,
              amount: amt,
              plan_type: c.plan_type,
              or_no: c.or_no,
              payment_for: c.payment_for,
              running_balance: runningBal,
              installment_no: inst,
              collector_name: cName,
              is_reinstatement: isReinstated || c.is_reinstatement // Prefer calc, fallback to DB
            });
          }

          // 4. Calculations (Totals)
          const totalPaid = cumulativePaid;
          const balance = Math.max(0, contracted - totalPaid);
          const installmentVal = monthlyDue > 0 ? totalPaid / monthlyDue : 0;
          const installment = installmentVal.toFixed(0);


          // 5. Determine Status (Last Payment Based)
          let status: MemberStatus = 'Active';
          let statusColor = '#22c55e'; // Green

          // Start Date
          let startDateVal = member.plan_start_date ? new Date(member.plan_start_date).getTime() : null;
          if (!startDateVal) {
            if (member.date_joined) startDateVal = new Date(member.date_joined).getTime();
            else startDateVal = new Date(member.created_at || Date.now()).getTime();
          }
          const startDate = new Date(startDateVal);

          // Find Last Regular Payment
          const regularPayments = rawPayments.filter((p: any) => !p.is_membership_fee);
          // rawPayments is usually ASC (based on SQL default or previous sort? query doesn't specify sort in JS, but usually date_paid).
          // Let's assume ASC or sort it to be safe? 
          // The fetch logic usually does .order('date_paid', { ascending: true })
          // If not sure, I should sort.
          regularPayments.sort((a, b) => new Date(a.date_paid).getTime() - new Date(b.date_paid).getTime());

          const lastPayment = regularPayments.length > 0 ? regularPayments[regularPayments.length - 1] : null;

          let paidUntilDate = new Date(startDate);

          if (lastPayment) {
            const lpDate = new Date(lastPayment.date_paid || lastPayment.created_at);
            const lpAmount = Number(lastPayment.payment) || 0;
            const mDue = Number(member.monthly_due) || 0;

            if (mDue > 0) {
              const monthsCovered = lpAmount / mDue;
              const wholeMonths = Math.floor(monthsCovered);
              const fraction = monthsCovered - wholeMonths;

              paidUntilDate = new Date(lpDate);
              paidUntilDate.setMonth(paidUntilDate.getMonth() + wholeMonths);
              paidUntilDate.setDate(paidUntilDate.getDate() + Math.round(fraction * 30));
            } else {
              paidUntilDate = new Date();
            }
          }

          // Calculate Months Behind
          const now = new Date();
          let monthsBehind = (now.getFullYear() - paidUntilDate.getFullYear()) * 12 +
            (now.getMonth() - paidUntilDate.getMonth());

          if (now.getDate() < paidUntilDate.getDate()) {
            monthsBehind--;
          }
          monthsBehind = Math.max(0, monthsBehind);

          if (balance <= 0) {
            status = 'Completed';
            statusColor = '#22c55e';
          } else {
            // Lapsed: > 3
            if (monthsBehind > 3) {
              status = 'Lapsed';
              statusColor = '#ef4444'; // Red
            }
            // Lapsable (At Risk): >= 2
            else if (monthsBehind >= 2) {
              status = 'Lapsable';
              statusColor = '#f97316'; // Orange
            }
            // Warning: >= 1
            else if (monthsBehind >= 1) {
              status = 'Warning';
              statusColor = '#eab308'; // Yellow
            }
            // Otherwise Active (< 1)
            else {
              status = 'Active';
              statusColor = '#22c55e'; // Green
            }
          }

          // 6. Amount Due Calculation
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

          // 7. Calculate Contestability Period
          const joinedDateVal = member.plan_start_date || member.date_joined || member.created_at;
          const contestabilityMonths = calculateContestability(joinedDateVal, rawPayments);
          const inceptionDateStr = datePH(joinedDateVal);

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
              amount_due_calculated: amountDueVal,
              contestability_period: contestabilityMonths,
              inception_date: inceptionDateStr
            });
          }

        } catch (err: any) {
          if (alive) setErrorMsg(err.message || "An error occurred.");
        } finally {
          if (alive) setLoading(false);
        }
      })();

      return () => { alive = false; };
    }, [mafParam, lastParam])
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

  if (loading) {
    return (
      <BackgroundLogo>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={memorialColors.primary} />
          <Text style={{ marginTop: 20, color: memorialColors.textMuted }}>Finding record...</Text>
        </View>
      </BackgroundLogo>
    );
  }

  if (errorMsg || !data) {
    return (
      <BackgroundLogo>
        <View style={{ flex: 1, padding: 40, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 18, color: memorialColors.error, textAlign: 'center', marginBottom: 20 }}>
            {errorMsg || "No data found"}
          </Text>
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 12, backgroundColor: memorialColors.primary, borderRadius: 8 }}>
            <Text style={{ color: '#fff', fontWeight: 'bold' }}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </BackgroundLogo>
    );
  }

  return (
    <BackgroundLogo>
      <View style={styles.container}>
        <Stack.Screen
          options={{
            headerTitle: '',
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
              {/* Inception Date */}
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Date of Inception:</Text>
                <Text style={styles.metaValue}>{data?.inception_date || '—'}</Text>
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
              {/* Contestability Period */}
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Contestability:</Text>
                <Text style={styles.metaValue}>
                  {data?.contestability_period >= 12 ? '12 Months (Max)' : `${data?.contestability_period} Month${data?.contestability_period === 1 ? '' : 's'}`}
                </Text>
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

              {!data?.payments?.length ? (
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
    paddingVertical: memorialSpacing.sm,
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
