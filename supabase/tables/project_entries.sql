CREATE TABLE project_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    day_entry_id UUID NOT NULL,
    project_id UUID NOT NULL,
    location_type TEXT NOT NULL CHECK (location_type IN ('remote',
    'onsite')) DEFAULT 'remote',
    man_days DECIMAL(5,2) NOT NULL,
    description TEXT,
    travel_chargeable BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);