
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://agyueadcymdopgihtckc.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFneXVlYWRjeW1kb3BnaWh0Y2tjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzMzA2NjYsImV4cCI6MjA3NDkwNjY2Nn0.EBYfJ9RTkeGLQptG3uWaOsFMIz9DySu3uhaOlzgeeMw";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkDec() {
    console.log("Checking commissions for Janace with month='2025-12-01'");
    const { data: comms, error } = await supabase
        .from('commissions')
        .select('*')
        .eq('agent_id', 6)
        .eq('month', '2025-12-01');

    if (error) {
        console.error(error);
        return;
    }

    console.log(`Total commissions (month='2025-12-01'): ${comms.length}`);
    if (comms.length > 0) {
        comms.forEach(c => {
            console.log(`${c.date_earned} | ${c.commission_type} | ${c.amount} | status: ${c.status}`);
        });
    }

    // Also check for any commissions in late Nov/early Dec that might have a different month value
    console.log("\nChecking commissions earned between 2025-11-07 and 2025-12-07");
    const { data: earned, error: eErr } = await supabase
        .from('commissions')
        .select('*')
        .eq('agent_id', 6)
        .gte('date_earned', '2025-11-07')
        .lt('date_earned', '2025-12-07');

    console.log(`Total commissions earned in Dec Cutoff: ${earned.length}`);
    earned.forEach(c => {
        console.log(`${c.date_earned} | ${c.commission_type} | ${c.amount} | month: ${c.month}`);
    });
}

checkDec();
