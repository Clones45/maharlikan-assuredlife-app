
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://agyueadcymdopgihtckc.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFneXVlYWRjeW1kb3BnaWh0Y2tjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzMzA2NjYsImV4cCI6MjA3NDkwNjY2Nn0.EBYfJ9RTkeGLQptG3uWaOsFMIz9DySu3uhaOlzgeeMw";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function report_passers_safe_v2() {
    console.log("🏆 Checking AGR Status for JAN 2026 (Robust Mode V2)...\n");

    const { data: agents, error: agentError } = await supabase.from('agents').select('id, firstname, lastname').order('id');
    if (agentError || !agents) { console.log("Failed to fetch agents"); return; }

    // Jan 2026 Cycle
    const startDate = '2026-01-07';
    const endDate = '2026-02-07';

    // Fetch collections
    const { data: allCollections, error: collError } = await supabase.from('collections')
        .select('agent_id, member_id, payment_type, amount')
        .gte('date_collected', startDate)
        .lt('date_collected', endDate);

    if (collError) { console.log("Error fetching collections:", collError); return; }
    const collections = allCollections || [];

    console.log(`Analyzing ${collections.length} collections for ${agents.length} agents...`);

    const passers = [];

    for (const agent of agents) {
        // Filter for this agent
        const myColls = collections.filter(c => c.agent_id === agent.id);

        // Group by Member
        const memberMap = {};
        myColls.forEach(c => {
            if (!memberMap[c.member_id]) memberMap[c.member_id] = { hasMem: false, hasReg: false };

            // Check logic
            const isMem = (c.payment_type === 'membership' || c.payment_type === 'membership_fee' || c.amount === 500);
            const isReg = (c.payment_type === 'regular' || c.payment_type === 'plan_monthly' || (c.payment_type === 'outright' && c.amount != 500));

            if (isMem) memberMap[c.member_id].hasMem = true;
            if (isReg) memberMap[c.member_id].hasReg = true;
        });

        let validMemberships = 0;
        let mixCount = 0;

        for (const m in memberMap) {
            const { hasMem, hasReg } = memberMap[m];
            if (hasMem) validMemberships++;
            if (hasMem && hasReg) mixCount++;
        }

        const passed = (validMemberships >= 2) || (mixCount >= 1);
        if (passed) {
            passers.push({ id: agent.id, name: `${agent.firstname} ${agent.lastname}`, details: `Mem:${validMemberships}, Mix:${mixCount}` });
        }
    }

    console.log(`✅ TOTAL PASSERS: ${passers.length}`);
    passers.forEach(p => console.log(`   - Agent ${p.id} (${p.name}): ${p.details}`));
}

report_passers_safe_v2();
