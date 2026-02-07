-- HISTORY BREAKDOWN FOR JANACE
-- See exactly which months contributed to the 8,822 balance

WITH agent_lookup AS (
    SELECT id FROM agents WHERE lastname ILIKE 'Kasilagan' LIMIT 1
)
SELECT 
    period_year,
    period_month,
    status,
    grand_total_commission as amount,
    receivable, -- checks if this column exists locally or just interpret logic
    updated_at
FROM agent_commission_rollups
WHERE agent_id = (SELECT id FROM agent_lookup)
ORDER BY period_year DESC, period_month DESC;

-- Also check wallet total vs Sum of released
-- SELECT sum(grand_total_commission) FROM ... WHERE status='released'
