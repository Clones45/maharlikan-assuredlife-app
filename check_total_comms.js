
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://agyueadcymdopgihtckc.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFneXVlYWRjeW1kb3BnaWh0Y2tjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzMzA2NjYsImV4cCI6MjA3NDkwNjY2Nn0.EBYfJ9RTkeGLQptG3uWaOsFMIz9DySu3uhaOlzgeeMw";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkTotal() {
    const { count, error } = await supabase
        .from('commissions')
        .select('*', { count: 'exact', head: true })
        .eq('month', '2025-12-01');

    if (error) { console.error(error); return; }
    console.log(`Total commissions for month='2025-12-01': ${count}`);

    const { count: janCount } = await supabase
        .from('commissions')
        .select('*', { count: 'exact', head: true })
        .eq('month', '2026-01-01');
    console.log(`Total commissions for month='2026-01-01': ${janCount}`);
}

checkTotal();
