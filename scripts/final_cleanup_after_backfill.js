const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://agyueadcymdopgihtckc.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFneXVlYWRjeW1kb3BnaWh0Y2tjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzMzA2NjYsImV4cCI6MjA3NDkwNjY2Nn0.EBYfJ9RTkeGLQptG3uWaOsFMIz9DySu3uhaOlzgeeMw";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
    console.log("🔧 FINAL CLEANUP AFTER BACKFILL\n");
    console.log("This will mark commissions from unreleased periods as non-receivable.\n");
    console.log("=".repeat(60));

    // Step 1: Get all UNRELEASED rollups
    const { data: unreleasedRollups } = await supabase
        .from('agent_commission_rollups')
        .select('*')
        .eq('status', 'unreleased')
        .order('agent_id')
        .order('period_year')
        .order('period_month');

    console.log(`\n📊 Found ${unreleasedRollups?.length || 0} unreleased rollups\n`);

    let totalFixed = 0;
    let totalForfeited = 0;

    // Step 2: For each unreleased rollup, mark commissions as non-receivable
    for (const rollup of unreleasedRollups || []) {
        const startDate = `${rollup.period_year}-${String(rollup.period_month).padStart(2, '0')}-07`;
        let endMonth = rollup.period_month + 1;
        let endYear = rollup.period_year;
        if (endMonth > 12) {
            endMonth = 1;
            endYear++;
        }
        const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-07`;

        // Get receivable commissions in this period
        const { data: comms } = await supabase
            .from('commissions')
            .select('*')
            .eq('agent_id', rollup.agent_id)
            .gte('date_earned', startDate)
            .lt('date_earned', endDate)
            .eq('is_receivable', true);

        if (comms && comms.length > 0) {
            const amount = comms.reduce((sum, c) => {
                const amt = c.commission_type === 'override' || c.commission_type === 'recruiter_bonus'
                    ? (c.override_commission > 0 ? c.override_commission : c.amount)
                    : c.amount;
                return sum + amt;
            }, 0);

            console.log(`Agent ${rollup.agent_id} - ${rollup.period_year}-${String(rollup.period_month).padStart(2, '0')}: ${comms.length} comms, ₱${amount}`);

            // Mark as non-receivable
            const commIds = comms.map(c => c.id);
            const { error } = await supabase
                .from('commissions')
                .update({ is_receivable: false })
                .in('id', commIds);

            if (!error) {
                totalFixed += comms.length;
                totalForfeited += amount;
            } else {
                console.log(`   ⚠️  Error: ${error.message}`);
            }
        }
    }

    console.log("\n" + "=".repeat(60));
    console.log("📊 CLEANUP SUMMARY:");
    console.log("=".repeat(60));
    console.log(`Commissions fixed: ${totalFixed}`);
    console.log(`Total forfeited: ₱${totalForfeited}\n`);

    // Step 3: Recalculate ALL agent wallets
    console.log("💰 RECALCULATING ALL AGENT WALLETS...\n");

    const { data: agents } = await supabase
        .from('agents')
        .select('id');

    const balances = [];

    for (const agent of agents || []) {
        const { data: receivable } = await supabase
            .from('commissions')
            .select('*')
            .eq('agent_id', agent.id)
            .eq('is_receivable', true);

        const total = receivable?.reduce((sum, c) => {
            const amt = c.commission_type === 'override' || c.commission_type === 'recruiter_bonus'
                ? (c.override_commission > 0 ? c.override_commission : c.amount)
                : c.amount;
            return sum + amt;
        }, 0) || 0;

        const { error } = await supabase
            .from('agent_wallets')
            .update({ balance: total })
            .eq('agent_id', agent.id);

        if (!error && total > 0) {
            balances.push({ agent_id: agent.id, balance: total });
        }
    }

    console.log("✅ Updated all agent wallets\n");
    console.log("📋 AGENTS WITH BALANCES:");
    balances.sort((a, b) => a.agent_id - b.agent_id).forEach(b => {
        console.log(`   Agent ${b.agent_id}: ₱${b.balance}`);
    });

    console.log("\n" + "=".repeat(60));
    console.log("✅ FINAL CLEANUP COMPLETE!");
    console.log("=".repeat(60));
}

main().catch(console.error);
