// @ts-nocheck
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://agyueadcymdopgihtckc.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFneXVlYWRjeW1kb3BnaWh0Y2tjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzMzA2NjYsImV4cCI6MjA3NDkwNjY2Nn0.EBYfJ9RTkeGLQptG3uWaOsFMIz9DySu3uhaOlzgeeMw";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkAllAgents() {
    console.log("--- AGENT STATS: NOV 7 - DEC 7, 2025 ---");
    const start = "2025-11-07";
    const end = "2025-12-07";

    // 1. Get all agents
    const { data: agents } = await supabase.from("agents").select("id, firstname, lastname");
    const agentMap = {};
    agents?.forEach(a => agentMap[a.id] = `${a.firstname} ${a.lastname}`);

    // 2. Get Commissions
    const { data: comms } = await supabase
        .from("commissions")
        .select("agent_id, amount")
        .gte("date_earned", start)
        .lt("date_earned", end);

    // 3. Get Collections
    const { data: colls } = await supabase
        .from("collections")
        .select("agent_id, payment")
        .gte("date_paid", start)
        .lt("date_paid", end);

    // 4. Aggregate
    const stats = {};
    agents?.forEach(a => stats[a.id] = { name: agentMap[a.id], comm: 0, coll: 0 });

    comms?.forEach(c => {
        if (stats[c.agent_id]) stats[c.agent_id].comm += c.amount;
    });

    colls?.forEach(c => {
        if (stats[c.agent_id]) stats[c.agent_id].coll += c.payment;
    });

    // 5. Display
    console.log("ID | NAME                   | COMMISSIONS | COLLECTIONS");
    console.log("---|------------------------|-------------|------------");

    Object.entries(stats).forEach(([id, s]) => {
        if (s.comm > 0 || s.coll > 0) {
            console.log(`${id.padEnd(2)} | ${s.name.padEnd(22)} | ₱${s.comm.toFixed(2).padEnd(10)} | ₱${s.coll.toFixed(2)}`);
        }
    });
}

checkAllAgents();
