
-- 1. Enable RLS on the commissions table (if not already enabled)
ALTER TABLE commissions ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing select policy if it exists (Optional, be careful)
-- DROP POLICY IF EXISTS "Agents can view their own commissions" ON commissions;

-- 3. Create policy to allow agents to see only their own commissions
CREATE POLICY "Agents can view their own commissions"
ON commissions
FOR SELECT
TO authenticated
USING (
  agent_id IN (
    SELECT agent_id 
    FROM users_profile 
    WHERE user_id = auth.uid()
  )
);

-- 4. Create policy for Admins to see all commissions (assuming they have a role 'admin')
-- Note: Replace 'admin' with your actual admin role name if different.
CREATE POLICY "Admins can view all commissions"
ON commissions
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users_profile 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);
