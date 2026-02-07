
DO $$
DECLARE
    r RECORD;
    v_lifetime numeric;
    v_withdrawals numeric;
BEGIN
    -- 1. Restore Early Release for Agents 2 & 5 (Passed Jan -> Feb Instant)
    UPDATE agent_commission_rollups
    SET status = 'released'
    WHERE agent_id IN (2, 5) 
      AND period_year = 2026 
      AND period_month = 2; -- Feb Earnings

    -- 2. Restore Early Release for Agent 6 (Passed Dec -> Jan Instant)
    UPDATE agent_commission_rollups
    SET status = 'released'
    WHERE agent_id = 6 
      AND period_year = 2026 
      AND period_month = 1; -- Jan Earnings

    -- 3. Recalculate Wallets for these agents
    FOR r IN 
        SELECT DISTINCT agent_id FROM agent_wallets 
        WHERE agent_id IN (2, 5, 6)
    LOOP
        -- Calculate Correct Lifetime (Sum of RELEASED)
        -- Added 'c.' prefix to avoid ambiguity
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

        -- Get Withdrawals
        SELECT COALESCE(SUM(amount), 0) INTO v_withdrawals 
        FROM withdrawal_requests 
        WHERE agent_id = r.agent_id AND status NOT IN ('rejected', 'cancelled');
        
        -- Update Wallet
        -- Balance = Lifetime - Withdrawals
        UPDATE agent_wallets
        SET lifetime_commission = v_lifetime,
            balance = v_lifetime - v_withdrawals,
            updated_at = now()
        WHERE agent_id = r.agent_id;
        
        RAISE NOTICE 'Restored Agent %: Lifetime %, Withdrawals %, Balance %', 
            r.agent_id, v_lifetime, v_withdrawals, (v_lifetime - v_withdrawals);
            
    END LOOP;
END $$;
