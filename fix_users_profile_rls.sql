-- ============================================================================
-- FIX RLS: users_profile
-- Purpose: Ensure the "Join" table (users_profile) is readable by the user.
-- This is CRITICAL for the 'collections' policy to work, because it does:
-- SELECT agent_id FROM users_profile WHERE user_id = auth.uid()
-- ============================================================================

-- 1. Enable RLS
ALTER TABLE users_profile ENABLE ROW LEVEL SECURITY;

-- 2. Policy: Users can view their OWN profile
DROP POLICY IF EXISTS "Users can view own profile" ON users_profile;

CREATE POLICY "Users can view own profile"
ON users_profile
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
);

-- 3. Policy: Admins can view ALL profiles
DROP POLICY IF EXISTS "Admins can view all profiles" ON users_profile;

CREATE POLICY "Admins can view all profiles"
ON users_profile
FOR ALL
TO authenticated
USING (
  role = 'admin'
);

-- 4. Grant Permissions
GRANT SELECT ON users_profile TO authenticated;
