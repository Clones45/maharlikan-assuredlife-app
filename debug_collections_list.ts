// @ts-nocheck
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://agyueadcymdopgihtckc.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFneXVlYWRjeW1kb3BnaWh0Y2tjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzMzA2NjYsImV4cCI6MjA3NDkwNjY2Nn0.EBYfJ9RTkeGLQptG3uWaOsFMIz9DySu3uhaOlzgeeMw";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function listCollections() {
    console.log("--- COLLECTIONS REPORT: NOV 7 - DEC 7, 2025 ---");

    const start = "2025-11-07";
    const end = "2025-12-07";

    // 1. Fetch Collections
    const { data: colls, error: collError } = await supabase
        .from("collections")
        .select("id, date_paid, payment, agent_id, member_id")
        .gte("date_paid", start)
        .lt("date_paid", end)
        .order("date_paid", { ascending: true });

    if (collError) { console.error(collError); return; }

    if (colls.length === 0) {
        console.log("No collections found in this range.");
        return;
    }

    // 2. Fetch Agent Names
    const agentIds = [...new Set(colls.map(c => c.agent_id))];
    const { data: agents } = await supabase
        .from("agents")
        .select("id, firstname, lastname")
        .in("id", agentIds);

    const agentMap = {};
    agents?.forEach(a => agentMap[a.id] = `${a.firstname} ${a.lastname}`);

    // 3. Fetch Member Names
    const memberIds = [...new Set(colls.map(c => c.member_id))];
    const { data: members } = await supabase
        .from("members")
        .select("id, first_name, last_name")
        .in("id", memberIds);

    const memberMap = {};
    members?.forEach(m => memberMap[m.id] = `${m.first_name} ${m.last_name}`);

    // 4. Display Table
    console.log(`Found ${colls.length} collections:\n`);
    console.log("DATE       | AGENT (Collector)      | MEMBER (Payer)         | AMOUNT");
    console.log("-----------|------------------------|------------------------|----------");

    colls.forEach(c => {
        const date = c.date_paid;
        const agent = (agentMap[c.agent_id] || `ID ${c.agent_id}`).padEnd(22).slice(0, 22);
        const member = (memberMap[c.member_id] || `ID ${c.member_id}`).padEnd(22).slice(0, 22);
        const amount = (c.payment || 0).toFixed(2).padStart(8);

        console.log(`${date} | ${agent} | ${member} | ₱${amount}`);
    });
}

listCollections();
