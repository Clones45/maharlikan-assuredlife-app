WITH agent_lookup AS (
    SELECT id, lastname, firstname FROM agents WHERE lastname ILIKE 'Kasilagan' LIMIT 1
),
dec_period AS (
    -- Dec 7 to Jan 7
    SELECT '2025-12-07'::date as start_d, '2026-01-07'::date as end_d
),
raw_colls AS (
    SELECT member_id, is_membership_fee, payment_for
    FROM collections c
    JOIN agent_lookup a ON c.agent_id = a.id
    JOIN dec_period p ON true
    WHERE c.date_paid >= p.start_d AND c.date_paid < p.end_d
),
stats AS (
    SELECT 
        count(*) filter (where is_membership_fee) as recruit_count,
        bool_or(
            exists(
                select 1 from raw_colls c2 
                where c2.member_id = raw_colls.member_id 
                and c2.is_membership_fee != raw_colls.is_membership_fee
            )
        ) as has_mix
    FROM raw_colls
),
wallet AS (
    SELECT balance, lifetime_commission, updated_at
    FROM agent_wallets w
    JOIN agent_lookup a ON w.agent_id = a.id
),
rollup AS (
    SELECT status, grand_total_commission
    FROM agent_commission_rollups r
    JOIN agent_lookup a ON r.agent_id = a.id
    WHERE r.period_year = 2026 AND r.period_month = 1
)
SELECT 
    a.lastname,
    s.recruit_count as "Dec Recruits (Need 3)",
    CASE WHEN s.has_mix THEN 'YES' ELSE 'NO' END as "Has Mix (Rule B)",
    CASE WHEN (s.recruit_count >= 3 OR s.has_mix) THEN '✅ ELIGIBLE' ELSE '❌ NOT ELIGIBLE' END as "Computed Verdict",
    COALESCE(r.status, 'No Record') as "Jan Status (DB)",
    COALESCE(r.grand_total_commission, 0) as "Jan Receivable",
    COALESCE(w.balance, 0) as "Wallet Balance",
    w.updated_at as "Wallet Last Update"
FROM agent_lookup a
CROSS JOIN stats s
LEFT JOIN wallet w ON true
LEFT JOIN rollup r ON true;
