
CREATE OR REPLACE FUNCTION public.trg_instant_release_comm()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
    py int; pm int;
    target_year int; target_month int;
    is_released boolean;
    val numeric;
BEGIN
    -- 1. Determine Earning Period of the NEW commission
    SELECT year, month INTO py, pm FROM get_commission_period(NEW.date_earned);

    -- 2. Shift to Release Period (Next Month)
    IF pm = 12 THEN
        target_month := 1;
        target_year := py + 1;
    ELSE
        target_month := pm + 1;
        target_year := py;
    END IF;

    -- 3. Check if Release Period is ALREADY released
    SELECT (status = 'released') INTO is_released
    FROM agent_commission_rollups
    WHERE agent_id = NEW.agent_id 
      AND period_year = target_year 
      AND period_month = target_month;

    -- 4. If satisfied, credit immediately
    IF is_released THEN
        -- Calculate Value
        val := CASE 
            WHEN NEW.commission_type IN ('override', 'recruiter_bonus') THEN 
                CASE WHEN NEW.override_commission > 0 THEN NEW.override_commission ELSE NEW.amount END
            WHEN NEW.is_receivable THEN NEW.amount 
            ELSE 0 
        END;

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
$function$
