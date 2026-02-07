
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://agyueadcymdopgihtckc.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFneXVlYWRjeW1kb3BnaWh0Y2tjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzMzA2NjYsImV4cCI6MjA3NDkwNjY2Nn0.EBYfJ9RTkeGLQptG3uWaOsFMIz9DySu3uhaOlzgeeMw";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
    console.log("Checking Dec 2025 Rollup for Agent 6...");

    // Check Rollup
    const { data: rollup } = await supabase
        .from('agent_commission_rollups')
        .select('*')
        .eq('agent_id', 6)
        .eq('period_year', 2025)
        .eq('period_month', 12)
        .single();

    console.log("Rollup:", rollup);

    // Check specific commissions if needed (to see where 209 comes from)
    // 209 sounds like a mix of monthly + travel? or just overrides?
}

main();
