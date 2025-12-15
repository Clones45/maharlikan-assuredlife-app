-- Function to handle reinstatement of Lapsed members
-- Triggered AFTER INSERT on collections

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
  v_total_paid INTEGER;
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

  -- 2. Count ALL payments (including this new one if it's AFTER INSERT, or excluding if BEFORE)
  -- Since trigger is AFTER INSERT (recommended), count will include NEW.
  SELECT COUNT(*)
  INTO v_existing_payments_count
  FROM collections
  WHERE member_id = NEW.member_id;

  -- 3. Calculate current status (before this logic modifies anything)
  -- Logic mimics get_lapsed_members:
  -- (Years * 12 + Months) - Count
  
  -- Calculate months since start
  -- We use age(current_date, plan_start_date)
  SELECT (
    DATE_PART('year', AGE(CURRENT_DATE, v_plan_start_date)) * 12 +
    DATE_PART('month', AGE(CURRENT_DATE, v_plan_start_date))
  ) INTO v_months_since_start;
  
  -- Calculate months behind based on the count *before* this payment effectively reinstated them?
  -- Actually, we want to know if they *were* Lapsed before this payment.
  -- If we count the new payment, months_behind decreases by 1.
  -- A Lapsed member is > 3 months behind.
  -- Example: 10 months behind. Pays 1. Now 9 months behind. Still Lapsed.
  -- We want to detect this state.
  
  v_months_behind := v_months_since_start - v_existing_payments_count;

  -- 4. Check if Lapsed (BEFORE this payment was conceptually applied to status, they were even more behind)
  -- If v_months_behind > 2 (Active is < 1, Warning < 2, At Risk < 3, Lapsed >= 3?)
  -- SQL definitions:
  -- Active: < 1
  -- Warning: 1 - 2
  -- At Risk (Lapsable): 2 - 3
  -- Lapsed: > 3
  
  -- If they are currently > 2 (meaning even with this payment they are still bad, or close to Lapsed), checks are needed.
  -- Actually, the rule is: "If the member is Lapsed, member needs to pay only 1 month to become an active."
  -- This means if they WERE Lapsed (status > 3 months behind), and they pay 1 (or more),
  -- we must drag them to Active.
  
  -- But wait, `v_months_behind` calculated above includes the new payment.
  -- So if they were 10 behind, paid 1, now 9 behind. 9 > 3. So checks pass.
  
  IF v_months_behind > 3 THEN
      -- They are Lapsed. 
      -- Requirement: Reset them to Active status.
      -- Active Status means months_behind < 1.
      -- So New_Months_Since_Start - Total_Payments < 1
      -- New_Months_Since_Start < Total_Payments + 1
      -- Let's set New_Months_Since_Start = Total_Payments.
      -- That means they are exactly up to date (0 months behind).
      
      -- New Plan Start Date = Current Date - (Total_Payments months)
      -- This makes it appear they started exactly X months ago, where X is how much they paid.
      
      UPDATE members
      SET plan_start_date = (CURRENT_DATE - (v_existing_payments_count || ' months')::INTERVAL)
      WHERE id = NEW.member_id;
      
      -- Log it or just do it? Just do it.
  END IF;

  RETURN NEW;
END;
$$;

-- Drop trigger if exists to avoid duplication
DROP TRIGGER IF EXISTS after_payment_reinstatement ON collections;

CREATE TRIGGER after_payment_reinstatement
AFTER INSERT ON collections
FOR EACH ROW
EXECUTE FUNCTION handle_member_reinstatement();
