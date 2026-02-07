const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://agyueadcymdopgihtckc.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFneXVlYWRjeW1kb3BnaWh0Y2tjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzMzA2NjYsImV4cCI6MjA3NDkwNjY2Nn0.EBYfJ9RTkeGLQptG3uWaOsFMIz9DySu3uhaOlzgeeMw";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
    console.log("🔧 FINAL FIX - DEC 2025 & JAN 2026 COMMISSIONS\n");
    console.log("=".repeat(60));

    const agents = [2, 5, 6, 13];

    for (const agentId of agents) {
        console.log(`\n🔧 AGENT ${agentId}:`);

        // Fix December 2025
        const { data: dec } = await supabase
            .from('commissions')
            .select('id')
            .eq('agent_id', agentId)
            .gte('date_earned', '2025-12-07')
            .lt('date_earned', '2026-01-07')
            .eq('is_receivable', true);

        if (dec && dec.length > 0) {
            const { error } = await supabase
                .from('commissions')
                .update({ is_receivable: false })
                .in('id', dec.map(c => c.id));

            if (!error) {
                console.log(`   ✅ Dec 2025: Marked ${dec.length} commissions as not receivable`);
            } else {
                console.log(`   ❌ Dec 2025: ${error.message}`);
            }
        } else {
            console.log(`   ✅ Dec 2025: No receivable commissions`);
        }

        // Fix January 2026
        const { data: jan } = await supabase
            .from('commissions')
            .select('id')
            .eq('agent_id', agentId)
            .gte('date_earned', '2026-01-07')
            .lt('date_earned', '2026-02-07')
            .eq('is_receivable', true);

        if (jan && jan.length > 0) {
            const { error } = await supabase
                .from('commissions')
                .update({ is_receivable: false })
                .in('id', jan.map(c => c.id));

            if (!error) {
                console.log(`   ✅ Jan 2026: Marked ${jan.length} commissions as not receivable`);
            } else {
                console.log(`   ❌ Jan 2026: ${error.message}`);
            }
        } else {
            console.log(`   ✅ Jan 2026: No receivable commissions`);
        }
    }

    console.log("\n" + "=".repeat(60));
    console.log("💰 RECALCULATING WALLETS...\n");

    for (const agentId of agents) {
        const { data: receivable } = await supabase
            .from('commissions')
            .select('*')
            .eq('agent_id', agentId)
            .eq('is_receivable', true);

        const total = receivable?.reduce((sum, c) => {
            const amt = c.commission_type === 'override' || c.commission_type === 'recruiter_bonus'
                ? (c.override_commission > 0 ? c.override_commission : c.amount)
                : c.amount;
            return sum + amt;
        }, 0) || 0;

        const { error } = await supabase
            .from('agent_wallets')
            .update({ balance: total })
            .eq('agent_id', agentId);

        if (!error) {
            console.log(`   Agent ${agentId}: ₱${total}`);
        }
    }

    console.log("\n" + "=".repeat(60));
    console.log("✅ FINAL FIX COMPLETE!");
    console.log("=".repeat(60));
}

main().catch(console.error);
