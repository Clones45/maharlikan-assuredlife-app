// @ts-nocheck
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://agyueadcymdopgihtckc.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFneXVlYWRjeW1kb3BnaWh0Y2tjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzMzA2NjYsImV4cCI6MjA3NDkwNjY2Nn0.EBYfJ9RTkeGLQptG3uWaOsFMIz9DySu3uhaOlzgeeMw";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function inspectAgent5() {
    console.log("--- INSPECTING AGENT 5 (MIKE CASIANO) ---");
    const agentId = 5;

    // 1. Check Rollup for Nov 2025
    const { data: rollup } = await supabase
        .from("agent_commission_rollups")
        .select("*")
        .eq("agent_id", agentId)
        .eq("period_year", 2025)
        .eq("period_month", 11);

    console.log("\nRollup Record (Nov 2025):");
    console.log(rollup && rollup.length > 0 ? rollup[0] : "NO ROLLUP FOUND");

    // 2. Check Raw Commissions (Nov 1 - Dec 31 to be safe)
    const { data: comms } = await supabase
        .from("commissions")
        .select("*")
        .eq("agent_id", agentId)
        .gte("date_earned", "2025-11-01")
        .lte("date_earned", "2025-12-31")
        .order("date_earned", { ascending: true });

    console.log(`\nRaw Commissions (Nov 1 - Dec 31): ${comms?.length} rows`);
    comms?.forEach(c => {
        console.log(`- ${c.date_earned}: ${c.commission_type} = ₱${c.amount} (Desc: ${c.description})`);
    });

    // 3. Check Raw Collections (Nov 1 - Dec 31)
    const { data: colls } = await supabase
        .from("collections")
        .select("*")
        .eq("agent_id", agentId)
        .gte("date_paid", "2025-11-01")
        .lte("date_paid", "2025-12-31");

    console.log(`\nRaw Collections (Nov 1 - Dec 31): ${colls?.length} rows`);
}

inspectAgent5();
