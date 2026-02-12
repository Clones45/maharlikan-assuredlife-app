-- Find the most recently created adapted member
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
WHERE is_adapted = true
ORDER BY created_at DESC
LIMIT 1;

-- Check if ANY collections exist for recently created adapted members
SELECT 
  m.maf_no,
  m.first_name,
  m.last_name,
  m.adapted_months,
  m.adapted_amount,
  m.created_at as member_created,
  c.id as collection_id,
  c.payment,
  c.payment_for,
  c.date_paid,
  c.created_at as collection_created
FROM members m
LEFT JOIN collections c ON m.id = c.member_id
WHERE m.is_adapted = true
ORDER BY m.created_at DESC
LIMIT 5;
