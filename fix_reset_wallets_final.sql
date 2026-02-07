
DO $$
BEGIN
    -- 1. Agent 2 & 5: Pass Jan AGR, but Jan Cycle commissions wait for Feb 7.
    -- Result: BALANCE 0.
    
    -- Reset Balances
    UPDATE agent_wallets SET balance = 0, updated_at = now() WHERE agent_id IN (2, 5);
    
    -- Reset Rollup Statuses for 2026-2 (Feb) and 2026-1 (Jan) to 'unreleased'
    UPDATE agent_commission_rollups
    SET status = 'unreleased'
    WHERE agent_id IN (2, 5) AND period_year = 2026 AND period_month IN (1, 2);

    -- 2. Agent 6: Passed Dec AGR -> Eligible for Jan EARLY RELEASE.
    -- So Jan Earnings (Period 1) ARE Instant.
    -- Result: BALANCE 1,157.
    
    UPDATE agent_commission_rollups
    SET status = 'released'
    WHERE agent_id = 6 AND period_year = 2026 AND period_month = 1;
    
    UPDATE agent_wallets SET balance = 1157.00, updated_at = now() WHERE agent_id = 6;

    RAISE NOTICE 'Correction Complete: Agent 2/5 -> 0, Agent 6 -> 1,157';
END $$;
