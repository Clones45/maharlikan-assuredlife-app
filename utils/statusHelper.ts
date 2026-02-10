
// utils/statusHelper.ts

export type MemberStatus = 'Active' | 'Warning' | 'Lapsable' | 'Lapsed' | 'Completed';

export interface StatusResult {
    status: MemberStatus;
    statusColor: string;
    graceDays: number;
    paidUntilDate: Date;
    effectiveStartDate: Date;
}

export function getEffectiveStartDate(dateJoined: string | Date | null | undefined, collections: any[]): Date {
    const joinDate = dateJoined ? new Date(dateJoined) : new Date();
    let effective = new Date(joinDate);
    let lastActivity = new Date(joinDate);

    const sorted = [...(collections || [])].sort((a, b) => new Date(a.date_paid).getTime() - new Date(b.date_paid).getTime());

    for (const c of sorted) {
        const pDate = new Date(c.date_paid);
        if (isNaN(pDate.getTime())) continue;

        let mDiff = (pDate.getFullYear() - lastActivity.getFullYear()) * 12;
        mDiff += pDate.getMonth() - lastActivity.getMonth();

        if (mDiff >= 3) {
            effective = pDate;
        }
        lastActivity = pDate;
    }
    return effective;
}

export function calculateMemberStatus(
    member: {
        monthly_due?: number | string | null;
        contracted_price?: number | string | null;
        plan_start_date?: string | null;
        date_joined?: string | null;
        created_at?: string | null;
        balance?: number | string | null;
    },
    collections: any[]
): StatusResult {

    const mDue = Number(member.monthly_due) || 0;
    const contracted = Number(member.contracted_price) || 0;

    // 1. Determine Effective Start Date
    // logic: Use the helper function to dynamically calculate it from collections, matching SOA/DB logic.
    // We prefer date_joined as the base anchor.
    const effectiveStartDate = getEffectiveStartDate(member.date_joined || member.created_at, collections);

    const originalJoined = new Date(member.date_joined || member.created_at || new Date().toISOString()).getTime();
    const isReinstated = effectiveStartDate.getTime() > originalJoined;

    // 2. Filter Valid Payments
    const sorted = [...(collections || [])].sort((a, b) => new Date(a.date_paid).getTime() - new Date(b.date_paid).getTime());

    let validSum = 0;
    let totalPaid = 0; // For balance calc separate from status

    sorted.forEach(c => {
        const pDate = new Date(c.date_paid).getTime();
        const payFor = (c.payment_for || '').toLowerCase();
        const isMembership = (c.is_membership_fee === true) || payFor.includes('membership');

        if (!isMembership) totalPaid += Number(c.payment || 0);

        let include = false;
        if (isReinstated) {
            if (pDate >= effectiveStartDate.getTime()) include = true;
        } else {
            include = true;
        }

        if (include && !isMembership) {
            validSum += Number(c.payment || 0);
        }
    });

    // 3. Calculate Paid Through Date
    // Formula: Inception (Effective Start) + (Total Valid Installments * 1 Month)
    let paidThroughDate = new Date(effectiveStartDate);
    if (mDue > 0) {
        const monthsPaid = validSum / mDue;
        const wholeMonths = Math.floor(monthsPaid);
        // Add whole months
        paidThroughDate.setMonth(paidThroughDate.getMonth() + wholeMonths);

        // Handle fractional months if necessary (usually not for strict monthly due)
        // For simplicity and standard logic, we stick to whole months for the "Paid Through" date base.
        // If there's a fraction, it technically extends coverage partially, but "Paid Through" usually implies fully paid periods.
        // Let's stick to whole months as the "Paid Through" marker.
    } else {
        paidThroughDate.setFullYear(paidThroughDate.getFullYear() + 100);
    }

    // 4. Calculate Next Due Date
    // New Rule: The day after coverage ends.
    // If Paid Through is Dec 28, Coverage ends Dec 28. Next Due is Dec 29.
    // However, standard billing usually aligns Next Due to the same day of the month.
    // User Example: "Paid through Feb 27... Next Due Feb 28".
    // This implies PaidThrough is the last day of coverage. Next Due is PaidThrough + 1 Day.

    const nextDueDate = new Date(paidThroughDate);
    nextDueDate.setDate(nextDueDate.getDate() + 1);

    // 5. Calculate Grace Days
    // IF Today <= Next Due Date: Grace = 0, Status = Active.
    // IF Today > Next Due Date: Grace = Today - Next Due Date.

    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const ndd = new Date(nextDueDate);
    ndd.setHours(0, 0, 0, 0);

    let finalGrace = 0;
    if (now.getTime() > ndd.getTime()) {
        const diffMs = now.getTime() - ndd.getTime();
        const graceDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        finalGrace = Math.max(0, graceDays);
    } else {
        finalGrace = 0;
    }

    // 6. Determine Status
    let status: MemberStatus = 'Active';
    let statusColor = '#22c55e';

    // Balance check (optional override)
    const currentBal = Math.max(0, contracted - totalPaid);

    if (currentBal <= 0) {
        status = 'Completed';
        statusColor = '#22c55e';
    } else {
        if (finalGrace <= 0) {
            status = 'Active';
            statusColor = '#22c55e';
        } else if (finalGrace >= 1 && finalGrace <= 29) {
            status = 'Warning';
            statusColor = '#eab308';
        } else if (finalGrace >= 30 && finalGrace <= 59) {
            status = 'Lapsable';
            statusColor = '#f97316';
        } else { // >= 60
            status = 'Lapsed';
            statusColor = '#ef4444';
        }
    }

    return { status, statusColor, graceDays: finalGrace, paidUntilDate: paidThroughDate, effectiveStartDate: effectiveStartDate };
}
