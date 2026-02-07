-- Function: check_agent_commission_status
-- Update: Now uses the robust `check_agr_eligibility` function to determine status.
-- This ensures the Notification ("Qualified" / "Not Qualified") matches the App's "Incentives Note".

CREATE OR REPLACE FUNCTION public.check_agent_commission_status()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
  agent RECORD;
  v_is_eligible BOOLEAN;
  v_target_date DATE;
  v_target_year INT;
  v_target_month INT;
BEGIN
  -- We are checking NOW (Current Month) to see if they qualify for THIS Month's commission.
  -- Example:
  --   Today is Feb 7 (Month 2). We want to know if we Qualified for Feb Commissions.
  --   We call check_agr_eligibility(..., Year, 2).
  --   Internally, it checks Month 2-1 = Month 1 (Jan 7 - Feb 7) performance.
  
  v_target_date := CURRENT_DATE;
  v_target_year := EXTRACT(YEAR FROM v_target_date)::INT;
  v_target_month := EXTRACT(MONTH FROM v_target_date)::INT;

  FOR agent IN 
    SELECT id, user_id FROM agents
  LOOP

    -- 🔍 CALL THE SHARED LOGIC
    v_is_eligible := public.check_agr_eligibility(agent.id, v_target_year, v_target_month);

    /* -----------------------------
       INSERT NOTIFICATION
       (Only insert if user_id exists)
    ------------------------------*/
    IF agent.user_id IS NOT NULL THEN
        IF v_is_eligible THEN

          INSERT INTO notifications (title, message, type, user_id, created_at)
          VALUES (
            'Commission Qualified',
            'Congratulations! You are qualified to receive a commission next month!',
            'commission_status',
            agent.user_id,
            NOW()
          );

        ELSE

          INSERT INTO notifications (title, message, type, user_id, created_at)
          VALUES (
            'Commission Not Qualified',
            'You are not yet qualified. Please complete AGR requirements before the cut-off.',
            'commission_status',
            agent.user_id,
            NOW()
          );

        END IF;
    END IF;

  END LOOP;
END;
$function$;
