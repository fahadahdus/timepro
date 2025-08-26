export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
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
        Insert: {
          id: string
          email: string
          full_name: string
          role: 'super_admin' | 'consultant'
          hourly_rate?: number
          country_code?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string
          role?: 'super_admin' | 'consultant'
          hourly_rate?: number
          country_code?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      weeks: {
        Row: {
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
        Insert: {
          id?: string
          user_id: string
          week_start: string
          status?: 'draft' | 'submitted' | 'approved' | 'rejected'
          submitted_at?: string | null
          approved_at?: string | null
          approved_by?: string | null
          rejection_reason?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          week_start?: string
          status?: 'draft' | 'submitted' | 'approved' | 'rejected'
          submitted_at?: string | null
          approved_at?: string | null
          approved_by?: string | null
          rejection_reason?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}
