// @ts-nocheck
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://agyueadcymdopgihtckc.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFneXVlYWRjeW1kb3BnaWh0Y2tjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzMzA2NjYsImV4cCI6MjA3NDkwNjY2Nn0.EBYfJ9RTkeGLQptG3uWaOsFMIz9DySu3uhaOlzgeeMw";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function debugCommissions() {
    console.log("--- DEBUG REPORT: NOV 2025 (Nov 7 - Dec 7) ---");

    const start = "2025-11-07";
    const end = "2025-12-07";

    // 1. Total System Collections
    const { data: allColls, error: collError } = await supabase
        .from("collections")
        .select("id, payment, agent_id")
        .gte("date_paid", start)
        .lt("date_paid", end);

    if (collError) { console.error(collError); return; }
    console.log(`Total Collections in System: ${allColls.length}`);
    const totalCollAmount = allColls.reduce((sum, c) => sum + c.payment, 0);
    console.log(`Total Collection Amount: ${totalCollAmount}`);

    // 2. Total Commissions
    const { data: allComms, error: commError } = await supabase
        .from("commissions")
        .select("agent_id, amount, commission_type")
        .gte("date_earned", start)
        .lt("date_earned", end);

    if (commError) { console.error(commError); return; }

    // 3. Debug Lifetime vs Stored
    console.log("\n--- AGENT WALLET CHECK ---");
    // Fetch all wallets
    const { data: wallets } = await supabase
        .from("agent_wallets")
        .select("agent_id, balance, lifetime_commission");

    const walletMap = {};
    (wallets || []).forEach(w => walletMap[w.agent_id] = w);

    // Calculate Expected Lifetime (>= Nov 7, 2025)
    // defined start/end in existing code, but let's be expansive
    const { data: lifeComms } = await supabase
        .from("commissions")
        .select("agent_id, amount, override_commission")
        .gte("date_earned", "2025-11-07");

    const expectedLife = {};
    (lifeComms || []).forEach(c => {
        if (!expectedLife[c.agent_id]) expectedLife[c.agent_id] = 0;
        expectedLife[c.agent_id] += (c.amount + (c.override_commission || 0));
    });

    // Compare
    console.log("Agent | Expected | Stored (DB) | Match?");
    console.log("-----------------------------------------");
    Object.keys(expectedLife).forEach(aid => {
        const exp = expectedLife[aid];
        const stored = walletMap[aid]?.lifetime_commission ?? "NO_WALLET";
        const match = Math.abs(exp - (stored === "NO_WALLET" ? 0 : stored)) < 0.01;

        console.log(`${aid.padEnd(6)}| ${exp.toFixed(2).padEnd(9)}| ${String(stored).padEnd(12)}| ${match ? "OK" : "MISMATCH"}`);
    });
}

debugCommissions();
