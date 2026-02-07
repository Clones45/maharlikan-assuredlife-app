
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://agyueadcymdopgihtckc.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFneXVlYWRjeW1kb3BnaWh0Y2tjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzMzA2NjYsImV4cCI6MjA3NDkwNjY2Nn0.EBYfJ9RTkeGLQptG3uWaOsFMIz9DySu3uhaOlzgeeMw";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
    const contextMhId = 6; // Janace
    console.log(`🔧 Linking Orphan Agents to Universal MH (Agent ${contextMhId})...`);

    // 1. Find agents with no assigned_id (excluding Janace herself)
    // using "is" for null check
    const { data: orphans, error } = await supabase
        .from('agents')
        .select('*')
        .is('assigned_id', null)
        .neq('id', contextMhId); // Don't link Janace to herself

    if (error) { console.error("Error finding orphans:", error); return; }

    console.log(`Found ${orphans.length} top-level agents (roots):`);
    orphans.forEach(a => console.log(`   - [${a.id}] ${a.firstname} ${a.lastname} (${a.position})`));

    if (orphans.length === 0) {
        console.log("✅ No orphans found. Hierarchy is already fully connected (or empty).");
        return;
    }

    // 2. Update them to point to Janace
    console.log(`\n🔗 Updating ${orphans.length} agents to report to Agent ${contextMhId}...`);

    // We can do a bulk update or loop. Loop is safer for logging.
    for (const agent of orphans) {
        const { error: updateErr } = await supabase
            .from('agents')
            .update({ assigned_id: contextMhId })
            .eq('id', agent.id);

        if (updateErr) {
            console.error(`   ❌ Failed to update Agent ${agent.id}: ${updateErr.message}`);
        } else {
            console.log(`   ✅ Agent ${agent.id} -> Agent ${contextMhId}`);
        }
    }

    console.log("\nHierarchy fix complete.");
}

main();
