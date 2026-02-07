const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://agyueadcymdopgihtckc.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFneXVlYWRjeW1kb3BnaWh0Y2tjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzMzA2NjYsImV4cCI6MjA3NDkwNjY2Nn0.EBYfJ9RTkeGLQptG3uWaOsFMIz9DySu3uhaOlzgeeMw";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkAgent(agentId) {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`AGENT ${agentId} - COMPLETE AGR HISTORY`);
    console.log("=".repeat(60));

    // Get wallet
    const { data: wallet } = await supabase
        .from('agent_wallets')
        .select('*')
        .eq('agent_id', agentId)
        .single();

    console.log(`\n💰 WALLET: ₱${wallet?.balance || 0}\n`);

    // Get ALL rollups
    const { data: rollups } = await supabase
        .from('agent_commission_rollups')
        .select('*')
        .eq('agent_id', agentId)
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
            .select('id, is_membership_fee, members(first_name, last_name)')
            .eq('agent_id', agentId)
            .gte('date_paid', startDate)
            .lt('date_paid', endDate);

        const memCount = colls?.filter(c => c.is_membership_fee).length || 0;
        const shouldPass = memCount >= 3;
        const status = rollup.status === 'released' ? '✅ released' : '❌ unreleased';
        const correct = (rollup.status === 'released') === shouldPass ? '✅' : '⚠️';

        console.log(`   ${period}: ${status} (${memCount} MEM) ${correct} ${shouldPass ? 'SHOULD PASS' : 'SHOULD FAIL'}`);
    }

    // Get all receivable commissions
    const { data: receivable } = await supabase
        .from('commissions')
        .select('*')
        .eq('agent_id', agentId)
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

    console.log("\n🎯 VERDICT:");
    const hasAnyReleased = rollups?.some(r => r.status === 'released') || false;
    if (!hasAnyReleased) {
        console.log(`   ❌ Agent ${agentId} has NEVER passed AGR`);
        console.log(`   ❌ They should have ₱0 balance, but have ₱${wallet?.balance || 0}`);
        console.log(`   ⚠️  THIS IS INCORRECT!`);
    } else {
        console.log(`   ✅ Agent ${agentId} has passed AGR in some periods`);
    }
}

async function main() {
    console.log("🔍 CHECKING AGENTS 2 AND 5 AGR HISTORY\n");

    await checkAgent(2);
    await checkAgent(5);

    console.log("\n" + "=".repeat(60));
    console.log("💡 CONCLUSION:");
    console.log("=".repeat(60));
    console.log("\nIf these agents never passed AGR, ALL their receivable commissions");
    console.log("are incorrectly marked. The backfill function or triggers have been");
    console.log("incorrectly marking commissions as receivable without AGR validation.");
}

main().catch(console.error);
