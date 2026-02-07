
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://agyueadcymdopgihtckc.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFneXVlYWRjeW1kb3BnaWh0Y2tjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzMzA2NjYsImV4cCI6MjA3NDkwNjY2Nn0.EBYfJ9RTkeGLQptG3uWaOsFMIz9DySu3uhaOlzgeeMw";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function reconcile() {
    console.log("⚖️ Reconciling Agent 2...");
    const agentId = 2;

    // 1. Get Wallet Lifetime
    const { data: wallet } = await supabase.from('agent_wallets').select('lifetime_commission, balance').eq('agent_id', agentId).single();
    const lifetime = Number(wallet.lifetime_commission || 0);
    const balance = Number(wallet.balance || 0);

    console.log(`   Detailed Wallet: Balance=${balance}, Lifetime=${lifetime}`);

    // 2. Identify Released Periods
    const { data: rollups } = await supabase.from('agent_commission_rollups')
        .select('*')
        .eq('agent_id', agentId)
        .eq('status', 'released');

    console.log(`   Released Periods: ${rollups.length}`);
    rollups.forEach(r => console.log(`     - ${r.period_year}-${r.period_month} (Total: ${r.grand_total_commission})`));

    // 3. Sum Commissions for Released Periods
    // We need to fetch all commissions and filter in JS or do strict query
    const { data: comms } = await supabase.from('commissions')
        .select('amount, commission_type, override_commission, period_year, period_month, is_receivable')
        .eq('agent_id', agentId);

    let calcLifetime = 0;
    let releasedSum = 0;

    // Map of Released Periods
    const releasedMap = new Set(rollups.map(r => `${r.period_year}-${r.period_month}`));

    comms.forEach(c => {
        const key = `${c.period_year}-${c.period_month}`;
        let val = 0;

        if (c.commission_type === 'override' || c.commission_type === 'recruiter_bonus') {
            val = c.override_commission > 0 ? c.override_commission : c.amount;
        } else if (c.is_receivable) {
            val = c.amount;
        }

        if (releasedMap.has(key)) {
            releasedSum += val;
        }
    });

    console.log(`   Calculated Sum from Commissions Table (Released Periods): ${releasedSum}`);
    console.log(`   Wallet Lifetime: ${lifetime}`);
    console.log(`   Difference: ${releasedSum - lifetime}`);

    if (releasedSum > lifetime) {
        console.log(`   ⚠️  SHORTFALL DETECTED: ${releasedSum - lifetime}`);
    } else {
        console.log(`   ✅  No Shortfall (Lifetime matches or exceeds sum)`);
    }
}

reconcile();
