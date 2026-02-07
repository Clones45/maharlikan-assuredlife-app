
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://agyueadcymdopgihtckc.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFneXVlYWRjeW1kb3BnaWh0Y2tjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzMzA2NjYsImV4cCI6MjA3NDkwNjY2Nn0.EBYfJ9RTkeGLQptG3uWaOsFMIz9DySu3uhaOlzgeeMw";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function inspect_feb_comms() {
    console.log("🔍 Inspecting Commissions for Period 2026-2 (Feb)...");
    const agentId = 2;

    const { data: comms } = await supabase.from('commissions')
        .select('id, amount, date_earned, commission_type, source_member_id')
        .eq('agent_id', agentId)
        .eq('period_year', 2026)
        .eq('period_month', 2);

    console.log(`\nFound ${comms.length} commissions for Period 2026-2:`);
    comms.slice(0, 5).forEach(c => {
        console.log(`   - Date: ${c.date_earned}, Amount: ${c.amount}, Type: ${c.commission_type}`);
    });

    // Total sum
    const total = comms.reduce((sum, c) => sum + Number(c.amount), 0);
    console.log(`   Total Sum: ${total}`);

    // Check getting commission period for a few dates
    // (We'll just infer from the query results)

    // Also check Period 1 (Jan) just to compare dates
    const { data: jan_comms } = await supabase.from('commissions')
        .select('date_earned')
        .eq('agent_id', agentId)
        .eq('period_year', 2026)
        .eq('period_month', 1)
        .limit(3);
    console.log(`\nSample Jan (2026-1) Dates: ${jan_comms.map(c => c.date_earned).join(', ')}`);
}

inspect_feb_comms();
