
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://agyueadcymdopgihtckc.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFneXVlYWRjeW1kb3BnaWh0Y2tjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzMzA2NjYsImV4cCI6MjA3NDkwNjY2Nn0.EBYfJ9RTkeGLQptG3uWaOsFMIz9DySu3uhaOlzgeeMw";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function find_match() {
    console.log("🔍 Hunting for 1,157.00 in Agent 6...");
    const agentId = 6;

    const { data: comms } = await supabase.from('commissions')
        .select('*')
        .eq('agent_id', agentId)
        .order('date_earned');

    // Group by Period
    const periods = {};
    const buckets = { 'All Released?': 0 };

    comms.forEach(c => {
        const key = `${c.period_year}-${c.period_month}`;
        if (!periods[key]) periods[key] = { sun: 0, items: [] };

        let val = 0;
        if (c.commission_type === 'override' || c.commission_type === 'recruiter_bonus') {
            val = c.override_commission > 0 ? c.override_commission : c.amount;
        } else if (c.is_receivable) {
            val = c.amount;
        }
        val = Number(val);

        periods[key].sum = (periods[key].sum || 0) + val;
        periods[key].items.push(val);
    });

    console.log("\n📊 Breakdown by Period:");
    for (const [k, v] of Object.entries(periods)) {
        console.log(`   Period ${k}: Total ${v.sum} (${v.items.length} items)`);
        // Check subsets?
        if (Math.abs(v.sum - 1157) < 5) console.log("      🎯 MATCH FOUND (+/- 5)");
    }

    console.log("\n🔄 Combinations:");
    // Try Dec + Jan?
    const p12 = periods['2025-12'] ? periods['2025-12'].sum : 0;
    const p1 = periods['2026-1'] ? periods['2026-1'].sum : 0;

    console.log(`   Dec (2025-12) only: ${p12}`);
    console.log(`   Jan (2026-1) only: ${p1}`);
    console.log(`   Dec + Jan: ${p12 + p1}`);

    // Exact search for 1157
    if (Math.abs(p1 - 1157) < 25) console.log("   --> Jan (Period 1) is the closest candidate (1179 vs 1157). Difference: " + (p1 - 1157));
}

find_match();
