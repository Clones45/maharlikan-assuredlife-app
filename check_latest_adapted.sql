-- Check the LATEST adapted member and their collections
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
LIMIT 1;

-- Also check if there are ANY collections at all for AF 030801
SELECT COUNT(*) as total_collections
FROM collections c
JOIN members m ON c.member_id = m.id
WHERE m.maf_no = '030801';
