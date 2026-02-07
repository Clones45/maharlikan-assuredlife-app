-- ============================================================================
-- FIX RLS: collections
-- Purpose: Allow agents to see their own collections so the Mobile App
-- can calculate AGR compliance (Incentives Note).
-- ============================================================================

-- 1. Enable RLS
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;

-- 2. Policy: AGENTS can view THEIR OWN collections
DROP POLICY IF EXISTS "Agents can view their own collections" ON collections;

CREATE POLICY "Agents can view their own collections"
ON collections
FOR SELECT
TO authenticated
USING (
  agent_id IN (
    SELECT agent_id 
    FROM users_profile 
    WHERE user_id = auth.uid()
  )
);

-- 3. Policy: ADMINS can view ALL collections
-- Using the subquery pattern to match fix_commissions_rls.sql
DROP POLICY IF EXISTS "Admins can view all collections" ON collections;

CREATE POLICY "Admins can view all collections"
ON collections
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users_profile 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- 4. Grant Permissions (just in case)
GRANT SELECT ON collections TO authenticated;
