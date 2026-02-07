
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://agyueadcymdopgihtckc.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFneXVlYWRjeW1kb3BnaWh0Y2tjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzMzA2NjYsImV4cCI6MjA3NDkwNjY2Nn0.EBYfJ9RTkeGLQptG3uWaOsFMIz9DySu3uhaOlzgeeMw";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkRollups() {
    console.log("Checking agent_commission_rollups for Janace (ID 6)");
    const { data: rollups, error } = await supabase
        .from('agent_commission_rollups')
        .select('*')
        .eq('agent_id', 6);

    if (error) {
        console.error(error);
        return;
    }

    console.log(`Total rollups: ${rollups.length}`);
    console.log(JSON.stringify(rollups, null, 2));
}

checkRollups();
