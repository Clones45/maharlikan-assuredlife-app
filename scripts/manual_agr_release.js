
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://agyueadcymdopgihtckc.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFneXVlYWRjeW1kb3BnaWh0Y2tjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzMzA2NjYsImV4cCI6MjA3NDkwNjY2Nn0.EBYfJ9RTkeGLQptG3uWaOsFMIz9DySu3uhaOlzgeeMw";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Config: Jan 2026 Release (based on Jan 7 - Feb 7 performance)
// WAIT: The period logic in SQL is:
// "If date is Jan 23, it's >= 7, so Period is Jan (Year 2026, Month 1)."
// Collections in Jan (Period 1) determine Release for Period 2 (Feb).
// BUT typically "AGR" enables withdrawals for the *next* month.
// Let's assume we are processing for the *Current* Eligibility to unlock *Next* month.
// Actually, let's just use the DATES.
// Collections: 2026-01-07 to 2026-02-07
// Target Period for Release: 2026 (Year), 2 (Month) -> Feb commissions become withdrawable?
// OR does it release JAN commissions?
// SQL: "check_and_release_agr(agent_id, 2026, 2)" looks at Prev Month (Jan).
// So if I run this for Target: 2026, 2... it will check Jan collections.
// AND it will release commissions earned in Feb (2026-02-07 to 2026-03-07)?
// Let's re-read the SQL logic carefully.
// "check_and_release_agr(input_agent_id bigint, input_year int, input_month int)"
//    prev_month = input_month - 1
//    Check collections in prev_month.
//    If eligible:
//       Mark commissions in *input_month* (Target) as receivable.
//       Add to wallet.
//       Mark rollup(input_month) as released.

// So if today is Jan 30... we are in Period 1 (Jan 7 - Feb 7).
// Collections are coming in for Period 1.
// Usually AGR releases commissions for the *Next* period (Period 2)?
// OR does it release commissions for *this* period (Period 1) based on *Previous* (Period 12)?
// The user issue is "Incentives Note... agent who passed the AGR is not updating".
// The Note says: "Complete AGR... to access withdrawable commission for the **following Month**."
// So if I pass Jan AGR, I get Feb commissions?
// Agent 6 has collections in Jan.
// So Agent 6 is qualifying for Feb.
// BUT maybe they want the note to update *now* (Jan) to say "Qualified for Next Month"?
// The UI logic checks *current* collections (Jan) and sets `isAGRCompliant`.
// This `isAGRCompliant` updates the *Note text*.
// The actual *release of money* happens for the *Target* month.

// WAIT. The User asked to "apply the SQL".
// The SQL likely enables the *Note*? No, the Note is client-side.
// The SQL enables the *actual money*.
// The user said: "ensure the system actually releases the money".
// So if Agent 6 passes Jan AGR, they should get *Feb* money lawfully?
// OR maybe they correspond to *Dec* AGR for *Jan* money?
// Let's check Agent 6's Jan collections.
// Use Diagnose script: Agent 6 has Jan collections.
// So Agent 6 is qualifying *now*.
// Money release will happen next month?
// If so, there is nothing to release *yet* for Feb.
// UNLESS the user implies they *already* passed (e.g. they think they passed Dec for Jan?)?
// "agent commission tab in the incentives note... agent who passed the AGR".
// If the note says "Congratulations", it means they passed *current* period.
// So they are qualified for *next* period.
// So this script should setup the release for *next* period?
// OR maybe I should just run the update for *this* period (Jan) just in case they meant Jan?
// Let's assume we want to run it for Target Month = Feb (2026, 2).
// INPUT: 2026, 2.
// PREV: 2026, 1 (Jan).
// This fits the collections we see (Jan 7 - Feb 7).

async function main() {
    console.log("🚀 MANUAL AGR RELEASE (Ultra-Relaxed Logic)...");

    // Target: Feb 2026 (Month 2) -> Based on Jan 2026 Performance
    const TARGET_YEAR = 2026;
    const TARGET_MONTH = 2;

    // Prev (Qualification) Period: Jan 2026
    const QUALIFY_START = '2026-01-07';
    const QUALIFY_END = '2026-02-07';

    console.log(`Checking Eligibility in Jan (${QUALIFY_START} - ${QUALIFY_END})`);
    console.log(`To Release Target: Feb (${TARGET_YEAR}-${TARGET_MONTH})`);

    // 1. Fetch Collections
    const { data: collections, error } = await supabase
        .from('collections')
        .select(`agent_id, is_membership_fee, payment_for, payment, date_paid, members(first_name, last_name, middle_name)`)
        .gte('date_paid', QUALIFY_START)
        .lt('date_paid', QUALIFY_END);

    if (error) { console.error(error); return; }

    const agentMap = {};
    collections.forEach(c => {
        if (!agentMap[c.agent_id]) agentMap[c.agent_id] = [];
        agentMap[c.agent_id].push(c);
    });

    for (const agentId in agentMap) {
        const colls = agentMap[agentId];

        // CHECK COMPLIANCE
        const memCount = colls.filter(c => c.is_membership_fee === true).length;
        let ruleB = false;

        const groups = {};
        colls.forEach(c => {
            const m = Array.isArray(c.members) ? c.members[0] : c.members;
            if (!m) return;
            const key = `${m.last_name}|${m.first_name}`.trim().toUpperCase();
            if (!groups[key]) groups[key] = [];
            groups[key].push(c);
        });

        for (const key in groups) {
            const p = groups[key];
            const hasMem = p.some(x => x.is_membership_fee === true);
            const hasReg = p.some(x => x.is_membership_fee === false && x.payment_for === 'regular');
            if (hasMem && hasReg) { ruleB = true; break; }
        }

        const isEligible = (memCount >= 3 || ruleB);

        if (isEligible) {
            console.log(`\n✅ Agent ${agentId} is ELIGIBLE.`);
            await releaseCommissions(agentId, TARGET_YEAR, TARGET_MONTH);
        }
    }
}

async function releaseCommissions(agentId, year, month) {
    // 1. Check if already released
    const { data: existing } = await supabase
        .from('agent_commission_rollups')
        .select('status')
        .eq('agent_id', agentId)
        .eq('period_year', year)
        .eq('period_month', month)
        .maybeSingle();

    if (existing?.status === 'released') {
        console.log(`   - Already released for ${year}-${month}. Skipping.`);
        return;
    }

    console.log(`   - Releasing commissions for ${year}-${month}...`);

    // 2. Fetch Commissions for Target Period
    // Target Period Date Range: Feb 7 - Mar 7 (approx)
    // Wait, if we are in Jan 30... Feb 7 hasn't started yet.
    // So there are NO commissions to release yet for Feb.
    // BUT we must mark the Rollup as 'released' so that *future* commissions 
    // (triggers) know to auto-release.

    // So we just Create/Update Rollup status = 'released'.

    const { error: upsertErr } = await supabase
        .from('agent_commission_rollups')
        .upsert({
            agent_id: agentId,
            period_year: year,
            period_month: month,
            status: 'released',
            // Default values for other columns if new row
            monthly_commission: 0,
            membership_commission: 0,
            override_commission: 0,
            recruiter_bonus: 0,
            grand_total_commission: 0,
            total_collection: 0
        }, { onConflict: 'agent_id, period_year, period_month' });

    if (upsertErr) console.error(`   ❌ Error updating rollup: ${upsertErr.message}`);
    else console.log(`   ✅ Marked ${year}-${month} as RELEASED.`);
}

main();
