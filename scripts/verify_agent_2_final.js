const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://agyueadcymdopgihtckc.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFneXVlYWRjeW1kb3BnaWh0Y2tjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzMzA2NjYsImV4cCI6MjA3NDkwNjY2Nn0.EBYfJ9RTkeGLQptG3uWaOsFMIz9DySu3uhaOlzgeeMw";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
    console.log("✅ FINAL VERIFICATION - AGENT 2 AGR STATUS\n");
    console.log("=".repeat(60));

    const AGENT_ID = 2;

    // 1. Wallet Status
    const { data: wallet } = await supabase
        .from('agent_wallets')
        .select('*')
        .eq('agent_id', AGENT_ID)
        .single();

    console.log("\n💰 WALLET STATUS:");
    console.log(`   Balance: ₱${wallet?.balance || 0}`);
    console.log(`   Lifetime Commission: ₱${wallet?.lifetime_commission || 0}`);

    // 2. AGR Rollup Status
    const { data: rollups } = await supabase
        .from('agent_commission_rollups')
        .select('*')
        .eq('agent_id', AGENT_ID)
        .in('period_year', [2025, 2026])
        .order('period_year', { ascending: false })
        .order('period_month', { ascending: false });

    console.log("\n📊 AGR ROLLUP STATUS:");
    rollups?.forEach(r => {
        const period = `${r.period_year}-${String(r.period_month).padStart(2, '0')}`;
        const status = r.status === 'released' ? '✅ released' : '❌ unreleased';
        console.log(`   ${period}: ${status}`);
    });

    // 3. December 2025 Collections (Nov 7 - Dec 6)
    const { data: decColls } = await supabase
        .from('collections')
        .select('id, is_membership_fee')
        .eq('agent_id', AGENT_ID)
        .gte('date_paid', '2025-12-07')
        .lt('date_paid', '2026-01-07');

    const decMemCount = decColls?.filter(c => c.is_membership_fee).length || 0;

    console.log("\n📅 DECEMBER 2025 PERIOD (Dec 7 - Jan 6):");
    console.log(`   Total Collections: ${decColls?.length || 0}`);
    console.log(`   Membership Fees: ${decMemCount}`);
    console.log(`   AGR Status: ${decMemCount >= 3 ? '✅ PASS' : '❌ FAIL'}`);

    // 4. Receivable Commissions by Period
    const { data: receivableComms } = await supabase
        .from('commissions')
        .select('*')
        .eq('agent_id', AGENT_ID)
        .eq('is_receivable', true);

    const periods = {};
    receivableComms?.forEach(c => {
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

    console.log("\n✅ RECEIVABLE COMMISSIONS BY PERIOD:");
    Object.keys(periods).sort().forEach(period => {
        const p = periods[period];
        const isIncorrect = period === '2025-12' || period === '2026-01';
        const marker = isIncorrect ? '⚠️ ' : '   ';
        console.log(`${marker}${period}: ${p.count} commissions, ₱${p.total}`);
    });

    const dec2025Receivable = periods['2025-12']?.total || 0;
    const jan2026Receivable = periods['2026-01']?.total || 0;

    console.log("\n" + "=".repeat(60));
    console.log("🎯 SUMMARY:");
    console.log("=".repeat(60));
    console.log(`\n✅ December 2025 Rollup: ${rollups?.find(r => r.period_year === 2025 && r.period_month === 12)?.status || 'NOT FOUND'}`);
    console.log(`✅ January 2026 Rollup: ${rollups?.find(r => r.period_year === 2026 && r.period_month === 1)?.status || 'NOT FOUND'}`);
    console.log(`\n💰 Wallet Balance: ₱${wallet?.balance || 0}`);
    console.log(`   - Total Receivable: ₱${receivableComms?.reduce((sum, c) => {
        const amt = c.commission_type === 'override' || c.commission_type === 'recruiter_bonus'
            ? (c.override_commission > 0 ? c.override_commission : c.amount)
            : c.amount;
        return sum + amt;
    }, 0) || 0}`);

    if (dec2025Receivable > 0 || jan2026Receivable > 0) {
        console.log("\n⚠️  WARNING: Agent 2 still has receivable commissions from:");
        if (dec2025Receivable > 0) console.log(`   - December 2025: ₱${dec2025Receivable}`);
        if (jan2026Receivable > 0) console.log(`   - January 2026: ₱${jan2026Receivable}`);
        console.log("\n   These should NOT be receivable since Agent 2 did not pass AGR.");
        console.log("   This suggests there may be other sources of receivable status");
        console.log("   (e.g., overrides, recruiter bonuses that are always receivable).");
    } else {
        console.log("\n✅ No receivable commissions from Dec 2025 or Jan 2026 periods.");
    }
}

main().catch(console.error);
