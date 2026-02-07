const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://agyueadcymdopgihtckc.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFneXVlYWRjeW1kb3BnaWh0Y2tjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzMzA2NjYsImV4cCI6MjA3NDkwNjY2Nn0.EBYfJ9RTkeGLQptG3uWaOsFMIz9DySu3uhaOlzgeeMw";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

async function main() {
    console.log("🔧 FORCE FIX - MARKING AGENT 2 COMMISSIONS AS NON-RECEIVABLE\n");

    const AGENT_ID = 2;

    // Get all receivable commissions from Dec 2025 and Jan 2026
    const { data: toFix } = await supabase
        .from('commissions')
        .select('id, date_earned, commission_type, amount')
        .eq('agent_id', AGENT_ID)
        .eq('is_receivable', true)
        .gte('date_earned', '2025-12-07')
        .lt('date_earned', '2026-02-07');

    console.log(`📋 Found ${toFix?.length || 0} commissions to fix\n`);

    if (!toFix || toFix.length === 0) {
        console.log("✅ No commissions to fix!");
        return;
    }

    // Update in batches
    const batchSize = 50;
    let updated = 0;

    for (let i = 0; i < toFix.length; i += batchSize) {
        const batch = toFix.slice(i, i + batchSize);
        const ids = batch.map(c => c.id);

        console.log(`🔧 Updating batch ${Math.floor(i / batchSize) + 1} (${ids.length} commissions)...`);

        const { error } = await supabase
            .from('commissions')
            .update({ is_receivable: false })
            .in('id', ids);

        if (error) {
            console.error(`   ❌ Error: ${error.message}`);
        } else {
            updated += ids.length;
            console.log(`   ✅ Updated ${ids.length} commissions`);
        }
    }

    console.log(`\n✅ Total updated: ${updated} commissions\n`);

    // Recalculate wallet balance
    console.log("💰 RECALCULATING WALLET BALANCE...");

    const { data: allReceivable } = await supabase
        .from('commissions')
        .select('*')
        .eq('agent_id', AGENT_ID)
        .eq('is_receivable', true);

    const totalReceivable = allReceivable?.reduce((sum, c) => {
        const amt = c.commission_type === 'override' || c.commission_type === 'recruiter_bonus'
            ? (c.override_commission > 0 ? c.override_commission : c.amount)
            : c.amount;
        return sum + amt;
    }, 0) || 0;

    console.log(`   Total Receivable: ₱${totalReceivable}`);

    const { error: walletError } = await supabase
        .from('agent_wallets')
        .update({
            balance: totalReceivable,
            updated_at: new Date().toISOString()
        })
        .eq('agent_id', AGENT_ID);

    if (walletError) {
        console.error(`   ❌ Error: ${walletError.message}`);
    } else {
        console.log(`   ✅ Updated wallet balance to ₱${totalReceivable}\n`);
    }

    // Verify
    const { data: verify } = await supabase
        .from('commissions')
        .select('id')
        .eq('agent_id', AGENT_ID)
        .eq('is_receivable', true)
        .gte('date_earned', '2025-12-07')
        .lt('date_earned', '2026-02-07');

    console.log("=".repeat(60));
    console.log("✅ FIX COMPLETE!");
    console.log("=".repeat(60));
    console.log(`Commissions updated: ${updated}`);
    console.log(`New wallet balance: ₱${totalReceivable}`);
    console.log(`Remaining receivables in Dec 2025 - Jan 2026: ${verify?.length || 0}`);
}

main().catch(console.error);
