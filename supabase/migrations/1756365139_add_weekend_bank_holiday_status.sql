-- Migration: add_weekend_bank_holiday_status
-- Created at: 1756365139

-- Add 'weekend_bank_holiday' status to day_entries table
-- Migration to update the status check constraint

ALTER TABLE day_entries 
DROP CONSTRAINT IF EXISTS day_entries_status_check;

ALTER TABLE day_entries 
ADD CONSTRAINT day_entries_status_check 
CHECK (status IN ('active', 'day_off', 'vacation', 'travel', 'weekend_bank_holiday'));;