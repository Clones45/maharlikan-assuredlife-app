
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://agyueadcymdopgihtckc.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFneXVlYWRjeW1kb3BnaWh0Y2tjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzMzA2NjYsImV4cCI6MjA3NDkwNjY2Nn0.EBYfJ9RTkeGLQptG3uWaOsFMIz9DySu3uhaOlzgeeMw";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function cutoffRange(year, month) {
    const Y = Number(year);
    const M = Number(month);
    const start = new Date(Y, M - 1, 7);
    const end = new Date(Y, M, 7);
    const fmt = d => d.toISOString().split('T')[0];
    return { gte: fmt(start), lt: fmt(end) };
}

async function debug() {
    console.log("🔍 Inspecting Agent 5 Jan 2026 AGR & Feb Release...");
    const agentId = 5;

    // 1. Check DEC 2025 AGR (affects JAN Release 2026-1)
    // We know this failed.

    // 2. Check JAN 2026 AGR (affects FEB Release 2026-2)
    // Range: Jan 7, 2026 to Feb 7, 2026
    const range = cutoffRange(2026, 1);
    console.log(`\nChecking Jan 2026 Collections (${range.gte} to ${range.lt})...`);

    const { data: colls, error: cErr } = await supabase
        .from('collections')
        .select('*')
        .eq('agent_id', agentId)
        .gte('date_paid', range.gte)
        .lt('date_paid', range.lt);

    if (cErr) console.log("   Collections Error:", cErr.message);
    else {
        console.log(`   Found ${colls.length} collections.`);
        // Logic
        const membershipCount = colls.filter(c => c.is_membership_fee).length;
        const byMember = {};
        colls.forEach(c => {
            if (!byMember[c.member_id]) byMember[c.member_id] = [];
            byMember[c.member_id].push(c);
        });
        let hasMix = false;
        for (const mId in byMember) {
            const pay = byMember[mId];
            const hasMem = pay.some(p => p.is_membership_fee);
            const hasReg = pay.some(p => !p.is_membership_fee && p.payment_for === 'regular');
            if (hasMem && hasReg) { hasMix = true; break; }
        }
        console.log(`   - Membership Count: ${membershipCount}`);
        console.log(`   - Has Mix: ${hasMix}`);
        const isEligible = (membershipCount >= 3) || hasMix;
        console.log(`   - Passed Jan AGR? ${isEligible ? "YES" : "NO"}`);
    }

    // 3. Check 2026-2 Rollup Details
    console.log("\nChecking 2026-2 Rollup...");
    const { data: rollup } = await supabase
        .from('agent_commission_rollups')
        .select('*')
        .eq('agent_id', agentId)
        .eq('period_year', 2026)
        .eq('period_month', 2)
        .single();

    console.log("   Rollup:", rollup);

    // 4. Check Wallet
    const { data: wallet } = await supabase.from('agent_wallets').select('*').eq('agent_id', agentId).single();
    console.log("   Wallet:", wallet);
}

debug();
