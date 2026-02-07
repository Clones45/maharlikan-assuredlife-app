-- VERIFY DUPLICATES BY NAME
-- The user requested to verify identity using Last Name, First Name, AND Middle Name.

SELECT 
    id, 
    maf_no, 
    first_name, 
    last_name, 
    middle_name, -- Checking the middle name as requested
    created_at
FROM members
WHERE id IN (325, 326, 327, 328);

-- OPTIONAL: Find ALL duplicates in the system based on these unique fields
-- This helps see if this is a systemic issue
/*
SELECT first_name, last_name, middle_name, count(*)
FROM members
GROUP BY first_name, last_name, middle_name
HAVING count(*) > 1;
*/
