-- CHECK MEMBER IDs
-- We need to see if the payments are linked to the SAME member_id.
-- If member_id is NULL, the App cannot group them, so Rule B fails.

SELECT 
    id,
    date_paid,
    or_no,
    payment,
    is_membership_fee,
    payment_for,
    member_id,
    agent_id
FROM collections
WHERE or_no IN ('2564', '1745', '2565')
ORDER BY or_no, id;
