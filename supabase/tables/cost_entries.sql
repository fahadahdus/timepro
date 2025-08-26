CREATE TABLE cost_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    day_entry_id UUID NOT NULL,
    cost_type TEXT NOT NULL CHECK (cost_type IN ('travel',
    'accommodation',
    'meal',
    'other')),
    distance_km DECIMAL(8,2),
    gross_amount DECIMAL(10,2) NOT NULL,
    vat_percentage DECIMAL(5,2) DEFAULT 0,
    net_amount DECIMAL(10,2) NOT NULL,
    chargeable BOOLEAN DEFAULT true,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);