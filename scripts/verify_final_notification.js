const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://agyueadcymdopgihtckc.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFneXVlYWRjeW1kb3BnaWh0Y2tjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzMzA2NjYsImV4cCI6MjA3NDkwNjY2Nn0.EBYfJ9RTkeGLQptG3uWaOsFMIz9DySu3uhaOlzgeeMw";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function verifyNotification() {
    console.log("🔍 Verifying Notification for Agent 6...");

    // 1. Get User ID for Agent 6
    const { data: agent, error: agentErr } = await supabase
        .from('agents')
        .select('user_id')
        .eq('id', 6)
        .single();

    if (agentErr || !agent) {
        console.error("❌ Could not find Agent 6:", agentErr);
        return;
    }

    const userId = agent.user_id;
    console.log(`Found User ID: ${userId}`);

    if (!userId) {
        console.error("❌ Agent 6 has no user_id linked!");
        return;
    }

    // 2. Fetch Latest Notification
    const { data: notifs, error: notifErr } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1);

    if (notifErr) {
        console.error("❌ Error fetching notifications:", notifErr);
        return;
    }

    if (notifs && notifs.length > 0) {
        const latest = notifs[0];
        console.log("✅ Latest Notification:");
        console.log(`   Title:   ${latest.title}`);
        console.log(`   Message: ${latest.message}`);
        console.log(`   Time:    ${latest.created_at}`);

        if (latest.title === "Commission Qualified") {
            console.log("\n🎉 SUCCESS: Agent is now notified as QUALIFIED!");
        } else {
            console.log("\n⚠️ WARNING: Latest notification is NOT 'Commission Qualified'.");
        }
    } else {
        console.log("⚠️ No notifications found for this agent.");
    }
}

verifyNotification();
