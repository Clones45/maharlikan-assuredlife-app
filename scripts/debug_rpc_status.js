
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load env
const appJsonPath = path.resolve(__dirname, '../app.json');
const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
const SUPABASE_URL = appJson.expo.extra.SUPABASE_URL;
const SUPABASE_ANON_KEY = appJson.expo.extra.SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function main() {
    const memberId = 19; // 0096
    console.log(`Checking status for Member ID: ${memberId}`);

    // Helper to find interesting member
    const findInteresting = (list, label) => {
        if (!list) return null;
        // Find someone with months_paid > 5 (arbitrary, implies some history)
        const m = list.find(x => x.months_paid > 5);
        if (m) {
            console.log(`FOUND INTERESTING ${label} MEMBER: ID ${m.id} (${m.first_name} ${m.last_name}) - Paid: ${m.months_paid}`);
            return m.id;
        }
        return null;
    };

    let targetId = null;

    // Check Warning
    const { data: warning, error: wErr } = await supabase.rpc('get_warning_members');
    if (wErr) console.error('Warning RPC Error:', wErr);
    targetId = findInteresting(warning, "WARNING");

    // Check At Risk
    if (!targetId) {
        const { data: atRisk, error: rErr } = await supabase.rpc('get_at_risk_members');
        if (rErr) console.error('AtRisk RPC Error:', rErr);
        targetId = findInteresting(atRisk, "AT RISK");
    }

    // Check Lapsed
    if (!targetId) {
        const { data: lapsed, error: lErr } = await supabase.rpc('get_lapsed_members');
        if (lErr) console.error('Lapsed RPC Error:', lErr);
        targetId = findInteresting(lapsed, "LAPSED");
    }

    if (targetId) {
        await inspectMember(targetId);
    } else {
        console.log('No interesting members found (with > 5 months paid).');
        // Fallback: check ANY payment
        // ...
    }
}

async function inspectMember(memberId) {
    const { data: member } = await supabase.from('members').select('*').eq('id', memberId).single();
    const { data: collections } = await supabase.from('collections').select('*').eq('member_id', memberId);

    console.log('\n--- Manual Data Inspection ---');
    console.log(`Member ID: ${memberId}`);
    console.log(`Plan Type: ${member.plan_type}`);
    console.log(`Monthly Due: ${member.monthly_due}`);
    console.log(`Plan Start: ${member.plan_start_date}`);
    console.log(`Date Joined: ${member.date_joined}`);

    const validCollections = collections.filter(c => !c.is_membership_fee && !c.payment_for?.toLowerCase().includes('membership'));
    const totalPaid = validCollections.reduce((sum, c) => sum + Number(c.payment || c.amount || 0), 0);
    console.log(`Total Valid Paid: ${totalPaid}`);

    if (member.monthly_due > 0) {
        const monthsPaid = totalPaid / member.monthly_due;
        console.log(`Months Paid: ${monthsPaid}`);

        const now = new Date();
        const start = new Date(member.plan_start_date || member.date_joined || now);
        const monthsSince = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
        console.log(`Months Since Start: ${monthsSince}`);

        const monthsBehind = monthsSince - monthsPaid;
        console.log(`Months Behind: ${monthsBehind.toFixed(2)}`);
    }
}

main();
