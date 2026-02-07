
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://agyueadcymdopgihtckc.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFneXVlYWRjeW1kb3BnaWh0Y2tjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzMzA2NjYsImV4cCI6MjA3NDkwNjY2Nn0.EBYfJ9RTkeGLQptG3uWaOsFMIz9DySu3uhaOlzgeeMw";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function check_dec_mix() {
    console.log("🔍 Deep Check Agent 6 Dec 2025 Mix...");
    const agentId = 6;
    const start = '2025-12-07';
    const end = '2026-01-07';

    const { data: colls } = await supabase.from('collections')
        .select('*')
        .eq('agent_id', agentId)
        .gte('date_paid', start)
        .lt('date_paid', end);

    console.log(`   Collections in Dec range: ${colls.length}`);

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
        console.log(`   Member ${mId}: Mem? ${hasMem}, Reg? ${hasReg}`);
        if (hasMem && hasReg) {
            hasMix = true;
            console.log("   ✅ FOUND MIX!");
        }
    }

    console.log(`   Result: Passed Dec via Mix? ${hasMix}`);
}

check_dec_mix();
