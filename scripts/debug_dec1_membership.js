const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://agyueadcymdopgihtckc.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFneXVlYWRjeW1kb3BnaWh0Y2tjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzMzA2NjYsImV4cCI6MjA3NDkwNjY2Nn0.EBYfJ9RTkeGLQptG3uWaOsFMIz9DySu3uhaOlzgeeMw";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
    console.log("🔍 INVESTIGATING THE DECEMBER 1ST MEMBERSHIP FEE...\n");

    // Get the membership fee from Dec 1
    const { data: memFee } = await supabase
        .from('collections')
        .select(`
            *,
            members (
                id,
                first_name,
                last_name,
                middle_name
            )
        `)
        .eq('agent_id', 2)
        .eq('is_membership_fee', true)
        .eq('date_paid', '2025-12-01')
        .maybeSingle();

    console.log("🎫 MEMBERSHIP FEE DETAILS:");
    if (memFee) {
        const m = Array.isArray(memFee.members) ? memFee.members[0] : memFee.members;
        console.log(`   Date Paid: ${memFee.date_paid}`);
        console.log(`   Member: ${m?.first_name} ${m?.middle_name || ''} ${m?.last_name}`);
        console.log(`   Amount: ₱${memFee.payment}`);
        console.log(`   Payment For: ${memFee.payment_for}`);
    } else {
        console.log("   ❌ Not found");
    }
    console.log("");

    // Check which commission period Dec 1 belongs to
    const dec1 = new Date('2025-12-01');
    console.log("📅 COMMISSION PERIOD ANALYSIS:");
    console.log(`   Date: ${dec1.toISOString().split('T')[0]}`);
    console.log(`   Day of Month: ${dec1.getDate()}`);

    if (dec1.getDate() >= 7) {
        console.log(`   Period: December 2025 (same month)`);
        console.log(`   Qualifies for: January 2026 release`);
    } else {
        console.log(`   Period: November 2025 (previous month)`);
        console.log(`   Qualifies for: December 2025 release`);
    }
    console.log("");

    // Check November 2025 collections (Nov 7 - Dec 7)
    const { data: novCollections } = await supabase
        .from('collections')
        .select(`
            id,
            date_paid,
            is_membership_fee,
            payment_for,
            members (
                first_name,
                last_name,
                middle_name
            )
        `)
        .eq('agent_id', 2)
        .gte('date_paid', '2025-11-07')
        .lt('date_paid', '2025-12-07')
        .order('date_paid');

    console.log("📊 NOVEMBER 2025 PERIOD (Nov 7 - Dec 6):");
    console.log(`   Total Collections: ${novCollections?.length || 0}`);

    const novMemCount = novCollections?.filter(c => c.is_membership_fee === true).length || 0;
    console.log(`   Membership Fees: ${novMemCount}`);
    console.log(`   Regular Payments: ${(novCollections?.length || 0) - novMemCount}`);
    console.log("");

    if (novCollections && novCollections.length > 0) {
        console.log("   DETAILS:");
        novCollections.forEach(c => {
            const m = Array.isArray(c.members) ? c.members[0] : c.members;
            const name = m ? `${m.first_name} ${m.middle_name || ""} ${m.last_name}`.trim() : `Member #${c.member_id}`;
            const type = c.is_membership_fee ? "MEM" : "REG";
            console.log(`   - [${type}] ${c.date_paid} | ${name}`);
        });
        console.log("");
    }

    // Check if November passes AGR
    console.log("🎯 NOVEMBER 2025 AGR CHECK:");
    console.log(`   Rule A (3+ Membership Fees): ${novMemCount >= 3 ? '✅ PASS' : '❌ FAIL'} (${novMemCount}/3)`);

    // Rule B check
    const groups = {};
    novCollections?.forEach(c => {
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

    const novPasses = novMemCount >= 3 || ruleB;
    console.log(`\n   OVERALL: ${novPasses ? '✅ PASSES AGR' : '❌ FAILS AGR'}`);
    console.log("");

    // Check December 2025 rollup status
    const { data: decRollup } = await supabase
        .from('agent_commission_rollups')
        .select('*')
        .eq('agent_id', 2)
        .eq('period_year', 2025)
        .eq('period_month', 12)
        .maybeSingle();

    console.log("📋 DECEMBER 2025 ROLLUP STATUS:");
    if (decRollup) {
        console.log(`   Status: ${decRollup.status}`);
        console.log(`   Created At: ${decRollup.created_at}`);
    } else {
        console.log("   ❌ No rollup found");
    }
    console.log("");

    console.log("=".repeat(60));
    console.log("🎯 ROOT CAUSE ANALYSIS:");
    console.log("=".repeat(60));
    console.log("");
    console.log("The Dec 1st membership fee belongs to NOVEMBER 2025 period");
    console.log("(because Dec 1 < Dec 7, so it's counted in the previous month).");
    console.log("");

    if (novPasses) {
        console.log("✅ Agent 2 PASSED AGR in November 2025");
        console.log("   → This qualifies them for December 2025 commission release");
        console.log("   → December 2025 rollup should be 'released'");
        console.log("");
        console.log("However, the user is asking about JANUARY 2026 withdrawable balance.");
        console.log("January 2026 requires passing AGR in DECEMBER 2025.");
        console.log("");
        console.log("Agent 2 did NOT pass December 2025 AGR (0 membership fees).");
        console.log("So they should NOT have January 2026 commissions released.");
    } else {
        console.log("❌ Agent 2 did NOT pass AGR in November 2025");
        console.log("   → They should NOT have December 2025 commissions released");
        console.log("   → But they have ₱644 withdrawable balance");
        console.log("");
        console.log("This suggests a bug in the AGR logic.");
    }
}

main();
