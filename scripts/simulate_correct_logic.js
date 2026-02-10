
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const appJsonPath = path.resolve(__dirname, '../app.json');
const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
const SUPABASE_URL = appJson.expo.extra.SUPABASE_URL;
const SUPABASE_ANON_KEY = appJson.expo.extra.SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkMember(memberId) {
    console.log(`\nChecking Member ID: ${memberId}`);

    const { data: member } = await supabase.from('members').select('*').eq('id', memberId).single();
    if (!member) { console.log('Member not found'); return; }

    const { data: collections } = await supabase.from('collections').select('*').eq('member_id', memberId);
    const sorted = (collections || []).sort((a, b) => new Date(a.date_paid) - new Date(b.date_paid));

    // 1. Current DB Logic (Flawed if PlanStart updated without filtering history)
    const mDue = member.monthly_due || 0;
    const dbStart = new Date(member.plan_start_date || member.date_joined);
    const validCols = sorted.filter(c => !c.is_membership_fee && !c.payment_for?.toLowerCase().includes('membership'));
    const totalPaidAll = validCols.reduce((sum, c) => sum + Number(c.payment || c.amount || 0), 0);

    // DB thinks:
    const dbMonthsPaid = mDue > 0 ? totalPaidAll / mDue : 0;
    const dbPaidUntil = new Date(dbStart);
    dbPaidUntil.setMonth(dbPaidUntil.getMonth() + Math.floor(dbMonthsPaid));

    console.log(`--- Current Logic (with my Patch) ---`);
    console.log(`Plan Start: ${dbStart.toISOString().split('T')[0]}`);
    console.log(`Total Paid (Historical): ${totalPaidAll}`);
    console.log(`Paid Until (Calculated): ${dbPaidUntil.toISOString().split('T')[0]}`);
    const graceDb = Math.ceil((new Date().getTime() - dbPaidUntil.getTime()) / (86400000));
    console.log(`Grace Days: ${graceDb}`);

    // 2. Correct "Last Payment / Reinstatement" Logic
    // Only count payments AFTER the reinstatement date

    // Re-detect reinstatement to find "True Effective Start"
    let effectiveStart = new Date(member.date_joined); // Use original join as base to find first gap
    let lastActivity = new Date(effectiveStart);

    // Iterate to find latest gap
    for (const c of sorted) {
        const pDate = new Date(c.date_paid);
        const gapMonths = (pDate.getFullYear() - lastActivity.getFullYear()) * 12 + (pDate.getMonth() - lastActivity.getMonth());
        if (gapMonths >= 3) {
            effectiveStart = pDate;
        }
        lastActivity = pDate;
    }

    // Now FILTER collections
    const effTime = effectiveStart.getTime();
    let validSumReinstated = 0;
    sorted.forEach(c => {
        const pDate = new Date(c.date_paid).getTime();
        if (pDate >= effTime) {
            const payFor = (c.payment_for || '').toLowerCase();
            const isMem = (c.is_membership_fee === true) || payFor.includes('membership');
            if (!isMem) validSumReinstated += Number(c.payment || c.amount || 0);
        }
    });

    const mPaidReinstated = mDue > 0 ? validSumReinstated / mDue : 0;
    const correctPaidUntil = new Date(effectiveStart);
    correctPaidUntil.setMonth(correctPaidUntil.getMonth() + Math.floor(mPaidReinstated));
    correctPaidUntil.setDate(correctPaidUntil.getDate() + Math.round((mPaidReinstated % 1) * 30));

    console.log(`--- Correct Logic (Reinstated Coverage) ---`);
    console.log(`Effective Start: ${effectiveStart.toISOString().split('T')[0]}`);
    console.log(`Valid Paid (Since Reinstatement): ${validSumReinstated}`);
    console.log(`Paid Until: ${correctPaidUntil.toISOString().split('T')[0]}`);
    // 4. Next Due Date (PaidUntil + 1 Month)
    const nextDueDate = new Date(correctPaidUntil);
    nextDueDate.setMonth(nextDueDate.getMonth() + 1);

    // 5. Grace Days
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    nextDueDate.setHours(0, 0, 0, 0);

    const diffMs = now.getTime() - nextDueDate.getTime();
    const graceDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    // Status
    // Active: <= 0 (Before Next Due Date)
    // Warning: 1 - 29
    // Lapsable: 30 - 59
    // Lapsed: >= 60

    let status = 'Active';
    if (graceDays >= 60) status = 'Lapsed';
    else if (graceDays >= 30) status = 'Lapsable';
    else if (graceDays >= 1) status = 'Warning';

    console.log(`Paid Until: ${correctPaidUntil.toISOString().split('T')[0]}`);
    console.log(`Next Due:   ${nextDueDate.toISOString().split('T')[0]}`);
    console.log(`Grace Days: ${graceDays} (Current - NextDue)`);
    console.log(`Status:     ${status}`);
    console.log("------------------------------------------");

    if (dbPaidUntil.getFullYear() > correctPaidUntil.getFullYear() + 1) {
        console.log(`🚨 HUGE DISCREPANCY! DB Logic overestimates coverage by years.`);
    }
}

// Check ID 97 (Gelbert) and 10 (Zosima)
async function main() {
    await checkMember(97);
    await checkMember(10);
}

main();
