import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://ebdjwnldnixdamyiofzw.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImViZGp3bmxkbml4ZGFteWlvZnp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU2ODUwNjgsImV4cCI6MjA3MTI2MTA2OH0.YU46yHSZR1fSn3gZ-dQERlsTsXczeYJUKyrcnTSxy0Y'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Database types
export interface User {
  id: string
  email: string
  full_name: string
  role: 'super_admin' | 'consultant'
  hourly_rate: number
  country_code: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Country {
  id: string
  code: string
  name: string
  vat_rate: number
  currency_code: string
  is_active: boolean
  created_at: string
}

export interface Client {
  id: string
  name: string
  code: string
  active: boolean
  created_at: string
  updated_at: string
}

export interface Project {
  id: string
  client_id: string
  code: string
  name: string
  billing_type: 'time_and_material' | 'fixed_price'
  budget_days: number
  budget_amount: number
  hourly_rate: number
  travel_billable: boolean
  active: boolean
  created_at: string
  updated_at: string
}

export interface Week {
  id: string
  user_id: string
  week_start: string
  status: 'draft' | 'submitted' | 'approved' | 'rejected'
  submitted_at: string | null
  approved_at: string | null
  approved_by: string | null
  rejection_reason: string | null
  created_at: string
  updated_at: string
}

export interface DayEntry {
  id: string
  week_id: string
  date: string
  time_in: string | null
  time_out: string | null
  status: 'active' | 'day_off' | 'vacation' | 'travel' | 'weekend_bank_holiday'
  allowance_amount: number
  office: string | null
  city: string | null
  country: string | null
  created_at: string
  updated_at: string
}

export interface ProjectEntry {
  id: string
  day_entry_id: string
  project_id: string
  location: 'remote' | 'onsite'
  man_days: number
  description: string | null
  travel_chargeable: boolean
  office: string | null
  city: string | null
  country: string | null
  invoiced: boolean
  created_at: string
  updated_at: string
}

export interface CostEntry {
  id: string
  day_entry_id: string
  type: 'car' | 'train' | 'flight' | 'taxi' | 'hotel' | 'meal' | 'other'
  distance_km: number | null
  gross_amount: number
  vat_percentage: number
  net_amount: number
  chargeable: boolean
  notes: string | null
  invoiced: boolean
  created_at: string
  updated_at: string
}

export interface AllowanceRate {
  id: string
  country: string
  partial_rate: number
  full_rate: number
  effective_from: string
  effective_to: string | null
  created_at: string
}

export interface ExpenseEntry {
  id: string
  user_id: string
  project_id: string
  date: string
  expense_type: 'train' | 'taxi' | 'flight' | 'rental_car' | 'fuel' | 'parking' | 'onpv' | 'hospitality' | 'hotel' | 'car' | 'others'
  description: string | null
  gross_amount: number
  vat_percentage: number
  vat_amount: number
  net_amount: number
  distance_km: number | null
  rate_per_km: number | null
  receipt_uploaded: boolean
  created_at: string
  updated_at: string
}

export interface AuditLog {
  id: string
  user_id: string
  action: string
  table_name: string
  record_id: string
  old_values: any
  new_values: any
  created_at: string
}