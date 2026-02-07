const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://agyueadcymdopgihtckc.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFneXVlYWRjeW1kb3BnaWh0Y2tjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzMzA2NjYsImV4cCI6MjA3NDkwNjY2Nn0.EBYfJ9RTkeGLQptG3uWaOsFMIz9DySu3uhaOlzgeeMw";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
    console.log("🔍 INVESTIGATING AGENT 2 AGR STATUS...\n");

    // 1. Check Agent 2's Wallet
    const { data: wallet } = await supabase
        .from('agent_wallets')
        .select('*')
        .eq('agent_id', 2)
        .single();

    console.log("💰 AGENT 2 WALLET:");
    console.log(`   Balance (Withdrawable): ₱${wallet?.balance || 0}`);
    console.log(`   Lifetime Commission: ₱${wallet?.lifetime_commission || 0}`);
    console.log(`   Updated At: ${wallet?.updated_at}\n`);

    // 2. Check AGR Rollup Status
    const { data: rollups } = await supabase
        .from('agent_commission_rollups')
        .select('*')
        .eq('agent_id', 2)
        .order('period_year', { ascending: false })
        .order('period_month', { ascending: false });

    console.log("📊 AGR ROLLUP STATUS:");
    rollups?.forEach(r => {
        console.log(`   ${r.period_year}-${String(r.period_month).padStart(2, '0')}: ${r.status}`);
    });
    console.log("");

    // 3. Check December 2025 Collections (Qualifying Period for January 2026)
    // December period: Dec 7, 2025 to Jan 7, 2026
    const { data: decCollections } = await supabase
        .from('collections')
        .select(`
            id,
            member_id,
            date_paid,
            is_membership_fee,
            payment_for,
            payment,
            members (
                id,
                first_name,
                last_name,
                middle_name
            )
        `)
        .eq('agent_id', 2)
        .gte('date_paid', '2025-12-07')
        .lt('date_paid', '2026-01-07')
        .order('date_paid');

    console.log("📅 DECEMBER 2025 COLLECTIONS (Dec 7 - Jan 6):");
    console.log(`   Total Collections: ${decCollections?.length || 0}`);

    const memCount = decCollections?.filter(c => c.is_membership_fee === true).length || 0;
    console.log(`   Membership Fees: ${memCount}`);
    console.log(`   Regular Payments: ${(decCollections?.length || 0) - memCount}\n`);

    if (decCollections && decCollections.length > 0) {
        console.log("   DETAILS:");
        decCollections.forEach(c => {
            const m = Array.isArray(c.members) ? c.members[0] : c.members;
            const name = m ? `${m.first_name} ${m.middle_name || ""} ${m.last_name}`.trim() : `Member #${c.member_id}`;
            const type = c.is_membership_fee ? "MEM" : "REG";
            console.log(`   - [${type}] ${c.date_paid} | ${name} | ₱${c.payment} | ${c.payment_for}`);
        });
        console.log("");
    }

    // 4. Check if Agent 2 meets AGR criteria
    console.log("🎯 AGR CRITERIA CHECK:");
    console.log(`   Rule A (3+ Membership Fees): ${memCount >= 3 ? '✅ PASS' : '❌ FAIL'} (${memCount}/3)`);

    // Rule B: Check for same member with both MEM and REG
    const groups = {};
    decCollections?.forEach(c => {
        const m = Array.isArray(c.members) ? c.members[0] : c.members;
        if (!m) return;
        const key = `${m.last_name}|${m.first_name}`.trim().toUpperCase();
        if (!groups[key]) groups[key] = [];
        groups[key].push(c);
    });

    let ruleB = false;
    for (const key in groups) {
        const payments = groups[key];
        const hasMem = payments.some(p => p.is_membership_fee === true);
        const hasReg = payments.some(p => p.is_membership_fee === false && p.payment_for === 'regular');

        if (hasMem && hasReg) {
            ruleB = true;
            console.log(`   Rule B (Member with MEM + REG): ✅ PASS`);
            console.log(`      Found: ${key.replace('|', ', ')}`);
            break;
        }
    }

    if (!ruleB) {
        console.log(`   Rule B (Member with MEM + REG): ❌ FAIL`);
    }

    const shouldPass = memCount >= 3 || ruleB;
    console.log(`\n   OVERALL: ${shouldPass ? '✅ SHOULD PASS AGR' : '❌ SHOULD NOT PASS AGR'}\n`);

    // 5. Check January 2026 Commissions (What would be released)
    const { data: janCommissions } = await supabase
        .from('commissions')
        .select('*')
        .eq('agent_id', 2)
        .gte('date_earned', '2026-01-07')
        .lt('date_earned', '2026-02-07')
        .order('date_earned');

    console.log("💵 JANUARY 2026 COMMISSIONS (Would be released if AGR passed):");
    console.log(`   Total Commissions: ${janCommissions?.length || 0}`);

    const totalAmount = janCommissions?.reduce((sum, c) => {
        if (c.commission_type === 'override' || c.commission_type === 'recruiter_bonus') {
            return sum + (c.override_commission > 0 ? c.override_commission : c.amount);
        }
        return sum + (c.is_receivable ? c.amount : 0);
    }, 0) || 0;

    console.log(`   Total Amount: ₱${totalAmount}\n`);

    if (janCommissions && janCommissions.length > 0) {
        console.log("   DETAILS:");
        janCommissions.forEach(c => {
            const amt = c.commission_type === 'override' || c.commission_type === 'recruiter_bonus'
                ? (c.override_commission > 0 ? c.override_commission : c.amount)
                : c.amount;
            console.log(`   - ${c.date_earned} | ${c.commission_type} | ₱${amt} | Receivable: ${c.is_receivable}`);
        });
    }

    // 6. Summary
    console.log("\n" + "=".repeat(60));
    console.log("📋 SUMMARY:");
    console.log("=".repeat(60));
    console.log(`Agent 2 ${shouldPass ? 'SHOULD' : 'SHOULD NOT'} have passed AGR for December 2025.`);
    console.log(`Agent 2's withdrawable balance is: ₱${wallet?.balance || 0}`);

    if (!shouldPass && wallet?.balance > 0) {
        console.log("\n⚠️  ISSUE DETECTED:");
        console.log("   Agent 2 has withdrawable balance but did NOT meet AGR criteria!");
        console.log("   This suggests the AGR logic may have incorrectly released commissions.");
    } else if (shouldPass && wallet?.balance === 0) {
        console.log("\n⚠️  ISSUE DETECTED:");
        console.log("   Agent 2 met AGR criteria but has NO withdrawable balance!");
        console.log("   This suggests the AGR logic failed to release commissions.");
    } else {
        console.log("\n✅ Status appears correct based on AGR criteria.");
    }
}

main();
