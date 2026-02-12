-- Check if the most recent adapted member has the right data
SELECT 
  maf_no,
  first_name,
  last_name,
  is_adapted,
  adapted_months,
  adapted_amount,
  created_at,
  -- This should show us if the member was truly created as adapted
  CASE 
    WHEN is_adapted = true THEN 'Yes - member is adapted'
    WHEN is_adapted = false THEN 'No - member is NOT adapted (check mobile app)'
    ELSE 'NULL - is_adapted field not set'
  END as adapted_status
FROM members
WHERE maf_no = '030801';
