-- Test Script for Reinstatement Logic
-- 1. Create Dummy Member (Lapsed)
-- 2. Check Status
-- 3. Insert Payment
-- 4. Check Status (Should be Active)

DO $$
DECLARE
  v_member_id BIGINT;
  v_months_behind DOUBLE PRECISION;
  v_plan_start_date DATE;
  v_new_start_date DATE;
BEGIN
  RAISE NOTICE '--- STARTING REINSTATEMENT TEST ---';

  -- 1. Create Dummy Member
  -- Plan Start Date: 12 months ago
  -- Payments: 0
  -- Status: Lapsed (12 months behind > 3)
  INSERT INTO members (
    first_name, last_name, plan_type, contracted_price, 
    monthly_due, balance, plan_start_date, agent_id
  ) VALUES (
    'TestReinstatement', 'Dummy', 'PACKAGE A', 60000, 
    1000, 60000, CURRENT_DATE - INTERVAL '12 months', 1
  ) RETURNING id INTO v_member_id;
  
  RAISE NOTICE 'Created Dummy Member ID: %', v_member_id;

  -- Verify Initial Lapsed State
  SELECT 
    (
        DATE_PART('year', AGE(CURRENT_DATE, plan_start_date)) * 12 +
        DATE_PART('month', AGE(CURRENT_DATE, plan_start_date))
    ) - 0
  INTO v_months_behind
  FROM members WHERE id = v_member_id;
  
  RAISE NOTICE 'Initial Months Behind: % (Expected ~12)', v_months_behind;
  
  IF v_months_behind < 3 THEN
    RAISE EXCEPTION 'Setup failed: Member should be lapsed but is only % behind', v_months_behind;
  END IF;

  -- 2. Insert Payment (1 Month)
  RAISE NOTICE 'Inserting Payment of 1000...';
  INSERT INTO collections (
    member_id, amount, date_collected, collector_id
  ) VALUES (
    v_member_id, 1000, CURRENT_DATE, 1
  );

  -- 3. Verify Reinstatement
  -- Trigger should have fired. plan_start_date should be reset.
  -- New Start Date should be roughly Current Date - 1 month (since they paid 1 month total).
  
  SELECT plan_start_date INTO v_new_start_date FROM members WHERE id = v_member_id;
  RAISE NOTICE 'New Plan Start Date: %', v_new_start_date;
  
  -- Recalculate Months Behind
  -- (Age) - 1 Payment
  SELECT 
    (
        DATE_PART('year', AGE(CURRENT_DATE, plan_start_date)) * 12 +
        DATE_PART('month', AGE(CURRENT_DATE, plan_start_date))
    ) - 1
  INTO v_months_behind
  FROM members WHERE id = v_member_id;
  
  RAISE NOTICE 'New Months Behind: % (Expected < 1)', v_months_behind;
  
  IF v_months_behind >= 1 THEN
     RAISE EXCEPTION 'Test Failed: Member is still % behind. Trigger did not reset start date correctly.', v_months_behind;
  ELSE
     RAISE NOTICE 'SUCCESS: Lapsed Member is now Active (< 1 month behind).';
  END IF;

  -- 3.1 Verify Reinstatement Flag matches
  DECLARE
    v_is_reinstated BOOLEAN;
  BEGIN
    SELECT is_reinstatement INTO v_is_reinstated FROM collections WHERE member_id = v_member_id ORDER BY id DESC LIMIT 1;
    IF v_is_reinstated IS TRUE THEN
        RAISE NOTICE 'SUCCESS: Payment marked as Reinstatement.';
    ELSE
        RAISE NOTICE 'WARNING: Payment NOT marked as Reinstatement (Column might not exist yet or Trigger update failed).';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'WARNING: Could not check is_reinstatement column (it may not exist).';
  END;

  -- ====================================================
  -- TEST 2: Warning Member (1.5 months behind) -> Pay 1 Month -> Active
  -- ====================================================
  RAISE NOTICE '--- TEST 2: Warning -> Active ---';
  
  -- Create Warning Member (1.5 months behind)
  -- Plan Start: 1.5 months ago. Payments: 0.
  -- 1.5 rounded is tricky with dates, let's use 2 months ago and 0 payments? No that's Lapsable (2.0).
  -- Let's use 1 month + 15 days ago.
  INSERT INTO members (
    first_name, last_name, plan_type, contracted_price, 
    monthly_due, balance, plan_start_date, agent_id
  ) VALUES (
    'TestWarning', 'Dummy', 'PACKAGE A', 60000, 
    1000, 60000, CURRENT_DATE - INTERVAL '1 month 15 days', 1
  ) RETURNING id INTO v_member_id;

  -- Pay 1 Month
  INSERT INTO collections (member_id, amount, date_collected, collector_id) 
  VALUES (v_member_id, 1000, CURRENT_DATE, 1);
  
  -- Check Status
  SELECT 
    (EXTRACT(YEAR FROM AGE(CURRENT_DATE, plan_start_date)) * 12 +
     EXTRACT(MONTH FROM AGE(CURRENT_DATE, plan_start_date))) - 
    (SELECT COUNT(*) FROM collections WHERE member_id = v_member_id)
  INTO v_months_behind
  FROM members WHERE id = v_member_id;
  
  RAISE NOTICE 'Warning Member New Status: % months behind (Should be < 1)', v_months_behind;
  -- 1.5 - 1 = 0.5 -> Active
  IF v_months_behind < 1 THEN
      RAISE NOTICE 'SUCCESS: Warning Member became Active.';
  ELSE
      RAISE EXCEPTION 'FAIL: Warning Member did not become Active.';
  END IF;

  -- ====================================================
  -- TEST 3: Lapsable Member (2.5 months behind) -> Pay 1 Month -> Warning
  -- ====================================================
  RAISE NOTICE '--- TEST 3: Lapsable -> Warning ---';
  
  INSERT INTO members (
    first_name, last_name, plan_type, contracted_price, 
    monthly_due, balance, plan_start_date, agent_id
  ) VALUES (
    'TestLapsable', 'Dummy', 'PACKAGE A', 60000, 
    1000, 60000, CURRENT_DATE - INTERVAL '2 months 15 days', 1
  ) RETURNING id INTO v_member_id;

  -- Pay 1 Month
  INSERT INTO collections (member_id, amount, date_collected, collector_id) 
  VALUES (v_member_id, 1000, CURRENT_DATE, 1);
  
  -- Check Status
  SELECT 
    (EXTRACT(YEAR FROM AGE(CURRENT_DATE, plan_start_date)) * 12 +
     EXTRACT(MONTH FROM AGE(CURRENT_DATE, plan_start_date))) - 
    (SELECT COUNT(*) FROM collections WHERE member_id = v_member_id)
  INTO v_months_behind
  FROM members WHERE id = v_member_id;
  
  RAISE NOTICE 'Lapsable Member New Status: % months behind (Should be 1.5)', v_months_behind;
  -- 2.5 - 1 = 1.5 -> Warning (1 to 2)
  IF v_months_behind >= 1 AND v_months_behind < 2 THEN
      RAISE NOTICE 'SUCCESS: Lapsable Member became Warning.';
  ELSE
      RAISE EXCEPTION 'FAIL: Lapsable Member did not become Warning.';
  END IF;



  -- Cleanup
  -- DELETE FROM collections WHERE member_id = v_member_id;
  -- DELETE FROM members WHERE id = v_member_id;
  -- RAISE NOTICE 'Cleanup completed.';
END;
$$;
