
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://agyueadcymdopgihtckc.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFneXVlYWRjeW1kb3BnaWh0Y2tjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzMzA2NjYsImV4cCI6MjA3NDkwNjY2Nn0.EBYfJ9RTkeGLQptG3uWaOsFMIz9DySu3uhaOlzgeeMw";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function report_passers_final() {
    console.log("🏆 Checking AGR Status for JAN 2026 (Final Mode)...\n");

    const { data: agents } = await supabase.from('agents').select('id, firstname, lastname').order('id');
    if (!agents) return;

    const startDate = '2026-01-07';
    const endDate = '2026-02-07';

    // Fetch collections using correct columns
    const { data: allCollections } = await supabase.from('collections')
        .select('agent_id, member_id, payment_for, is_membership_fee, amount, date_paid') // using date_paid usually
        .gte('date_paid', startDate) // Or date_collected? Schema said date_paid_date? Let's try date_paid first.
        .lt('date_paid', endDate);

    // Wait, schema had date_collected? No, schema output showed: date_paid, date_paid_date, collection_month.
    // I see `date_paid`. Using that.

    const collections = allCollections || [];
    console.log(`Analyzing ${collections.length} collections...`);

    // Group by Agent -> Member
    const agentMap = {}; // agent_id -> { member_id -> { hasMem, hasReg } }

    collections.forEach(c => {
        if (!agentMap[c.agent_id]) agentMap[c.agent_id] = {};
        if (!agentMap[c.agent_id][c.member_id]) agentMap[c.agent_id][c.member_id] = { hasMem: false, hasReg: false };

        const isMem = c.is_membership_fee === true || c.payment_for === 'membership' || c.amount === 500;
        const isReg = c.payment_for === 'regular' || c.payment_for === 'monthly' || c.payment_for === 'plan_monthly';

        if (isMem) agentMap[c.agent_id][c.member_id].hasMem = true;
        if (isReg) agentMap[c.agent_id][c.member_id].hasReg = true;
    });

    const passers = [];

    for (const agent of agents) {
        const members = agentMap[agent.id] || {};
        let validMemberships = 0;
        let mixCount = 0;

        for (const mId in members) {
            const stats = members[mId];
            if (stats.hasMem) validMemberships++;
            if (stats.hasMem && stats.hasReg) mixCount++;
        }

        const passed = (validMemberships >= 2) || (mixCount >= 1);
        if (passed) {
            passers.push({ id: agent.id, name: `${agent.firstname} ${agent.lastname}`, details: `Mem:${validMemberships}, Mix:${mixCount}` });
        }
    }

    console.log(`✅ TOTAL PASSERS: ${passers.length}`);
    passers.forEach(p => console.log(`   - Agent ${p.id} (${p.name}): ${p.details}`));
}

report_passers_final();
