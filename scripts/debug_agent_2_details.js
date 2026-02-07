
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://agyueadcymdopgihtckc.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFneXVlYWRjeW1kb3BnaWh0Y2tjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzMzA2NjYsImV4cCI6MjA3NDkwNjY2Nn0.EBYfJ9RTkeGLQptG3uWaOsFMIz9DySu3uhaOlzgeeMw";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function inspect() {
    console.log("🔍 Inspecting Agent 2 Data...");
    const agentId = 2;

    // 1. Withdrawal Requests
    console.log("\n1️⃣ Withdrawal Requests:");
    const { data: wreqs } = await supabase.from('withdrawal_requests').select('*').eq('agent_id', agentId);
    if (!wreqs || wreqs.length === 0) console.log("   No withdrawals found.");
    else wreqs.forEach(w => console.log(`   - [${w.status}] Amount: ${w.amount}, Date: ${w.created_at}`));

    // 2. Commissions in 2026-2
    console.log("\n2️⃣ Commissions in 2026-2 (Feb Period):");
    const { data: comms } = await supabase.from('commissions')
        .select('*')
        .eq('agent_id', agentId)
        .eq('period_year', 2026)
        .eq('period_month', 2);

    if (!comms || comms.length === 0) console.log("   No commissions in 2026-2.");
    else {
        console.log(`   Found ${comms.length} commissions.`);
        let sum = 0;
        let releasedSum = 0;
        comms.forEach(c => {
            let val = 0;
            if (c.commission_type === 'override' || c.commission_type === 'recruiter_bonus') {
                val = c.override_commission > 0 ? c.override_commission : c.amount;
            } else if (c.is_receivable) {
                val = c.amount;
            }
            sum += val;

            // Check inferred status
            // We can't easily check if it was 'added' to wallet without logs, 
            // but we can list details.
            if (comms.length < 10 || val > 500) { // Limit output
                console.log(`   - ID ${c.id}: ${c.commission_type}, Amt=${val}, Date=${c.date_earned}, Recv=${c.is_receivable}`);
            }
        });
        console.log(`   Total Sum in 2026-2: ${sum}`);
    }

    // 3. Jan AGR Status Verification
    console.log("\n3️⃣ Verifying Jan 2026 AGR (affects 2026-2 Release):");
    // Range: Jan 7 to Feb 7
    const start = '2026-01-07';
    const end = '2026-02-07';

    const { data: colls } = await supabase.from('collections')
        .select('*')
        .eq('agent_id', agentId)
        .gte('date_paid', start)
        .lt('date_paid', end);

    const membershipCount = colls.filter(c => c.is_membership_fee).length;
    console.log(`   Collections in Jan: ${colls.length}`);
    console.log(`   Membership Count: ${membershipCount}`);

    // Check for mix
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
        if (hasMem && hasReg) { hasMix = true; break; }
    }
    console.log(`   Has Mix: ${hasMix}`);
    console.log(`   Passed Jan AGR? ${(membershipCount >= 3 || hasMix) ? "YES" : "NO"}`);
}

inspect();
