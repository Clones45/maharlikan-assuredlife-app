const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://agyueadcymdopgihtckc.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFneXVlYWRjeW1kb3BnaWh0Y2tjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzMzA2NjYsImV4cCI6MjA3NDkwNjY2Nn0.EBYfJ9RTkeGLQptG3uWaOsFMIz9DySu3uhaOlzgeeMw";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
    console.log("🔍 VERIFYING AGENT 6 AGR STATUS\n");
    console.log("=".repeat(60));

    const AGENT_ID = 6;

    // Get wallet
    const { data: wallet } = await supabase
        .from('agent_wallets')
        .select('*')
        .eq('agent_id', AGENT_ID)
        .single();

    console.log(`\n💰 WALLET: ₱${wallet?.balance || 0}\n`);

    // Get ALL rollups
    const { data: rollups } = await supabase
        .from('agent_commission_rollups')
        .select('*')
        .eq('agent_id', AGENT_ID)
        .order('period_year', { ascending: false })
        .order('period_month', { ascending: false });

    console.log("📊 AGR ROLLUP HISTORY:");

    for (const rollup of rollups || []) {
        const period = `${rollup.period_year}-${String(rollup.period_month).padStart(2, '0')}`;

        // Check if they actually passed AGR for this period
        const prevMonth = rollup.period_month === 1 ? 12 : rollup.period_month - 1;
        const prevYear = rollup.period_month === 1 ? rollup.period_year - 1 : rollup.period_year;

        const startDate = `${prevYear}-${String(prevMonth).padStart(2, '0')}-07`;
        const endDate = `${rollup.period_year}-${String(rollup.period_month).padStart(2, '0')}-07`;

        const { data: colls } = await supabase
            .from('collections')
            .select(`
                id,
                is_membership_fee,
                payment_for,
                members (
                    first_name,
                    last_name,
                    middle_name
                )
            `)
            .eq('agent_id', AGENT_ID)
            .gte('date_paid', startDate)
            .lt('date_paid', endDate);

        const memCount = colls?.filter(c => c.is_membership_fee).length || 0;

        // Rule B: Check for member with both MEM and REG
        const groups = {};
        colls?.forEach(c => {
            const m = Array.isArray(c.members) ? c.members[0] : c.members;
            if (!m || !m.first_name || !m.last_name) return;
            const key = `${m.last_name}|${m.first_name}`.trim().toUpperCase();
            if (!groups[key]) groups[key] = [];
            groups[key].push(c);
        });

        let ruleB = false;
        for (const key in groups) {
            const payments = groups[key];
            const hasMem = payments.some(p => p.is_membership_fee === true);
            const hasReg = payments.some(p => p.is_membership_fee === false && p.payment_for === 'regular');
            if (hasMem && hasReg) {
                ruleB = true;
                break;
            }
        }

        const shouldPass = memCount >= 3 || ruleB;
        const status = rollup.status === 'released' ? '✅ released' : '❌ unreleased';
        const correct = (rollup.status === 'released') === shouldPass ? '✅' : '⚠️';

        console.log(`   ${period}: ${status} (${memCount} MEM${ruleB ? ' + Rule B' : ''}) ${correct} ${shouldPass ? 'SHOULD PASS' : 'SHOULD FAIL'}`);
    }

    // Get receivable commissions
    const { data: receivable } = await supabase
        .from('commissions')
        .select('*')
        .eq('agent_id', AGENT_ID)
        .eq('is_receivable', true);

    console.log(`\n✅ RECEIVABLE COMMISSIONS: ${receivable?.length || 0}`);

    if (receivable && receivable.length > 0) {
        const total = receivable.reduce((sum, c) => {
            const amt = c.commission_type === 'override' || c.commission_type === 'recruiter_bonus'
                ? (c.override_commission > 0 ? c.override_commission : c.amount)
                : c.amount;
            return sum + amt;
        }, 0);
        console.log(`   Total: ₱${total}`);

        // Group by period
        const periods = {};
        receivable.forEach(c => {
            const date = new Date(c.date_earned);
            let year = date.getFullYear();
            let month = date.getMonth() + 1;

            if (date.getDate() < 7) {
                month -= 1;
                if (month === 0) {
                    month = 12;
                    year -= 1;
                }
            }

            const key = `${year}-${String(month).padStart(2, '0')}`;
            if (!periods[key]) periods[key] = { count: 0, total: 0 };

            const amt = c.commission_type === 'override' || c.commission_type === 'recruiter_bonus'
                ? (c.override_commission > 0 ? c.override_commission : c.amount)
                : c.amount;

            periods[key].count++;
            periods[key].total += amt;
        });

        console.log("\n   BY PERIOD:");
        Object.keys(periods).sort().forEach(period => {
            const p = periods[period];
            const rollup = rollups?.find(r => `${r.period_year}-${String(r.period_month).padStart(2, '0')}` === period);
            const marker = rollup?.status === 'released' ? '✅' : '⚠️';
            console.log(`   ${marker} ${period}: ${p.count} commissions, ₱${p.total}`);
        });
    }

    console.log("\n" + "=".repeat(60));
    console.log("🎯 VERDICT:");
    console.log("=".repeat(60));

    const passedPeriods = rollups?.filter(r => {
        const prevMonth = r.period_month === 1 ? 12 : r.period_month - 1;
        const prevYear = r.period_month === 1 ? r.period_year - 1 : r.period_year;
        const period = `${prevYear}-${String(prevMonth).padStart(2, '0')}`;
        return r.status === 'released';
    }) || [];

    if (passedPeriods.length > 0) {
        console.log(`✅ Agent 6 HAS passed AGR in ${passedPeriods.length} periods`);
        console.log(`   They SHOULD have a withdrawable balance`);
    } else {
        console.log(`❌ Agent 6 has NEVER passed AGR`);
        console.log(`   They should have ₱0 balance`);
    }
}

main().catch(console.error);
