
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load env
const appJsonPath = path.resolve(__dirname, '../app.json');
const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
const SUPABASE_URL = appJson.expo.extra.SUPABASE_URL;
const SUPABASE_ANON_KEY = appJson.expo.extra.SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function main() {
    console.log('Fetching live schema via debug_export_schema()...');
    const { data, error } = await supabase.rpc('debug_export_schema');

    if (error) {
        console.error('Error fetching schema:', error);
        return;
    }

    const outputPath = path.resolve(__dirname, 'live_schema_dump.sql');
    fs.writeFileSync(outputPath, data);
    console.log(`Schema saved to ${outputPath}`);
}

main();
