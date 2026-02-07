-- ============================================================
-- COMPLETE FIX: Reset all commissions and rebuild from scratch
-- ============================================================
-- This will:
-- 1. Mark ALL commissions as non-receivable
-- 2. Mark ONLY commissions from RELEASED periods as receivable
-- 3. Recalculate all wallet balances
-- ============================================================

-- Step 1: Mark ALL commissions as non-receivable
UPDATE commissions
SET is_receivable = false;

-- Step 2: Mark commissions from RELEASED periods as receivable
UPDATE commissions c
SET is_receivable = true
FROM agent_commission_rollups r
WHERE c.agent_id = r.agent_id
  AND r.status = 'released'
  AND c.date_earned >= (r.period_year || '-' || LPAD(r.period_month::text, 2, '0') || '-07')::date
  AND c.date_earned < (
    CASE 
      WHEN r.period_month = 12 THEN (r.period_year + 1) || '-01-07'
      ELSE r.period_year || '-' || LPAD((r.period_month + 1)::text, 2, '0') || '-07'
    END
  )::date;

-- Step 3: Recalculate all agent wallet balances
UPDATE agent_wallets w
SET balance = COALESCE((
  SELECT SUM(
    CASE 
      WHEN c.commission_type IN ('override', 'recruiter_bonus') THEN 
        CASE WHEN c.override_commission > 0 THEN c.override_commission ELSE c.amount END
      ELSE c.amount
    END
  )
  FROM commissions c
  WHERE c.agent_id = w.agent_id
    AND c.is_receivable = true
), 0);

-- Step 4: Verify the results
SELECT 
  a.id as agent_id,
  w.balance,
  COUNT(c.id) as receivable_count,
  COALESCE(SUM(
    CASE 
      WHEN c.commission_type IN ('override', 'recruiter_bonus') THEN 
        CASE WHEN c.override_commission > 0 THEN c.override_commission ELSE c.amount END
      ELSE c.amount
    END
  ), 0) as receivable_total
FROM agents a
LEFT JOIN agent_wallets w ON w.agent_id = a.id
LEFT JOIN commissions c ON c.agent_id = a.id AND c.is_receivable = true
GROUP BY a.id, w.balance
HAVING w.balance > 0 OR COUNT(c.id) > 0
ORDER BY a.id;

-- Step 5: Show which periods are released for each agent
SELECT 
  r.agent_id,
  r.period_year || '-' || LPAD(r.period_month::text, 2, '0') as period,
  r.status,
  COUNT(c.id) as commission_count,
  COALESCE(SUM(
    CASE 
      WHEN c.commission_type IN ('override', 'recruiter_bonus') THEN 
        CASE WHEN c.override_commission > 0 THEN c.override_commission ELSE c.amount END
      ELSE c.amount
    END
  ), 0) as total_amount
FROM agent_commission_rollups r
LEFT JOIN commissions c ON c.agent_id = r.agent_id
  AND c.date_earned >= (r.period_year || '-' || LPAD(r.period_month::text, 2, '0') || '-07')::date
  AND c.date_earned < (
    CASE 
      WHEN r.period_month = 12 THEN (r.period_year + 1) || '-01-07'
      ELSE r.period_year || '-' || LPAD((r.period_month + 1)::text, 2, '0') || '-07'
    END
  )::date
  AND c.is_receivable = true
WHERE r.status = 'released'
GROUP BY r.agent_id, r.period_year, r.period_month, r.status
ORDER BY r.agent_id, r.period_year, r.period_month;
