-- ============================================================================
-- FIX: Merge Duplicate Members for AGR Compliance
-- Purpose:
-- The App requires both "Regular" and "Membership" payments to be under the 
-- SAME member_id to count as a "Mix" sale (Rule B).
-- Currently, they are split across two different Member IDs (e.g. 327 & 328).
-- We will move the "Regular" payment to the "Membership" Member ID (the one with MC-xxx).
-- ============================================================================

BEGIN;

-- 1. Fix Elizabeth Bustamante (OR 1745)
-- Move 'Regular' payment (Member 327) to 'Membership' Member (328)
UPDATE collections 
SET member_id = 328 
WHERE or_no = '1745' AND member_id = 327;

-- 2. Fix Elma Dampios (OR 2564)
-- Move 'Regular' payment (Member 325) to 'Membership' Member (326)
UPDATE collections 
SET member_id = 326 
WHERE or_no = '2564' AND member_id = 325;

COMMIT;

-- Verification Output
SELECT id, or_no, payment_for, member_id 
FROM collections 
WHERE or_no IN ('1745', '2564');
