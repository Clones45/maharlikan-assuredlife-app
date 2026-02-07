-- Add transferred_date column to members table to track transfers
-- This allows resetting contestability period while keeping original join date

ALTER TABLE members 
ADD COLUMN IF NOT EXISTS transferred_date DATE DEFAULT NULL;

-- Verify it worked
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'members' 
AND column_name = 'transferred_date';
