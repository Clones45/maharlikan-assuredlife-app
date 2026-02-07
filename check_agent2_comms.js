
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://agyueadcymdopgihtckc.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFneXVlYWRjeW1kb3BnaWh0Y2tjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzMzA2NjYsImV4cCI6MjA3NDkwNjY2Nn0.EBYfJ9RTkeGLQptG3uWaOsFMIz9DySu3uhaOlzgeeMw";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkAgent2() {
    console.log("Checking commissions for Agent ID: 2 with month='2026-01-01'");
    const { data: comms, error } = await supabase
        .from('commissions')
        .select('date_earned, amount, commission_type')
        .eq('agent_id', 2)
        .eq('month', '2026-01-01')
        .limit(10);

    if (error) {
        console.error(error);
        return;
    }

    console.log(`Sample commissions for Agent 2:`);
    console.log(JSON.stringify(comms, null, 2));
}

checkAgent2();
