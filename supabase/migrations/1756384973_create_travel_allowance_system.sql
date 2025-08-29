-- Migration: create_travel_allowance_system
-- Created at: 1756384973

-- Create Country Daily Rates table for travel allowance calculations
CREATE TABLE country_daily_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    country_name VARCHAR(100) NOT NULL,
    country_code VARCHAR(3) NOT NULL,
    rate_a DECIMAL(10,2) NOT NULL, -- Partial day allowance
    rate_b DECIMAL(10,2) NOT NULL, -- Full day allowance
    effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure unique country codes
    UNIQUE(country_code),
    
    -- Validate rates are positive
    CONSTRAINT positive_rate_a CHECK (rate_a >= 0),
    CONSTRAINT positive_rate_b CHECK (rate_b >= 0)
);

-- Create updated_at trigger for country_daily_rates
CREATE OR REPLACE FUNCTION update_country_daily_rates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER country_daily_rates_updated_at
    BEFORE UPDATE ON country_daily_rates
    FOR EACH ROW
    EXECUTE FUNCTION update_country_daily_rates_updated_at();

-- Insert default country rates (based on European travel allowance standards)
INSERT INTO country_daily_rates (country_name, country_code, rate_a, rate_b, effective_from) VALUES
-- Germany (base rates from image analysis)
('Deutschland', 'DE', 14.00, 28.00, '2025-01-01'),
('Germany', 'DEU', 14.00, 28.00, '2025-01-01'), -- Alternative name

-- European Union countries
('France', 'FR', 15.00, 30.00, '2025-01-01'),
('United Kingdom', 'GB', 16.00, 32.00, '2025-01-01'),
('Italy', 'IT', 13.50, 27.00, '2025-01-01'),
('Spain', 'ES', 12.50, 25.00, '2025-01-01'),
('Netherlands', 'NL', 15.50, 31.00, '2025-01-01'),
('Belgium', 'BE', 14.50, 29.00, '2025-01-01'),
('Austria', 'AT', 14.00, 28.00, '2025-01-01'),
('Switzerland', 'CH', 18.00, 36.00, '2025-01-01'),
('Sweden', 'SE', 16.50, 33.00, '2025-01-01'),
('Norway', 'NO', 20.00, 40.00, '2025-01-01'),
('Denmark', 'DK', 17.00, 34.00, '2025-01-01'),

-- North America
('United States', 'US', 20.00, 40.00, '2025-01-01'),
('Canada', 'CA', 18.50, 37.00, '2025-01-01'),

-- Asia-Pacific
('Japan', 'JP', 22.00, 44.00, '2025-01-01'),
('Australia', 'AU', 19.00, 38.00, '2025-01-01'),
('Singapore', 'SG', 17.50, 35.00, '2025-01-01'),

-- Other major destinations
('Brazil', 'BR', 15.50, 31.00, '2025-01-01'),
('China', 'CN', 16.00, 32.00, '2025-01-01'),
('India', 'IN', 12.00, 24.00, '2025-01-01');

-- Add travel-specific fields to expense_entries table
ALTER TABLE expense_entries ADD COLUMN start_datetime TIMESTAMP WITH TIME ZONE;
ALTER TABLE expense_entries ADD COLUMN end_datetime TIMESTAMP WITH TIME ZONE;
ALTER TABLE expense_entries ADD COLUMN outbound_from VARCHAR(255);
ALTER TABLE expense_entries ADD COLUMN outbound_to VARCHAR(255);
ALTER TABLE expense_entries ADD COLUMN destination_country VARCHAR(10);
ALTER TABLE expense_entries ADD COLUMN return_from VARCHAR(255);
ALTER TABLE expense_entries ADD COLUMN return_to VARCHAR(255);
ALTER TABLE expense_entries ADD COLUMN calculated_allowance DECIMAL(10,2);

-- Add travel expense type to vat_settings
INSERT INTO vat_settings (expense_type, default_vat_rate, available_rates, is_configurable, description) VALUES
('travel', 0.00, '[0]'::jsonb, true, 'Travel daily allowances - typically VAT exempt');

-- Enable RLS for country_daily_rates
ALTER TABLE country_daily_rates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for country_daily_rates
-- Allow all authenticated users to read country rates
CREATE POLICY "Country rates are viewable by authenticated users" ON country_daily_rates
    FOR SELECT USING (auth.role() = 'authenticated');

-- Only admins can update country rates
CREATE POLICY "Country rates are editable by admins only" ON country_daily_rates
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );

-- Create indexes for performance
CREATE INDEX idx_country_daily_rates_country_code ON country_daily_rates(country_code);
CREATE INDEX idx_country_daily_rates_effective_from ON country_daily_rates(effective_from);
CREATE INDEX idx_expense_entries_travel_fields ON expense_entries(destination_country, start_datetime, end_datetime);;