
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://agyueadcymdopgihtckc.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFneXVlYWRjeW1kb3BnaWh0Y2tjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzMzA2NjYsImV4cCI6MjA3NDkwNjY2Nn0.EBYfJ9RTkeGLQptG3uWaOsFMIz9DySu3uhaOlzgeeMw";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
    console.log("🔍 DIAGNOSING AGR FAILURES (Jan 2026)...");

    const startDate = '2026-01-07';
    const endDate = '2026-02-07';

    // 1. Get ALL collections
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

    const agentMap = {};
    collections.forEach(c => {
        if (!agentMap[c.agent_id]) agentMap[c.agent_id] = [];
        agentMap[c.agent_id].push(c);
    });

    for (const agentId in agentMap) {
        const colls = agentMap[agentId];

        // Skip if 3+ memberships (already passes via Rule A)
        const memCount = colls.filter(c => c.is_membership_fee === true).length;
        if (memCount >= 3) continue;

        // Skip if 0 memberships (impossible to pass Rule B)
        if (memCount === 0) continue;

        // --- CHECK WHY RULE B FAILS ---

        // 1. Mimic Current "Relaxed" Logic (Last|First)
        const groups = {};
        colls.forEach(c => {
            const m = Array.isArray(c.members) ? c.members[0] : c.members;
            if (!m) return;
            const key = `${m.last_name}|${m.first_name}`.trim().toUpperCase();
            if (!groups[key]) groups[key] = [];
            groups[key].push(c);
        });

        let passedRelaxed = false;
        for (const key in groups) {
            const payments = groups[key];
            const hasMem = payments.some(p => p.is_membership_fee === true);
            const hasReg = payments.some(p => p.is_membership_fee === false && p.payment_for === 'regular');

            if (hasMem && hasReg) {
                // Check strict compatibility (MN)
                const mems = payments.filter(p => p.is_membership_fee === true);
                const regs = payments.filter(p => p.is_membership_fee === false && p.payment_for === 'regular');

                const compatible = mems.some(m => {
                    const mMN = (Array.isArray(m.members) ? m.members[0] : m.members)?.middle_name || "";
                    return regs.some(r => {
                        const rMN = (Array.isArray(r.members) ? r.members[0] : r.members)?.middle_name || "";
                        // Logic: (!mMN || !rMN || mMN === rMN)
                        return (!mMN || !rMN || mMN.toUpperCase() === rMN.toUpperCase());
                    });
                });

                if (compatible) { passedRelaxed = true; break; }
            }
        }

        if (passedRelaxed) {
            // Does pass, so user isn't talking about this one. (Or maybe they are, but app failed to update?)
            console.log(`✅ Agent ${agentId} PASSES with current logic.`);
        } else {
            // 2. CHECK "NEAR MISSES"
            // Did they have Mem + Reg but names didn't match perfectly?
            console.log(`❌ Agent ${agentId} FAILS current logic. Investigating collections...`);
            colls.forEach(c => {
                const m = Array.isArray(c.members) ? c.members[0] : c.members;
                const name = m ? `${m.first_name} ${m.middle_name || ""} ${m.last_name}` : `Member #${c.member.id}`;
                console.log(`   - [${c.is_membership_fee ? 'MEM' : 'REG'}] ${c.payment_for} : ${name}`);
            });
        }
    }
}

main();
