const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://agyueadcymdopgihtckc.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFneXVlYWRjeW1kb3BnaWh0Y2tjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzMzA2NjYsImV4cCI6MjA3NDkwNjY2Nn0.EBYfJ9RTkeGLQptG3uWaOsFMIz9DySu3uhaOlzgeeMw";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function main() {
    console.log("Fetching member 0096...");
    const { data: members, error: mErr } = await supabase
        .from('members')
        .select('*')
        .eq('maf_no', '0096')
        .limit(1);

    if (mErr) {
        console.error("Member fetch error:", mErr);
        return;
    }
    if (!members || members.length === 0) {
        console.error("Member 0096 not found");
        return;
    }

    const member = members[0];
    console.log("Member found:", member.first_name, member.last_name, "ID:", member.id);
    console.log("Plan Start:", member.plan_start_date);
    console.log("Date Joined:", member.date_joined);
    console.log("Monthly Due:", member.monthly_due);

    const { data: collections, error: cErr } = await supabase
        .from('collections')
        .select('*')
        .eq('member_id', member.id)
        .order('date_paid', { ascending: true });

    if (cErr) {
        console.error("Collections fetch error:", cErr);
        return;
    }

    console.log(`Found ${collections.length} collections.`);
    collections.forEach(c => {
        console.log(` - Paid: ${c.date_paid}, Amt: ${c.payment}, For: ${c.payment_for}, IsMem: ${c.is_membership_fee}`);
    });

    // Run Logic
    const effectiveDate = getEffectiveStartDate(member.date_joined, collections);
    console.log("Effective Start Date:", effectiveDate.toISOString());

    const result = calculateGracePeriodStatus(effectiveDate, collections, member.monthly_due, member.contracted_price, member.date_joined);
    console.log("Calculation Result:", result);
}

function getEffectiveStartDate(dateJoined, collections) {
    if (!dateJoined) return new Date();

    // Filter valid payments
    const sorted = [...(collections || [])].sort((a, b) => new Date(a.date_paid) - new Date(b.date_paid));

    let effectiveStartDate = new Date(dateJoined);
    let lastActivityDate = new Date(dateJoined);

    sorted.forEach(col => {
        const paymentDate = new Date(col.date_paid);
        if (isNaN(paymentDate.getTime())) return;

        // Calculate Gap from PREVIOUS activity in MONTHS
        let monthsDiff = (paymentDate.getFullYear() - lastActivityDate.getFullYear()) * 12;
        monthsDiff += paymentDate.getMonth() - lastActivityDate.getMonth();

        // If gap >= 3, Reset.
        if (monthsDiff >= 3) {
            // LAPSE DETECTED -> REINSTATEMENT
            console.log(`Reinstatement detected! Gap: ${monthsDiff} months. New Start: ${paymentDate.toISOString()}`);
            effectiveStartDate = paymentDate;
        }

        lastActivityDate = paymentDate;
    });

    return effectiveStartDate;
}

function calculateGracePeriodStatus(effectiveStartDate, collections, monthlyDue, totalPayable, dateJoined) {
    const sorted = [...(collections || [])].sort((a, b) => new Date(a.date_paid) - new Date(b.date_paid));

    // Check if Reinstated
    // If effectiveStartDate > dateJoined (with some tolerance or check equality)
    // Actually, effectiveStartDate comes from getEffectiveStartDate which defaults to dateJoined.
    // So if strictly greater, it's reinstated.
    const isReinstated = effectiveStartDate.getTime() > new Date(dateJoined).getTime();
    console.log("Is Reinstated?", isReinstated);

    let validPaymentSum = 0;
    const effStartTime = effectiveStartDate.getTime();

    sorted.forEach(c => {
        const pDate = new Date(c.date_paid);
        let include = false;

        if (isReinstated) {
            // Strict filter for reinstatement
            if (pDate.getTime() >= effStartTime) include = true;
        } else {
            // Include ALL payments if not reinstated (even if early)
            include = true;
        }

        if (include) {
            const payFor = (c.payment_for || '').toLowerCase();
            const isMembership = c.is_membership_fee === true || payFor.includes('membership');
            if (!isMembership) {
                validPaymentSum += Number(c.payment || c.amount || 0);
                console.log(`   -> Valid Payment: ${c.date_paid} : ${c.payment} (Sum: ${validPaymentSum})`);
            } else {
                console.log(`   -> Skipped (others): ${c.date_paid} : ${c.payment}`);
            }
        } else {
            console.log(`   -> Skipped (Before Start & Reinstated): ${c.date_paid} : ${c.payment}`);
        }
    });

    const mDue = Number(monthlyDue) || 0;
    let monthsCovered = 0;
    if (mDue > 0) {
        monthsCovered = validPaymentSum / mDue;
    }
    console.log("Months Covered:", monthsCovered);

    const paidUntil = new Date(effectiveStartDate);
    const wholeMonths = Math.floor(monthsCovered);
    const fractionMonth = monthsCovered - wholeMonths;

    paidUntil.setMonth(paidUntil.getMonth() + wholeMonths);
    paidUntil.setDate(paidUntil.getDate() + Math.round(fractionMonth * 30));

    console.log("Paid Until Date:", paidUntil.toISOString());

    const now = new Date();
    // Reset hours to compare dates only?
    now.setHours(0, 0, 0, 0);
    const paidUntilOnly = new Date(paidUntil);
    paidUntilOnly.setHours(0, 0, 0, 0);

    // Diff in ms
    const diffTime = now.getTime() - paidUntilOnly.getTime();
    // Diff in days
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    const graceDays = Math.max(0, diffDays);

    let status = 'Active';
    let color = '#22c55e'; // Green

    if (graceDays <= 0) {
        status = 'Active';
        color = '#22c55e';
    } else if (graceDays >= 1 && graceDays <= 29) {
        status = 'Warning';
        color = '#eab308'; // Yellow
    } else if (graceDays >= 30 && graceDays <= 59) {
        status = 'Lapsable';
        color = '#f97316'; // Orange
    } else if (graceDays >= 60) {
        status = 'Lapsed';
        color = '#ef4444'; // Red
    }

    return { status, color, daysGrace: graceDays, paidUntilText: paidUntil.toDateString() };
}

main();
