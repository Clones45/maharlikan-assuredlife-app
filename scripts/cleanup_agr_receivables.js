const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://agyueadcymdopgihtckc.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFneXVlYWRjeW1kb3BnaWh0Y2tjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzMzA2NjYsImV4cCI6MjA3NDkwNjY2Nn0.EBYfJ9RTkeGLQptG3uWaOsFMIz9DySu3uhaOlzgeeMw";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
    console.log("🔧 CLEANING UP INCORRECTLY RELEASED COMMISSIONS...\n");
    console.log("=".repeat(60));

    // Step 1: Get all agents and their rollup status
    const { data: rollups } = await supabase
        .from('agent_commission_rollups')
        .select('*')
        .order('agent_id')
        .order('period_year', { ascending: false })
        .order('period_month', { ascending: false });

    console.log(`\n📊 Found ${rollups?.length || 0} rollup records\n`);

    // Step 2: For each agent, check if they have receivable commissions in unreleased periods
    const agentsToFix = new Map();

    for (const rollup of rollups || []) {
        if (rollup.status === 'unreleased') {
            const { data: comms } = await supabase
                .from('commissions')
                .select('*')
                .eq('agent_id', rollup.agent_id)
                .gte('date_earned', `${rollup.period_year}-${String(rollup.period_month).padStart(2, '0')}-07`)
                .lt('date_earned', `${rollup.period_year}-${String(rollup.period_month + 1).padStart(2, '0')}-07`)
                .eq('is_receivable', true);

            if (comms && comms.length > 0) {
                const key = `${rollup.agent_id}`;
                if (!agentsToFix.has(key)) {
                    agentsToFix.set(key, []);
                }
                agentsToFix.get(key).push({
                    period: `${rollup.period_year}-${String(rollup.period_month).padStart(2, '0')}`,
                    commissions: comms
                });
            }
        }
    }

    console.log(`⚠️  Found ${agentsToFix.size} agents with incorrectly released commissions\n`);

    // Step 3: Fix each agent
    let totalFixed = 0;
    let totalAmount = 0;

    for (const [agentId, periods] of agentsToFix.entries()) {
        console.log(`\n🔧 Fixing Agent ${agentId}:`);

        for (const period of periods) {
            const amount = period.commissions.reduce((sum, c) => {
                const amt = c.commission_type === 'override' || c.commission_type === 'recruiter_bonus'
                    ? (c.override_commission > 0 ? c.override_commission : c.amount)
                    : c.amount;
                return sum + amt;
            }, 0);

            console.log(`   Period ${period.period}: ${period.commissions.length} commissions, ₱${amount}`);

            // Mark commissions as not receivable
            const commIds = period.commissions.map(c => c.id);
            const { error } = await supabase
                .from('commissions')
                .update({ is_receivable: false })
                .in('id', commIds);

            if (error) {
                console.error(`   ❌ Error: ${error.message}`);
            } else {
                console.log(`   ✅ Marked ${commIds.length} commissions as not receivable`);
                totalFixed += commIds.length;
                totalAmount += amount;
            }
        }
    }

    console.log("\n" + "=".repeat(60));
    console.log("📊 CLEANUP SUMMARY:");
    console.log("=".repeat(60));
    console.log(`Agents affected: ${agentsToFix.size}`);
    console.log(`Commissions fixed: ${totalFixed}`);
    console.log(`Total amount forfeited: ₱${totalAmount}\n`);

    // Step 4: Recalculate all agent wallet balances
    console.log("💰 RECALCULATING WALLET BALANCES...\n");

    const { data: agents } = await supabase
        .from('agents')
        .select('id');

    let walletsUpdated = 0;

    for (const agent of agents || []) {
        // Get all receivable commissions
        const { data: receivableComms } = await supabase
            .from('commissions')
            .select('*')
            .eq('agent_id', agent.id)
            .eq('is_receivable', true);

        const totalReceivable = receivableComms?.reduce((sum, c) => {
            const amt = c.commission_type === 'override' || c.commission_type === 'recruiter_bonus'
                ? (c.override_commission > 0 ? c.override_commission : c.amount)
                : c.amount;
            return sum + amt;
        }, 0) || 0;

        // Get withdrawals
        const { data: withdrawals } = await supabase
            .from('agent_withdrawals')
            .select('amount')
            .eq('agent_id', agent.id);

        const totalWithdrawn = withdrawals?.reduce((sum, w) => sum + (w.amount || 0), 0) || 0;

        const correctBalance = totalReceivable - totalWithdrawn;

        // Update wallet
        const { error: walletError } = await supabase
            .from('agent_wallets')
            .update({
                balance: correctBalance,
                updated_at: new Date().toISOString()
            })
            .eq('agent_id', agent.id);

        if (!walletError) {
            walletsUpdated++;
        }
    }

    console.log(`✅ Updated ${walletsUpdated} agent wallets\n`);

    console.log("=".repeat(60));
    console.log("✅ CLEANUP COMPLETE!");
    console.log("=".repeat(60));
}

main().catch(console.error);
