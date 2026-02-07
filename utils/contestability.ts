export function calculateContestability(dateJoined: string | number | Date | null | undefined, collections: any[]): number {
    if (!dateJoined) return 0;

    // Sort collections by date (just to be safe, though usually ordered)
    const sorted = [...collections].sort((a, b) => {
        const dA = new Date(a.date_paid || a.created_at);
        const dB = new Date(b.date_paid || b.created_at);
        return dA.getTime() - dB.getTime();
    });

    // 1. Initial Reference: Date Joined
    let effectiveStartDate = new Date(dateJoined);
    let lastActivityDate = new Date(dateJoined);

    // 2. Iterate Payments to check for Gaps (Lapses)
    sorted.forEach(col => {
        const pDateVal = col.date_paid || col.created_at;
        const paymentDate = new Date(pDateVal);
        if (isNaN(paymentDate.getTime())) return;

        // Calculate Gap from PREVIOUS activity
        // Logic: (YearDiff * 12) + MonthDiff
        let monthsDiff = (paymentDate.getFullYear() - lastActivityDate.getFullYear()) * 12;
        monthsDiff += paymentDate.getMonth() - lastActivityDate.getMonth();

        // Also adjust for day of month (optional, but "month-based" usually ignores days)
        // User said: "if the member became lapsed or hasn't paid on the last 3 months"
        // Let's stick to pure month difference for simplicity, or approximate.

        if (monthsDiff >= 3) {
            // LAPSE DETECTED!
            // Restart contestability from this new payment date (Reinstatement)
            effectiveStartDate = paymentDate;
        }

        lastActivityDate = paymentDate;
    });

    // 3. Calculate Period from Effective Start to NOW
    const now = new Date();
    let currentMonths = (now.getFullYear() - effectiveStartDate.getFullYear()) * 12;
    currentMonths += now.getMonth() - effectiveStartDate.getMonth();

    // Adjust day? "contestability period is not based on the payment but on the month the member stays"
    // So simple month diff is likely sufficient.

    // 4. Cap at 12
    if (currentMonths < 0) currentMonths = 0;
    if (currentMonths > 12) currentMonths = 12;

    return currentMonths;
}
