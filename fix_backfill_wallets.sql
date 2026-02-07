
-- 1. Backfill Wallets for Existing Agents
-- Inserts a wallet row for any agent who doesn't have one yet.
INSERT INTO agent_wallets (agent_id, balance, lifetime_commission, updated_at)
SELECT id, 0, 0, now()
FROM agents a
WHERE NOT EXISTS (
    SELECT 1 FROM agent_wallets w WHERE w.agent_id = a.id
);

-- 2. Create Function to Auto-Create Wallet
CREATE OR REPLACE FUNCTION public.create_wallet_for_new_agent()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
    INSERT INTO public.agent_wallets (agent_id, balance, lifetime_commission, updated_at)
    VALUES (NEW.id, 0, 0, now())
    ON CONFLICT (agent_id) DO NOTHING;
    RETURN NEW;
END;
$function$;

-- 3. Create Trigger on 'agents' table
DROP TRIGGER IF EXISTS trg_create_wallet ON public.agents;

CREATE TRIGGER trg_create_wallet
AFTER INSERT ON public.agents
FOR EACH ROW
EXECUTE FUNCTION public.create_wallet_for_new_agent();
