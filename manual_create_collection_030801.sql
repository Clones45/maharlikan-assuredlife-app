-- Manually create the collection record for AF 030801
-- This bypasses the mobile app and creates it directly in the database

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
  m.id,
  m.agent_id,
  m.agent_id,
  m.maf_no,
  m.adapted_amount,
  CONCAT('adapted - ', m.adapted_months, CASE WHEN m.adapted_months = 1 THEN ' month' ELSE ' months' END),
  NOW(),
  DATE_TRUNC('month', NOW()),
  m.last_name,
  m.first_name,
  m.middle_name,
  m.address,
  m.plan_type,
  '',
  false,
  'accrue',
  false,
  false,
  false,
  false
FROM members m
WHERE m.maf_no = '030801';

-- Verify it was created
SELECT 
  c.id,
  c.payment,
  c.payment_for,
  c.date_paid,
  m.maf_no
FROM collections c
JOIN members m ON c.member_id = m.id
WHERE m.maf_no = '030801';
