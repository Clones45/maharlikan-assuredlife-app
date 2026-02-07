
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://agyueadcymdopgihtckc.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFneXVlYWRjeW1kb3BnaWh0Y2tjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzMzA2NjYsImV4cCI6MjA3NDkwNjY2Nn0.EBYfJ9RTkeGLQptG3uWaOsFMIz9DySu3uhaOlzgeeMw";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkIds() {
    console.log("Checking commissions for Janace with month='2025-12-01'");
    const { data: comms, error } = await supabase
        .from('commissions')
        .select('id, amount, commission_type, collection_id, date_earned')
        .eq('agent_id', 6)
        .eq('month', '2025-12-01');

    if (error) { console.error(error); return; }

    comms.forEach(c => {
        console.log(`Comm ID: ${c.id} | Amt: ${c.amount} | Type: ${c.commission_type} | Coll ID: ${c.collection_id} | Earned: ${c.date_earned}`);
    });
}

checkIds();
