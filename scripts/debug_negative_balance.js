const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://agyueadcymdopgihtckc.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFneXVlYWRjeW1kb3BnaWh0Y2tjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzMzA2NjYsImV4cCI6MjA3NDkwNjY2Nn0.EBYfJ9RTkeGLQptG3uWaOsFMIz9DySu3uhaOlzgeeMw";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
    console.log("🔍 INVESTIGATING NEGATIVE BALANCE ISSUE...\n");

    const AGENT_ID = 2;

    // Check current wallet
    const { data: wallet } = await supabase
        .from('agent_wallets')
        .select('*')
        .eq('agent_id', AGENT_ID)
        .single();

    console.log("💰 CURRENT WALLET STATE:");
    console.log(`   Balance: ₱${wallet?.balance || 0}`);
    console.log(`   Lifetime Commission: ₱${wallet?.lifetime_commission || 0}\n`);

    // Check for withdrawals
    const { data: withdrawals } = await supabase
        .from('agent_withdrawals')
        .select('*')
        .eq('agent_id', AGENT_ID)
        .order('created_at', { ascending: false });

    console.log("💸 WITHDRAWAL HISTORY:");
    if (withdrawals && withdrawals.length > 0) {
        console.log(`   Total Withdrawals: ${withdrawals.length}`);
        const totalWithdrawn = withdrawals.reduce((sum, w) => sum + (w.amount || 0), 0);
        console.log(`   Total Amount Withdrawn: ₱${totalWithdrawn}\n`);

        console.log("   DETAILS:");
        withdrawals.forEach(w => {
            console.log(`   - ${w.created_at}: ₱${w.amount} (${w.status})`);
        });
    } else {
        console.log("   ❌ No withdrawals found\n");
    }

    // Check all commissions that are still marked as receivable
    const { data: stillReceivable } = await supabase
        .from('commissions')
        .select('*')
        .eq('agent_id', AGENT_ID)
        .eq('is_receivable', true)
        .order('date_earned');

    console.log("\n✅ COMMISSIONS STILL MARKED AS RECEIVABLE:");
    console.log(`   Count: ${stillReceivable?.length || 0}\n`);

    if (stillReceivable && stillReceivable.length > 0) {
        // Group by period
        const periods = {};
        stillReceivable.forEach(c => {
            const date = new Date(c.date_earned);
            let year = date.getFullYear();
            let month = date.getMonth() + 1;

            if (date.getDate() < 7) {
                month -= 1;
                if (month === 0) {
                    month = 12;
                    year -= 1;
                }
            }

            const key = `${year}-${String(month).padStart(2, '0')}`;
            if (!periods[key]) periods[key] = { count: 0, total: 0, commissions: [] };

            const amt = c.commission_type === 'override' || c.commission_type === 'recruiter_bonus'
                ? (c.override_commission > 0 ? c.override_commission : c.amount)
                : c.amount;

            periods[key].count++;
            periods[key].total += amt;
            periods[key].commissions.push(c);
        });

        console.log("   BY PERIOD:");
        Object.keys(periods).sort().forEach(period => {
            const p = periods[period];
            console.log(`   ${period}: ${p.count} commissions, ₱${p.total}`);
        });
        console.log("");
    }

    // Check all receivable commissions (including those that should be receivable)
    const { data: allComms } = await supabase
        .from('commissions')
        .select('*')
        .eq('agent_id', AGENT_ID)
        .order('date_earned');

    console.log("📊 ALL COMMISSIONS ANALYSIS:");

    const byReceivable = {
        receivable: { count: 0, total: 0 },
        notReceivable: { count: 0, total: 0 }
    };

    allComms?.forEach(c => {
        const amt = c.commission_type === 'override' || c.commission_type === 'recruiter_bonus'
            ? (c.override_commission > 0 ? c.override_commission : c.amount)
            : c.amount;

        if (c.is_receivable) {
            byReceivable.receivable.count++;
            byReceivable.receivable.total += amt;
        } else {
            byReceivable.notReceivable.count++;
            byReceivable.notReceivable.total += amt;
        }
    });

    console.log(`   Receivable: ${byReceivable.receivable.count} commissions, ₱${byReceivable.receivable.total}`);
    console.log(`   Not Receivable: ${byReceivable.notReceivable.count} commissions, ₱${byReceivable.notReceivable.total}`);
    console.log(`   TOTAL: ${allComms?.length || 0} commissions, ₱${byReceivable.receivable.total + byReceivable.notReceivable.total}\n`);

    // Calculate what the balance SHOULD be
    console.log("🎯 EXPECTED BALANCE CALCULATION:");
    const totalWithdrawn = withdrawals?.reduce((sum, w) => sum + (w.amount || 0), 0) || 0;
    const expectedBalance = byReceivable.receivable.total - totalWithdrawn;

    console.log(`   Total Receivable Commissions: ₱${byReceivable.receivable.total}`);
    console.log(`   Total Withdrawn: ₱${totalWithdrawn}`);
    console.log(`   Expected Balance: ₱${expectedBalance}`);
    console.log(`   Actual Balance: ₱${wallet?.balance || 0}`);
    console.log(`   Difference: ₱${(wallet?.balance || 0) - expectedBalance}\n`);

    console.log("=".repeat(60));
    console.log("💡 ANALYSIS:");
    console.log("=".repeat(60));

    if (wallet?.balance < 0) {
        console.log("⚠️  The negative balance suggests that Agent 2 may have:");
        console.log("   1. Withdrawn more than they earned");
        console.log("   2. Had commissions incorrectly added and then withdrawn");
        console.log("   3. Had manual adjustments to their wallet");
        console.log("");
        console.log("The correct balance should be based on:");
        console.log(`   - Receivable commissions that are LEGITIMATELY earned: ₱${byReceivable.receivable.total}`);
        console.log(`   - Minus withdrawals: ₱${totalWithdrawn}`);
        console.log(`   - Expected balance: ₱${expectedBalance}`);
    }
}

main().catch(console.error);
