
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://agyueadcymdopgihtckc.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFneXVlYWRjeW1kb3BnaWh0Y2tjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzMzA2NjYsImV4cCI6MjA3NDkwNjY2Nn0.EBYfJ9RTkeGLQptG3uWaOsFMIz9DySu3uhaOlzgeeMw";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testAsJanaceCollections() {
    console.log("Logging in as agent_janace@maharlikan.local...");
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: 'agent_janace@maharlikan.local',
        password: 'agent12345'
    });

    if (authError) {
        console.error("Auth failed:", authError.message);
        return;
    }

    console.log("Login successful!");

    const start = "2025-12-07";
    const end = "2026-01-07";

    console.log("Testing query on collections as Janace...");
    const { data: colls } = await supabase
        .from('collections')
        .select('id, payment')
        .eq('agent_id', 6)
        .gte('date_paid', start)
        .lt('date_paid', end);

    console.log(`Found ${colls?.length || 0} collections.`);

    console.log("Testing query on commissions as Janace...");
    const { data: comms } = await supabase
        .from('commissions')
        .select('id')
        .eq('agent_id', 6)
        .gte('date_earned', start)
        .lt('date_earned', end);

    console.log(`Found ${comms?.length || 0} commissions.`);
}

testAsJanaceCollections();
