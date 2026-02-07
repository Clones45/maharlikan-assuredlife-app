
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://agyueadcymdopgihtckc.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFneXVlYWRjeW1kb3BnaWh0Y2tjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzMzA2NjYsImV4cCI6MjA3NDkwNjY2Nn0.EBYfJ9RTkeGLQptG3uWaOsFMIz9DySu3uhaOlzgeeMw";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
    console.log("🔍 Testing ULTRA-RELAXED Logic (No Middle Name Check)...");

    const startDate = '2026-01-07';
    const endDate = '2026-02-07';

    // 1. Get raw collections
    const { data: collections, error } = await supabase
        .from('collections')
        .select(`
            id,
            agent_id,
            is_membership_fee,
            amount:payment,
            payment_for,
            date_paid,
            members (
                id,
                first_name,
                last_name,
                middle_name
            )
        `)
        .gte('date_paid', startDate)
        .lt('date_paid', endDate);

    if (error) { console.error(error); return; }

    // 2. Group by Agent
    const agentMap = {};
    collections.forEach(c => {
        if (!agentMap[c.agent_id]) agentMap[c.agent_id] = [];
        agentMap[c.agent_id].push(c);
    });

    let passingAgents = [];

    for (const agentId in agentMap) {
        const colls = agentMap[agentId];

        // Rule A: 3+ Membership Fees
        const memCount = colls.filter(c => c.is_membership_fee === true).length;

        // --- ULTRA-RELAXED LOGIC ---
        const groups = {};
        colls.forEach(c => {
            const m = Array.isArray(c.members) ? c.members[0] : c.members;
            if (!m) return;
            // Key: LAST|FIRST (Ignore Middle)
            const key = `${m.last_name}|${m.first_name}`.trim().toUpperCase();
            if (!groups[key]) groups[key] = [];
            groups[key].push(c);
        });

        let ruleB = false;
        for (const key in groups) {
            const payments = groups[key];
            const hasMem = payments.some(p => p.is_membership_fee === true);
            const hasReg = payments.some(p => p.is_membership_fee === false && p.payment_for === 'regular');

            // IF match found here, it passes (no MN check)
            if (hasMem && hasReg) {
                ruleB = true;
                break;
            }
        }

        if (memCount >= 3 || ruleB) {
            passingAgents.push({ agentId, ruleB });
        }
    }

    console.log(`\nRESULTS:`);
    console.log(`Ultra-Relaxed Logic Passing Agents: ${passingAgents.length}`);
    passingAgents.forEach(a => {
        console.log(`- Agent ${a.agentId} (Rule B: ${a.ruleB})`);
    });

    // Check for Agent 6
    if (passingAgents.some(a => String(a.agentId) === '6')) {
        console.log("\n✅ SUCCESS: Agent 6 now passes!");
    } else {
        console.log("\n❌ FAILURE: Agent 6 still fails.");
    }
}

main();
