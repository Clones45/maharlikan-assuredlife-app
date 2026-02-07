
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://agyueadcymdopgihtckc.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFneXVlYWRjeW1kb3BnaWh0Y2tjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzMzA2NjYsImV4cCI6MjA3NDkwNjY2Nn0.EBYfJ9RTkeGLQptG3uWaOsFMIz9DySu3uhaOlzgeeMw";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
    const janaceId = 6;
    console.log(`🔎 Seeking 'Orphan' Sales (Not rolling up to Janace)...`);

    // 1. Get ALL Sales in Jan 2026
    const start = '2026-01-01';
    const end = '2026-02-01';

    const { data: sales, error } = await supabase
        .from('collections')
        .select('id, payment, date_paid, agent_id, is_membership_fee, payment_for')
        .gte('date_paid', start)
        .lt('date_paid', end);

    if (error) { console.error(error); return; }

    console.log(`\n📅 Total Global Sales in Jan 2026: ${sales.length}`);

    // 2. Identify Sales NOT by Janace or her downline
    // We already know her downline (Agent 4) had 0 sales.
    // So any sale NOT by Janace herself is a potential candidate.

    const orphanSales = sales.filter(s => s.agent_id !== janaceId && s.agent_id !== 4); // 4 is Maylene

    console.log(`   Sales by others: ${orphanSales.length}`);

    for (const s of orphanSales) {
        console.log(`   - ₱${s.payment} by Agent ${s.agent_id} on ${s.date_paid} (Mem: ${s.is_membership_fee})`);

        // 3. Trace their Upline
        await traceUpline(s.agent_id);
    }
}

async function traceUpline(startAgentId) {
    let currentId = startAgentId;
    let chain = [];

    for (let i = 0; i < 5; i++) {
        if (!currentId) break;

        const { data: agent } = await supabase
            .from('agents')
            .select('id, firstname, lastname, position, assigned_id')
            .eq('id', currentId)
            .single();

        if (!agent) break;

        chain.push(`${agent.firstname} (${agent.position})`);
        currentId = agent.assigned_id;
    }

    console.log(`      Chain: ${chain.join(' -> ')}`);
}

main();
