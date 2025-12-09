// scripts/check_tables.js
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://agyueadcymdopgihtckc.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFneXVlYWRjeW1kb3BnaWh0Y2tjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzMzA2NjYsImV4cCI6MjA3NDkwNjY2Nn0.EBYfJ9RTkeGLQptG3uWaOsFMIz9DySu3uhaOlzgeeMw";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function main() {
    console.log("Checking for 'withdrawal_transaction' table...");
    const { data: d1, error: e1 } = await supabase.from('withdrawal_transaction').select('*').limit(1);
    if (e1) {
        console.log("❌ 'withdrawal_transaction' error:", e1.message);
    } else {
        console.log("✅ 'withdrawal_transaction' exists!");
    }

    console.log("Checking for 'withdrawal_requests' table...");
    const { data: d2, error: e2 } = await supabase.from('withdrawal_requests').select('*').limit(1);
    if (e2) {
        console.log("❌ 'withdrawal_requests' error:", e2.message);
    } else {
        console.log("✅ 'withdrawal_requests' exists!");
    }
}

main();
