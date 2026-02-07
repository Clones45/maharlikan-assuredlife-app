
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://agyueadcymdopgihtckc.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFneXVlYWRjeW1kb3BnaWh0Y2tjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzMzA2NjYsImV4cCI6MjA3NDkwNjY2Nn0.EBYfJ9RTkeGLQptG3uWaOsFMIz9DySu3uhaOlzgeeMw";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function findThe1011() {
    const start = "2025-12-07";
    const end = "2026-01-07";
    console.log(`Auditing commissions for Janace (ID 6) earned between ${start} and ${end}`);

    const { data: comms, error } = await supabase
        .from('commissions')
        .select('*')
        .eq('agent_id', 6)
        .gte('date_earned', start)
        .lt('date_earned', end);

    if (error) { console.error(error); return; }

    console.log(`Total commissions found in range: ${comms.length}`);

    const breakdown = comms.reduce((acc, c) => {
        const type = c.commission_type;
        acc[type] = (acc[type] || 0) + Number(c.amount);
        return acc;
    }, {});

    console.log("Breakdown of these commissions:");
    console.log(JSON.stringify(breakdown, null, 2));

    const total = comms.reduce((s, c) => s + Number(c.amount), 0);
    console.log(`Total Earned: ${total}`);

    // Check month column distribution
    const monthDist = comms.reduce((acc, c) => {
        acc[c.month] = (acc[c.month] || 0) + Number(c.amount);
        return acc;
    }, {});
    console.log("Month Column Distribution:");
    console.log(JSON.stringify(monthDist, null, 2));
}

findThe1011();
