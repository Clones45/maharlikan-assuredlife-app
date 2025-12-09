-- Run this in your Supabase SQL Editor to fix missing notifications

-- 1. Create Function to Handle Notification Logic
CREATE OR REPLACE FUNCTION notify_withdrawal_update() RETURNS TRIGGER AS $$
DECLARE
  target_user_uuid UUID;
BEGIN
  -- 🔍 LOOKUP: Get the Supabase Auth User UUID for this Agent
  SELECT user_id INTO target_user_uuid
  FROM users_profile
  WHERE agent_id = NEW.agent_id
  LIMIT 1;

  -- APPROVED
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
      target_user_uuid, -- ✅ Stores actual User UUID now (RLS compatible)
      'Commission Approved', 
      'Your withdrawal of ₱' || NEW.amount || ' has been approved.', 
      'payout_released', 
      false, 
      jsonb_build_object('agent_id', NEW.agent_id),
      NOW()
    );
  
  -- REJECTED
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
      'Your withdrawal of ₱' || NEW.amount || ' was rejected.', 
      'agr_warning', 
      false, 
      jsonb_build_object('agent_id', NEW.agent_id),
      NOW()
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Attach Trigger to withdrawal_requests table
DROP TRIGGER IF EXISTS on_withdrawal_update ON withdrawal_requests;

CREATE TRIGGER on_withdrawal_update
AFTER UPDATE ON withdrawal_requests
FOR EACH ROW EXECUTE FUNCTION notify_withdrawal_update();
