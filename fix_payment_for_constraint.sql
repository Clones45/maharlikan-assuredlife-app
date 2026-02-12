-- Fix the CHECK CONSTRAINT to allow "adapted - X months" format
-- First, drop the old constraint
ALTER TABLE collections 
DROP CONSTRAINT IF EXISTS collections_payment_for_chk;

-- Then, create a new constraint that allows:
-- - All the original values (regular, membership, etc.)
-- - The new format: "adapted - X month(s)"
ALTER TABLE collections
ADD CONSTRAINT collections_payment_for_chk 
CHECK (
  payment_for IN ('regular', 'membership', 'adapted', 'outright', 'installment', 'reinstatement')
  OR payment_for LIKE 'adapted - %'  -- Allow "adapted - 3 months", etc.
);

-- Verify the new constraint
SELECT 
  conname as constraint_name,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conname = 'collections_payment_for_chk';
