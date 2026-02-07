
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://agyueadcymdopgihtckc.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFneXVlYWRjeW1kb3BnaWh0Y2tjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzMzA2NjYsImV4cCI6MjA3NDkwNjY2Nn0.EBYfJ9RTkeGLQptG3uWaOsFMIz9DySu3uhaOlzgeeMw";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkComms() {
    const agentId = 6; // Janace
    console.log(`Checking commissions for Agent ID: ${agentId}`);

    const { data: comms, error } = await supabase
        .from('agent_commissions')
        .select('*')
        .eq('agent_id', agentId);

    if (error) {
        console.error(error);
        return;
    }

    console.log(`Total commissions found: ${comms.length}`);
    if (comms.length > 0) {
        console.log("Sample commission data:");
        console.log(JSON.stringify(comms[0], null, 2));

        const summary = comms.reduce((acc, c) => {
            acc[c.commission_type] = (acc[c.commission_type] || 0) + Number(c.amount);
            return acc;
        }, {});
        console.log("\nSummary by type:");
        console.log(JSON.stringify(summary, null, 2));

        const statusSummary = comms.reduce((acc, c) => {
            acc[c.status] = (acc[c.status] || 0) + 1;
            return acc;
        }, {});
        console.log("\nStatus summary:");
        console.log(JSON.stringify(statusSummary, null, 2));
    } else {
        console.log("No commissions found in agent_commissions table for Janace.");
    }
}

checkComms();
