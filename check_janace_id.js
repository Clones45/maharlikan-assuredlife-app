
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://agyueadcymdopgihtckc.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFneXVlYWRjeW1kb3BnaWh0Y2tjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzMzA2NjYsImV4cCI6MjA3NDkwNjY2Nn0.EBYfJ9RTkeGLQptG3uWaOsFMIz9DySu3uhaOlzgeeMw";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkJanaceProfile() {
    console.log("Checking users_profile for JANACE");
    const { data: profiles, error } = await supabase
        .from('users_profile')
        .select('*')
        .ilike('firstname', '%JANACE%');

    if (error) {
        console.error(error);
        return;
    }

    console.log(JSON.stringify(profiles, null, 2));

    if (profiles.length > 0) {
        const agentId = profiles[0].agent_id;
        console.log(`Found Agent ID: ${agentId}`);

        const { data: agent } = await supabase.from('agents').select('*').eq('id', agentId).single();
        console.log("Agent Record:");
        console.log(JSON.stringify(agent, null, 2));
    }
}

checkJanaceProfile();
