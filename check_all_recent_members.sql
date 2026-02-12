-- Check ALL recently created members (not just adapted ones)
SELECT 
  m.maf_no,
  m.first_name,
  m.last_name,
  m.is_adapted,
  m.adapted_months,
  m.adapted_amount,
  m.created_at,
  COUNT(c.id) as collection_count
FROM members m
LEFT JOIN collections c ON m.id = c.member_id
GROUP BY m.id, m.maf_no, m.first_name, m.last_name, m.is_adapted, m.adapted_months, m.adapted_amount, m.created_at
ORDER BY m.created_at DESC
LIMIT 5;
