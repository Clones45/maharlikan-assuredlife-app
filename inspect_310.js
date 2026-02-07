
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://agyueadcymdopgihtckc.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFneXVlYWRjeW1kb3BnaWh0Y2tjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzMzA2NjYsImV4cCI6MjA3NDkwNjY2Nn0.EBYfJ9RTkeGLQptG3uWaOsFMIz9DySu3uhaOlzgeeMw";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function inspect310() {
    const { data: m, error } = await supabase.from('members').select('id, plan_start_date, date_joined, monthly_due').eq('id', 310).single();
    if (error) {
        console.error(error);
        return;
    }
    console.log("Member 310 Metadata:");
    console.log(JSON.stringify(m, null, 2));

    const { data: colls } = await supabase.from('collections').select('id, payment, is_membership_fee').eq('member_id', 310);
    console.log("\nCollections for 310:");
    console.log(JSON.stringify(colls, null, 2));

    // Try to run the logic manually
    const now = new Date();
    const start = new Date(m.plan_start_date);
    const monthsSinceStart = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());

    const paidRegular = colls.filter(c => c.is_membership_fee !== true).reduce((s, c) => s + Number(c.payment), 0);
    const monthsPaid = paidRegular / m.monthly_due;
    const monthsBehind = monthsSinceStart - monthsPaid;

    console.log(`\nManual Calculation:`);
    console.log(`Months Since Start: ${monthsSinceStart}`);
    console.log(`Months Paid: ${monthsPaid}`);
    console.log(`Months Behind: ${monthsBehind}`);

    // Run the SQL logic directly
    const { data: sqlRes, error: sqlErr } = await supabase.rpc('get_active_members');
    console.log(`\nActive Members Count: ${sqlRes ? sqlRes.length : 0}`);
}

inspect310();
