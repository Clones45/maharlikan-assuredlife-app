// scripts/fund_agent.js
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://agyueadcymdopgihtckc.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFneXVlYWRjeW1kb3BnaWh0Y2tjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzMzA2NjYsImV4cCI6MjA3NDkwNjY2Nn0.EBYfJ9RTkeGLQptG3uWaOsFMIz9DySu3uhaOlzgeeMw";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function main() {
    const agentId = 1;
    const newBalance = 6000;

    console.log(`Checking wallet for Agent ${agentId}...`);

    // 1. Check existing
    const { data: wallet, error: fetchError } = await supabase
        .from('agent_wallets')
        .select('*')
        .eq('agent_id', agentId)
        .single();

    if (fetchError) {
        console.error("Error fetching wallet:", fetchError.message);
        if (fetchError.code === 'PGRST116') {
            console.log("Wallet not found. Attempting to create one...");
            const { error: insertError } = await supabase
                .from('agent_wallets')
                .insert([{ agent_id: agentId, balance: newBalance, lifetime_commission: newBalance }]);

            if (insertError) {
                console.error("Insert failed:", insertError);
            } else {
                console.log("✅ Wallet created with balance:", newBalance);
            }
        }
        return;
    }

    console.log(`Current balance: ${wallet.balance}`);

    if (wallet.balance < 6000) {
        console.log(`Updating balance to ${newBalance}...`);
        const { error: updateError } = await supabase
            .from('agent_wallets')
            .update({ balance: newBalance })
            .eq('agent_id', agentId);

        if (updateError) {
            console.error("Update failed:", updateError);
        } else {
            console.log("✅ Wallet updated successfully to:", newBalance);
        }
    } else {
        console.log("✅ Balance is already sufficient (> 500). No update needed.");
    }
}

main();
