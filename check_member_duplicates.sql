-- CHECK MEMBER DETAILS (Updated)
-- Checking Name AND MAF Number for the conflicting IDs.

SELECT 
    id, 
    maf_no,      -- The user mentioned this is the key identifier
    first_name, 
    last_name, 
    created_at
FROM members
WHERE id IN (325, 326, 327, 328);
