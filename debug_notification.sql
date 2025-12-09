-- DEBUG SCRIPT: Run this in Supabase SQL Editor
-- This will help us identify why notifications are missing.

-- 1. 🕵️ CHECK AGENT MAPPING
-- Does Agent 1 have a linked User ID?
SELECT user_id, agent_id, role, first_name, last_name 
FROM users_profile 
WHERE agent_id IN (1, (SELECT agent_id FROM agents WHERE id=1));

-- 2. 🕵️ CHECK RECENT NOTIFICATIONS
-- Did the system create any notifications recently? Check if user_id is NULL.
SELECT id, user_id, title, message, created_at, extra 
FROM notifications 
ORDER BY created_at DESC 
LIMIT 5;

-- 3. 🧪 FORCE INSERT TEST NOTIFICATION
-- This attempts to insert a notification explicitly for Agent 1's User.
-- If this appears in your app, the App is fine, and the Trigger is the problem.
DO $$
DECLARE
  target_user_uuid UUID;
BEGIN
  -- Get UUID for Agent 1
  SELECT user_id INTO target_user_uuid
  FROM users_profile
  WHERE agent_id = 1
  LIMIT 1;

  IF target_user_uuid IS NOT NULL THEN
    INSERT INTO notifications (
      user_id, 
      title, 
      message, 
      type, 
      is_read, 
      extra,
      created_at
    ) VALUES (
      target_user_uuid, 
      'Debug Test', 
      'If you see this, the App is working! The issue is the Trigger.', 
      'agr_success', 
      false, 
      '{"agent_id": 1}', 
      NOW()
    );
  END IF;
END $$;
