
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://agyueadcymdopgihtckc.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFneXVlYWRjeW1kb3BnaWh0Y2tjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzMzA2NjYsImV4cCI6MjA3NDkwNjY2Nn0.EBYfJ9RTkeGLQptG3uWaOsFMIz9DySu3uhaOlzgeeMw";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function check_withdrawals() {
    console.log("💳 Checking Actual Withdrawals...");
    const agents = [1, 2, 5, 6];

    for (const agentId of agents) {
        // 1. Withdrawal Requests
        const { data: wreqs } = await supabase.from('withdrawal_requests')
            .select('amount, status')
            .eq('agent_id', agentId)
            .neq('status', 'rejected') // Assuming rejected doesn't count
            .neq('status', 'cancelled');

        let totalW = 0;
        wreqs.forEach(w => totalW += Number(w.amount));

        // 2. Payouts (if separate)
        const { data: payouts } = await supabase.from('payouts')
            .select('amount')
            .eq('agent_id', agentId);

        let totalP = 0;
        payouts.forEach(p => totalP += Number(p.amount));

        console.log(`\n👤 Agent ${agentId}:`);
        console.log(`   Withdrawal Requests: ${totalW} (${wreqs.length} items)`);
        console.log(`   Payouts: ${totalP} (${payouts.length} items)`);

        // Check current wallet
        const { data: wallet } = await supabase.from('agent_wallets').select('*').eq('agent_id', agentId).single();
        console.log(`   Current Wallet: Balance=${wallet.balance}, Lifetime=${wallet.lifetime_commission}`);

        // If Withdrawals are 0 and Balance is Negative, it's definitely wrong.
        if (totalW === 0 && totalP === 0 && wallet.balance < 0) {
            console.log("   ❌ ERROR: Negative Balance but NO Withdrawals!");
        }
    }
}

check_withdrawals();
