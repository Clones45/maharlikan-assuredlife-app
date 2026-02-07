
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://agyueadcymdopgihtckc.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFneXVlYWRjeW1kb3BnaWh0Y2tjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzMzA2NjYsImV4cCI6MjA3NDkwNjY2Nn0.EBYfJ9RTkeGLQptG3uWaOsFMIz9DySu3uhaOlzgeeMw";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkToday() {
    const today = "2026-01-07";
    console.log(`Checking collections for today: ${today}`);

    const { data: colls, error } = await supabase
        .from('collections')
        .select('agent_id, payment')
        .gte('date_paid', today);

    if (error) {
        console.error(error);
        return;
    }

    console.log(`Total collections today: ${colls.length}`);
    const summary = colls.reduce((acc, c) => {
        acc[c.agent_id] = (acc[c.agent_id] || 0) + Number(c.payment);
        return acc;
    }, {});
    console.log("Summary by Agent ID:");
    console.log(JSON.stringify(summary, null, 2));
}

checkToday();
