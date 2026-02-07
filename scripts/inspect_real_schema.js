
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://agyueadcymdopgihtckc.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFneXVlYWRjeW1kb3BnaWh0Y2tjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzMzA2NjYsImV4cCI6MjA3NDkwNjY2Nn0.EBYfJ9RTkeGLQptG3uWaOsFMIz9DySu3uhaOlzgeeMw";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function inspect() {
    console.log("🔍 Inspecting REAL Database Schema...");

    // 1. List all public tables
    // Since we can't query information_schema easily via client without permissions (usually),
    // we will try to make a generic RPC call function if available, OR just infer from known tables.
    // Actually, supabase-js text search or just selecting 1 row is best.

    const tables = ['profiles', 'users', 'agents', 'members', 'agent_wallets'];

    for (const t of tables) {
        const { data, error } = await supabase.from(t).select('*').limit(1);
        if (error) {
            console.log(`\n❌ Table '${t}': Error/Not Found (${error.message})`);
        } else {
            console.log(`\n✅ Table '${t}' EXISTS.`);
            if (data.length > 0) {
                console.log(`   Columns: ${Object.keys(data[0]).join(', ')}`);
                console.log(`   Sample ID: ${data[0].id || data[0].agent_id}`);
            } else {
                console.log(`   (Table is empty)`);
            }
        }
    }

    // Check totals
    const { count: profileCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
    console.log(`\n📊 Profile Count: ${profileCount}`);

    // If 'profiles' has UUID and 'agent_wallets' has INT, we need the bridge.
    // Maybe 'agent_id' in agent_wallets IS the profile ID but cast to int? (Unlikely)
    // Or maybe there exists a `public.users` table with Int ID?
}

inspect();
