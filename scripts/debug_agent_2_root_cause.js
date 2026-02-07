const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://agyueadcymdopgihtckc.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFneXVlYWRjeW1kb3BnaWh0Y2tjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzMzA2NjYsImV4cCI6MjA3NDkwNjY2Nn0.EBYfJ9RTkeGLQptG3uWaOsFMIz9DySu3uhaOlzgeeMw";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
    console.log("🔍 INVESTIGATING WHY AGENT 2 WAS INCORRECTLY RELEASED...\n");

    // Check if there's a January 2026 rollup marked as 'released'
    const { data: janRollup } = await supabase
        .from('agent_commission_rollups')
        .select('*')
        .eq('agent_id', 2)
        .eq('period_year', 2026)
        .eq('period_month', 1)
        .maybeSingle();

    console.log("📊 JANUARY 2026 ROLLUP STATUS:");
    if (janRollup) {
        console.log(`   Status: ${janRollup.status}`);
        console.log(`   Created At: ${janRollup.created_at}`);
        console.log(`   Updated At: ${janRollup.updated_at || 'N/A'}`);
    } else {
        console.log("   ❌ No rollup found for January 2026");
    }
    console.log("");

    // Check wallet transaction history
    const { data: wallet } = await supabase
        .from('agent_wallets')
        .select('*')
        .eq('agent_id', 2)
        .single();

    console.log("💰 WALLET DETAILS:");
    console.log(`   Balance: ₱${wallet?.balance || 0}`);
    console.log(`   Lifetime Commission: ₱${wallet?.lifetime_commission || 0}`);
    console.log(`   Updated At: ${wallet?.updated_at}`);
    console.log("");

    // Check if commissions were marked as receivable
    const { data: receivableComms } = await supabase
        .from('commissions')
        .select('*')
        .eq('agent_id', 2)
        .gte('date_earned', '2026-01-07')
        .lt('date_earned', '2026-02-07')
        .eq('is_receivable', true)
        .order('date_earned');

    console.log("✅ COMMISSIONS MARKED AS RECEIVABLE (Jan 2026):");
    console.log(`   Count: ${receivableComms?.length || 0}`);

    const receivableTotal = receivableComms?.reduce((sum, c) => {
        if (c.commission_type === 'override' || c.commission_type === 'recruiter_bonus') {
            return sum + (c.override_commission > 0 ? c.override_commission : c.amount);
        }
        return sum + c.amount;
    }, 0) || 0;

    console.log(`   Total: ₱${receivableTotal}`);
    console.log("");

    // Check if there are any collections from OTHER months that might have triggered this
    const { data: allCollections } = await supabase
        .from('collections')
        .select(`
            id,
            date_paid,
            is_membership_fee,
            payment_for,
            members (
                first_name,
                last_name
            )
        `)
        .eq('agent_id', 2)
        .order('date_paid', { ascending: false })
        .limit(100);

    // Group by period
    const periods = {};
    allCollections?.forEach(c => {
        const datePaid = new Date(c.date_paid);
        let year = datePaid.getFullYear();
        let month = datePaid.getMonth() + 1;

        // Apply commission period logic
        if (datePaid.getDate() < 7) {
            month -= 1;
            if (month === 0) {
                month = 12;
                year -= 1;
            }
        }

        const key = `${year}-${String(month).padStart(2, '0')}`;
        if (!periods[key]) periods[key] = { mem: 0, reg: 0, collections: [] };

        if (c.is_membership_fee) {
            periods[key].mem++;
        } else if (c.payment_for === 'regular') {
            periods[key].reg++;
        }
        periods[key].collections.push(c);
    });

    console.log("📅 COLLECTION SUMMARY BY PERIOD:");
    Object.keys(periods).sort().reverse().slice(0, 6).forEach(period => {
        const p = periods[period];
        const passes = p.mem >= 3 ? '✅' : '❌';
        console.log(`   ${period}: ${p.mem} MEM, ${p.reg} REG ${passes}`);
    });
    console.log("");

    // Check if backfill was run
    console.log("🔄 POSSIBLE ROOT CAUSES:");
    console.log("   1. Backfill function ran and incorrectly evaluated AGR criteria");
    console.log("   2. Trigger fired on a collection that shouldn't have passed AGR");
    console.log("   3. Manual release was performed");
    console.log("   4. Commission trigger auto-released based on existing 'released' status");
    console.log("");

    // Check if there are any membership fees at all
    const { data: allMemFees } = await supabase
        .from('collections')
        .select('id, date_paid')
        .eq('agent_id', 2)
        .eq('is_membership_fee', true)
        .order('date_paid', { ascending: false });

    console.log("🎫 ALL MEMBERSHIP FEES FOR AGENT 2:");
    if (allMemFees && allMemFees.length > 0) {
        console.log(`   Total: ${allMemFees.length}`);
        allMemFees.slice(0, 10).forEach(m => {
            console.log(`   - ${m.date_paid}`);
        });
    } else {
        console.log("   ❌ NO MEMBERSHIP FEES FOUND!");
        console.log("   This agent has NEVER collected any membership fees.");
    }
    console.log("");

    console.log("=".repeat(60));
    console.log("🎯 CONCLUSION:");
    console.log("=".repeat(60));
    console.log("Agent 2 has:");
    console.log(`  - 0 membership fees in December 2025 (needed 3)`);
    console.log(`  - No member with both MEM + REG in December 2025`);
    console.log(`  - ${allMemFees?.length || 0} total membership fees EVER`);
    console.log("");
    console.log("Yet Agent 2 has:");
    console.log(`  - ₱${wallet?.balance || 0} withdrawable balance`);
    console.log(`  - ${receivableComms?.length || 0} commissions marked as receivable`);
    console.log(`  - January 2026 rollup status: ${janRollup?.status || 'NOT FOUND'}`);
    console.log("");
    console.log("⚠️  This is INCORRECT. The AGR logic has a bug.");
}

main();
