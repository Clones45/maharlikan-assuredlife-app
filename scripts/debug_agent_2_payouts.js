
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://agyueadcymdopgihtckc.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFneXVlYWRjeW1kb3BnaWh0Y2tjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzMzA2NjYsImV4cCI6MjA3NDkwNjY2Nn0.EBYfJ9RTkeGLQptG3uWaOsFMIz9DySu3uhaOlzgeeMw";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function check_payouts() {
    console.log("💸 Checking Payouts for Agent 2...");
    const agentId = 2;

    const { data: payouts, error } = await supabase.from('payouts').select('*').eq('agent_id', agentId);

    if (error) {
        console.log("Error:", error.message);
        return;
    }

    let totalPayout = 0;
    if (payouts.length > 0) {
        console.log(`   Found ${payouts.length} payouts.`);
        payouts.forEach(p => {
            console.log(`   - ID ${p.id}: Amt ${p.amount}, Status ${p.status}, Date ${p.created_at}`);
            totalPayout += Number(p.amount);
        });
    } else {
        console.log("   No payouts found.");
    }

    console.log(`   Total Payouts: ${totalPayout}`);
}

check_payouts();
