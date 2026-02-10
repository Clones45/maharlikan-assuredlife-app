
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read env for credentials
const envPath = path.resolve(__dirname, '../../Desktop/.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const urlMatch = envContent.match(/SUPABASE_URL=(.+)/);
const keyMatch = envContent.match(/SUPABASE_SERVICE_KEY=(.+)/);

const SUPABASE_URL = urlMatch ? urlMatch[1].trim() : null;
const SERVICE_KEY = keyMatch ? keyMatch[1].trim() : null;

if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error("Missing credentials.");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function check() {
    console.log("Checking 'get_lapsed_members' RPC...");
    const { data, error } = await supabase.rpc('get_lapsed_members');

    if (error) {
        console.error("❌ RPC Failed:");
        console.error(error.message);
        console.error("Details:", error.details);
        console.error("Hint:", error.hint);
    } else {
        console.log("✅ RPC Success! The function is working.");
        console.log(`Returned ${data.length} rows.`);
        if (data.length > 0) {
            console.log("Sample Row JSON:");
            console.log(JSON.stringify(data[0], null, 2));
        }
    }
}

check();
