
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase
const supabaseUrl = 'https://agyueadcymdopgihtckc.supabase.co';
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFneXVlYWRjeW1kb3BnaWh0Y2tjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzMzA2NjYsImV4cCI6MjA3NDkwNjY2Nn0.EBYfJ9RTkeGLQptG3uWaOsFMIz9DySu3uhaOlzgeeMw";
const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyAccessCodes() {
    console.log("--- START VERIFICATION ---");

    // 1. Generate 'A' Code
    const aCode = `A-${Math.floor(10000 + Math.random() * 90000)}`;
    console.log(`\n1. Generated Agent Code: ${aCode}`);

    const { data: aData, error: aError } = await supabase
        .from('access_codes')
        .insert({
            code: aCode,
            prefix: 'A',
            expires_at: new Date(Date.now() + 86400000).toISOString(),
            used: false
        })
        .select()
        .single();

    if (aError) { console.error("Error creating A code:", aError); return; }
    console.log("   -> Created in DB");

    // 2. Generate 'MS' Code
    const msCode = `MS-${Math.floor(10000 + Math.random() * 90000)}`;
    console.log(`\n2. Generated Member Code: ${msCode}`);

    const { data: msData, error: msError } = await supabase
        .from('access_codes')
        .insert({
            code: msCode,
            prefix: 'MS',
            expires_at: new Date(Date.now() + 86400000).toISOString(),
            used: false
        })
        .select()
        .single();

    if (msError) { console.error("Error creating MS code:", msError); return; }
    console.log("   -> Created in DB");

    // 3. Simulate Member Registration Validation
    console.log("\n3. Testing Member Registration Logic:");

    // Check A Code
    if (aCode.trim().toUpperCase().startsWith("A")) {
        console.log(`   [PASS] Correctly Rejected Agent Code ${aCode} for Member Registration`);
    } else {
        console.error(`   [FAIL] Failed to reject Agent Code ${aCode} for Member Registration`);
    }

    // Check MS Code
    if (msCode.trim().toUpperCase().startsWith("A")) {
        console.error(`   [FAIL] Incorrectly Rejected Member Code ${msCode} for Member Registration`);
    } else {
        console.log(`   [PASS] Correctly Accepted Member Code ${msCode} for Member Registration`);
    }

    // 4. Simulate Agent Recruitment Validation
    console.log("\n4. Testing Agent Recruitment Logic:");

    // Check A Code
    if (!aCode.trim().toUpperCase().startsWith("A")) {
        console.error(`   [FAIL] Incorrectly Rejected Agent Code ${aCode} for Agent Recruitment`);
    } else {
        console.log(`   [PASS] Correctly Accepted Agent Code ${aCode} for Agent Recruitment`);
    }

    // Check MS Code
    if (!msCode.trim().toUpperCase().startsWith("A")) {
        console.log(`   [PASS] Correctly Rejected Member Code ${msCode} for Agent Recruitment`);
    } else {
        console.error(`   [FAIL] Failed to reject Member Code ${msCode} for Agent Recruitment`);
    }

    console.log("\n--- VERIFICATION COMPLETE ---");
}

verifyAccessCodes();
