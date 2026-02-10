
// Scripts/fix_adapted_collections.js
// Run this in the MobileApp directory or similar environment with access to Supabase client
const { createClient } = require('@supabase/supabase-js');

// REPLACE WITH YOUR PROJECT URL AND SERVICE ROLE KEY (temporarily for the script)
// OR run this logic within an existing authenticated context
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY; // Service Role or Anon with Policy rights

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("Please set SUPABASE_URL and SUPABASE_KEY env vars");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function fixAdaptedCollections() {
    console.log("Starting fix for adapted collections...");

    // 1. Get all members who are adapted and have adapted_months > 0
    const { data: members, error: mErr } = await supabase
        .from('members')
        .select('id, maf_no, adapted_months, adapted_amount')
        .eq('is_adapted', true)
        .gt('adapted_months', 0);

    if (mErr) {
        console.error("Error fetching members:", mErr);
        return;
    }

    console.log(`Found ${members.length} adapted members.`);

    for (const m of members) {
        const months = m.adapted_months;
        const monthsText = months === 1 ? '1 month' : `${months} months`;
        const newPaymentFor = `adapted - ${monthsText}`;

        // 2. Find the corresponding collection record
        // We look for collections for this member where payment_for is 'adapted' (exact match)
        // or looks like an adapted payment (amount matches adapted_amount)

        // First try strict match on 'adapted' string
        const { data: cols, error: cErr } = await supabase
            .from('collections')
            .select('id, payment_for, payment')
            .eq('member_id', m.id)
            .eq('payment_for', 'adapted'); // Only target those that haven't been fixed yet

        if (cErr) {
            console.error(`Error fetching cols for member ${m.id}:`, cErr);
            continue;
        }

        if (cols && cols.length > 0) {
            for (const c of cols) {
                console.log(`Updating collection ${c.id} for member ${m.maf_no}: '${c.payment_for}' -> '${newPaymentFor}'`);

                const { error: uErr } = await supabase
                    .from('collections')
                    .update({ payment_for: newPaymentFor })
                    .eq('id', c.id);

                if (uErr) console.error("Update failed:", uErr);
                else console.log("Update success.");
            }
        } else {
            console.log(`No pending 'adapted' collections found for member ${m.maf_no} (ID: ${m.id}).`);
        }
    }

    console.log("Done.");
}

fixAdaptedCollections();
