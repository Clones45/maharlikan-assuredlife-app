const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://agyueadcymdopgihtckc.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFneXVlYWRjeW1kb3BnaWh0Y2tjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzMzA2NjYsImV4cCI6MjA3NDkwNjY2Nn0.EBYfJ9RTkeGLQptG3uWaOsFMIz9DySu3uhaOlzgeeMw";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
    console.log("🔧 FIXING AGENT 2 WALLET BALANCE...\n");

    const AGENT_ID = 2;

    // Get current wallet
    const { data: walletBefore } = await supabase
        .from('agent_wallets')
        .select('*')
        .eq('agent_id', AGENT_ID)
        .single();

    console.log("💰 CURRENT WALLET STATE:");
    console.log(`   Balance: ₱${walletBefore?.balance || 0}`);
    console.log(`   Lifetime Commission: ₱${walletBefore?.lifetime_commission || 0}\n`);

    // Get all receivable commissions
    const { data: receivableComms } = await supabase
        .from('commissions')
        .select('*')
        .eq('agent_id', AGENT_ID)
        .eq('is_receivable', true);

    const totalReceivable = receivableComms?.reduce((sum, c) => {
        if (c.commission_type === 'override' || c.commission_type === 'recruiter_bonus') {
            return sum + (c.override_commission > 0 ? c.override_commission : c.amount);
        }
        return sum + c.amount;
    }, 0) || 0;

    console.log("✅ RECEIVABLE COMMISSIONS:");
    console.log(`   Count: ${receivableComms?.length || 0}`);
    console.log(`   Total: ₱${totalReceivable}\n`);

    // Check for withdrawals
    const { data: withdrawals } = await supabase
        .from('agent_withdrawals')
        .select('*')
        .eq('agent_id', AGENT_ID);

    const totalWithdrawn = withdrawals?.reduce((sum, w) => sum + (w.amount || 0), 0) || 0;

    console.log("💸 WITHDRAWALS:");
    console.log(`   Count: ${withdrawals?.length || 0}`);
    console.log(`   Total: ₱${totalWithdrawn}\n`);

    // Calculate correct balance
    const correctBalance = totalReceivable - totalWithdrawn;

    console.log("🎯 BALANCE CALCULATION:");
    console.log(`   Total Receivable: ₱${totalReceivable}`);
    console.log(`   Total Withdrawn: ₱${totalWithdrawn}`);
    console.log(`   Correct Balance: ₱${correctBalance}`);
    console.log(`   Current Balance: ₱${walletBefore?.balance || 0}`);
    console.log(`   Adjustment Needed: ₱${correctBalance - (walletBefore?.balance || 0)}\n`);

    // Update wallet to correct balance
    console.log("🔧 UPDATING WALLET...");
    const { error: walletError } = await supabase
        .from('agent_wallets')
        .update({
            balance: correctBalance,
            updated_at: new Date().toISOString()
        })
        .eq('agent_id', AGENT_ID);

    if (walletError) {
        console.error(`   ❌ Error: ${walletError.message}`);
        return;
    }
    console.log("   ✅ Wallet updated\n");

    // Verify
    const { data: walletAfter } = await supabase
        .from('agent_wallets')
        .select('*')
        .eq('agent_id', AGENT_ID)
        .single();

    console.log("=".repeat(60));
    console.log("✅ FIX COMPLETE!");
    console.log("=".repeat(60));
    console.log(`Balance: ₱${walletBefore?.balance || 0} → ₱${walletAfter?.balance || 0}`);
    console.log(`Lifetime Commission: ₱${walletAfter?.lifetime_commission || 0}`);
    console.log("");
    console.log("📊 BREAKDOWN:");
    console.log(`   Receivable Commissions: ₱${totalReceivable}`);
    console.log(`   Withdrawals: ₱${totalWithdrawn}`);
    console.log(`   Net Balance: ₱${walletAfter?.balance || 0}`);
}

main().catch(console.error);
