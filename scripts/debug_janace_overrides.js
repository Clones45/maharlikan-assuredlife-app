
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://agyueadcymdopgihtckc.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFneXVlYWRjeW1kb3BnaWh0Y2tjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzMzA2NjYsImV4cCI6MjA3NDkwNjY2Nn0.EBYfJ9RTkeGLQptG3uWaOsFMIz9DySu3uhaOlzgeeMw";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
    const rootAgentId = 6; // Janace
    console.log(`🔎 DEEP DIVE: Downline Tree for Agent ${rootAgentId}...`);

    // 1. Build Tree
    let allDownlineIds = [];
    let currentLevelIds = [rootAgentId];

    for (let level = 1; level <= 5; level++) {
        const { data: recruits } = await supabase
            .from('agents')
            .select('id, firstname, lastname, position, assigned_id')
            .in('assigned_id', currentLevelIds);

        if (!recruits || recruits.length === 0) break;

        const ids = recruits.map(r => r.id);
        console.log(`   Level ${level}: Found ${ids.length} agents.`);
        recruits.forEach(r => console.log(`      - [${r.id}] ${r.firstname} ${r.lastname} (${r.position})`));

        allDownlineIds = [...allDownlineIds, ...ids];
        currentLevelIds = ids;
    }

    console.log(`\n📉 Total Downline Size: ${allDownlineIds.length}`);

    if (allDownlineIds.length === 0) {
        console.log("   No downlines found. No overrides possible.");
        return;
    }

    // 2. Check January Sales for ENTIRE Tree
    console.log(`\n📅 Checking January 2026 Sales for all ${allDownlineIds.length} agents...`);

    const { data: sales } = await supabase
        .from('collections')
        .select('id, payment, date_paid, agent_id, is_membership_fee, payment_for')
        .in('agent_id', allDownlineIds)
        .gte('date_paid', '2026-01-01');

    if (!sales || sales.length === 0) {
        console.log("   ❌ NO SALES found in downline for January.");
    } else {
        console.log(`   found ${sales.length} sales!`);
        sales.forEach(s => {
            console.log(`   - Sale ₱${s.payment} by Agent ${s.agent_id} on ${s.date_paid} (Mem: ${s.is_membership_fee})`);
        });

        // 3. Why no override?
        // Logic requires: 
        // - Sale must be valid
        // - `handle_collection_commissions` must run
        // - Upline chain must remain intact
    }
}

main();
