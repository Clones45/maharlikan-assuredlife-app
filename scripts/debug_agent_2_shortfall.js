
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://agyueadcymdopgihtckc.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFneXVlYWRjeW1kb3BnaWh0Y2tjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzMzA2NjYsImV4cCI6MjA3NDkwNjY2Nn0.EBYfJ9RTkeGLQptG3uWaOsFMIz9DySu3uhaOlzgeeMw";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function check_shortfall() {
    console.log("🧮 Calculating Shortfall for Agent 2...");
    const agentId = 2;

    // 1. Get Wallet
    const { data: wallet } = await supabase.from('agent_wallets').select('balance, lifetime_commission').eq('agent_id', agentId).single();
    const lifetime = Number(wallet.lifetime_commission || 0);
    const balance = Number(wallet.balance || 0);

    // 2. Sum All Released Rollups
    const { data: rollups } = await supabase.from('agent_commission_rollups')
        .select('period_year, period_month, grand_total_commission')
        .eq('agent_id', agentId)
        .eq('status', 'released');

    let totalReleased = 0;
    rollups.forEach(r => {
        totalReleased += Number(r.grand_total_commission);
    });

    console.log(`   Total Released Rollups: ${totalReleased}`);
    console.log(`   Wallet Lifetime: ${lifetime}`);
    console.log(`   Current Balance: ${balance}`);

    const diff = totalReleased - lifetime;
    console.log(`   Difference (Owed): ${diff}`);

    return diff;
}

check_shortfall();
