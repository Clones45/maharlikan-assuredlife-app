-- Reset OLACO for Reinstatement Test
-- 1. Remove all collections for this member (to start fresh)
DELETE FROM collections 
WHERE member_id = (SELECT id FROM members WHERE last_name = 'OLACO');

-- 2. Reset Plan Start Date to ORIGIN (July 26, 2025)
UPDATE members
SET plan_start_date = '2025-07-26'
WHERE last_name = 'OLACO';

-- 3. Confirm Status
DO $$
DECLARE
    r RECORD;
    v_months_behind FLOAT;
BEGIN
    SELECT * INTO r FROM members WHERE last_name = 'OLACO';
    
    -- Calculate months behind based on now vs July
    -- July to Dec = ~5 months
    SELECT 
    (
        DATE_PART('year', AGE(CURRENT_DATE, r.plan_start_date)) * 12 +
        DATE_PART('month', AGE(CURRENT_DATE, r.plan_start_date))
    ) INTO v_months_behind;
    
    RAISE NOTICE 'Olaco Reset Complete.';
    RAISE NOTICE 'Plan Start: %', r.plan_start_date;
    RAISE NOTICE 'Months Behind: %', v_months_behind;
    
    IF v_months_behind > 3 THEN
        RAISE NOTICE 'Status: LAPSED (Ready for test)';
    ELSE
        RAISE NOTICE 'Status: WARNING/ACTIVE (Check dates?)';
    END IF;
END $$;
