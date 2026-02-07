const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://agyueadcymdopgihtckc.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFneXVlYWRjeW1kb3BnaWh0Y2tjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzMzA2NjYsImV4cCI6MjA3NDkwNjY2Nn0.EBYfJ9RTkeGLQptG3uWaOsFMIz9DySu3uhaOlzgeeMw";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
    console.log("🔄 REVERTING AGENT 2 INCORRECT AGR RELEASE...\n");

    const AGENT_ID = 2;

    // Step 1: Get current wallet state
    console.log("📊 STEP 1: Getting current wallet state...");
    const { data: walletBefore } = await supabase
        .from('agent_wallets')
        .select('*')
        .eq('agent_id', AGENT_ID)
        .single();

    console.log(`   Current Balance: ₱${walletBefore?.balance || 0}`);
    console.log(`   Current Lifetime Commission: ₱${walletBefore?.lifetime_commission || 0}\n`);

    // Step 2: Get all incorrectly released commissions from December 2025 period
    console.log("📊 STEP 2: Finding incorrectly released commissions (Dec 2025)...");
    const { data: decComms } = await supabase
        .from('commissions')
        .select('*')
        .eq('agent_id', AGENT_ID)
        .gte('date_earned', '2025-12-07')
        .lt('date_earned', '2026-01-07')
        .eq('is_receivable', true);

    const decTotal = decComms?.reduce((sum, c) => {
        if (c.commission_type === 'override' || c.commission_type === 'recruiter_bonus') {
            return sum + (c.override_commission > 0 ? c.override_commission : c.amount);
        }
        return sum + c.amount;
    }, 0) || 0;

    console.log(`   Found ${decComms?.length || 0} incorrectly released commissions`);
    console.log(`   Total amount to revert (Dec 2025): ₱${decTotal}\n`);

    // Step 3: Get all incorrectly released commissions from January 2026 period
    console.log("📊 STEP 3: Finding incorrectly released commissions (Jan 2026)...");
    const { data: janComms } = await supabase
        .from('commissions')
        .select('*')
        .eq('agent_id', AGENT_ID)
        .gte('date_earned', '2026-01-07')
        .lt('date_earned', '2026-02-07')
        .eq('is_receivable', true);

    const janTotal = janComms?.reduce((sum, c) => {
        if (c.commission_type === 'override' || c.commission_type === 'recruiter_bonus') {
            return sum + (c.override_commission > 0 ? c.override_commission : c.amount);
        }
        return sum + c.amount;
    }, 0) || 0;

    console.log(`   Found ${janComms?.length || 0} incorrectly released commissions`);
    console.log(`   Total amount to revert (Jan 2026): ₱${janTotal}\n`);

    const totalToRevert = decTotal + janTotal;
    console.log(`💰 TOTAL AMOUNT TO REVERT: ₱${totalToRevert}\n`);

    // Step 4: Confirm before proceeding
    console.log("⚠️  CONFIRMATION:");
    console.log(`   This will revert ₱${totalToRevert} from Agent 2's wallet.`);
    console.log(`   New balance will be: ₱${(walletBefore?.balance || 0) - totalToRevert}`);
    console.log(`   New lifetime commission will be: ₱${(walletBefore?.lifetime_commission || 0) - totalToRevert}\n`);

    // Proceed with reversion
    console.log("🔧 STEP 4: Reverting changes...\n");

    // 4a. Mark December 2025 rollup as unreleased
    console.log("   4a. Updating December 2025 rollup to 'unreleased'...");
    const { error: rollupError } = await supabase
        .from('agent_commission_rollups')
        .update({ status: 'unreleased' })
        .eq('agent_id', AGENT_ID)
        .eq('period_year', 2025)
        .eq('period_month', 12);

    if (rollupError) {
        console.error(`   ❌ Error updating rollup: ${rollupError.message}`);
        return;
    }
    console.log("   ✅ December 2025 rollup updated to 'unreleased'\n");

    // 4b. Mark December 2025 commissions as not receivable
    if (decComms && decComms.length > 0) {
        console.log(`   4b. Marking ${decComms.length} December 2025 commissions as not receivable...`);
        const { error: decCommError } = await supabase
            .from('commissions')
            .update({ is_receivable: false })
            .eq('agent_id', AGENT_ID)
            .gte('date_earned', '2025-12-07')
            .lt('date_earned', '2026-01-07')
            .eq('is_receivable', true);

        if (decCommError) {
            console.error(`   ❌ Error updating Dec commissions: ${decCommError.message}`);
            return;
        }
        console.log("   ✅ December 2025 commissions marked as not receivable\n");
    }

    // 4c. Mark January 2026 commissions as not receivable
    if (janComms && janComms.length > 0) {
        console.log(`   4c. Marking ${janComms.length} January 2026 commissions as not receivable...`);
        const { error: janCommError } = await supabase
            .from('commissions')
            .update({ is_receivable: false })
            .eq('agent_id', AGENT_ID)
            .gte('date_earned', '2026-01-07')
            .lt('date_earned', '2026-02-07')
            .eq('is_receivable', true);

        if (janCommError) {
            console.error(`   ❌ Error updating Jan commissions: ${janCommError.message}`);
            return;
        }
        console.log("   ✅ January 2026 commissions marked as not receivable\n");
    }

    // 4d. Update wallet balance
    console.log("   4d. Updating wallet balance...");
    const newBalance = (walletBefore?.balance || 0) - totalToRevert;
    const newLifetime = (walletBefore?.lifetime_commission || 0) - totalToRevert;

    const { error: walletError } = await supabase
        .from('agent_wallets')
        .update({
            balance: newBalance,
            lifetime_commission: newLifetime,
            updated_at: new Date().toISOString()
        })
        .eq('agent_id', AGENT_ID);

    if (walletError) {
        console.error(`   ❌ Error updating wallet: ${walletError.message}`);
        return;
    }
    console.log("   ✅ Wallet balance updated\n");

    // Step 5: Verify changes
    console.log("✅ STEP 5: Verifying changes...\n");

    const { data: walletAfter } = await supabase
        .from('agent_wallets')
        .select('*')
        .eq('agent_id', AGENT_ID)
        .single();

    const { data: decRollup } = await supabase
        .from('agent_commission_rollups')
        .select('*')
        .eq('agent_id', AGENT_ID)
        .eq('period_year', 2025)
        .eq('period_month', 12)
        .single();

    const { data: receivableCheck } = await supabase
        .from('commissions')
        .select('id')
        .eq('agent_id', AGENT_ID)
        .gte('date_earned', '2025-12-07')
        .lt('date_earned', '2026-02-07')
        .eq('is_receivable', true);

    console.log("📊 VERIFICATION RESULTS:");
    console.log(`   December 2025 Rollup Status: ${decRollup?.status || 'NOT FOUND'}`);
    console.log(`   Receivable Commissions (Dec 2025 - Jan 2026): ${receivableCheck?.length || 0}`);
    console.log(`   Wallet Balance: ₱${walletBefore?.balance || 0} → ₱${walletAfter?.balance || 0}`);
    console.log(`   Lifetime Commission: ₱${walletBefore?.lifetime_commission || 0} → ₱${walletAfter?.lifetime_commission || 0}\n`);

    console.log("=".repeat(60));
    console.log("✅ REVERSION COMPLETE!");
    console.log("=".repeat(60));
    console.log(`Agent 2's incorrect AGR release has been reverted.`);
    console.log(`Amount reverted: ₱${totalToRevert}`);
    console.log(`New withdrawable balance: ₱${walletAfter?.balance || 0}`);
}

main().catch(console.error);
