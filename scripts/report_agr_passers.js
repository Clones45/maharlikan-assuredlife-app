
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://agyueadcymdopgihtckc.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFneXVlYWRjeW1kb3BnaWh0Y2tjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzMzA2NjYsImV4cCI6MjA3NDkwNjY2Nn0.EBYfJ9RTkeGLQptG3uWaOsFMIz9DySu3uhaOlzgeeMw";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function report_passers() {
    console.log("🏆 Checking AGR Status for JAN 2026 (All Agents)...\n");

    const { data: agents } = await supabase.from('agents').select('id, firstname, lastname').order('id');

    // Date Range for Jan 2026 AGR: Jan 7, 2026 to Feb 7, 2026
    const startDate = '2026-01-07';
    const endDate = '2026-02-07';

    const passers = [];
    const failers = [];

    for (const agent of agents) {
        // Get Collections in Range
        const { data: collections } = await supabase.from('collections')
            .select('member_id, payment_type, amount, date_collected')
            .eq('agent_id', agent.id)
            .gte('date_collected', startDate)
            .lt('date_collected', endDate);

        let membershipCount = 0;
        const memberPayments = {}; // map of member_id -> { hasMembership: bool, hasRegular: bool }

        collections.forEach(c => {
            if (!memberPayments[c.member_id]) memberPayments[c.member_id] = { hasMembership: false, hasRegular: false };

            // Check Payment Type
            // Assuming 'membership' or amount=500 is membership
            // Assuming 'monthly' or 'regular' is regular
            const isMembership = c.payment_type === 'membership' || c.payment_type === 'membership_fee';
            const isRegular = c.payment_type === 'regular' || c.payment_type === 'plan_monthly';

            if (isMembership) {
                // Count unique membership payments? Or unique members paying membership?
                // Rule: "2 Memberships" -> usually means 2 different people paid membership.
                // Or 1 person paid 2 memberships? Usually 2 different people.
                // We'll count unique members who paid membership.
            }
            // Let's refine based on the member object in the loop
        });

        // Unique Member Analysis
        const uniqueMembers = Object.keys(memberPayments);
        let validMemberships = 0;
        let mixCount = 0;

        for (const mId of uniqueMembers) {
            // Re-scan strictly for this member
            const memColls = collections.filter(c => c.member_id === mId);
            const hasMem = memColls.some(c => c.payment_type === 'membership' || c.payment_type === 'membership_fee');
            const hasReg = memColls.some(c => c.payment_type === 'regular' || c.payment_type === 'plan_monthly');

            if (hasMem) validMemberships++;
            if (hasMem && hasReg) mixCount++;
        }

        const passed = (validMemberships >= 2) || (mixCount >= 1);

        if (passed) {
            passers.push({ id: agent.id, name: `${agent.firstname} ${agent.lastname}`, counts: `Mem: ${validMemberships}, Mix: ${mixCount}` });
        } else {
            failers.push({ id: agent.id, name: `${agent.firstname} ${agent.lastname}`, counts: `Mem: ${validMemberships}, Mix: ${mixCount}` });
        }
    }

    console.log(`✅ PASSED (${passers.length}):`);
    passers.forEach(p => console.log(`   - Agent ${p.id} (${p.name}): ${p.counts}`));

    console.log(`\n❌ FAILED (${failers.length}):`);
    // failers.forEach(p => console.log(`   - Agent ${p.id} (${p.name}): ${p.counts}`)); -- Too noisy, just count
}

report_passers();
