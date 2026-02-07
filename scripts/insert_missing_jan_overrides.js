
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://agyueadcymdopgihtckc.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFneXVlYWRjeW1kb3BnaWh0Y2tjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzMzA2NjYsImV4cCI6MjA3NDkwNjY2Nn0.EBYfJ9RTkeGLQptG3uWaOsFMIz9DySu3uhaOlzgeeMw";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
    const mhId = 6; // Janace
    console.log(`💰 Inserting Missing Overrides for Agent ${mhId} (Jan 2026)...`);

    // 1. Get Jan downline sales AGAIN (since we know they are visible now)
    // We reuse the logic: Get ALL downlines, then their sales.
    // Or just fetch all collections in Jan, check if hierarchy leads to 6?
    // We validated hierarchy is fixed. So let's fetch sales from the known downline.

    // Quick recursion not possible in anon key read...
    // Let's rely on the fact that we linked Orphans -> Janace. 
    // So anyone with assigned_id=6 OR their downline is target.
    // Actually, 'debug_janace_overrides' proved we can find them.
    // Let's just fetch ALL sales in Jan 2026 for now (small dataset) and check if they owe commission.

    const start = '2026-01-01';
    const end = '2026-02-01';

    const { data: sales } = await supabase
        .from('collections')
        .select('*')
        .gte('date_paid', start)
        .lt('date_paid', end);

    console.log(`Scanning ${sales.length} global sales...`);

    for (const sale of sales) {
        if (sale.agent_id === mhId) continue; // No override on self

        // Check if this sale already paid Janace
        const { data: existing } = await supabase
            .from('commissions')
            .select('id')
            .eq('collection_id', sale.id)
            .eq('agent_id', mhId)
            .eq('commission_type', 'override');

        if (existing && existing.length > 0) {
            console.log(`   [${sale.id}] Skip: Already paid.`);
            continue;
        }

        // CHECK ELIGIBILITY: Is this agent in Janace's downline?
        // Trace up.
        const path = await trace(sale.agent_id);
        if (!path.includes(mhId)) {
            console.log(`   [${sale.id}] Skip: Not in downline (Chain: ${path.join('->')})`);
            continue;
        }

        // CALCULATE AMOUNT
        // We need 'months_covered'.
        // Try finding the commission for the AGENT themselves
        const { data: agentComm } = await supabase
            .from('commissions')
            .select('months_covered, plan_type')
            .eq('collection_id', sale.id)
            .neq('commission_type', 'override') // Get the main one
            .limit(1)
            .single();

        let months = 1;
        let planType = 'N/A';

        if (agentComm) {
            months = agentComm.months_covered || 1;
            planType = agentComm.plan_type;
        } else {
            // Fallback: Estimate from payment?
            // membership = 1
            // 498 usually = 1 month
            months = 1;
        }

        const amount = 8.00 * months;
        console.log(`   [${sale.id}] ✅ INSERTING Override: ₱${amount} (${months} months)`);

        // INSERT
        const { error: insErr } = await supabase.from('commissions').insert({
            agent_id: mhId,
            member_id: sale.member_id,
            collection_id: sale.id,
            commission_type: 'override',
            plan_type: planType,
            basis_amount: 0, // usually monthly_due, but optional
            amount: amount,
            months_covered: months,
            date_earned: sale.date_paid,
            status: 'pending',
            maf_no: sale.or_no, // use or_no as maf? or null
            year: 2026,
            period_year: 2026,
            period_month: 1,
            override_commission: amount, // Critical for logic
            is_receivable: true
        });

        if (insErr) console.error("     Insert Error:", insErr.message);
    }
}

async function trace(startId) {
    let chain = [];
    let cur = startId;
    for (let i = 0; i < 10; i++) {
        if (!cur) break;
        chain.push(cur);
        const { data } = await supabase.from('agents').select('assigned_id').eq('id', cur).single();
        if (!data) break;
        cur = data.assigned_id;
    }
    return chain;
}

main();
