const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://agyueadcymdopgihtckc.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFneXVlYWRjeW1kb3BnaWh0Y2tjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzMzA2NjYsImV4cCI6MjA3NDkwNjY2Nn0.EBYfJ9RTkeGLQptG3uWaOsFMIz9DySu3uhaOlzgeeMw";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
    console.log("🔍 TESTING FORFEITED COMMISSION DISPLAY\n");
    console.log("=".repeat(60));

    // Test for January 2026 period
    const startDate = '2026-01-07';
    const endDate = '2026-02-07';

    const { data: commissions } = await supabase
        .from('commissions')
        .select('*')
        .gte('date_earned', startDate)
        .lt('date_earned', endDate)
        .order('agent_id');

    console.log(`\n📊 JANUARY 2026 COMMISSIONS BREAKDOWN:\n`);

    // Group by agent
    const byAgent = {};
    commissions?.forEach(c => {
        if (!byAgent[c.agent_id]) {
            byAgent[c.agent_id] = {
                receivable: [],
                forfeited: []
            };
        }

        const amt = c.commission_type === 'override' || c.commission_type === 'recruiter_bonus'
            ? (c.override_commission > 0 ? c.override_commission : c.amount)
            : c.amount;

        if (c.is_receivable) {
            byAgent[c.agent_id].receivable.push({ ...c, displayAmount: amt });
        } else {
            byAgent[c.agent_id].forfeited.push({ ...c, displayAmount: amt });
        }
    });

    for (const agentId in byAgent) {
        const data = byAgent[agentId];
        const receivableTotal = data.receivable.reduce((sum, c) => sum + c.displayAmount, 0);
        const forfeitedTotal = data.forfeited.reduce((sum, c) => sum + c.displayAmount, 0);

        console.log(`Agent ${agentId}:`);
        console.log(`   ✅ Receivable (Passed AGR): ${data.receivable.length} commissions, ₱${receivableTotal}`);
        console.log(`   ❌ Forfeited (Failed AGR): ${data.forfeited.length} commissions, ₱${forfeitedTotal}`);

        if (data.forfeited.length > 0) {
            console.log(`      Forfeited breakdown:`);
            const typeGroups = {};
            data.forfeited.forEach(c => {
                if (!typeGroups[c.commission_type]) typeGroups[c.commission_type] = [];
                typeGroups[c.commission_type].push(c);
            });

            for (const type in typeGroups) {
                const items = typeGroups[type];
                const total = items.reduce((sum, c) => sum + c.displayAmount, 0);
                console.log(`         - ${type}: ${items.length} items, ₱${total}`);
            }
        }
        console.log();
    }

    console.log("=".repeat(60));
    console.log("✅ VERIFICATION COMPLETE");
    console.log("=".repeat(60));
    console.log("\n📋 What to check in Desktop App:");
    console.log("   1. Open Incentives & Taxes report");
    console.log("   2. Select January 2026");
    console.log("   3. Check 'Forfeited' amount matches the totals above");
    console.log("   4. Agents who never passed AGR should show all commissions as forfeited\n");
}

main().catch(console.error);
