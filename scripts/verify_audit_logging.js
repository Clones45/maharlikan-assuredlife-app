
const { createClient } = require('@supabase/supabase-js');

// Config from audit_1011.js
const SUPABASE_URL = "https://agyueadcymdopgihtckc.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFneXVlYWRjeW1kb3BnaWh0Y2tjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzMzA2NjYsImV4cCI6MjA3NDkwNjY2Nn0.EBYfJ9RTkeGLQptG3uWaOsFMIz9DySu3uhaOlzgeeMw";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function verifyAudit() {
    console.log("Starting Audit Log Verification...");

    const testId = 999999;
    // Using a random large ID might conflict if identity is set, better to let DB assign or use negative? 
    // Supabase usually uses bigint identity. Let's just insert and see.
    // Actually, let's try to insert a record and let it auto-generate ID, capture it, then update/delete.

    // 1. INSERT
    console.log("1. Insert Test Member...");
    const { data: inserted, error: insertErr } = await supabase
        .from('members')
        .insert({
            first_name: 'AuditTest',
            last_name: 'Bot',
            maf_no: 'AUDIT-001',
            date_joined: new Date().toISOString()
        })
        .select()
        .single();

    if (insertErr) {
        console.error("Insert Failed:", insertErr);
        return;
    }
    console.log("   Inserted Member ID:", inserted.id);
    const memberId = inserted.id;

    // 2. UPDATE
    console.log("2. Update Test Member...");
    const { error: updateErr } = await supabase
        .from('members')
        .update({ middle_name: 'UpdatedMid' })
        .eq('id', memberId);

    if (updateErr) {
        console.error("Update Failed:", updateErr);
    } else {
        console.log("   Update successful.");
    }

    // 3. DELETE
    console.log("3. Delete Test Member...");
    const { error: deleteErr } = await supabase
        .from('members')
        .delete()
        .eq('id', memberId);

    if (deleteErr) {
        console.error("Delete Failed:", deleteErr);
    } else {
        console.log("   Delete successful.");
    }

    // 4. CHECK LOGS
    console.log("4. Checking Audit Logs...");
    // Give it a split second just in case (though it should be immediate in same transaction usually, accessing from client might have race if async? No, Trigger is sync.)

    const { data: logs, error: logErr } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('record_id', memberId)
        .eq('table_name', 'members')
        .order('id', { ascending: true });

    if (logErr) {
        console.error("Check Logs Failed:", logErr);
        return;
    }

    console.log(`   Found ${logs.length} log entries.`);
    logs.forEach(l => {
        console.log(`   - [${l.operation}] ID: ${l.id} | Changed At: ${l.changed_at}`);
        if (l.operation === 'UPDATE') {
            console.log(`     Old: ${l.old_data.middle_name} -> New: ${l.new_data.middle_name}`);
        }
    });

    if (logs.length >= 3) {
        console.log("\n✅ VERIFICATION SUCCESSFUL: All operations logged.");
    } else {
        console.log("\n❌ VERIFICATION FAILED: Missing logs.");
    }
}

verifyAudit();
