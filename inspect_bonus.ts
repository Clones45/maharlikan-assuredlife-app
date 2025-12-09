// @ts-nocheck
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://agyueadcymdopgihtckc.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFneXVlYWRjeW1kb3BnaWh0Y2tjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzMzA2NjYsImV4cCI6MjA3NDkwNjY2Nn0.EBYfJ9RTkeGLQptG3uWaOsFMIz9DySu3uhaOlzgeeMw";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function inspectRecruiterBonus() {
    console.log("Fetching recruiter_bonus rows...");

    const { data, error } = await supabase
        .from("commissions")
        .select("*, collections(*)")
        .eq("commission_type", "recruiter_bonus")
        .limit(5);

    if (error) {
        console.error("Error:", error);
        return;
    }

    console.log("Found", data.length, "rows.");
    if (data.length > 0) {
        console.log("Sample row:", JSON.stringify(data[0], null, 2));
    }
}

inspectRecruiterBonus();
