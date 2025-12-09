// scripts/verify_withdrawal.js
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://agyueadcymdopgihtckc.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFneXVlYWRjeW1kb3BnaWh0Y2tjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzMzA2NjYsImV4cCI6MjA3NDkwNjY2Nn0.EBYfJ9RTkeGLQptG3uWaOsFMIz9DySu3uhaOlzgeeMw";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function main() {
    const agentId = 1;
    console.log(`Verifying effects for Agent ${agentId}...`);

    // 1. Check Wallet Balance
    const { data: wallet } = await supabase
        .from('agent_wallets')
        .select('balance')
        .eq('agent_id', agentId)
        .single();

    if (wallet) {
        console.log(`Current Wallet Balance: ${wallet.balance}`);
        if (wallet.balance < 5000) {
            console.log("✅ Balance was deducted! (Started at 5000)");
        } else {
            console.log("⚠️ Balance unchanged at 5000. Withdrawal might not have processed.");
        }
    } else {
        console.log("❌ Could not read wallet.");
    }

    // 2. Try querying 'withdrawal_requests' again
    const { data, error } = await supabase
        .from('withdrawal_requests')
        .select('*')
        .eq('agent_id', agentId); // removed limit to just see any

    if (data && data.length > 0) {
        console.log(`Found ${data.length} withdrawal requests.`);
        console.log(JSON.stringify(data[0], null, 2));
    } else {
        console.log("❌ Still no withdrawal_requests found directly (could be RLS).");
    }
}

main();
