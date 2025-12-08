-- 1. Add column to agent_wallets (safe check)
ALTER TABLE public.agent_wallets
ADD COLUMN IF NOT EXISTS lifetime_commission numeric DEFAULT 0;

-- 2. Create the function to recalculate logic
CREATE OR REPLACE FUNCTION public.update_agent_lifetime_commission()
RETURNS TRIGGER AS $$
DECLARE
    affected_agent_id INT;
BEGIN
    -- Determine which agent to update
    IF (TG_OP = 'DELETE') THEN
        affected_agent_id := OLD.agent_id;
    ELSE
        affected_agent_id := NEW.agent_id;
    END IF;

    -- Update the wallet with sum of all commissions >= Nov 7, 2025
    UPDATE public.agent_wallets
    SET lifetime_commission = (
        SELECT COALESCE(SUM(amount + COALESCE(override_commission, 0)), 0)
        FROM public.commissions
        WHERE agent_id = affected_agent_id
          AND date_earned >= '2025-11-07'
    )
    WHERE agent_id = affected_agent_id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create the trigger
DROP TRIGGER IF EXISTS trg_update_lifetime_commission ON public.commissions;

CREATE TRIGGER trg_update_lifetime_commission
AFTER INSERT OR UPDATE OR DELETE ON public.commissions
FOR EACH ROW
EXECUTE FUNCTION public.update_agent_lifetime_commission();

-- 4. Initial Backfill (Recalculate for everyone once)
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
