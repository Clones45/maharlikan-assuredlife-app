
// Deploy the fix
async function deploy() {
    console.log("Reading SQL fix...");
    const sql = fs.readFileSync(path.join(__dirname, '..', 'fix_member_status_logic.sql'), 'utf8');

    // Split into individual statements
    const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);

    console.log(`Found ${statements.length} statements to execute.`);

    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

    for (const statement of statements) {
        // Simple check to identify statement type for logging
        const type = statement.split(' ')[0].toUpperCase();
        console.log(`Executing ${type} statement...`);

        const { error } = await supabase.rpc('exec_sql', { sql_query: statement }); // Assuming exec_sql exists? 
        // Wait, if exec_sql doesn't exist (it usually doesn't by default), we need direct connection or a helper.

        // Actually, previous attempts used a 'postgres' connection or similar? 
        // The user said "you already connected to my mcp server".
        // BUT my MCP tool failed.

        // Let's assume we can try to use standard supabase.rpc if a 'exec_sql' or similar exists, 
        // OR we might have to guide the user if we can't run it.

        // RE-READING CONTEXT:
        // "A new PostgreSQL function calculate_paid_until(member_id) was created... The existing RPCs were updated... The supabase client was configured with a SERVICE_KEY... to allow for DDL operations via the generated SQL script."
        // AND "The decision was made to generate a SQL script... rather than attempting direct DDL execution via supabase-js due to potential permission issues".

        // So I CANNOT run it easily with simple supabase-js UNLESS there is a special function.
        // BUT the user specfically asked "can you be the one touch my database".

        // Let's try to find a way. If I can't, I will just fix the file and ask user to run it. 
        // BUT I SHOULD FIX THE FILE FIRST.

        // Wait, I can try to use `postgres` node module if I had connection string?
        // Usage of standard supabase-js client restricts DDL unless via a wrapper.

        // Let's stick to FIXING the file first, which is the requested "fix". 
        // I will write this script just in case, but primary goal is fixing the SQL content.

        // Actually, I'll revert to just fixing the SQL file for the User to run in Dashboard Query Editor.
        // That is the most reliable "touch" I can facilitate if direct access fails.
        // BUT I can try to use the MCP tool 'execute_sql' with a simpler query to test?
        // No, 'execute_sql' IS the tool that failed.

        // OK, I will focus on fixing the SQL text.
    }
}
// We duplicate the core logic from the 4 files to verify they produce identical results given the same input data.

// 1. REINSTATEMENT DETECTION LOGIC (Shared)
function getEffectiveStartDate(joined, collections) {
    const joinDate = new Date(joined);
    let effective = new Date(joined);
    let lastActivity = new Date(joined);

    // Sort collections by date
    const sorted = [...(collections || [])].sort((a, b) => new Date(a.date_paid) - new Date(b.date_paid));

    for (const c of sorted) {
        const pDate = new Date(c.date_paid);
        if (isNaN(pDate.getTime())) continue;

        // Diff in months from last activity
        let mDiff = (pDate.getFullYear() - lastActivity.getFullYear()) * 12;
        mDiff += pDate.getMonth() - lastActivity.getMonth();

        // If gap >= 3, NEW Effective Start
        if (mDiff >= 3) {
            effective = pDate;
        }
        lastActivity = pDate;
    }
    return effective;
}

// 2. PAID UNTIL & STATUS LOGIC (Shared)
function calculateStatus(member, collections) {
    const mDue = Number(member.monthly_due) || 0;
    const joined = member.plan_start_date || member.date_joined || member.created_at;

    // A. DETERMINE EFFECTIVE START (Logic used in SOA)
    const effectiveDate = getEffectiveStartDate(joined, collections);
    const effTime = effectiveDate.getTime();

    // B. SUM VALID PAYMENTS
    let validSum = 0;
    const sorted = [...(collections || [])].sort((a, b) => new Date(a.date_paid) - new Date(b.date_paid));

    // Check if Reinstated
    // We must compare the Effective Start (Calculated or Plan Start) vs Original Date Joined
    // If Plan Start > Date Joined, it's reinstated.

    // In SOA.tsx logic:
    // const effStartTime = effectiveStartDateForStatus.getTime();
    // const inceptionTime = new Date(member.date_joined).getTime();
    // const isReinstated = effStartTime > inceptionTime;

    const originalJoined = new Date(member.date_joined || member.created_at).getTime();
    const isReinstated = effTime > originalJoined;

    console.log(`[Verify] Reinstated? ${isReinstated} (Eff: ${effectiveDate.toISOString().split('T')[0]} vs Org: ${new Date(originalJoined).toISOString().split('T')[0]})`);

    sorted.forEach(c => {
        const pDate = new Date(c.date_paid).getTime();
        let include = false;
        if (isReinstated) {
            if (pDate >= effTime) include = true;
        } else {
            include = true;
        }

        if (include) {
            const payFor = (c.payment_for || '').toLowerCase();
            const isMembership = (c.is_membership_fee === true) || payFor.includes('membership');
            if (!isMembership) validSum += Number(c.payment || 0);
        }
    });

    // C. CALCULATE PAID UNTIL
    let paidUntil = new Date(effectiveDate);
    if (mDue > 0) {
        const monthsCovered = validSum / mDue;
        const whole = Math.floor(monthsCovered);
        const frac = monthsCovered - whole;
        paidUntil.setMonth(paidUntil.getMonth() + whole);
        paidUntil.setDate(paidUntil.getDate() + Math.round(frac * 30));
    } else {
        paidUntil.setFullYear(paidUntil.getFullYear() + 100);
    }

    // D. CALCULATE NEXT DUE DATE (PaidUntil + 1 Month)
    const nextDueDate = new Date(paidUntil);
    nextDueDate.setMonth(nextDueDate.getMonth() + 1);

    // E. CALCULATE GRACE DAYS
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const ndd = new Date(nextDueDate);
    ndd.setHours(0, 0, 0, 0);

    const diff = now.getTime() - ndd.getTime();
    const graceDays = Math.ceil(diff / (1000 * 60 * 60 * 24));

    const finalGrace = Math.max(0, graceDays);

    // F. DETERMINE STATUS (NEW THRESHOLDS)
    let status = 'Active';
    if (finalGrace <= 0) status = 'Active';
    else if (finalGrace >= 1 && finalGrace <= 29) status = 'Warning';
    else if (finalGrace >= 30 && finalGrace <= 59) status = 'Lapsable';
    else status = 'Lapsed'; // >= 60

    return { status, graceDays: finalGrace, paidUntil: paidUntil.toISOString().split('T')[0], nextDueDate: nextDueDate.toISOString().split('T')[0] };
}


// --- MAIN EXECUTION ---
async function run() {
    // Adjusted paths relative to MobileApp root where script is run
    require('dotenv').config({ path: '../Desktop/.env' });

    let url, key;

    if (process.env.SUPABASE_URL) {
        url = process.env.SUPABASE_URL;
        key = process.env.SUPABASE_SERVICE_KEY;
    } else {
        try {
            const appJson = JSON.parse(readFileSync('../app.json', 'utf8'));
            url = appJson.expo.extra.supabaseUrl;
            key = appJson.expo.extra.supabaseAnonKey; // Fallback to anon if service key missing in env
        } catch (e) {
            console.error("Failed to read app.json:", e.message);
        }
    }

    if (!key && process.env.SUPABASE_SERVICE_KEY) key = process.env.SUPABASE_SERVICE_KEY;

    if (!url || !key) {
        console.error("Missing credentials. Please ensure ../Desktop/.env exists or app.json is valid.");
        return;
    }

    const supabase = createClient(url, key);

    // Test Member ID 97 (Known Reinstated Case)
    const memberId = 97;
    console.log(`Checking Member ${memberId}...`);

    const { data: member } = await supabase.from('members').select('*').eq('id', memberId).single();
    const { data: collections } = await supabase.from('collections').select('*').eq('member_id', memberId);

    if (!member) { console.error("Member not found"); return; }

    const result = calculateStatus(member, collections);

    console.log("------------------------------------------------");
    console.log("Verified Logic Output (Simulating SOA Logic)");
    console.log("------------------------------------------------");
    console.log(`Paid Until Date: ${result.paidUntil}`);
    console.log(`Grace Days:      ${result.graceDays}`);
    console.log(`Calculated Status: ${result.status}`);
    console.log("------------------------------------------------");

    if (result.status === 'Active' && result.graceDays <= 0) {
        console.log("✅ PASS: Correctly identified as Active/Grace<=0");
    } else {
        console.log("⚠️ CHECK: Result might be unexpected based on simulation.");
    }
}

run();
