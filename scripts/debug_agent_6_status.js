
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://agyueadcymdopgihtckc.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFneXVlYWRjeW1kb3BnaWh0Y2tjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzMzA2NjYsImV4cCI6MjA3NDkwNjY2Nn0.EBYfJ9RTkeGLQptG3uWaOsFMIz9DySu3uhaOlzgeeMw";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function cutoffRange(year, month) {
    const Y = Number(year);
    const M = Number(month);
    const start = new Date(Y, M - 1, 7);
    const end = new Date(Y, M, 7);
    const fmt = d => d.toISOString().split('T')[0];
    return { gte: fmt(start), lt: fmt(end) };
}

async function debug() {
    console.log("🔍 Investigating Agent 6...");
    const agentId = 6;

    // 1. Current Wallet
    const { data: wallet } = await supabase.from('agent_wallets').select('*').eq('agent_id', agentId).single();
    console.log("💰 Wallet:", wallet);

    // 2. Rollups (Dec, Jan, Feb)
    console.log("\n📊 Rollups:");
    const periods = [
        { y: 2025, m: 12 },
        { y: 2026, m: 1 },
        { y: 2026, m: 2 }
    ];

    for (const p of periods) {
        const { data: r } = await supabase.from('agent_commission_rollups')
            .select('*')
            .eq('agent_id', agentId)
            .eq('period_year', p.y)
            .eq('period_month', p.m)
            .single();

        console.log(`   Period ${p.y}-${p.m}: Status=${r?.status}, Total=${r?.grand_total_commission}`);

        // AGR Check (Membership count)
        const range = cutoffRange(p.y, p.m);
        const { count } = await supabase.from('collections')
            .select('*', { count: 'exact', head: true })
            .eq('agent_id', agentId)
            .gte('date_paid', range.gte)
            .lt('date_paid', range.lt)
            .eq('is_membership_fee', true);

        console.log(`      > Memberships in range ${range.gte} to ${range.lt}: ${count}`);
    }
}

debug();
