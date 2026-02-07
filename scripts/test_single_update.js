const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://agyueadcymdopgihtckc.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFneXVlYWRjeW1kb3BnaWh0Y2tjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzMzA2NjYsImV4cCI6MjA3NDkwNjY2Nn0.EBYfJ9RTkeGLQptG3uWaOsFMIz9DySu3uhaOlzgeeMw";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
    console.log("🔍 TESTING SINGLE COMMISSION UPDATE\n");

    const AGENT_ID = 2;

    // Get one commission
    const { data: comm } = await supabase
        .from('commissions')
        .select('*')
        .eq('agent_id', AGENT_ID)
        .eq('is_receivable', true)
        .gte('date_earned', '2025-12-07')
        .lt('date_earned', '2026-01-07')
        .limit(1)
        .single();

    if (!comm) {
        console.log("✅ No receivable commissions found!");
        return;
    }

    console.log("📋 BEFORE UPDATE:");
    console.log(`   ID: ${comm.id}`);
    console.log(`   Date: ${comm.date_earned}`);
    console.log(`   Type: ${comm.commission_type}`);
    console.log(`   is_receivable: ${comm.is_receivable}\n`);

    // Update it
    console.log("🔧 Updating...");
    const { error } = await supabase
        .from('commissions')
        .update({ is_receivable: false })
        .eq('id', comm.id);

    if (error) {
        console.error(`❌ Error: ${error.message}`);
        return;
    }

    console.log("✅ Update successful\n");

    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Check again
    const { data: after } = await supabase
        .from('commissions')
        .select('*')
        .eq('id', comm.id)
        .single();

    console.log("📋 AFTER UPDATE:");
    console.log(`   ID: ${after.id}`);
    console.log(`   Date: ${after.date_earned}`);
    console.log(`   Type: ${after.commission_type}`);
    console.log(`   is_receivable: ${after.is_receivable}\n`);

    if (after.is_receivable === false) {
        console.log("✅ SUCCESS: Commission is now not receivable!");
    } else {
        console.log("❌ FAILURE: Commission is still receivable!");
        console.log("   This suggests a trigger or RLS policy is preventing the update.");
    }
}

main().catch(console.error);
