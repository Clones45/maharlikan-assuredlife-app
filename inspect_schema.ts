// @ts-nocheck
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://agyueadcymdopgihtckc.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFneXVlYWRjeW1kb3BnaWh0Y2tjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzMzA2NjYsImV4cCI6MjA3NDkwNjY2Nn0.EBYfJ9RTkeGLQptG3uWaOsFMIz9DySu3uhaOlzgeeMw";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function inspectSchema() {
    console.log("--- INSPECTING AGENT WALLETS TABLE ---");

    const { data, error } = await supabase
        .from("agent_wallets")
        .select("*")
        .limit(1);

    if (error) {
        console.error("Error:", error);
        return;
    }

    if (data.length === 0) {
        console.log("Table is empty.");
    } else {
        console.log("Sample Row Keys (Columns):");
        console.log(Object.keys(data[0]).join(", "));

        console.log("\nSample Row Data:");
        console.log(data[0]);
    }
}

inspectSchema();
