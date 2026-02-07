
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://agyueadcymdopgihtckc.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFneXVlYWRjeW1kb3BnaWh0Y2tjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzMzA2NjYsImV4cCI6MjA3NDkwNjY2Nn0.EBYfJ9RTkeGLQptG3uWaOsFMIz9DySu3uhaOlzgeeMw";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testWrite() {
    console.log("Testing WRITE access to agent_wallets...");
    const agentId = 1;

    // 1. Get current
    const { data: initial } = await supabase.from('agent_wallets').select('balance').eq('agent_id', agentId).single();
    if (!initial) { console.error("Could not find agent 1"); return; }

    const originalBal = Number(initial.balance);
    console.log("Original Balance:", originalBal);

    // 2. Try Update (+1 peso)
    const { error: updateErr } = await supabase
        .from('agent_wallets')
        .update({ balance: originalBal + 1 })
        .eq('agent_id', agentId);

    if (updateErr) {
        console.error("❌ WRITE FAILED:", updateErr.message);
    } else {
        console.log("✅ WRITE SUCCESS! (Balance incremented)");

        // 3. Revert
        const { error: revertErr } = await supabase
            .from('agent_wallets')
            .update({ balance: originalBal })
            .eq('agent_id', agentId);

        if (!revertErr) console.log("✅ Reverted successfully.");
    }
}

testWrite();
