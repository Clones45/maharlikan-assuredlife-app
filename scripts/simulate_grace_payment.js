
function calculateGracePeriodStatus(effectiveStartDate, collections, monthlyDue, totalPayable, dateJoined) {
    const sorted = [...(collections || [])].sort((a, b) => new Date(a.date_paid) - new Date(b.date_paid));

    const effTime = effectiveStartDate.getTime();
    const joinTime = new Date(dateJoined).getTime();
    const isReinstated = effTime > joinTime;

    let validPaymentSum = 0;

    sorted.forEach(c => {
        const pDate = new Date(c.date_paid);
        let include = false;

        if (isReinstated) {
            if (pDate.getTime() >= effTime) include = true;
        } else {
            include = true;
        }

        if (include) {
            const payFor = (c.payment_for || '').toLowerCase();
            const isMembership = c.is_membership_fee === true || payFor.includes('membership');
            if (!isMembership) {
                validPaymentSum += Number(c.payment || c.amount || 0);
            }
        }
    });

    const mDue = Number(monthlyDue) || 0;
    let monthsCovered = 0;
    if (mDue > 0) {
        monthsCovered = validPaymentSum / mDue;
    }

    const paidUntil = new Date(effectiveStartDate);
    const wholeMonths = Math.floor(monthsCovered);
    const fractionMonth = monthsCovered - wholeMonths;

    paidUntil.setMonth(paidUntil.getMonth() + wholeMonths);
    paidUntil.setDate(paidUntil.getDate() + Math.round(fractionMonth * 30));

    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const paidUntilOnly = new Date(paidUntil);
    paidUntilOnly.setHours(0, 0, 0, 0);

    const diffTime = now.getTime() - paidUntilOnly.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    const graceDays = Math.max(0, diffDays);

    return { graceDays, paidUntil, validPaymentSum };
}

// --- SIMULATION ---

const MONTHLY_DUE = 500;
// Let's go back enough to have ~59 days grace.
// If today is Feb 9, 2026.
// We want Paid Until to be approx (Feb 9 - 59 days) = Dec 12, 2025.
// If Plan Start was June 12, 2025 (6 months ago).
// If we paid 6 months * 500 = 3000.
// Paid Until = Dec 12, 2025.
// Now = Feb 9, 2026.
// Gap = ~59 days.

const NOW = new Date("2026-02-09T00:00:00Z"); // Fix 'Now' for consistency in test
// Override Date constructor to simulate "Now"
const RealDate = Date;
global.Date = class extends RealDate {
    constructor(...args) {
        if (args.length) return new RealDate(...args);
        return new RealDate(NOW);
    }
}

const planStart = new Date("2025-06-12T00:00:00Z");
const initialPayments = [
    { date_paid: "2025-06-12", payment: 500, payment_for: "monthly" },
    { date_paid: "2025-07-12", payment: 500, payment_for: "monthly" },
    { date_paid: "2025-08-12", payment: 500, payment_for: "monthly" },
    { date_paid: "2025-09-12", payment: 500, payment_for: "monthly" },
    { date_paid: "2025-10-12", payment: 500, payment_for: "monthly" },
    { date_paid: "2025-11-12", payment: 500, payment_for: "monthly" },
]; // Total 3000. 6 months.

console.log("--- SCENARIO 1: 59 Days Grace ---");
const res1 = calculateGracePeriodStatus(planStart, initialPayments, MONTHLY_DUE, 50000, planStart);
console.log(`Paid Until: ${res1.paidUntil.toISOString().split('T')[0]}`);
console.log(`Grace Days: ${res1.graceDays}`);

console.log("\n--- SCENARIO 2: Pay 1 Month ---");
const newPayment = { date_paid: "2026-02-09", payment: 500, payment_for: "monthly" };
const updatedPayments = [...initialPayments, newPayment];

const res2 = calculateGracePeriodStatus(planStart, updatedPayments, MONTHLY_DUE, 50000, planStart);
console.log(`Paid Until: ${res2.paidUntil.toISOString().split('T')[0]}`);
console.log(`Grace Days: ${res2.graceDays}`);

const reduction = res1.graceDays - res2.graceDays;
console.log(`\nReduction: ${reduction} days`);

if (reduction >= 28 && reduction <= 31) {
    console.log("SUCCESS: Grace period reduced by approx 1 month.");
} else {
    console.log("FAILURE: Unexpected reduction.");
}
