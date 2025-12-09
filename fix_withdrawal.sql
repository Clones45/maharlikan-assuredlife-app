-- Run this in your Supabase SQL Editor to fix the withdrawal function

CREATE OR REPLACE FUNCTION withdraw_commission(
  p_agent_id bigint,
  p_amount numeric
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_balance numeric;
  v_month int;
  v_year int;
BEGIN
  -- 1. Check current balance
  SELECT balance INTO v_balance
  FROM agent_wallets
  WHERE agent_id = p_agent_id;

  IF v_balance IS NULL OR v_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient funds';
  END IF;

  -- 2. Determine current period (for record keeping)
  v_month := EXTRACT(MONTH FROM NOW());
  v_year := EXTRACT(YEAR FROM NOW());

  -- 3. Deduct from wallet
  UPDATE agent_wallets
  SET balance = balance - p_amount
  WHERE agent_id = p_agent_id;

  -- 4. Create Withdrawal Request in CORRECT TABLE (withdrawal_requests)
  INSERT INTO withdrawal_requests (
    agent_id, 
    amount, 
    period_month, 
    period_year, 
    status, 
    created_at
  )
  VALUES (
    p_agent_id, 
    p_amount, 
    v_month, 
    v_year, 
    'pending', 
    NOW()
  );

END;
$$;
