
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://agyueadcymdopgihtckc.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFneXVlYWRjeW1kb3BnaWh0Y2tjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzMzA2NjYsImV4cCI6MjA3NDkwNjY2Nn0.EBYfJ9RTkeGLQptG3uWaOsFMIz9DySu3uhaOlzgeeMw";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function findJanaceEmail() {
    console.log("Checking profiles for Agent ID 6...");
    const { data: profile, error } = await supabase
        .from('users_profile')
        .select('*')
        .eq('agent_id', 6)
        .maybeSingle();

    if (error) {
        console.error(error);
        return;
    }

    if (profile) {
        console.log("Found profile:");
        console.log(JSON.stringify(profile, null, 2));
    } else {
        console.log("No profile found for Agent ID 6");
    }
}

findJanaceEmail();
