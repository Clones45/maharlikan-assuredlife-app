
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://agyueadcymdopgihtckc.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFneXVlYWRjeW1kb3BnaWh0Y2tjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzMzA2NjYsImV4cCI6MjA3NDkwNjY2Nn0.EBYfJ9RTkeGLQptG3uWaOsFMIz9DySu3uhaOlzgeeMw";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function verify() {
    console.log("🧪 Verifying Instant Release Fix...");
    const agentId = 5;
    const testAmount = 10;
    const testDate = '2026-01-15'; // Earned in Jan -> Released in Feb

    // 1. Get Initial Balance
    const { data: initialWallet } = await supabase.from('agent_wallets').select('balance').eq('agent_id', agentId).single();
    const startBalance = Number(initialWallet.balance);
    console.log(`   Initial Balance: ${startBalance}`);

    // 2. Insert Test Commission
    // We need a valid collectionID or just dummy fields?
    // Constraints: collection_id is foreign key? collection_id references collections(id).
    // I need a valid collection. I'll pick one from Agent 5 history or insert a dummy collection?
    // Inserting dummy collection might trigger other things.
    // Better to find an existing collection ID and duplicate a commission or add a new type.

    // Find a collection for Agent 5
    const { data: col } = await supabase.from('collections').select('id, member_id').eq('agent_id', agentId).limit(1).single();

    if (!col) {
        console.error("   ❌ No collection found for Agent 5 to attach commission to.");
        return;
    }

    console.log(`   Inserting test commission (Amount: ${testAmount}) dated ${testDate}...`);

    const { data: newComm, error: iErr } = await supabase
        .from('commissions')
        .insert({
            agent_id: agentId,
            member_id: col.member_id,
            collection_id: col.id,
            commission_type: 'plan_monthly', // Standard receivable type
            amount: testAmount,
            date_earned: testDate,
            is_receivable: true,
            status: 'pending',
            maf_no: 'TEST-FIX',
            year: 2026,
            period_year: 2026,
            period_month: 1,
            plan_type: 'TEST'
        })
        .select()
        .single();

    if (iErr) {
        console.error("   ❌ Insert Error:", iErr.message);
        return;
    }
    console.log(`   Inserted Commission ID: ${newComm.id}`);

    // 3. Check Wallet Again
    const { data: midWallet } = await supabase.from('agent_wallets').select('balance').eq('agent_id', agentId).single();
    const midBalance = Number(midWallet.balance);
    console.log(`   Balance After Insert: ${midBalance}`);

    if (midBalance === startBalance + testAmount) {
        console.log("   ✅ SUCCESS: Wallet incremented instantly!");
    } else {
        console.log("   ❌ FAILURE: Wallet did not increment.");
    }

    // 4. Cleanup
    console.log("   Cleaning up...");
    // Delete commission
    await supabase.from('commissions').delete().eq('id', newComm.id);

    // Revert Wallet
    // Since delete trigger might not exist for wallet decrement, we verify.
    // Actually, I should just update wallet back.
    if (midBalance > startBalance) {
        await supabase.from('agent_wallets').update({ balance: startBalance }).eq('agent_id', agentId);
        console.log("   Wallet reverted to original balance.");
    }
}

verify();
