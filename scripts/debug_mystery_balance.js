
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://agyueadcymdopgihtckc.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFneXVlYWRjeW1kb3BnaWh0Y2tjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzMzA2NjYsImV4cCI6MjA3NDkwNjY2Nn0.EBYfJ9RTkeGLQptG3uWaOsFMIz9DySu3uhaOlzgeeMw";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function check_status() {
    console.log("🔍 Checking Agent 2 & 5 Status...");

    for (const id of [2, 5]) {
        console.log(`\n👤 Agent ${id}:`);

        // Wallet
        const { data: w } = await supabase.from('agent_wallets').select('*').eq('agent_id', id).single();
        console.log(`   Wallet: Balance=${w.balance}, Lifetime=${w.lifetime_commission}, Updated=${w.updated_at}`);

        // Jan & Feb Rollups
        const { data: r } = await supabase.from('agent_commission_rollups')
            .select('*')
            .eq('agent_id', id)
            .in('period_month', [1, 2])
            .eq('period_year', 2026);

        r.forEach(run => {
            console.log(`   Period 2026-${run.period_month}: Status=${run.status}, Total=${run.grand_total_commission}`);
        });
    }
}

check_status();
