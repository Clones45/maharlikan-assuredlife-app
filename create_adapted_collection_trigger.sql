-- Create a database trigger to automatically create collection records for adapted members
-- This bypasses the mobile app entirely

-- First, create the function that will insert the collection
CREATE OR REPLACE FUNCTION create_adapted_collection()
RETURNS TRIGGER AS $$
BEGIN
  -- Only run if this is an adapted member
  IF NEW.is_adapted = true AND NEW.adapted_months > 0 THEN
    -- Insert the collection record
    INSERT INTO collections (
      member_id,
      agent_id,
      collector_id,
      maf_no,
      payment,
      payment_for,
      date_paid,
      collection_month,
      last_name,
      first_name,
      middle_name,
      address,
      plan_type,
      or_no,
      is_membership_fee,
      outright_mode,
      deduct_now,
      got_monthly_commission,
      got_travel_allowance,
      personally_collected
    ) VALUES (
      NEW.id,
      NEW.agent_id,
      NEW.agent_id,
      NEW.maf_no,
      NEW.adapted_amount,
      CONCAT('adapted - ', NEW.adapted_months, CASE WHEN NEW.adapted_months = 1 THEN ' month' ELSE ' months' END),
      NOW(),
      DATE_TRUNC('month', NOW()),
      NEW.last_name,
      NEW.first_name,
      NEW.middle_name,
      NEW.address,
      NEW.plan_type,
      '',
      false,
      'accrue',
      false,
      false,
      false,
      false
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
DROP TRIGGER IF EXISTS trigger_create_adapted_collection ON members;
CREATE TRIGGER trigger_create_adapted_collection
  AFTER INSERT ON members
  FOR EACH ROW
  EXECUTE FUNCTION create_adapted_collection();

-- Test: Check if trigger was created
SELECT 
  tgname as trigger_name,
  tgrelid::regclass as table_name,
  tgtype,
  tgenabled
FROM pg_trigger
WHERE tgname = 'trigger_create_adapted_collection';
