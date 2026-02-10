
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
    console.log(`Inspecting DB fields for Member ID: ${memberId}`);

    const { data: member, error } = await supabase
        .from('members')
        .select('*')
        .eq('id', memberId)
        .single();

    if (error) {
        console.error("Error:", error);
        return;
    }

    console.log('--- Member Data ---');
    console.log(`Plan Type: ${member.plan_type}`);
    console.log(`Contracted Price: ${member.contracted_price}`);
    console.log(`Balance: ${member.balance}`);
    console.log(`Monthly Due: ${member.monthly_due}`);
    console.log(`Plan Start Date: ${member.plan_start_date}`);
    console.log(`Date Joined: ${member.date_joined}`);

    // Calculate expected logic used by view_members
    const cPrice = Number(member.contracted_price) || 0;
    const bal = Number(member.balance) || 0;
    const mDue = Number(member.monthly_due) || 0;

    let paidCount = 0;
    if (mDue > 0) {
        const paidAmount = cPrice - bal;
        paidCount = paidAmount / mDue;
    }
    console.log(`Calculated Months Paid (via Balance): ${paidCount}`);

    const now = new Date();
    const start = new Date(member.plan_start_date || member.date_joined || now);
    const monthsSince = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
    console.log(`Calculated Months Since Start: ${monthsSince}`);

    const monthsBehind = monthsSince - paidCount;
    console.log(`Calculated Months Behind: ${monthsBehind.toFixed(2)}`);

    if (monthsBehind >= 1) console.log("Result: WARNING");
    if (monthsBehind >= 2) console.log("Result: AT RISK / LAPSABLE");
    if (monthsBehind > 3) console.log("Result: LAPSED");
}

main();
