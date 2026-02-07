
const { createClient } = require('@supabase/supabase-js');

// Config from sync_agr_commissions.js
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
    console.log("🔍 Debugging Agents 1 & 5...");

    const agentIds = [1, 5];

    for (const agentId of agentIds) {
        console.log(`\n--- Agent ${agentId} ---`);

        // 1. Check Wallet Balance
        const { data: wallet, error: wErr } = await supabase
            .from('agent_wallets')
            .select('*')
            .eq('agent_id', agentId)
            .single();

        if (wErr) console.log("   Wallet Error:", wErr.message);
        else console.log("   Wallet Balance:", wallet);

        // 2. Check Rollup Status for Jan 2026 (Target: 2026-1) which relies on Dec 2025 performance
        // Actually, logic is: Target Month M (Release) checks Month M-1 (Performance).
        // If user says "Didn't pass AGR last December", they refer to Dec 2025 Performance.
        // This would govern the JAN 2026 release (Period Year 2026, Month 1).

        const periodYear = 2026;
        const periodMonth = 1;

        const { data: rollup, error: rErr } = await supabase
            .from('agent_commission_rollups')
            .select('*')
            .eq('agent_id', agentId)
            .eq('period_year', periodYear)
            .eq('period_month', periodMonth)
            .maybeSingle();

        if (rErr) console.log("   Rollup Error:", rErr.message);
        else console.log(`   Rollup [${periodYear}-${periodMonth}]:`, rollup);

        // 3. Check Performance in Dec 2025
        const prevYear = 2025;
        const prevMonth = 12;
        console.log(`   Checking Performance for Dec ${prevYear} (Month 12)...`);

        const range = cutoffRange(prevYear, prevMonth);
        console.log(`   Range: ${range.gte} to ${range.lt}`);

        const { data: colls, error: cErr } = await supabase
            .from('collections')
            .select('member_id, is_membership_fee, payment_for, payment')
            .eq('agent_id', agentId)
            .gte('date_paid', range.gte)
            .lt('date_paid', range.lt);

        if (cErr) {
            console.log("   Collections Error:", cErr.message);
        } else {
            console.log(`   Collections Found: ${colls.length}`);

            // Analyze Eligibility
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
            console.log(`   - Has Mix (Mem + Reg): ${hasMix}`);
            const isEligible = (membershipCount >= 3) || hasMix;
            console.log(`   - ELIGIBLE? ${isEligible ? "YES" : "NO"}`);
        }
    }
}

debug();
