
DO $$
BEGIN
    -- 1. Agent 2 & 5: Set Balance to 0 (Wait for Feb 7)
    UPDATE agent_wallets 
    SET balance = 0, 
        updated_at = now() 
    WHERE agent_id IN (2, 5);
    
    -- 2. Agent 6: Set Balance to 1,157.00
    UPDATE agent_wallets 
    SET balance = 1157.00, 
        updated_at = now() 
    WHERE agent_id = 6;

    -- 3. Ensure Rollup Statuses match this reality
    -- Agent 2, 5: Feb 2026 Unreleased (Correct). Jan 2026 Unreleased (Wait for Feb 7).
    UPDATE agent_commission_rollups
    SET status = 'unreleased'
    WHERE agent_id IN (2, 5) AND period_year = 2026 AND period_month IN (1, 2);

    -- Agent 6: 
    -- The user expects 1157 to be available. 
    -- My debug showed 1157 corresponds to Period 2026-1 (Jan).
    -- So for Agent 6, Period 2026-1 MUST be 'released'.
    UPDATE agent_commission_rollups
    SET status = 'released'
    WHERE agent_id = 6 AND period_year = 2026 AND period_month = 1;
    
    -- And Dec 2025 (Period 12) should be 'released' too? 
    -- User didn't mention it, but usually yes. Let's leave it as is (my previous script released it).
    
    RAISE NOTICE 'Wallets Reset: Agent 2/5 -> 0, Agent 6 -> 1,157. Statuses updated.';
END $$;
