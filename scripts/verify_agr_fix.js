const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://agyueadcymdopgihtckc.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFneXVlYWRjeW1kb3BnaWh0Y2tjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzMzA2NjYsImV4cCI6MjA3NDkwNjY2Nn0.EBYfJ9RTkeGLQptG3uWaOsFMIz9DySu3uhaOlzgeeMw";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function verifyAGRFix() {
    console.log("🔍 Verifying AGR Fix...");

    // 1. Pick an agent who should be qualified (based on previous knowledge or just Agent 6)
    const AGENT_ID = 6;
    const YEAR = 2026;
    const MONTH = 2; // Target Feb (Qualify Jan)

    console.log(`Checking Agent ${AGENT_ID} for ${YEAR}-${MONTH}...`);

    const { data: isEligible, error } = await supabase.rpc('check_agr_eligibility', {
        p_agent_id: AGENT_ID,
        p_year: YEAR,
        p_month: MONTH
    });

    if (error) {
        console.error("❌ Error calling check_agr_eligibility:", error);
    } else {
        console.log(`✅ Result: ${isEligible ? 'QUALIFIED' : 'NOT QUALIFIED'}`);
    }
}

verifyAGRFix();
