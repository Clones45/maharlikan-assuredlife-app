-- Manual test: Try to insert a collection record for AF 030801
-- This will tell us if there's a database constraint blocking the insert

-- First, get the member_id for 030801
WITH member_info AS (
  SELECT id, maf_no, adapted_months, adapted_amount
  FROM members
  WHERE maf_no = '030801'
)
-- Now try to insert a collection manually
INSERT INTO collections (
  member_id,
  agent_id,
  collector_id,
  maf_no,
  payment,
  payment_for,
  date_paid,
  collection_month,
  last_name,
  first_name,
  middle_name,
  address,
  plan_type,
  or_no,
  is_membership_fee,
  outright_mode,
  deduct_now,
  got_monthly_commission,
  got_travel_allowance,
  personally_collected
)
SELECT 
  id,                                                    -- member_id
  1,                                                     -- agent_id (REPLACE WITH ACTUAL agent_id if needed)
  1,                                                     -- collector_id
  maf_no,                                                -- maf_no
  adapted_amount,                                        -- payment
  CONCAT('adapted - ', adapted_months, ' months'),      -- payment_for
  NOW(),                                                 -- date_paid
  DATE_TRUNC('month', NOW()),                           -- collection_month
  'Manayaga',                                            -- last_name
  'Nerah',                                               -- first_name
  null,                                                  -- middle_name
  '',                                                    -- address
  'PACKAGE A1',                                          -- plan_type (ADJUST AS NEEDED)
  '',                                                    -- or_no
  false,                                                 -- is_membership_fee
  'accrue',                                              -- outright_mode
  false,                                                 -- deduct_now
  false,                                                 -- got_monthly_commission
  false,                                                 -- got_travel_allowance
  false                                                  -- personally_collected
FROM member_info;

-- Verify it worked
SELECT 
  id,
  member_id,
  payment,
  payment_for,
  date_paid,
  created_at
FROM collections
WHERE member_id = (SELECT id FROM members WHERE maf_no = '030801')
ORDER BY created_at DESC;
