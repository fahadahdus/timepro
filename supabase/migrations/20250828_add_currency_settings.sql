-- Create currency_settings table
CREATE TABLE currency_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    currency_code VARCHAR(3) NOT NULL UNIQUE,
    currency_symbol VARCHAR(10) NOT NULL,
    currency_name VARCHAR(50) NOT NULL,
    decimal_places INTEGER NOT NULL DEFAULT 2,
    is_active BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_by UUID
);

-- Insert default currencies
INSERT INTO currency_settings (currency_code, currency_symbol, currency_name, decimal_places, is_active) VALUES
('EUR', '€', 'Euro', 2, true),
('USD', '$', 'US Dollar', 2, false),
('GBP', '£', 'British Pound', 2, false),
('JPY', '¥', 'Japanese Yen', 0, false),
('CHF', 'CHF', 'Swiss Franc', 2, false),
('CAD', 'C$', 'Canadian Dollar', 2, false);

-- Create index for quick active currency lookup
CREATE INDEX idx_currency_settings_active ON currency_settings(is_active) WHERE is_active = true;

-- Create trigger to ensure only one active currency
CREATE OR REPLACE FUNCTION ensure_single_active_currency()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_active = TRUE THEN
        -- Deactivate all other currencies
        UPDATE currency_settings 
        SET is_active = FALSE, updated_at = NOW() 
        WHERE currency_code != NEW.currency_code;
    END IF;
    
    -- Update timestamp
    NEW.updated_at = NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ensure_single_active_currency_trigger
    BEFORE INSERT OR UPDATE ON currency_settings
    FOR EACH ROW
    EXECUTE FUNCTION ensure_single_active_currency();