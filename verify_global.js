
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://agyueadcymdopgihtckc.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFneXVlYWRjeW1kb3BnaWh0Y2tjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzMzA2NjYsImV4cCI6MjA3NDkwNjY2Nn0.EBYfJ9RTkeGLQptG3uWaOsFMIz9DySu3uhaOlzgeeMw";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function verifyGlobalFix() {
    // 1. Check a member with and without membership fee
    const { data: collections, error: cErr } = await supabase
        .from('collections')
        .select('member_id, payment, is_membership_fee')
        .eq('member_id', 310);

    console.log("Member 310 Collections:");
    console.log(JSON.stringify(collections, null, 2));

    const totalRegular = collections
        .filter(c => !c.is_membership_fee)
        .reduce((sum, c) => sum + Number(c.payment), 0);

    const { data: member, error: mErr } = await supabase
        .from('members')
        .select('id, contracted_price, balance, plan_type')
        .eq('id', 310)
        .single();

    console.log("\nMember 310 Database State:");
    console.log(`Price: ${member.contracted_price}, Balance: ${member.balance}, Plan: ${member.plan_type}`);
    console.log(`Regular Paid: ${totalRegular}`);

    // Note: The database 'balance' column might still have the old value if not updated by my script,
    // but the frontend calculation should now show Price - Regular.
    console.log(`Frontend Calculated Balance: ${member.contracted_price - totalRegular}`);

    // 2. Test SQL Functions
    const statusRpcs = ['get_active_members', 'get_warning_members', 'get_at_risk_members', 'get_lapsed_members'];
    for (const rpc of statusRpcs) {
        const { data: list, error: err } = await supabase.rpc(rpc);
        if (list) {
            const m310 = list.find(m => m.id === 310);
            if (m310) {
                console.log(`\nSQL Function ${rpc} for 310:`);
                console.log(`Months Paid: ${m310.months_paid}`);
                console.log(`Months Behind: ${m310.months_behind}`);
                break;
            }
        }
    }

    // 3. Search for another member with is_membership_fee = true
    const { data: otherColls, error: oErr } = await supabase
        .from('collections')
        .select('member_id, payment, is_membership_fee')
        .eq('is_membership_fee', true)
        .neq('member_id', 310)
        .limit(1);

    if (otherColls && otherColls.length > 0) {
        const otherId = otherColls[0].member_id;
        console.log(`\nVerifying another member (ID: ${otherId}) with membership fee...`);
        // ... same logic as above if needed ...
    }
}

verifyGlobalFix();
