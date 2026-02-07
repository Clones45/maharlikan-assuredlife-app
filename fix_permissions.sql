-- ============================================================================
-- FIX PERMISSIONS: agent_wallets
-- ============================================================================

-- 1. Enable RLS (Security Best Practice)
ALTER TABLE agent_wallets ENABLE ROW LEVEL SECURITY;

-- 2. Grant Basic Access
GRANT SELECT, UPDATE ON agent_wallets TO authenticated;
GRANT SELECT, UPDATE ON agent_wallets TO service_role;

-- 3. Policy: ADMINS can see ALL wallets
DROP POLICY IF EXISTS "Admins can view all wallets" ON agent_wallets;
CREATE POLICY "Admins can view all wallets"
ON agent_wallets FOR SELECT
TO authenticated
USING (
  public.is_admin(auth.uid())
);

-- 4. Policy: AGENTS can see THEIR OWN wallet
-- We need to map auth.uid() -> agent_id. 
-- We can do this by joining users_profile or just checking existence.
DROP POLICY IF EXISTS "Agents can view own wallet" ON agent_wallets;
CREATE POLICY "Agents can view own wallet"
ON agent_wallets FOR SELECT
TO authenticated
USING (
  agent_id IN (
      SELECT agent_id FROM public.users_profile WHERE user_id = auth.uid()
  )
);
