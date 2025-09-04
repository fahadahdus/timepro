import React from 'react'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { clsx } from 'clsx'

interface Country {
  id: string
  code: string
  name: string
  vat_rate: string
  currency_code: string
  is_active: boolean
}

interface Project {
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

const OFFICE_LOCATIONS = [
  { value: 'main_office', label: 'Main Office' },
  { value: 'branch_office', label: 'Branch Office' },
  { value: 'client_site', label: 'Client Site' },
  { value: 'home_office', label: 'Home Office' },
  { value: 'coworking_space', label: 'Coworking Space' },
  { value: 'other', label: 'Other' }
]

interface TravelFieldsProps {
  dateStr: string
  office?: string
  city?: string
  country?: string
  projectId?: string
  countries: Country[]
  projects: Project[]
  citySuggestions: string[]
  isMobile: boolean
  isReadOnly: boolean
  onChange: (field: string, value: string) => void
  smartDefaults?: {
    lastOffice: string
    lastCity: string
    lastCountry: string
    recentOffices: string[]
  }
}

export function TravelFields({ 
  dateStr, 
  office, 
  city, 
  country, 
  projectId, 
  countries, 
  projects, 
  citySuggestions, 
  isMobile, 
  isReadOnly, 
  onChange,
  smartDefaults 
}: TravelFieldsProps) {
  
  // Auto-populate fields with smart defaults when they're empty
  React.useEffect(() => {
    if (!isReadOnly && smartDefaults) {
      if (!office && smartDefaults.lastOffice) {
        onChange('office', smartDefaults.lastOffice)
      }
      if (!city && smartDefaults.lastCity) {
        onChange('city', smartDefaults.lastCity)
      }
      if (!country && smartDefaults.lastCountry) {
        onChange('country', smartDefaults.lastCountry)
      }
    }
  }, [office, city, country, smartDefaults, onChange, isReadOnly])
  return (
    <div className={clsx(
      "bg-muted/20 rounded-lg p-3 space-y-3 mt-3",
      "border border-muted"
    )}>
      <h4 className="text-sm font-medium text-foreground flex items-center">
        <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        Travel Location Details
      </h4>
      <div className={clsx(
        "grid gap-3",
        {
          "grid-cols-1": isMobile,
          "grid-cols-2 lg:grid-cols-4": !isMobile
        }
      )}>
        <Select
          value={projectId || ''}
          onChange={(e) => onChange('project_id', e.target.value)}
          className={clsx(
            "premium-focus",
            {
              "w-full": isMobile,
            }
          )}
          disabled={isReadOnly}
          onClick={(e) => e.stopPropagation()}
          options={[
            { value: '', label: 'Select project...' },
            ...projects.map(project => ({
              value: project.id,
              label: `${project.code} - ${project.name}`
            }))
          ]}
          label={isMobile ? "Project *" : undefined}
          variant={isMobile ? "floating" : "default"}
          required
        />
        <Select
          value={office || ''}
          onChange={(e) => onChange('office', e.target.value)}
          className={clsx(
            "premium-focus",
            {
              "w-full": isMobile,
            }
          )}
          disabled={isReadOnly}
          onClick={(e) => e.stopPropagation()}
          options={[
            { value: '', label: 'Select office...' },
            ...OFFICE_LOCATIONS
          ]}
          label={isMobile ? "Office Location" : undefined}
          variant={isMobile ? "floating" : "default"}
        />
        <div className="relative">
          <Input
            type="text"
            label={isMobile ? "City" : undefined}
            placeholder="Enter city"
            value={city || ''}
            onChange={(e) => onChange('city', e.target.value)}
            disabled={isReadOnly}
            onClick={(e) => e.stopPropagation()}
            variant={isMobile ? "floating" : "default"}
            list={`city-suggestions-${dateStr}`}
          />
          <datalist id={`city-suggestions-${dateStr}`}>
            {citySuggestions.map((suggestionCity, index) => (
              <option key={index} value={suggestionCity} />
            ))}
          </datalist>
        </div>
        <Select
          value={country || ''}
          onChange={(e) => onChange('country', e.target.value)}
          className={clsx(
            "premium-focus",
            {
              "w-full": isMobile,
            }
          )}
          disabled={isReadOnly}
          onClick={(e) => e.stopPropagation()}
          options={[
            { value: '', label: 'Select country...' },
            ...countries.map(countryItem => ({
              value: countryItem.name,
              label: `${countryItem.name} (${countryItem.code})`
            }))
          ]}
          label={isMobile ? "Country" : undefined}
          variant={isMobile ? "floating" : "default"}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        <span className="font-medium text-orange-600">Project selection is required</span> for travel days to associate daily allowance with project costs.
      </p>
    </div>
  )
}
