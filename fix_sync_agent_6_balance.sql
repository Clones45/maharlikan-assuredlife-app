
DO $$
BEGIN
    -- Force set Agent 6 Balance to match the confirmed 1,437.00 total
    -- The discrepancy (280) was due to an outdated rollup total.
    
    -- 1. Sync Wallet
    UPDATE agent_wallets 
    SET balance = 1437.00, 
        lifetime_commission = 1437.00,
        updated_at = now() 
    WHERE agent_id = 6;
    
    -- 2. Sync Commission Rollup (Jan 2026)
    UPDATE agent_commission_rollups
    SET grand_total_commission = 1437.00,
        status = 'released'
    WHERE agent_id = 6 AND period_year = 2026 AND period_month = 1;

    RAISE NOTICE 'Fixed Agent 6 Balance to 1,437.00';
END $$;
