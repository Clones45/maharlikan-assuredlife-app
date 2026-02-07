
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://agyueadcymdopgihtckc.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFneXVlYWRjeW1kb3BnaWh0Y2tjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzMzA2NjYsImV4cCI6MjA3NDkwNjY2Nn0.EBYfJ9RTkeGLQptG3uWaOsFMIz9DySu3uhaOlzgeeMw";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testRollupWrite() {
    console.log("Testing WRITE access to agent_commission_rollups...");
    // Use Janace (id 6) and a past period (e.g. 2025-10)
    const agentId = 6;
    const periodM = 10;
    const periodY = 2025;

    // 1. Get current
    const { data: initial, error: selErr } = await supabase
        .from('agent_commission_rollups')
        .select('status')
        .eq('agent_id', agentId)
        .eq('period_month', periodM)
        .eq('period_year', periodY)
        .single();

    if (selErr) { console.error("Found select error:", selErr.message); return; }

    const originalStatus = initial.status;
    console.log("Original Status:", originalStatus);

    // 2. Try Update
    const newStatus = originalStatus === 'unreleased' ? 'released' : 'unreleased'; // toggle

    const { error: updateErr } = await supabase
        .from('agent_commission_rollups')
        .update({ status: newStatus })
        .eq('agent_id', agentId)
        .eq('period_month', periodM)
        .eq('period_year', periodY);

    if (updateErr) {
        console.error("❌ WRITE FAILED:", updateErr.message);
    } else {
        console.log("✅ WRITE SUCCESS! (Status changed)");

        // 3. Revert
        const { error: revertErr } = await supabase
            .from('agent_commission_rollups')
            .update({ status: originalStatus })
            .eq('agent_id', agentId)
            .eq('period_month', periodM)
            .eq('period_year', periodY);

        if (!revertErr) console.log("✅ Reverted successfully.");
    }
}

testRollupWrite();
