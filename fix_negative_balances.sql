
DO $$
DECLARE
    r RECORD;
    v_lifetime numeric;
    v_withdrawals numeric;
BEGIN
    -- Fix for Agents 1, 2, 5, 6 (and potentially others with negative balances)
    -- Logic: If they have NO withdrawals, Balance MUST equal Lifetime.
    FOR r IN 
        SELECT agent_id, balance, lifetime_commission 
        FROM agent_wallets 
        WHERE balance < 0
    LOOP
        -- Check actual withdrawals/payouts
        SELECT COALESCE(SUM(amount), 0) INTO v_withdrawals 
        FROM withdrawal_requests 
        WHERE agent_id = r.agent_id AND status NOT IN ('rejected', 'cancelled');

        -- Optional: Add check for 'payouts' table if it tracks separate things
        -- SELECT COALESCE(SUM(amount), 0) + v_withdrawals INTO v_withdrawals ...

        IF v_withdrawals = 0 THEN
            -- No withdrawals? Reset Balance to match Lifetime (or current released sum)
            -- We trust the Lifetime Commission we just recalculated in the previous step (fix_revert_early_releases.sql)
            -- So we simply set Balance = Lifetime.
            UPDATE agent_wallets
            SET balance = lifetime_commission,
                updated_at = now()
            WHERE agent_id = r.agent_id;
            
            RAISE NOTICE 'Fixed Negative Balance for Agent %: Was %, Withdrawals=0, Reset to %', 
                r.agent_id, r.balance, r.lifetime_commission;
        ELSE
            -- If strictly negative but valid withdrawals exist, we might need manual review.
            -- But for now, user context implies these are ALL errors.
            -- Let's apply a safer fix: Balance = Lifetime - Withdrawals.
            UPDATE agent_wallets
            SET balance = lifetime_commission - v_withdrawals,
                updated_at = now()
            WHERE agent_id = r.agent_id;
            
            RAISE NOTICE 'Adjusted Agent % with Withdrawals (%): New Balance %', 
                r.agent_id, v_withdrawals, (r.lifetime_commission - v_withdrawals);
        END IF;
    END LOOP;
END $$;
