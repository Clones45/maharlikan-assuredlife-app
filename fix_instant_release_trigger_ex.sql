
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

    -- DEBUG: RAISE EXCEPTION
    RAISE EXCEPTION 'DEBUG: Agent=% Date=% => Earn=%-% Target=%-% Released=%', 
        NEW.agent_id, NEW.date_earned, py, pm, target_year, target_month, is_released;

    -- 4. If satisfied, credit immediately
    IF is_released THEN
       -- ...
    END IF;

    RETURN NEW;
END;
$function$
