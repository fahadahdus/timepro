-- System settings table for storing application configuration
CREATE TABLE system_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    value TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Default rates table for storing default hourly rates by project type
CREATE TABLE default_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_type TEXT NOT NULL CHECK (project_type IN ('time_and_material', 'fixed_price')),
    hourly_rate DECIMAL(10,2) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert initial system settings
INSERT INTO system_settings (key, value, description) VALUES
('default_vat_rate', '20', 'Default VAT rate percentage'),
('default_currency', 'USD', 'Default currency code'),
('week_start_day', '1', 'Week start day (0=Sunday, 1=Monday)'),
('auto_submit_enabled', 'false', 'Enable automatic timesheet submission'),
('notification_enabled', 'true', 'Enable email notifications');

-- Insert initial default rates
INSERT INTO default_rates (project_type, hourly_rate, description) VALUES
('time_and_material', 150.00, 'Default hourly rate for time and material projects'),
('fixed_price', 125.00, 'Default hourly rate for fixed price projects');