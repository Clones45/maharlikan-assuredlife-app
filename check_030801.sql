-- Diagnostic query for AF 030801
-- Check member table
SELECT 
  id,
  maf_no,
  first_name,
  last_name,
  is_adapted,
  adapted_months,
  adapted_amount,
  created_at
FROM members
WHERE maf_no = '030801';

-- Check collections table for this member
SELECT 
  c.id,
  c.member_id,
  c.date_paid,
  c.payment,
  c.payment_for,
  c.or_no,
  c.is_membership_fee,
  c.created_at
FROM collections c
JOIN members m ON c.member_id = m.id
WHERE m.maf_no = '030801'
ORDER BY c.date_paid;

-- Count all collections for this member
SELECT COUNT(*) as total_collections
FROM collections c
JOIN members m ON c.member_id = m.id
WHERE m.maf_no = '030801';
