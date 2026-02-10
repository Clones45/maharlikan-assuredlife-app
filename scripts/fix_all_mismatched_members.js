
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const appJsonPath = path.resolve(__dirname, '../app.json');
const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
const SUPABASE_URL = appJson.expo.extra.SUPABASE_URL;
const SUPABASE_ANON_KEY = appJson.expo.extra.SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function main() {
    console.log('Starting Fix for Mismatched Members...');

    // 1. Fetch all members
    const { data: members, error } = await supabase
        .from('members')
        .select('*')
        .order('id', { ascending: true });

    if (error) { console.error(error); return; }

    console.log(`Checking ${members.length} members...`);

    let fixedCount = 0;

    for (const m of members) {
        if (!m.monthly_due) continue;

        const { data: collections } = await supabase.from('collections').select('*').eq('member_id', m.id);
        const sorted = (collections || []).sort((a, b) => new Date(a.date_paid) - new Date(b.date_paid));

        // --- SOA LOGIC (Reinstatement) ---
        // Calculate Effective Start Date
        let effectiveStartDate = new Date(m.plan_start_date || m.date_joined || m.created_at);
        let lastActivityDate = new Date(effectiveStartDate);

        let hasReinstatement = false;
        let newStartDate = effectiveStartDate;

        for (const c of sorted) {
            const pDate = new Date(c.date_paid);
            if (isNaN(pDate.getTime())) continue;
            let mDiff = (pDate.getFullYear() - lastActivityDate.getFullYear()) * 12;
            mDiff += pDate.getMonth() - lastActivityDate.getMonth();

            // Gap > 3 months?
            if (mDiff >= 3) {
                newStartDate = pDate;
                hasReinstatement = true;
            }
            lastActivityDate = pDate;
        }

        if (hasReinstatement) {
            // Check if DB Plan Start Date is significantly different from New Start Date
            const dbStart = new Date(m.plan_start_date || m.date_joined);
            const diffTime = Math.abs(newStartDate.getTime() - dbStart.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays > 30) {
                console.log(`\nFound Candidate for Fix: ID ${m.id} (${m.first_name} ${m.last_name})`);
                console.log(`  Current Plan Start: ${m.plan_start_date || m.date_joined}`);
                console.log(`  Calculated Start:   ${newStartDate.toISOString().split('T')[0]}`);
                console.log(`  Status Mismatch:    DB thinks Lapsed/Risk, App thinks Active.`);

                // UPDATE DB
                const isoDate = newStartDate.toISOString().split('T')[0]; // YYYY-MM-DD
                const { error: updateErr } = await supabase
                    .from('members')
                    .update({ plan_start_date: isoDate })
                    .eq('id', m.id);

                if (updateErr) {
                    console.error(`  ERROR Updating: ${updateErr.message}`);
                } else {
                    console.log(`  ✅ SUCCESS: Updated plan_start_date to ${isoDate}`);
                    fixedCount++;
                }
            }
        }
    }

    console.log(`\nFix complete. Updated ${fixedCount} members.`);
}

main();
