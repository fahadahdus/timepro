-- Migration: create_expense_entries_table
-- Created at: 1756381495

-- Create expense_entries table with comprehensive expense tracking
CREATE TABLE expense_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    project_id UUID NOT NULL,
    date DATE NOT NULL,
    expense_type TEXT NOT NULL CHECK (expense_type IN (
        'train', 'taxi', 'flight', 'rental_car', 'fuel', 
        'parking', 'onpv', 'hospitality', 'hotel', 'car', 'others'
    )),
    description TEXT,
    gross_amount DECIMAL(10,2) NOT NULL,
    vat_percentage DECIMAL(5,2) NOT NULL,
    vat_amount DECIMAL(10,2) NOT NULL,
    net_amount DECIMAL(10,2) NOT NULL,
    distance_km DECIMAL(8,2), -- Only for car expenses
    rate_per_km DECIMAL(4,2), -- Only for car expenses (0.7, 0.5, or 0.3)
    receipt_uploaded BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Foreign key constraints
    CONSTRAINT fk_expense_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_expense_project FOREIGN KEY (project_id) REFERENCES projects(id),
    
    -- Business logic constraints
    CONSTRAINT chk_car_expense_distance CHECK (
        (expense_type = 'car' AND distance_km IS NOT NULL AND distance_km > 0) 
        OR expense_type != 'car'
    ),
    CONSTRAINT chk_car_expense_rate CHECK (
        (expense_type = 'car' AND rate_per_km IN (0.7, 0.5, 0.3)) 
        OR expense_type != 'car'
    ),
    CONSTRAINT chk_car_vat_zero CHECK (
        (expense_type = 'car' AND vat_percentage = 0) 
        OR expense_type != 'car'
    )
);

-- Create indexes for better performance
CREATE INDEX idx_expense_entries_user_date ON expense_entries(user_id, date);
CREATE INDEX idx_expense_entries_project ON expense_entries(project_id);
CREATE INDEX idx_expense_entries_type ON expense_entries(expense_type);

-- Add RLS policies
ALTER TABLE expense_entries ENABLE ROW LEVEL SECURITY;

-- Policy for users to see their own expenses
CREATE POLICY "Users can view their own expenses" ON expense_entries
    FOR SELECT USING (user_id = auth.uid());

-- Policy for users to create their own expenses
CREATE POLICY "Users can create their own expenses" ON expense_entries
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- Policy for users to update their own expenses
CREATE POLICY "Users can update their own expenses" ON expense_entries
    FOR UPDATE USING (user_id = auth.uid());

-- Policy for users to delete their own expenses
CREATE POLICY "Users can delete their own expenses" ON expense_entries
    FOR DELETE USING (user_id = auth.uid());

-- Super admins can view all expenses
CREATE POLICY "Super admins can view all expenses" ON expense_entries
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'super_admin'
        )
    );

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_expense_entries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_expense_entries_updated_at
    BEFORE UPDATE ON expense_entries
    FOR EACH ROW
    EXECUTE FUNCTION update_expense_entries_updated_at();;