
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://agyueadcymdopgihtckc.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFneXVlYWRjeW1kb3BnaWh0Y2tjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzMzA2NjYsImV4cCI6MjA3NDkwNjY2Nn0.EBYfJ9RTkeGLQptG3uWaOsFMIz9DySu3uhaOlzgeeMw";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkAllComms() {
    const start = "2025-12-07";
    const end = "2026-01-07";

    const { data: comms, error } = await supabase
        .from('commissions')
        .select('status, is_receivable, agent_id')
        .eq('agent_id', 6)
        .gte('date_earned', start)
        .lt('date_earned', end);

    if (error) {
        console.error(error);
        return;
    }

    const rec = {};
    comms.forEach(c => {
        rec[c.is_receivable] = (rec[c.is_receivable] || 0) + 1;
    });

    console.log("is_receivable distribution for Agent 6 commissions:");
    console.log(JSON.stringify(rec, null, 2));
}

checkAllComms();
