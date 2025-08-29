-- Migration: add_weekend_bank_holiday_enum_value
-- Created at: 1756365168

-- Add 'weekend_bank_holiday' value to the day_status enum
ALTER TYPE day_status ADD VALUE 'weekend_bank_holiday';;