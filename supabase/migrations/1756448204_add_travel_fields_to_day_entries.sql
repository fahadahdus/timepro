-- Migration: add_travel_fields_to_day_entries
-- Created at: 1756448204

ALTER TABLE day_entries 
ADD COLUMN office TEXT,
ADD COLUMN city TEXT, 
ADD COLUMN country TEXT;;