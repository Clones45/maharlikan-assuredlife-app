
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://agyueadcymdopgihtckc.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFneXVlYWRjeW1kb3BnaWh0Y2tjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzMzA2NjYsImV4cCI6MjA3NDkwNjY2Nn0.EBYfJ9RTkeGLQptG3uWaOsFMIz9DySu3uhaOlzgeeMw";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function patch310() {
    console.log("Patching Member 310 plan_start_date...");
    const { data: m } = await supabase.from('members').select('date_joined').eq('id', 310).single();
    if (m && m.date_joined) {
        const { error } = await supabase.from('members').update({ plan_start_date: m.date_joined }).eq('id', 310);
        if (error) console.error(error);
        else console.log("Success! Member 310 patched.");
    }
}

patch310();
