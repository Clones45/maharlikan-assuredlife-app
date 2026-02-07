
DO $$
DECLARE
    r RECORD;
    v_lifetime numeric;
    v_balance numeric;
    v_withdrawals numeric;
BEGIN
    -- 1. Revert Feb 2026 to 'unreleased' (Currently Feb 6, Cutoff is Feb 7)
    -- This affects anyone who got paid early.
    UPDATE agent_commission_rollups
    SET status = 'unreleased'
    WHERE period_year = 2026 AND period_month = 2 AND status = 'released';

    -- 2. Force Release Dec 2025 for Agent 6 (Passed via Mix but missed)
    UPDATE agent_commission_rollups
    SET status = 'released'
    WHERE agent_id = 6 AND period_year = 2025 AND period_month = 12;

    -- 3. Recalculate Wallets for affected agents (2, 5, 6, and anyone else)
    FOR r IN 
        SELECT DISTINCT agent_id FROM agent_commission_rollups 
        WHERE (period_year = 2026 AND period_month = 2) 
           OR (agent_id = 6 AND period_year = 2025 AND period_month = 12)
    LOOP
        -- A. Calculate Correct Lifetime Commission (Sum of RELEASED Rollups)
        -- FIXED: Added 'c.' prefix to avoid ambiguity
        SELECT COALESCE(SUM(
            CASE 
                WHEN c.commission_type IN ('override', 'recruiter_bonus') THEN 
                    CASE WHEN c.override_commission > 0 THEN c.override_commission ELSE c.amount END
                WHEN c.is_receivable THEN c.amount 
                ELSE 0 
            END
        ), 0)
        INTO v_lifetime
        FROM commissions c
        JOIN agent_commission_rollups ar 
          ON c.agent_id = ar.agent_id 
          AND c.period_year = ar.period_year 
          AND c.period_month = ar.period_month
        WHERE c.agent_id = r.agent_id
          AND ar.status = 'released';

        -- B. Update Wallet
        DECLARE
            old_lifetime numeric;
            old_balance numeric;
            spent numeric;
        BEGIN
            SELECT lifetime_commission, balance INTO old_lifetime, old_balance
            FROM agent_wallets WHERE agent_id = r.agent_id;
            
            spent := COALESCE(old_lifetime, 0) - COALESCE(old_balance, 0);
            
            -- Update Wallet
            UPDATE agent_wallets
            SET lifetime_commission = v_lifetime,
                balance = v_lifetime - spent,
                updated_at = now()
            WHERE agent_id = r.agent_id;
            
            RAISE NOTICE 'Fixed Agent %: Lifetime % -> %, Balance % -> %', 
                r.agent_id, old_lifetime, v_lifetime, old_balance, (v_lifetime - spent);
        END;
        
    END LOOP;
END $$;
