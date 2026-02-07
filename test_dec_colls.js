
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://agyueadcymdopgihtckc.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFneXVlYWRjeW1kb3BnaWh0Y2tjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzMzA2NjYsImV4cCI6MjA3NDkwNjY2Nn0.EBYfJ9RTkeGLQptG3uWaOsFMIz9DySu3uhaOlzgeeMw";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkCollections() {
    const start = "2025-12-07";
    const end = "2026-01-07";
    console.log(`Checking collections for Janace between ${start} and ${end}`);

    const { data: colls, error } = await supabase
        .from('collections')
        .select('*')
        .eq('agent_id', 6)
        .gte('date_paid', start)
        .lt('date_paid', end);

    if (error) {
        console.error(error);
        return;
    }

    console.log(`Total collections found: ${colls.length}`);
    const total = colls.reduce((s, c) => s + Number(c.payment), 0);
    console.log(`Total amount: ${total}`);

    if (colls.length > 0) {
        console.log("Sample collections:");
        console.log(JSON.stringify(colls.slice(0, 5), null, 2));
    }
}

checkCollections();
