
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const appJsonPath = path.resolve(__dirname, '../app.json');
const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
const SUPABASE_URL = appJson.expo.extra.SUPABASE_URL;
const SUPABASE_ANON_KEY = appJson.expo.extra.SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function main() {
    console.log('Scanning for mismatched members...');

    // 1. Fetch all members (limit to 100 recent ones for speed, or paging)
    const { data: members, error } = await supabase
        .from('members')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(200);

    if (error) { console.error(error); return; }

    console.log(`Checking ${members.length} members...`);

    let mismatches = 0;

    for (const m of members) {
        if (!m.monthly_due) continue;

        const { data: collections } = await supabase.from('collections').select('*').eq('member_id', m.id);
        const sorted = (collections || []).sort((a, b) => new Date(a.date_paid) - new Date(b.date_paid));

        // --- LIST VIEW LOGIC (Standard) ---
        const validColsList = sorted.filter(c => !c.is_membership_fee && !c.payment_for?.toLowerCase().includes('membership'));
        const totalPaidList = validColsList.reduce((sum, c) => sum + Number(c.payment || c.amount || 0), 0);
        const monthsPaidList = totalPaidList / m.monthly_due;

        const now = new Date();
        const startList = new Date(m.plan_start_date || m.date_joined || now);
        const monthsSinceList = (now.getFullYear() - startList.getFullYear()) * 12 + (now.getMonth() - startList.getMonth());
        const monthsBehindList = monthsSinceList - monthsPaidList;

        let statusList = 'Active';
        if (monthsBehindList > 3) statusList = 'Lapsed';
        else if (monthsBehindList >= 2) statusList = 'At Risk';
        else if (monthsBehindList >= 1) statusList = 'Warning';

        // --- SOA LOGIC (Reinstatement) ---
        // Calculate Effective Start Date
        let effectiveStartDate = new Date(m.plan_start_date || m.date_joined || m.created_at);
        let lastActivityDate = new Date(effectiveStartDate);

        for (const c of sorted) {
            const pDate = new Date(c.date_paid);
            if (isNaN(pDate.getTime())) continue;
            let mDiff = (pDate.getFullYear() - lastActivityDate.getFullYear()) * 12;
            mDiff += pDate.getMonth() - lastActivityDate.getMonth();
            if (mDiff >= 3) {
                effectiveStartDate = pDate;
            }
            lastActivityDate = pDate;
        }

        const effTime = effectiveStartDate.getTime();
        const joinTime = new Date(m.date_joined).getTime();
        const isReinstated = effTime > joinTime;

        // Valid Sum SOA
        let validSumSOA = 0;
        sorted.forEach(c => {
            const pDate = new Date(c.date_paid).getTime();
            let include = false;
            if (isReinstated) {
                if (pDate >= effTime) include = true;
            } else {
                include = true;
            }
            if (include) {
                const payFor = (c.payment_for || '').toLowerCase();
                const isMem = (c.is_membership_fee === true) || payFor.includes('membership');
                if (!isMem) validSumSOA += Number(c.payment || c.amount || 0);
            }
        });

        // Paid Until
        const monthsCoveredSOA = validSumSOA / m.monthly_due;
        const paidUntil = new Date(effectiveStartDate);
        const whole = Math.floor(monthsCoveredSOA);
        const frac = monthsCoveredSOA - whole;
        paidUntil.setMonth(paidUntil.getMonth() + whole);
        paidUntil.setDate(paidUntil.getDate() + Math.round(frac * 30));

        const nowZero = new Date(); nowZero.setHours(0, 0, 0, 0);
        const puZero = new Date(paidUntil); puZero.setHours(0, 0, 0, 0);
        const diffMs = nowZero.getTime() - puZero.getTime();
        const graceDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

        let statusSOA = 'Active';
        if (m.balance <= 0) statusSOA = 'Completed';
        else if (graceDays > 60) statusSOA = 'Lapsed';
        else if (graceDays >= 30) statusSOA = 'Lapsable'; // At Risk
        else if (graceDays >= 1) statusSOA = 'Warning';
        else statusSOA = 'Active';

        // --- COMPARE ---
        // Map List statuses to SOA terms
        const listMap = {
            'Lapsed': 'Lapsed',
            'At Risk': 'Lapsable',
            'Warning': 'Warning',
            'Active': 'Active'
        };
        const mappedList = listMap[statusList];

        if (mappedList !== statusSOA) {
            // Filter only if List is worse than SOA (e.g. List=Lapsable, SOA=Active)
            const severity = { 'Active': 0, 'Warning': 1, 'Lapsable': 2, 'Lapsed': 3 };
            if (severity[mappedList] > severity[statusSOA]) {
                console.log(`\nMISMATCH FOUND: ID ${m.id} (${m.first_name} ${m.last_name})`);
                console.log(`  List View: ${statusList} (Months Behind: ${monthsBehindList.toFixed(2)})`);
                console.log(`  SOA View:  ${statusSOA} (Grace Days: ${graceDays})`);
                console.log(`  Plan Start: ${m.plan_start_date} | Effective Start: ${effectiveStartDate.toISOString().split('T')[0]}`);
                mismatches++;
            }
        }
    }

    console.log(`\nScan complete. Found ${mismatches} mismatches (List worse than SOA).`);
}

main();
