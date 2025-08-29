-- Migration: create_vat_settings_table
-- Created at: 1756383355

-- Create VAT Settings table for dynamic expense type configuration
CREATE TABLE vat_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expense_type TEXT NOT NULL,
    default_vat_rate DECIMAL(5,2) NOT NULL DEFAULT 20.00,
    available_rates JSONB NOT NULL DEFAULT '[20]'::jsonb,
    is_configurable BOOLEAN NOT NULL DEFAULT true,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure unique expense types
    UNIQUE(expense_type),
    
    -- Validate VAT rates are between 0-100
    CONSTRAINT valid_default_vat_rate CHECK (default_vat_rate >= 0 AND default_vat_rate <= 100)
);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_vat_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER vat_settings_updated_at
    BEFORE UPDATE ON vat_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_vat_settings_updated_at();

-- Insert default VAT settings for all expense types
INSERT INTO vat_settings (expense_type, default_vat_rate, available_rates, is_configurable, description) VALUES
-- Standard 20% VAT rate expenses
('train', 20.00, '[20]'::jsonb, true, 'Standard VAT rate for train travel'),
('taxi', 20.00, '[20]'::jsonb, true, 'Standard VAT rate for taxi services'),
('flight', 20.00, '[20]'::jsonb, true, 'Standard VAT rate for flight expenses'),
('rental_car', 20.00, '[20]'::jsonb, true, 'Standard VAT rate for car rental'),
('fuel', 20.00, '[20]'::jsonb, true, 'Standard VAT rate for fuel expenses'),
('parking', 20.00, '[20]'::jsonb, true, 'Standard VAT rate for parking fees'),
('onpv', 20.00, '[20]'::jsonb, true, 'Standard VAT rate for public transport'),
('hospitality', 20.00, '[20]'::jsonb, true, 'Standard VAT rate for hospitality'),
('others', 20.00, '[20]'::jsonb, true, 'Standard VAT rate for other expenses'),

-- Hotel with multiple VAT options
('hotel', 19.00, '[19, 7, 0]'::jsonb, true, 'Multiple VAT rates for accommodation'),

-- Car with fixed 0% VAT (non-configurable)
('car', 0.00, '[0]'::jsonb, false, 'Car mileage expenses are VAT exempt');

-- Enable RLS
ALTER TABLE vat_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Allow all authenticated users to read VAT settings
CREATE POLICY "VAT settings are viewable by authenticated users" ON vat_settings
    FOR SELECT USING (auth.role() = 'authenticated');

-- Only admins can update VAT settings
CREATE POLICY "VAT settings are editable by admins only" ON vat_settings
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );

-- Create indexes for performance
CREATE INDEX idx_vat_settings_expense_type ON vat_settings(expense_type);
CREATE INDEX idx_vat_settings_configurable ON vat_settings(is_configurable);;