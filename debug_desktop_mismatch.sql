-- Find the agent based on the collections shown in the screenshot
WITH target_collection AS (
    SELECT agent_id, date_paid, or_no, payment
    FROM collections 
    WHERE or_no IN ('2564', '2563')
    LIMIT 1
),
agent_info AS (
    SELECT a.id, a.firstname, a.lastname, a.recruiter_id
    FROM agents a
    JOIN target_collection tc ON a.id = tc.agent_id
)
SELECT 
    ai.id as "Agent ID",
    ai.firstname || ' ' || ai.lastname as "Name",
    w.balance as "Wallet Balance",
    w.updated_at as "Wallet Updated",
    r.period_year,
    r.period_month,
    r.status as "Rollup Status",
    r.grand_total_commission as "Rollup Total",
    (SELECT count(*) FROM collections c WHERE c.agent_id = ai.id) as "Total Collections Count"
FROM agent_info ai
LEFT JOIN agent_wallets w ON w.agent_id = ai.id
LEFT JOIN agent_commission_rollups r ON r.agent_id = ai.id 
    AND r.period_year = 2026 AND r.period_month = 1;
