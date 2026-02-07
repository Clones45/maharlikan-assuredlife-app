
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://agyueadcymdopgihtckc.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFneXVlYWRjeW1kb3BnaWh0Y2tjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzMzA2NjYsImV4cCI6MjA3NDkwNjY2Nn0.EBYfJ9RTkeGLQptG3uWaOsFMIz9DySu3uhaOlzgeeMw";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkOthers() {
    console.log("Checking commissions for period_month=1, period_year=2026 across all agents");
    const { data: comms, error } = await supabase
        .from('commissions')
        .select('agent_id, amount, month, date_earned, commission_type')
        .eq('period_month', 1)
        .eq('period_year', 2026);

    if (error) {
        console.error(error);
        return;
    }

    console.log(`Total commissions for Jan 2026: ${comms.length}`);
    if (comms.length > 0) {
        console.log("Sample commissions for Jan 2026:");
        console.log(JSON.stringify(comms.slice(0, 5), null, 2));
    }

    console.log("\nChecking commissions for month='2026-01-01' across all agents");
    const { data: comms2, error: err2 } = await supabase
        .from('commissions')
        .select('agent_id, amount, month, date_earned, commission_type')
        .eq('month', '2026-01-01');

    if (err2) {
        console.error(err2);
        return;
    }

    console.log(`Total commissions for month='2026-01-01': ${comms2.length}`);
    const agentSummary = comms2.reduce((acc, c) => {
        acc[c.agent_id] = (acc[c.agent_id] || 0) + Number(c.amount);
        return acc;
    }, {});
    console.log("Agent Summary for month='2026-01-01':");
    console.log(JSON.stringify(agentSummary, null, 2));
}

checkOthers();
