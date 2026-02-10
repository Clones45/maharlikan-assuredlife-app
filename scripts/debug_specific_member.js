
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.resolve(__dirname, '../../Desktop/.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const urlMatch = envContent.match(/SUPABASE_URL=(.+)/);
const keyMatch = envContent.match(/SUPABASE_SERVICE_KEY=(.+)/);

const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

async function debugMember() {
    // 1. Find Member by Name/AF
    const { data: members, error: mErr } = await supabase
        .from('members')
        .select('*')
        .ilike('last_name', 'Sarno')
        .ilike('first_name', 'Roel');

    if (mErr || !members.length) {
        console.error("Member not found", mErr);
        return;
    }

    const member = members[0];
    console.log("Member Found:", member.id, member.first_name, member.last_name, member.maf_no);
    console.log("Plan Start:", member.plan_start_date);
    console.log("Date Joined:", member.date_joined);

    // 2. Fetch Collections
    const { data: collections, error: cErr } = await supabase
        .from('collections')
        .select('*')
        .eq('member_id', member.id)
        .order('date_paid', { ascending: true });

    console.log("Collections:", collections.length);
    collections.forEach(c => {
        console.log(`- ${c.date_paid}: ${c.payment} (${c.payment_for}) [IsMembership: ${c.is_membership_fee}]`);
    });

    // 3. Run DB Calculation Check
    const { data: dbDate } = await supabase.rpc('calculate_paid_until', { p_member_id: member.id });
    console.log("DB calculate_paid_until:", dbDate);

    // 4. Simulate statusHelper.ts Logic
    console.log("\n--- Simulating statusHelper.ts ---");

    // Logic from statusHelper.ts (simplified for debugging)
    const mDue = Number(member.monthly_due) || 0;
    const joined = member.plan_start_date || member.date_joined; // 2025-07-28
    const effectiveStartDate = new Date(joined);
    // Manual TZ Fix? Mobile might be doing UTC adjustments?

    console.log("Effective Start (JS):", effectiveStartDate.toISOString());

    const sorted = [...(collections || [])].sort((a, b) => new Date(a.date_paid) - new Date(b.date_paid));

    let validSum = 0;
    sorted.forEach(c => {
        // statusHelper logic:
        // const pDate = new Date(c.date_paid).getTime();
        // if (pDate >= effectiveStartDate.getTime()) ...

        const pDate = new Date(c.date_paid);
        console.log(`Checking Payment ${c.date_paid}:`);
        console.log(`- Payment Time: ${pDate.getTime()}`);
        console.log(`- Effective Time: ${effectiveStartDate.getTime()}`);

        if (pDate.getTime() >= effectiveStartDate.getTime()) {
            validSum += c.payment;
            console.log(`  -> Included! New Sum: ${validSum}`);
        } else {
            console.log(`  -> Excluded (Date < Start)`);
        }
    });

    let paidUntil = new Date(effectiveStartDate);
    const monthsCovered = validSum / mDue;
    const whole = Math.floor(monthsCovered);
    const frac = monthsCovered - whole;
    paidUntil.setMonth(paidUntil.getMonth() + whole);
    paidUntil.setDate(paidUntil.getDate() + Math.round(frac * 30));

    console.log("\nCalculated Paid Until:", paidUntil.toISOString());

    const nextDueDate = new Date(paidUntil);
    nextDueDate.setMonth(nextDueDate.getMonth() + 1);
    console.log("Calculated Next Due:", nextDueDate.toISOString());

    const now = new Date(); // Using system time
    now.setHours(0, 0, 0, 0);
    const ndd = new Date(nextDueDate);
    ndd.setHours(0, 0, 0, 0);

    const diff = now.getTime() - ndd.getTime();
    const graceDays = Math.ceil(diff / (1000 * 60 * 60 * 24));
    console.log("Calculated Grace Days:", graceDays);
}

debugMember();
