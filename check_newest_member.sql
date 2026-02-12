-- Check the most recent adapted member (the one you just added)
SELECT 
  m.maf_no,
  m.first_name,
  m.last_name,
  m.adapted_months,
  m.adapted_amount,
  m.created_at as member_created,
  COUNT(c.id) as collection_count,
  MAX(c.payment) as collection_payment,
  MAX(c.payment_for) as collection_payment_for
FROM members m
LEFT JOIN collections c ON m.id = c.member_id
WHERE m.is_adapted = true
GROUP BY m.id, m.maf_no, m.first_name, m.last_name, m.adapted_months, m.adapted_amount, m.created_at
ORDER BY m.created_at DESC
LIMIT 2;

-- Also check for any errors in recent collections
SELECT 
  m.maf_no,
  c.created_at,
  c.payment,
  c.payment_for
FROM collections c
JOIN members m ON c.member_id = m.id
WHERE m.is_adapted = true
ORDER BY c.created_at DESC
LIMIT 5;
