
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://agyueadcymdopgihtckc.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFneXVlYWRjeW1kb3BnaWh0Y2tjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzMzA2NjYsImV4cCI6MjA3NDkwNjY2Nn0.EBYfJ9RTkeGLQptG3uWaOsFMIz9DySu3uhaOlzgeeMw";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
    console.log("🔍 Checking Middle Names for Agent 4...");

    const startDate = '2026-01-07';
    const endDate = '2026-02-07';

    const { data: collections, error } = await supabase
        .from('collections')
        .select(`
            id,
            payment_for,
            members (
                first_name,
                last_name,
                middle_name
            )
        `)
        .eq('agent_id', 4)
        .gte('date_paid', startDate)
        .lt('date_paid', endDate);

    if (error) { console.error(error); return; }

    collections.forEach(c => {
        const m = Array.isArray(c.members) ? c.members[0] : c.members;
        if (m) {
            console.log(`- ${m.first_name} ${m.middle_name ? `"${m.middle_name}" ` : "(No MN) "}${m.last_name} [${c.payment_for}]`);
        }
    });
}

main();
