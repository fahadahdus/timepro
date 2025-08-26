CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    client_id UUID NOT NULL,
    billing_type TEXT NOT NULL CHECK (billing_type IN ('TNM',
    'Fixed')),
    budget_hours DECIMAL(10,2) DEFAULT 0,
    budget_amount DECIMAL(15,2) DEFAULT 0,
    hourly_rate DECIMAL(10,2) DEFAULT 0,
    travel_billable BOOLEAN DEFAULT true,
    start_date DATE,
    end_date DATE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);