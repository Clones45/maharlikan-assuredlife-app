
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://agyueadcymdopgihtckc.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFneXVlYWRjeW1kb3BnaWh0Y2tjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzMzA2NjYsImV4cCI6MjA3NDkwNjY2Nn0.EBYfJ9RTkeGLQptG3uWaOsFMIz9DySu3uhaOlzgeeMw";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function inspect_feb_safe() {
    console.log("🔍 Checking Feb 2026 Commissions...");
    const { data: comms, error } = await supabase.from('commissions')
        .select('*')
        .eq('agent_id', 2)
        .eq('period_year', 2026)
        .eq('period_month', 2)
        .limit(5);

    if (error) { console.log("Error:", error); return; }
    if (!comms || comms.length === 0) { console.log("No commissions found for Feb."); return; }

    console.log(`Found ${comms.length}+ items. Examples:`);
    comms.forEach(c => console.log(` - Date: ${c.date_earned}, Amount: ${c.amount}, Source: ${c.source_member_id}`));
}

inspect_feb_safe();
