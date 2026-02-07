const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://agyueadcymdopgihtckc.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFneXVlYWRjeW1kb3BnaWh0Y2tjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzMzA2NjYsImV4cCI6MjA3NDkwNjY2Nn0.EBYfJ9RTkeGLQptG3uWaOsFMIz9DySu3uhaOlzgeeMw";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
    console.log("🔧 FIXING DECEMBER 2025 RECEIVABLES FOR AGENT 2...\n");

    const AGENT_ID = 2;

    // Check December 2025 rollup
    const { data: decRollup } = await supabase
        .from('agent_commission_rollups')
        .select('*')
        .eq('agent_id', AGENT_ID)
        .eq('period_year', 2025)
        .eq('period_month', 12)
        .single();

    console.log("📊 DECEMBER 2025 ROLLUP:");
    console.log(`   Status: ${decRollup?.status || 'NOT FOUND'}\n`);

    if (decRollup?.status === 'unreleased') {
        // Mark all December 2025 commissions as not receivable
        const { data: decComms, error: fetchError } = await supabase
            .from('commissions')
            .select('*')
            .eq('agent_id', AGENT_ID)
            .gte('date_earned', '2025-12-07')
            .lt('date_earned', '2026-01-07')
            .eq('is_receivable', true);

        if (fetchError) {
            console.error(`❌ Error fetching commissions: ${fetchError.message}`);
            return;
        }

        console.log(`📋 FOUND ${decComms?.length || 0} RECEIVABLE COMMISSIONS IN DEC 2025\n`);

        if (decComms && decComms.length > 0) {
            const amount = decComms.reduce((sum, c) => {
                const amt = c.commission_type === 'override' || c.commission_type === 'recruiter_bonus'
                    ? (c.override_commission > 0 ? c.override_commission : c.amount)
                    : c.amount;
                return sum + amt;
            }, 0);

            console.log(`   Total Amount: ₱${amount}`);
            console.log(`   Commission Types:`);

            const types = {};
            decComms.forEach(c => {
                if (!types[c.commission_type]) types[c.commission_type] = { count: 0, total: 0 };
                const amt = c.commission_type === 'override' || c.commission_type === 'recruiter_bonus'
                    ? (c.override_commission > 0 ? c.override_commission : c.amount)
                    : c.amount;
                types[c.commission_type].count++;
                types[c.commission_type].total += amt;
            });

            Object.keys(types).forEach(type => {
                console.log(`      - ${type}: ${types[type].count} (₱${types[type].total})`);
            });

            console.log("\n🔧 Marking as not receivable...");

            const { error: updateError } = await supabase
                .from('commissions')
                .update({ is_receivable: false })
                .eq('agent_id', AGENT_ID)
                .gte('date_earned', '2025-12-07')
                .lt('date_earned', '2026-01-07')
                .eq('is_receivable', true);

            if (updateError) {
                console.error(`   ❌ Error: ${updateError.message}`);
                return;
            }

            console.log(`   ✅ Marked ${decComms.length} commissions as not receivable\n`);

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

            const { error: walletError } = await supabase
                .from('agent_wallets')
                .update({
                    balance: totalReceivable,
                    updated_at: new Date().toISOString()
                })
                .eq('agent_id', AGENT_ID);

            if (walletError) {
                console.error(`   ❌ Error: ${walletError.message}`);
                return;
            }

            console.log(`   ✅ Updated wallet balance to ₱${totalReceivable}\n`);

            console.log("=".repeat(60));
            console.log("✅ FIX COMPLETE!");
            console.log("=".repeat(60));
            console.log(`Forfeited: ₱${amount}`);
            console.log(`New Balance: ₱${totalReceivable}`);
        } else {
            console.log("✅ No receivable commissions found in December 2025");
        }
    } else {
        console.log("⚠️  December 2025 is marked as 'released' - this should not happen!");
    }
}

main().catch(console.error);
