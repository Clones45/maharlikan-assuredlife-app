
DROP FUNCTION IF EXISTS public.check_and_release_agr(bigint, integer, integer);

CREATE OR REPLACE FUNCTION public.check_and_release_agr(p_agent_id bigint, p_year integer, p_month integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    prev_year int;
    prev_month int;
    prev_start date;
    prev_end date;
    is_eligible boolean := false;
    
    target_start date;
    target_end date;
    
    receivable_amount numeric := 0;
    already_released boolean := false;
BEGIN
    -- A. Determine Previous Period (The Qualifier)
    -- If Target is Feb (2), Prev is Jan (1).
    if p_month = 1 then
        prev_month := 12;
        prev_year := p_year - 1;
    else
        prev_month := p_month - 1;
        prev_year := p_year;
    end if;

    -- Check if ALREADY Released
    SELECT (status = 'released') INTO already_released
    FROM agent_commission_rollups
    WHERE agent_id = p_agent_id AND period_year = p_year AND period_month = p_month;

    IF already_released THEN
        RETURN; -- Nothing to do
    END IF;

    -- NEW: Enforce Date Check (Wait for Cutoff)
    SELECT start_date, end_date INTO target_start, target_end FROM get_cutoff_range(p_year, p_month);
    
    -- If today is BEFORE the start date (the 7th), DO NOT RELEASE.
    IF CURRENT_DATE < target_start THEN
        -- Optional: Raise notice for debug
        -- RAISE NOTICE 'Too early to release %-%. Current: %, Wait for %', p_year, p_month, CURRENT_DATE, target_start;
        RETURN; 
    END IF;

    -- B. Check Eligibility in Prev Period
    SELECT start_date, end_date INTO prev_start, prev_end FROM get_cutoff_range(prev_year, prev_month);

    WITH agent_colls AS (
        SELECT member_id, is_membership_fee, payment_for
        FROM collections
        WHERE agent_id = p_agent_id
          AND date_paid >= prev_start 
          AND date_paid < prev_end
    ),
    stats AS (
        SELECT 
            count(*) filter (where is_membership_fee) as mem_count,
            bool_or(
                exists(
                    select 1 from agent_colls c2 
                    where c2.member_id = agent_colls.member_id 
                    and c2.is_membership_fee != agent_colls.is_membership_fee
                )
            ) as has_mix
        FROM agent_colls
    )
    SELECT (mem_count >= 3 OR has_mix) INTO is_eligible FROM stats;

    IF is_eligible IS NULL THEN is_eligible := false; END IF;

    IF NOT is_eligible THEN
        RETURN; -- Not eligible yet
    END IF;

    -- C. Calculate Receivable for Target Period
    -- (Reuse target_start/end from above)

    SELECT COALESCE(SUM(
        CASE 
            WHEN commission_type IN ('override', 'recruiter_bonus') THEN 
                CASE WHEN override_commission > 0 THEN override_commission ELSE amount END
            WHEN is_receivable THEN amount 
            ELSE 0 
        END
    ), 0)
    INTO receivable_amount
    FROM commissions
    WHERE agent_id = p_agent_id
      AND date_earned >= target_start
      AND date_earned < target_end;

    IF receivable_amount <= 0 THEN
        NULL;
    ELSE
        -- D. UPDATE WALLET
        UPDATE agent_wallets 
        SET balance = balance + receivable_amount, 
            lifetime_commission = lifetime_commission + receivable_amount,
            updated_at = now()
        WHERE agent_id = p_agent_id;

        IF NOT FOUND THEN
             INSERT INTO agent_wallets (agent_id, balance, lifetime_commission) 
             VALUES (p_agent_id, receivable_amount, receivable_amount);
        END IF;
    END IF;

    -- E. Mark Rollup as Released
    INSERT INTO agent_commission_rollups (agent_id, period_year, period_month, status, receivable)
    VALUES (p_agent_id, p_year, p_month, 'released', receivable_amount)
    ON CONFLICT (agent_id, period_year, period_month)
    DO UPDATE SET status = 'released', receivable = EXCLUDED.receivable;

END;
$function$
