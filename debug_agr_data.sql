-- ============================================================================
-- DEBUG: AGR Data Inspection
-- Purpose: Check if 'is_membership_fee' is actually TRUE for recent payments.
-- ============================================================================

SELECT 
    id,
    date_paid,
    or_no,
    payment,
    -- Check if the column is actually true/false
    is_membership_fee,
    payment_for,
    agent_id
FROM collections
ORDER BY date_paid DESC
LIMIT 20;

-- Also check specific agents who SHOULD have passed
-- Replace 123 with a known Agent ID if you have one, or just look at the list above.
