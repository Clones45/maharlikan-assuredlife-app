const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://agyueadcymdopgihtckc.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFneXVlYWRjeW1kb3BnaWh0Y2tjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzMzA2NjYsImV4cCI6MjA3NDkwNjY2Nn0.EBYfJ9RTkeGLQptG3uWaOsFMIz9DySu3uhaOlzgeeMw";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
    console.log("🔍 DIRECT DATABASE CHECK - AGENT 2\n");

    const AGENT_ID = 2;

    // Get wallet
    const { data: wallet } = await supabase
        .from('agent_wallets')
        .select('*')
        .eq('agent_id', AGENT_ID)
        .single();

    console.log("💰 WALLET:");
    console.log(`   Balance: ₱${wallet?.balance || 0}\n`);

    // Get ALL receivable commissions with raw dates
    const { data: receivable } = await supabase
        .from('commissions')
        .select('id, date_earned, commission_type, amount, override_commission, is_receivable')
        .eq('agent_id', AGENT_ID)
        .eq('is_receivable', true)
        .order('date_earned');

    console.log(`✅ TOTAL RECEIVABLE COMMISSIONS: ${receivable?.length || 0}\n`);

    // Check specific date ranges
    const dec2025 = receivable?.filter(c => {
        const date = new Date(c.date_earned);
        return date >= new Date('2025-12-07') && date < new Date('2026-01-07');
    }) || [];

    const jan2026 = receivable?.filter(c => {
        const date = new Date(c.date_earned);
        return date >= new Date('2026-01-07') && date < new Date('2026-02-07');
    }) || [];

    console.log("📅 BY DATE RANGE:");
    console.log(`   Dec 7, 2025 - Jan 6, 2026: ${dec2025.length} commissions`);
    console.log(`   Jan 7, 2026 - Feb 6, 2026: ${jan2026.length} commissions\n`);

    if (dec2025.length > 0) {
        console.log("⚠️  DECEMBER 2025 RECEIVABLES (SHOULD BE 0):");
        const decTotal = dec2025.reduce((sum, c) => {
            const amt = c.commission_type === 'override' || c.commission_type === 'recruiter_bonus'
                ? (c.override_commission > 0 ? c.override_commission : c.amount)
                : c.amount;
            return sum + amt;
        }, 0);
        console.log(`   Total: ₱${decTotal}`);
        console.log(`   First 5 IDs: ${dec2025.slice(0, 5).map(c => c.id).join(', ')}\n`);
    }

    if (jan2026.length > 0) {
        console.log("⚠️  JANUARY 2026 RECEIVABLES (SHOULD BE 0):");
        const janTotal = jan2026.reduce((sum, c) => {
            const amt = c.commission_type === 'override' || c.commission_type === 'recruiter_bonus'
                ? (c.override_commission > 0 ? c.override_commission : c.amount)
                : c.amount;
            return sum + amt;
        }, 0);
        console.log(`   Total: ₱${janTotal}`);
        console.log(`   First 5 IDs: ${jan2026.slice(0, 5).map(c => c.id).join(', ')}\n`);
    }

    // Calculate what balance SHOULD be (excluding Dec 2025 and Jan 2026)
    const legitReceivable = receivable?.filter(c => {
        const date = new Date(c.date_earned);
        return date < new Date('2025-12-07') || date >= new Date('2026-02-07');
    }) || [];

    const legitTotal = legitReceivable.reduce((sum, c) => {
        const amt = c.commission_type === 'override' || c.commission_type === 'recruiter_bonus'
            ? (c.override_commission > 0 ? c.override_commission : c.amount)
            : c.amount;
        return sum + amt;
    }, 0);

    console.log("🎯 EXPECTED STATE:");
    console.log(`   Legitimate Receivables (before Dec 2025): ${legitReceivable.length} commissions, ₱${legitTotal}`);
    console.log(`   Current Balance: ₱${wallet?.balance || 0}`);
    console.log(`   Expected Balance: ₱${legitTotal}`);
    console.log(`   Difference: ₱${(wallet?.balance || 0) - legitTotal}\n`);

    if (dec2025.length > 0 || jan2026.length > 0) {
        console.log("❌ ISSUE: Agent 2 still has receivable commissions from unreleased periods!");
        console.log("   The cleanup script may not have worked correctly.");
    } else {
        console.log("✅ SUCCESS: No receivable commissions from unreleased periods!");
    }
}

main().catch(console.error);
