
const { createClient } = require('@supabase/supabase-js');

// Config
const SUPABASE_URL = "https://agyueadcymdopgihtckc.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFneXVlYWRjeW1kb3BnaWh0Y2tjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzMzA2NjYsImV4cCI6MjA3NDkwNjY2Nn0.EBYfJ9RTkeGLQptG3uWaOsFMIz9DySu3uhaOlzgeeMw";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Helper: Cutoff Range
function cutoffRange(year, month) {
    const Y = Number(year);
    const M = Number(month);
    const start = new Date(Y, M - 1, 7);
    const end = new Date(Y, M, 7);
    const fmt = d => d.toISOString().split('T')[0];
    return { gte: fmt(start), lt: fmt(end) };
}

// Helper: Get Previous Month
function getPrevPeriod(y, m) {
    let py = y;
    let pm = m - 1;
    if (pm === 0) {
        pm = 12;
        py = y - 1;
    }
    return { year: py, month: pm };
}

async function main() {
    console.log("🚀 Starting AGR Commission Sync (ALL AGENTS)...");
    console.log("   Rule: Month M is released IF Month M-1 Passed AGR.");

    // 1. Determine Target Period (Current Month)
    const now = new Date();
    const period_year = now.getFullYear();
    const period_month = now.getMonth() + 1;

    console.log(`   Target Period: ${period_year}-${period_month}`);

    // 2. Fetch ALL Agents
    const { data: agents, error: aErr } = await supabase.from('agents').select('id');
    if (aErr) { console.error("Error fetching agents:", aErr); return; }
    console.log(`Found ${agents.length} agents.`);

    for (const agent of agents) {
        // Check if ALREADY released for this agent/month
        const { data: existing } = await supabase
            .from('agent_commission_rollups')
            .select('*')
            .eq('agent_id', agent.id)
            .eq('period_year', period_year)
            .eq('period_month', period_month)
            .maybeSingle();

        if (existing && existing.status === 'released') {
            continue; // Already paid
        }

        // Construct a virtual rollup object
        const rollup = existing || {
            agent_id: agent.id,
            period_year,
            period_month,
            status: 'unreleased'
        };

        await processRollup(rollup);
    }
    console.log("✅ Sync Complete.");
}

async function processRollup(r) {
    const { agent_id, period_year, period_month } = r;
    const label = `Agent ${agent_id} [Target: ${period_year}-${period_month}]`;

    // 2. Identify PREVIOUS Period (The Qualifier)
    const prev = getPrevPeriod(period_year, period_month);
    // console.log(`   Checking Qualifier: ${prev.year}-${prev.month}`);

    // 3. Check Eligibility in PREVIOUS Period
    const { gte, lt } = cutoffRange(prev.year, prev.month);

    // Fetch collections for PREV period
    const { data: colls, error: cErr } = await supabase
        .from('collections')
        .select('member_id, is_membership_fee, payment_for, payment')
        .eq('agent_id', agent_id)
        .gte('date_paid', gte)
        .lt('date_paid', lt);

    if (cErr) { console.error(`[${label}] Error fetching prev collections:`, cErr.message); return; }

    // Logic Check (Rule A/B)
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

    const isEligible = (membershipCount >= 3) || hasMix;

    if (!isEligible) {
        console.log(`[${label}] ❌ Not Eligible (Prev Month ${prev.month} Stats: MS: ${membershipCount}). Skipping.`);
        return;
    }

    // 4. Calculate Receivable Amount for TARGET Period (Current r)
    // Fetch comms for TARGET period
    const targetRange = cutoffRange(period_year, period_month);

    const { data: comms } = await supabase
        .from('commissions')
        .select('amount, commission_type, is_receivable, override_commission')
        .eq('agent_id', agent_id)
        .gte('date_earned', targetRange.gte)
        .lt('date_earned', targetRange.lt);

    let receivableTotal = 0;
    comms.forEach(c => {
        const amt = Number(c.amount || 0);
        const type = c.commission_type;
        const ovr = Number(c.override_commission || 0);
        if (type === 'override' || type === 'recruiter_bonus') {
            receivableTotal += (ovr > 0 ? ovr : amt);
        } else if (c.is_receivable) {
            receivableTotal += amt;
        }
    });

    if (receivableTotal <= 0) {
        console.log(`[${label}] ⚠️ Eligible but 0 Receivable. Marking released.`);
        await markReleased(agent_id, period_year, period_month);
        return;
    }

    // 5. RELEASE
    console.log(`[${label}] 💰 QUALIFIED! Transferring ₱${receivableTotal.toFixed(2)} based on Month ${prev.month} Performance.`);

    const { error: wErr } = await supabase.rpc('increment_wallet', {
        p_agent_id: agent_id, p_amount: receivableTotal
    });

    if (wErr) {
        const { data: wData } = await supabase.from('agent_wallets').select('balance').eq('agent_id', agent_id).single();
        if (!wData) await supabase.from('agent_wallets').insert([{ agent_id, balance: receivableTotal, lifetime_commission: receivableTotal }]);
        else await supabase.from('agent_wallets').update({ balance: Number(wData.balance) + receivableTotal }).eq('agent_id', agent_id);
    }

    await markReleased(agent_id, period_year, period_month);
}

async function markReleased(agentId, y, m) {
    await supabase.from('agent_commission_rollups').update({ status: 'released' }).eq('agent_id', agentId).eq('period_year', y).eq('period_month', m);
}

main();
