-- Fix adapted collection history for AF No 030801
-- This updates the collection record to show "adapted - X months" instead of just "adapted"

UPDATE collections
SET payment_for = CONCAT('adapted - ', m.adapted_months, CASE WHEN m.adapted_months = 1 THEN ' month' ELSE ' months' END)
FROM members m
WHERE collections.member_id = m.id
  AND m.maf_no = '030801'
  AND collections.payment_for = 'adapted';

-- Verify the update
SELECT 
  c.date_paid,
  c.payment,
  c.payment_for,
  c.or_no,
  m.maf_no,
  m.adapted_months
FROM collections c
JOIN members m ON c.member_id = m.id
WHERE m.maf_no = '030801'
  AND c.payment_for LIKE '%adapted%';
