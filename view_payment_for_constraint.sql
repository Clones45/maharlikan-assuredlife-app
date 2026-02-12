-- View the current CHECK CONSTRAINT on payment_for
SELECT 
  conname as constraint_name,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conname = 'collections_payment_for_chk';
