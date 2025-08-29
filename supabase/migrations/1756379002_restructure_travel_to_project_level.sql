-- Migration: restructure_travel_to_project_level
-- Created at: 1756379002

-- Add travel fields to project_entries table
ALTER TABLE project_entries 
ADD COLUMN office TEXT,
ADD COLUMN city TEXT,
ADD COLUMN country TEXT;

-- Update day_entries status constraint to remove 'travel'
ALTER TABLE day_entries 
DROP CONSTRAINT IF EXISTS day_entries_status_check;

ALTER TABLE day_entries 
ADD CONSTRAINT day_entries_status_check 
CHECK (status IN ('active', 'day_off', 'vacation', 'weekend_bank_holiday'));

-- Remove travel-related fields from day_entries if they exist
ALTER TABLE day_entries 
DROP COLUMN IF EXISTS office,
DROP COLUMN IF EXISTS city,
DROP COLUMN IF EXISTS country,
DROP COLUMN IF EXISTS work_from,
DROP COLUMN IF EXISTS travel_destination;

-- Update any existing 'travel' status to 'active'
UPDATE day_entries 
SET status = 'active' 
WHERE status = 'travel';;