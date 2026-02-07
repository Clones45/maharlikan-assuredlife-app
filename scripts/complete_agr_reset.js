const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://agyueadcymdopgihtckc.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFneXVlYWRjeW1kb3BnaWh0Y2tjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzMzA2NjYsImV4cCI6MjA3NDkwNjY2Nn0.EBYfJ9RTkeGLQptG3uWaOsFMIz9DySu3uhaOlzgeeMw";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
    console.log("🔧 COMPLETE AGR SYSTEM RESET\n");
    console.log("This will re-evaluate ALL rollups and fix incorrectly released periods.\n");
    console.log("=".repeat(60));

    // Step 1: Get all rollups
    const { data: allRollups } = await supabase
        .from('agent_commission_rollups')
        .select('*')
        .order('agent_id')
        .order('period_year')
        .order('period_month');

    console.log(`\n📊 Found ${allRollups?.length || 0} rollup records\n`);

    const fixes = [];

    // Step 2: Check each rollup
    for (const rollup of allRollups || []) {
        if (rollup.status !== 'released') continue;

        // Calculate the qualifying period (previous month)
        const prevMonth = rollup.period_month === 1 ? 12 : rollup.period_month - 1;
        const prevYear = rollup.period_month === 1 ? rollup.period_year - 1 : rollup.period_year;

        const startDate = `${prevYear}-${String(prevMonth).padStart(2, '0')}-07`;
        const endDate = `${rollup.period_year}-${String(rollup.period_month).padStart(2, '0')}-07`;

        // Get collections for qualifying period
        const { data: colls } = await supabase
            .from('collections')
            .select(`
                id,
                is_membership_fee,
                payment_for,
                members (
                    first_name,
                    last_name,
                    middle_name
                )
            `)
            .eq('agent_id', rollup.agent_id)
            .gte('date_paid', startDate)
            .lt('date_paid', endDate);

        // Check AGR criteria
        const memCount = colls?.filter(c => c.is_membership_fee).length || 0;

        // Rule B: Check for member with both MEM and REG
        const groups = {};
        colls?.forEach(c => {
            const m = Array.isArray(c.members) ? c.members[0] : c.members;
            if (!m || !m.first_name || !m.last_name) return;
            const key = `${m.last_name}|${m.first_name}`.trim().toUpperCase();
            if (!groups[key]) groups[key] = [];
            groups[key].push(c);
        });

        let ruleB = false;
        for (const key in groups) {
            const payments = groups[key];
            const hasMem = payments.some(p => p.is_membership_fee === true);
            const hasReg = payments.some(p => p.is_membership_fee === false && p.payment_for === 'regular');
            if (hasMem && hasReg) {
                ruleB = true;
                break;
            }
        }

        const shouldPass = memCount >= 3 || ruleB;

        if (!shouldPass) {
            // This rollup is incorrectly released!
            fixes.push({
                agent_id: rollup.agent_id,
                period: `${rollup.period_year}-${String(rollup.period_month).padStart(2, '0')}`,
                period_year: rollup.period_year,
                period_month: rollup.period_month,
                mem_count: memCount,
                rule_b: ruleB
            });
        }
    }

    console.log(`\n⚠️  Found ${fixes.length} incorrectly released rollups:\n`);

    // Group by agent
    const byAgent = {};
    fixes.forEach(f => {
        if (!byAgent[f.agent_id]) byAgent[f.agent_id] = [];
        byAgent[f.agent_id].push(f);
    });

    Object.keys(byAgent).forEach(agentId => {
        console.log(`   Agent ${agentId}: ${byAgent[agentId].length} periods`);
    });

    console.log("\n" + "=".repeat(60));
    console.log("PROCEEDING WITH FIX...\n");

    let rollupsFixed = 0;
    let commissionsFixed = 0;
    let totalForfeited = 0;

    // Step 3: Fix each incorrect rollup
    for (const fix of fixes) {
        console.log(`\n🔧 Agent ${fix.agent_id} - ${fix.period}:`);

        // Mark rollup as unreleased
        const { error: rollupError } = await supabase
            .from('agent_commission_rollups')
            .update({ status: 'unreleased' })
            .eq('agent_id', fix.agent_id)
            .eq('period_year', fix.period_year)
            .eq('period_month', fix.period_month);

        if (rollupError) {
            console.error(`   ❌ Rollup error: ${rollupError.message}`);
            continue;
        }

        rollupsFixed++;
        console.log(`   ✅ Marked rollup as unreleased`);

        // Get commissions for this period
        const startDate = `${fix.period_year}-${String(fix.period_month).padStart(2, '0')}-07`;
        let endMonth = fix.period_month + 1;
        let endYear = fix.period_year;
        if (endMonth > 12) {
            endMonth = 1;
            endYear++;
        }
        const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-07`;

        const { data: comms } = await supabase
            .from('commissions')
            .select('*')
            .eq('agent_id', fix.agent_id)
            .gte('date_earned', startDate)
            .lt('date_earned', endDate)
            .eq('is_receivable', true);

        if (comms && comms.length > 0) {
            const amount = comms.reduce((sum, c) => {
                const amt = c.commission_type === 'override' || c.commission_type === 'recruiter_bonus'
                    ? (c.override_commission > 0 ? c.override_commission : c.amount)
                    : c.amount;
                return sum + amt;
            }, 0);

            console.log(`   Found ${comms.length} receivable commissions (₱${amount})`);

            // Mark as not receivable
            const commIds = comms.map(c => c.id);

            const { error: commError } = await supabase
                .from('commissions')
                .update({ is_receivable: false })
                .in('id', commIds);

            if (!commError) {
                commissionsFixed += comms.length;
                totalForfeited += amount;
                console.log(`   ✅ Marked ${comms.length} commissions as not receivable`);
            } else {
                console.log(`   ⚠️  Error: ${commError.message}`);
            }
        }
    }

    console.log("\n" + "=".repeat(60));
    console.log("📊 RESET SUMMARY:");
    console.log("=".repeat(60));
    console.log(`Rollups fixed: ${rollupsFixed}`);
    console.log(`Commissions fixed: ${commissionsFixed}`);
    console.log(`Total forfeited: ₱${totalForfeited}\n`);

    // Step 4: Recalculate all agent wallets
    console.log("💰 RECALCULATING ALL AGENT WALLETS...\n");

    const { data: agents } = await supabase
        .from('agents')
        .select('id');

    let walletsUpdated = 0;

    for (const agent of agents || []) {
        const { data: receivable } = await supabase
            .from('commissions')
            .select('*')
            .eq('agent_id', agent.id)
            .eq('is_receivable', true);

        const totalReceivable = receivable?.reduce((sum, c) => {
            const amt = c.commission_type === 'override' || c.commission_type === 'recruiter_bonus'
                ? (c.override_commission > 0 ? c.override_commission : c.amount)
                : c.amount;
            return sum + amt;
        }, 0) || 0;

        const { error } = await supabase
            .from('agent_wallets')
            .update({ balance: totalReceivable })
            .eq('agent_id', agent.id);

        if (!error) walletsUpdated++;
    }

    console.log(`✅ Updated ${walletsUpdated} agent wallets\n`);

    console.log("=".repeat(60));
    console.log("✅ COMPLETE AGR RESET FINISHED!");
    console.log("=".repeat(60));
}

main().catch(console.error);
