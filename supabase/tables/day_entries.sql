CREATE TABLE day_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    week_id UUID NOT NULL,
    day_date DATE NOT NULL,
    time_in TIME,
    time_out TIME,
    status TEXT NOT NULL CHECK (status IN ('active',
    'day_off',
    'vacation',
    'travel')) DEFAULT 'active',
    allowance_amount DECIMAL(10,2) DEFAULT 0,
    travel_destination TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(week_id,
    day_date)
);