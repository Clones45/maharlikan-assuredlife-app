-- 1. Add Column
ALTER TABLE collections 
ADD COLUMN IF NOT EXISTS is_reinstatement BOOLEAN DEFAULT FALSE;

-- 2. Update Function to set the flag
CREATE OR REPLACE FUNCTION handle_member_reinstatement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_plan_start_date DATE;
  v_monthly_due NUMERIC;
  v_existing_payments_count INTEGER;
  v_months_since_start INTEGER;
  v_months_behind DOUBLE PRECISION;
BEGIN
  -- 1. Get Member Details
  SELECT plan_start_date, monthly_due
  INTO v_plan_start_date, v_monthly_due
  FROM members
  WHERE id = NEW.member_id;

  -- Safety check
  IF v_plan_start_date IS NULL OR v_monthly_due IS NULL OR v_monthly_due = 0 THEN
    RETURN NEW;
  END IF;

  -- 2. Count ALL payments (including this new one if it's AFTER INSERT)
  SELECT COUNT(*)
  INTO v_existing_payments_count
  FROM collections
  WHERE member_id = NEW.member_id;

  -- 3. Calculate status BEFORE reinstatement
  SELECT (
    DATE_PART('year', AGE(CURRENT_DATE, v_plan_start_date)) * 12 +
    DATE_PART('month', AGE(CURRENT_DATE, v_plan_start_date))
  ) INTO v_months_since_start;
  
  -- Logic: If they were Lapsed (months_behind > 3) essentially
  -- "Real" months behind calculation considering this payment helps reduce it by 1 conceptually
  v_months_behind := v_months_since_start - v_existing_payments_count;

  -- 4. Check if Lapsed trigger condition
  IF v_months_behind > 3 THEN
      -- Reset Plan Start Date
      UPDATE members
      SET plan_start_date = (CURRENT_DATE - (v_existing_payments_count || ' months')::INTERVAL)
      WHERE id = NEW.member_id;
      
      -- MARK THIS PAYMENT AS REINSTATEMENT
      -- Since this is an AFTER INSERT trigger, we update the row we just inserted.
      UPDATE collections 
      SET is_reinstatement = TRUE 
      WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;
