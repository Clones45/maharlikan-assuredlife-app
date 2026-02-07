const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Usage: Using the config from your existing scripts
const SUPABASE_URL = "https://agyueadcymdopgihtckc.supabase.co";
// Note: This needs to be a key with permissions to call the RPC. 
// Assuming the one in sync_agr_commissions.js works for this.
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFneXVlYWRjeW1kb3BnaWh0Y2tjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzMzA2NjYsImV4cCI6MjA3NDkwNjY2Nn0.EBYfJ9RTkeGLQptG3uWaOsFMIz9DySu3uhaOlzgeeMw";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function fetchSchema() {
    console.log("Creating bridge to database...");

    const { data, error } = await supabase.rpc('debug_export_schema');

    if (error) {
        console.error("❌ Link failed:", error.message);
        console.error("Hint: Did you run the 'debug_schema.sql' script in Supabase first?");
        return;
    }

    console.log("✅ Connection successful. Retrieved Database Blueprint.");
    const outFile = 'current_schema.dump.sql';
    fs.writeFileSync(outFile, data);
    console.log(`Saved schema to: ${outFile}`);
}

fetchSchema();
