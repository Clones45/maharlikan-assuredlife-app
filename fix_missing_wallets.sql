-- 1. Insert missing wallets for agents who have commissions but no wallet row
INSERT INTO public.agent_wallets (agent_id, balance, lifetime_commission)
SELECT DISTINCT c.agent_id, 0, 0
FROM public.commissions c
WHERE NOT EXISTS (
    SELECT 1 FROM public.agent_wallets w WHERE w.agent_id = c.agent_id
);

-- 2. Recalculate Lifetime Commission for ALL agents (Just to be sure)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT DISTINCT agent_id FROM public.commissions WHERE date_earned >= '2025-11-07'
    LOOP
        UPDATE public.agent_wallets
        SET lifetime_commission = (
            SELECT COALESCE(SUM(amount + COALESCE(override_commission, 0)), 0)
            FROM public.commissions
            WHERE agent_id = r.agent_id
              AND date_earned >= '2025-11-07'
        )
        WHERE agent_id = r.agent_id;
    END LOOP;
END;
$$;
