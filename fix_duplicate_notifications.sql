-- ----------------------------------------------------------------
-- FIX DUPLICATE NOTIFICATIONS SCRIPT
-- ----------------------------------------------------------------
-- This script effectively removes all known variations of the 
-- withdrawal notification trigger and installs a SINGLE, clean version.
-- Run this in your Supabase SQL Editor.

-- 1. DROP EXISTING TRIGGERS (Aggressive Cleanup)
-- We drop every possible name this trigger might have had.
DROP TRIGGER IF EXISTS on_withdrawal_update ON withdrawal_requests;
DROP TRIGGER IF EXISTS trigger_notify_withdrawal ON withdrawal_requests;
DROP TRIGGER IF EXISTS withdrawal_notification_trigger ON withdrawal_requests;
DROP TRIGGER IF EXISTS trg_notify_withdrawal_update ON withdrawal_requests;

-- 2. DROP EXISTING FUNCTION
DROP FUNCTION IF EXISTS notify_withdrawal_update CASCADE;

-- 3. CREATE CLEAN FUNCTION
CREATE OR REPLACE FUNCTION notify_withdrawal_update() RETURNS TRIGGER AS $$
DECLARE
  target_user_uuid UUID;
  v_period_text TEXT;
BEGIN
  -- 🔍 LOOKUP: Get the Supabase Auth User UUID for this Agent
  SELECT user_id INTO target_user_uuid
  FROM users_profile
  WHERE agent_id = NEW.agent_id
  LIMIT 1;

  -- Format Period Text (e.g., "12/2025")
  v_period_text := NEW.period_month || '/' || NEW.period_year;

  -- ✅ APPROVED NOTIFICATION
  IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
    INSERT INTO notifications (
      user_id, 
      title, 
      message, 
      type, 
      is_read, 
      extra,
      created_at
    )
    VALUES (
      target_user_uuid, 
      'Withdrawal Approved', 
      'Your withdrawal request for ₱' || NEW.amount || ' (period ' || v_period_text || ') has been approved.', 
      'withdrawal_status', -- Standardized Type
      false, 
      jsonb_build_object('agent_id', NEW.agent_id, 'request_id', NEW.id),
      NOW()
    );
  
  -- ❌ REJECTED NOTIFICATION
  ELSIF NEW.status = 'rejected' AND OLD.status != 'rejected' THEN
    INSERT INTO notifications (
      user_id, 
      title, 
      message, 
      type, 
      is_read, 
      extra,
      created_at
    )
    VALUES (
      target_user_uuid, 
      'Withdrawal Rejected', 
      'Your withdrawal request for ₱' || NEW.amount || ' (period ' || v_period_text || ') was rejected.', 
      'withdrawal_status', -- Standardized Type
      false, 
      jsonb_build_object('agent_id', NEW.agent_id, 'request_id', NEW.id),
      NOW()
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. ATTACH SINGLE TRIGGER
CREATE TRIGGER on_withdrawal_update
AFTER UPDATE ON withdrawal_requests
FOR EACH ROW EXECUTE FUNCTION notify_withdrawal_update();

-- ----------------------------------------------------------------
-- VERIFICATION QUERY (Optional)
-- ----------------------------------------------------------------
-- After running this, try updating a withdrawal request status.
-- You should see exactly ONE new entry in the 'notifications' table.
