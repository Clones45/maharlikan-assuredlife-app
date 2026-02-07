
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://agyueadcymdopgihtckc.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFneXVlYWRjeW1kb3BnaWh0Y2tjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzMzA2NjYsImV4cCI6MjA3NDkwNjY2Nn0.EBYfJ9RTkeGLQptG3uWaOsFMIz9DySu3uhaOlzgeeMw";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function analyze_agent_6_gap() {
    console.log("🔍 Analyzing Agent 6 Jan 2026 Discrepancy...");
    const agentId = 6;

    // User expects 1,437. Current is 1,157. Gap = 280.

    const { data: comms } = await supabase.from('commissions')
        .select('*')
        .eq('agent_id', agentId)
        .eq('period_year', 2026)
        .eq('period_month', 1);

    let total = 0;
    let receivableTotal = 0;
    const typeBreakdown = {};

    console.log("\n📋 Commission Items:");
    comms.forEach(c => {
        let val = Number(c.amount);
        if (c.commission_type === 'override' || c.commission_type === 'recruiter_bonus') {
            if (c.override_commission > 0) val = Number(c.override_commission);
        }

        total += val;
        if (c.is_receivable) receivableTotal += val;

        if (!typeBreakdown[c.commission_type]) typeBreakdown[c.commission_type] = 0;
        typeBreakdown[c.commission_type] += val;

        console.log(`   - ${c.date_earned} | ${c.commission_type.padEnd(15)} | Amt: ${val} | Recv: ${c.is_receivable}`);
    });

    console.log("\n📊 Summary:");
    console.log(`   Total Sum of All Items: ${total}`);
    console.log(`   Total 'is_receivable':  ${receivableTotal}`);
    console.log(`   User Expects:           1437`);
    console.log(`   Gap (Total - Expect):   ${total - 1437}`);
    console.log(`   Gap (Recv - Expect):    ${receivableTotal - 1437}`);
    console.log(`   Gap (User - 1157):      ${1437 - 1157} (Should be 280)`);

    console.log("\n💡 Breakdown by Type:");
    for (const [type, sum] of Object.entries(typeBreakdown)) {
        console.log(`   ${type}: ${sum}`);
    }
}

analyze_agent_6_gap();
