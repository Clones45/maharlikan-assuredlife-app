
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://agyueadcymdopgihtckc.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFneXVlYWRjeW1kb3BnaWh0Y2tjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzMzA2NjYsImV4cCI6MjA3NDkwNjY2Nn0.EBYfJ9RTkeGLQptG3uWaOsFMIz9DySu3uhaOlzgeeMw";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function debug() {
    console.log("🔍 Inspecting Commissions & SOA Transactions for Agent 5...");
    const agentId = 5;

    // 1. Commissions Table
    console.log("\n--- Commissions Table ---");
    const { data: comms, error: cErr } = await supabase
        .from('commissions')
        .select('*')
        .eq('agent_id', agentId);

    if (cErr) console.log("   Commissions Error:", cErr.message);
    else {
        console.log(`   Found ${comms.length} commissions.`);
        // Group by type
        const byType = {};
        let total = 0;
        let totalReleased = 0;
        let totalReceivable = 0;

        comms.forEach(c => {
            const amt = Number(c.amount || 0);
            const type = c.commission_type;
            if (!byType[type]) byType[type] = 0;
            byType[type] += amt;

            total += amt;
            if (c.date_earned) {
                // Check if released? 
                // There is no 'released' column in commissions, but 'override_released' column exists.
                // But generally commissions are rolled up into 'agent_commission_rollups'.
            }
        });

        console.log("   By Type:", byType);
        console.log("   Total Commissions Recorded:", total);
    }

    // 2. SOA Transactions (for history of payments/collections)
    console.log("\n--- SOA Transactions Table ---");
    const { data: txns, error: tErr } = await supabase
        .from('soa_transactions')
        .select('*')
        .eq('agent_id', agentId);

    if (tErr) console.log("   SOA Transactions Error:", tErr.message);
    else {
        console.log(`   Found ${txns.length} SOA transactions.`);
        let total = 0;
        txns.forEach(t => {
            total += Number(t.amount || 0);
        });
        console.log("   Total SOA Amount:", total);
    }

    // 3. Transactions Table (Retry if possible, maybe with agent_id?)
    // If it exists, it might hold 'Direct Referral'
    // Let's try to query 'transactions' AGAIN, using raw SQL via rpc if possible? No RPC available.
    // Try simple select. If table doesn't exist, we know.
    // But notice earlier error: "Could not find table public.transactions in schema cache".
    // This suggests it might exist but cache issue.
    // But if createClient(URL, KEY) fails, it fails.

}

debug();
