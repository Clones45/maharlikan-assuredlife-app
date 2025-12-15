-- Refactored Reinstatement Logic (BEFORE INSERT)

-- 1. Ensure Column Exists (Idempotent)
ALTER TABLE collections 
ADD COLUMN IF NOT EXISTS is_reinstatement BOOLEAN DEFAULT FALSE;

-- 2. Drop Old Objects to Avoid Conflicts
DROP TRIGGER IF EXISTS after_payment_reinstatement ON collections;
DROP FUNCTION IF EXISTS handle_member_reinstatement();

-- 3. Create OR REPLACE Function (Modified for BEFORE INSERT)
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
  v_new_total_payments INTEGER;
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

  -- 2. Count EXISTING payments (Excluding this one because it's BEFORE INSERT)
  SELECT COUNT(*)
  INTO v_existing_payments_count
  FROM collections
  WHERE member_id = NEW.member_id;
  
  -- The count determining the new state should include the new payment
  v_new_total_payments := v_existing_payments_count + 1;

  -- 3. Calculate status BEFORE reinstatement
  -- Logic: If they were Lapsed (months_behind > 3) essentially
  -- "Real" months behind calculation considering this payment helps reduce it by 1 conceptually
  
  -- Months since start
  SELECT (
    DATE_PART('year', AGE(CURRENT_DATE, v_plan_start_date)) * 12 +
    DATE_PART('month', AGE(CURRENT_DATE, v_plan_start_date))
  ) INTO v_months_since_start;
  
  -- Months behind (Current state before this payment is effectively applied)
  -- If we want to see if they ARE/WERE Lapsed, we compare (Months Since - Existing Count)
  -- Example: 5 months since start. 0 existing payments. Months Behind = 5. (> 3 Lapsed).
  v_months_behind := v_months_since_start - v_existing_payments_count;

  -- 4. Check if Lapsed trigger condition
  IF v_months_behind > 3 THEN
      -- Reset Plan Start Date
      -- We want to make them "Active" (< 1 month behind).
      -- So we set start date s.t. MonthsSinceStart == NewTotalPayments.
      -- NewStart = Now - NewTotalPayments months.
      UPDATE members
      SET plan_start_date = (CURRENT_DATE - (v_new_total_payments || ' months')::INTERVAL)
      WHERE id = NEW.member_id;
      
      -- MARK THIS PAYMENT AS REINSTATEMENT DIRECTLY
      NEW.is_reinstatement := TRUE;
  END IF;

  RETURN NEW;
END;
$$;

-- 4. Re-create Trigger as BEFORE INSERT
CREATE TRIGGER before_payment_reinstatement
BEFORE INSERT ON collections
FOR EACH ROW
EXECUTE FUNCTION handle_member_reinstatement();
