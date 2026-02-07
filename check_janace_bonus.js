
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://agyueadcymdopgihtckc.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFneXVlYWRjeW1kb3BnaWh0Y2tjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzMzA2NjYsImV4cCI6MjA3NDkwNjY2Nn0.EBYfJ9RTkeGLQptG3uWaOsFMIz9DySu3uhaOlzgeeMw";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkBonus() {
    console.log("Checking recruiter_bonus for Janace");
    const { data: comms, error } = await supabase
        .from('commissions')
        .select('*')
        .eq('agent_id', 6)
        .eq('commission_type', 'recruiter_bonus');

    if (error) {
        console.error(error);
        return;
    }

    console.log(`Total recruiter bonuses: ${comms.length}`);
    comms.forEach(c => {
        console.log(`${c.date_earned} | ${c.amount} | period: ${c.period_month}/${c.period_year} | month: ${c.month}`);
    });
}

checkBonus();
