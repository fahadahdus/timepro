-- Migration: add_office_field_to_day_entries
-- Created at: 1756367323

-- Add office field for travel information
ALTER TABLE day_entries ADD COLUMN office TEXT;;