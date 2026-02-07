const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://agyueadcymdopgihtckc.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFneXVlYWRjeW1kb3BnaWh0Y2tjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzMzA2NjYsImV4cCI6MjA3NDkwNjY2Nn0.EBYfJ9RTkeGLQptG3uWaOsFMIz9DySu3uhaOlzgeeMw";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
    console.log("🔍 INVESTIGATING DECEMBER 2025 AGENTS\n");
    console.log("=".repeat(60));

    // 1. Get Dec 2025 Rollups
    const { data: rollups } = await supabase
        .from('agent_commission_rollups')
        .select('agent_id, status')
        .eq('period_year', 2025)
        .eq('period_month', 12);

    console.log(`\n📊 DECEMBER 2025 ROLLUP STATUS:`);
    const statusMap = {};
    rollups?.forEach(r => {
        statusMap[r.agent_id] = r.status;
        console.log(`   Agent ${r.agent_id}: ${r.status}`);
    });

    // 2. Get Dec 2025 Commissions
    // Date range: Dec 7, 2025 to Jan 7, 2026
    const startDate = '2025-12-07';
    const endDate = '2026-01-07';

    const { data: commissions } = await supabase
        .from('commissions')
        .select('*')
        .gte('date_earned', startDate)
        .lt('date_earned', endDate);

    console.log(`\n💰 DECEMBER 2025 COMMISSIONS:`);

    // Group by agent
    const agentComms = {};
    commissions?.forEach(c => {
        if (!agentComms[c.agent_id]) {
            agentComms[c.agent_id] = { total: 0, receivable: 0, forfeited: 0, count: 0 };
        }

        const amt = c.commission_type === 'override' || c.commission_type === 'recruiter_bonus'
            ? (c.override_commission > 0 ? c.override_commission : c.amount)
            : c.amount;

        agentComms[c.agent_id].total += amt;
        agentComms[c.agent_id].count++;

        if (c.is_receivable) {
            agentComms[c.agent_id].receivable += amt;
        } else {
            agentComms[c.agent_id].forfeited += amt;
        }
    });

    for (const agentId in agentComms) {
        const data = agentComms[agentId];
        const status = statusMap[agentId] || 'NO ROLLUP';
        console.log(`   Agent ${agentId} (${status}):`);
        console.log(`      Total: ₱${data.total} (${data.count} items)`);
        console.log(`      ✅ Receivable: ₱${data.receivable}`);
        console.log(`      ❌ Forfeited (is_receivable=false): ₱${data.forfeited}`);

        if (status === 'unreleased' && data.receivable > 0) {
            console.log(`      ⚠️  ERROR: Has receivable commissions but rollup is unreleased!`);
        }
    }
}

main().catch(console.error);
