
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://agyueadcymdopgihtckc.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFneXVlYWRjeW1kb3BnaWh0Y2tjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzMzA2NjYsImV4cCI6MjA3NDkwNjY2Nn0.EBYfJ9RTkeGLQptG3uWaOsFMIz9DySu3uhaOlzgeeMw";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
    const agentId = 6;
    const amountToRevert = 209.00;

    console.log(`UNDO Tranasction: Deducting ₱${amountToRevert} from Agent ${agentId}...`);

    // 1. Get current balance
    const { data: wallet } = await supabase.from('agent_wallets').select('balance').eq('agent_id', agentId).single();
    if (!wallet) { console.error("Wallet not found"); return; }

    const newBal = Number(wallet.balance) - amountToRevert;

    // 2. Update Wallet
    const { error: wErr } = await supabase
        .from('agent_wallets')
        .update({ balance: newBal })
        .eq('agent_id', agentId);

    if (wErr) { console.error("Wallet update failed:", wErr); return; }
    console.log(`✅ Wallet balance reverted to ₱${newBal}`);

    // 3. Reset DEC 2025 Rollup to 'unreleased'
    const { error: rErr } = await supabase
        .from('agent_commission_rollups')
        .update({ status: 'unreleased' })
        .eq('agent_id', agentId)
        .eq('period_year', 2025)
        .eq('period_month', 12);

    if (rErr) { console.error("Rollup reset failed:", rErr); return; }
    console.log("✅ Dec 2025 Rollup reset to 'unreleased'.");
}

main();
