
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://agyueadcymdopgihtckc.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFneXVlYWRjeW1kb3BnaWh0Y2tjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzMzA2NjYsImV4cCI6MjA3NDkwNjY2Nn0.EBYfJ9RTkeGLQptG3uWaOsFMIz9DySu3uhaOlzgeeMw";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function check_jan_agr_all() {
    console.log("🏆 Checking Jan 2026 AGR Status for ALL Agents (Jan 7 - Feb 7)...");

    // 1. Get All Agents
    const { data: agents, error } = await supabase.from('agent_wallets').select('agent_id');
    if (error) { console.log("Error fetching agents:", error); return; }

    console.log(`   Found ${agents.length} agents.`);

    const start = '2026-01-07';
    const end = '2026-02-07';
    const passers = [];

    for (const a of agents) {
        const agentId = a.agent_id;

        // Fetch collections in range
        const { data: colls } = await supabase.from('collections')
            .select('*')
            .eq('agent_id', agentId)
            .gte('date_paid', start)
            .lt('date_paid', end);

        if (!colls || colls.length === 0) continue;

        // 1. Check Membership Count
        const memCount = colls.filter(c => c.is_membership_fee).length;

        // 2. Check Mix
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
            if (hasMem && hasReg) {
                hasMix = true;
                break;
            }
        }

        if (memCount >= 3 || hasMix) {
            passers.push({ id: agentId, reason: hasMix ? "Mix" : "3+ Memberships" });
            console.log(`   ✅ Agent ${agentId} PASSED (${hasMix ? "Mix" : memCount + " Mems"})`);
        }
    }

    console.log("\n🎊 SUMMARY: The following agents PASSED Jan AGR:");
    passers.forEach(p => console.log(`   - Agent ${p.id} (${p.reason})`));
    console.log(`   Total: ${passers.length} Agents`);
}

check_jan_agr_all();
