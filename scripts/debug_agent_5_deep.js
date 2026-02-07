
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://agyueadcymdopgihtckc.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFneXVlYWRjeW1kb3BnaWh0Y2tjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzMzA2NjYsImV4cCI6MjA3NDkwNjY2Nn0.EBYfJ9RTkeGLQptG3uWaOsFMIz9DySu3uhaOlzgeeMw";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function debug() {
    console.log("🔍 Deep Dive Agent 5...");
    const agentId = 5;

    // 1. Withdrawal Requests
    console.log("\n--- Withdrawal Requests ---");
    const { data: wreqs, error: wErr } = await supabase
        .from('withdrawal_requests')
        .select('*')
        .eq('agent_id', agentId);

    if (wErr) console.log("   WR Error:", wErr.message);
    else {
        console.log(`   Found ${wreqs.length} requests.`);
        wreqs.forEach(w => console.log(`   - [${w.status}] Amt: ${w.amount}, Gross: ${w.gross_amount}, Date: ${w.created_at}`));
    }

    // 2. All Rollups
    console.log("\n--- All Commission Rollups ---");
    const { data: rollups, error: rErr } = await supabase
        .from('agent_commission_rollups')
        .select('*')
        .eq('agent_id', agentId)
        .order('period_year', { ascending: true })
        .order('period_month', { ascending: true });

    if (rErr) console.log("   Rollup Error:", rErr.message);
    else {
        rollups.forEach(r => {
            console.log(`   - ${r.period_year}-${r.period_month}: Status=${r.status}, GrandTotal=${r.grand_total_commission}`);
        });
    }

    // 3. Check for specific problematic commissions (Jan 2026)
    // Jan 2026 relies on Dec 2025 performance.
    // If Dec 2025 AGR failed, Jan 2026 should be unreleased.
    // Rollup says 'unreleased'.
    // So if wallet has balance, does it come from 'unreleased' rollup? (Shouldn't).

    // Check if any commission in Jan 2026 has 'override_released' = true?
    // Although 'override_released' column exists, logic is obscure.
}

debug();
