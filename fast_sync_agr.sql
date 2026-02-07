-- ============================================================================
-- FAST SYNC AGR: Real-time Wallet Updates via Database Triggers
-- ============================================================================

-- 1. Helper: Determine Commission Period from a Date
-- Logic: Period starts on the 7th.
-- If date is Jan 23, it's >= 7, so Period is Jan (Month 1).
-- If date is Jan 5, it's < 7, so Period is Dec (Month 12 of prev year).
CREATE OR REPLACE FUNCTION get_commission_period(p_date date)
RETURNS TABLE (year int, month int) AS $$
BEGIN
    IF EXTRACT(DAY FROM p_date) >= 7 THEN
        RETURN QUERY SELECT CAST(EXTRACT(YEAR FROM p_date) AS INT), CAST(EXTRACT(MONTH FROM p_date) AS INT);
    ELSE
        RETURN QUERY SELECT 
            CAST(EXTRACT(YEAR FROM (p_date - interval '1 month')) AS INT),
            CAST(EXTRACT(MONTH FROM (p_date - interval '1 month')) AS INT);
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 2. Helper: Get Cutoff Dates for a Period (Year, Month)
-- Period M = [Month M, 7th] to [Month M+1, 7th)
CREATE OR REPLACE FUNCTION get_cutoff_range(p_year int, p_month int)
RETURNS TABLE (start_date date, end_date date) AS $$
BEGIN
    start_date := make_date(p_year, p_month, 7);
    end_date := start_date + interval '1 month';
    RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- 3. Core Logic: Check Eligibility & Release
DROP FUNCTION IF EXISTS check_and_release_agr(bigint, int, int);
CREATE OR REPLACE FUNCTION check_and_release_agr(input_agent_id bigint, input_year int, input_month int)
RETURNS void AS $$
DECLARE
    -- M-1 LOGIC: Performance in Month M-1 releases Commission in Month M.
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
    if input_month = 1 then
        prev_month := 12;
        prev_year := input_year - 1;
    else
        prev_month := input_month - 1;
        prev_year := input_year;
    end if;

    -- Check if ALREADY Released
    SELECT (status = 'released') INTO already_released
    FROM agent_commission_rollups
    WHERE agent_id = input_agent_id AND period_year = input_year AND period_month = input_month;

    IF already_released THEN
        RETURN; -- Nothing to do
    END IF;

    -- B. Check Eligibility in Prev Period
    SELECT start_date, end_date INTO prev_start, prev_end FROM get_cutoff_range(prev_year, prev_month);

    -- Rule A: 3+ Membership Fees
    -- Rule B: 1 Member with BOTH Regular + Membership (Mix)
    WITH agent_colls AS (
        SELECT c.member_id, c.is_membership_fee, c.payment_for, 
               m.first_name, m.last_name, m.middle_name
        FROM collections c
        LEFT JOIN members m ON c.member_id = m.id
        WHERE c.agent_id = input_agent_id
          AND c.date_paid >= prev_start 
          AND c.date_paid < prev_end
    ),
    stats AS (
        SELECT 
            count(*) filter (where is_membership_fee) as mem_count,
            bool_or(
                exists(
                    select 1 from agent_colls c2 
                    where 
                        -- MATCH NAMES (Ultra-Relaxed: Ignore Middle Name)
                        -- Must have First and Last name. 
                        (c2.first_name IS NOT NULL AND c2.last_name IS NOT NULL) AND
                        upper(c2.last_name) = upper(agent_colls.last_name) AND
                        upper(c2.first_name) = upper(agent_colls.first_name) 
                        -- Removed Middle Name Check to handle typos (e.g. Revillesa vs Revilla)
                    and c2.is_membership_fee != agent_colls.is_membership_fee
                )
            ) as has_mix
        FROM agent_colls
    )
    SELECT (mem_count >= 3 OR has_mix) INTO is_eligible FROM stats;

    -- Fallback for empty stats
    IF is_eligible IS NULL THEN is_eligible := false; END IF;

    IF NOT is_eligible THEN
        RETURN; -- Not eligible yet
    END IF;

    -- C. Calculate Receivable for Target Period
    SELECT start_date, end_date INTO target_start, target_end FROM get_cutoff_range(input_year, input_month);

    -- FIX: Mark commissions as receivable BEFORE summing them up
    UPDATE commissions
    SET is_receivable = true
    WHERE agent_id = input_agent_id
      AND date_earned >= target_start
      AND date_earned < target_end
      AND is_receivable = false;

    -- FIXED: Only count commissions where is_receivable = true (ALL types require AGR)
    SELECT COALESCE(SUM(
        CASE 
            WHEN is_receivable THEN 
                CASE 
                    WHEN commission_type IN ('override', 'recruiter_bonus') THEN 
                        CASE WHEN override_commission > 0 THEN override_commission ELSE amount END
                    ELSE amount 
                END
            ELSE 0 
        END
    ), 0)
    INTO receivable_amount
    FROM commissions
    WHERE agent_id = input_agent_id
      AND date_earned >= target_start
      AND date_earned < target_end;

    IF receivable_amount <= 0 THEN
        -- Still mark released
        NULL;
    ELSE
        -- D. UPDATE WALLET
        UPDATE agent_wallets 
        SET balance = agent_wallets.balance + receivable_amount, 
            lifetime_commission = agent_wallets.lifetime_commission + receivable_amount,
            updated_at = now()
        WHERE agent_wallets.agent_id = input_agent_id;

        IF NOT FOUND THEN
             INSERT INTO agent_wallets (agent_id, balance, lifetime_commission) 
             VALUES (input_agent_id, receivable_amount, receivable_amount);
        END IF;
    END IF;

    -- E. Mark Rollup as Released
    -- Note: 'receivable' column does not exist. We just mark status.
    -- The actual money was added to agent_wallets above.
    INSERT INTO agent_commission_rollups (agent_id, period_year, period_month, status)
    VALUES (input_agent_id, input_year, input_month, 'released')
    ON CONFLICT (agent_id, period_year, period_month)
    DO UPDATE SET status = 'released';

END;
$$ LANGUAGE plpgsql;


-- 4. Trigger: ON collections (Check Eligibility)
CREATE OR REPLACE FUNCTION trg_check_eligibility() RETURNS TRIGGER AS $$
DECLARE
    py int; pm int;
    target_year int; target_month int;
BEGIN
    -- Determine Period of this collection
    SELECT year, month INTO py, pm FROM get_commission_period(NEW.date_paid);
    
    -- This collection period (Jan) is the PREV period for (Feb) Release.
    IF pm = 12 THEN
        target_month := 1;
        target_year := py + 1;
    ELSE
        target_month := pm + 1;
        target_year := py;
    END IF;

    -- Re-check Release for the Target Period
    PERFORM check_and_release_agr(NEW.agent_id, target_year, target_month);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_on_collection_agr ON collections;
CREATE TRIGGER tr_on_collection_agr
AFTER INSERT OR UPDATE ON collections
FOR EACH ROW EXECUTE FUNCTION trg_check_eligibility();


-- 5. Trigger: ON commissions (Instant Release if Eligible)
CREATE OR REPLACE FUNCTION trg_instant_release_comm() RETURNS TRIGGER AS $$
DECLARE
    py int; pm int;
    is_released boolean;
    val numeric;
BEGIN
    SELECT year, month INTO py, pm FROM get_commission_period(NEW.date_earned);

    -- Check if this period is ALREADY released
    SELECT (status = 'released') INTO is_released
    FROM agent_commission_rollups
    WHERE agent_id = NEW.agent_id AND period_year = py AND period_month = pm;

    IF is_released THEN
        -- FIXED: Mark this specific commission as receivable
        UPDATE commissions SET is_receivable = true WHERE id = NEW.id;

        -- FIXED: Only add to wallet if is_receivable = true (ALL types require AGR)
        -- Calculate the amount based on commission type
        val := CASE 
            WHEN NEW.commission_type IN ('override', 'recruiter_bonus') THEN 
                CASE WHEN NEW.override_commission > 0 THEN NEW.override_commission ELSE NEW.amount END
            ELSE NEW.amount 
        END;

        -- Only add to wallet if amount is positive
        IF val > 0 THEN
             UPDATE agent_wallets 
             SET balance = balance + val, 
                 lifetime_commission = lifetime_commission + val,
                 updated_at = now()
             WHERE agent_id = NEW.agent_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_on_commission_agr ON commissions;
CREATE TRIGGER tr_on_commission_agr
AFTER INSERT ON commissions
FOR EACH ROW EXECUTE FUNCTION trg_instant_release_comm();

-- 6. ONE-TIME BACKFILL: Process Past Months
-- This ensures that when you run this script, it catches up on all history.
CREATE OR REPLACE FUNCTION backfill_agr_history() RETURNS void AS $$
DECLARE
    rec RECORD;
    curr_year int;
    curr_month int;
    y int; m int;
BEGIN
    -- Fallback to current year if not specified (request.header is not available in direct SQL execution)
    IF curr_year IS NULL THEN 
        curr_year := CAST(EXTRACT(YEAR FROM CURRENT_DATE) AS INT); 
    END IF;
    
    -- Iterate ALL Agents
    FOR rec IN SELECT id FROM agents LOOP
        -- Check last 24 months
        FOR i IN 0..23 LOOP
            y := CAST(EXTRACT(YEAR FROM (now() - (i || ' month')::interval)) AS INT);
            m := CAST(EXTRACT(MONTH FROM (now() - (i || ' month')::interval)) AS INT);
            
            PERFORM check_and_release_agr(rec.id, y, m);
        END LOOP;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Uncomment the line below to run it immediately when you execute this script
SELECT backfill_agr_history();

