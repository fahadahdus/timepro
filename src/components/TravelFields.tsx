import React from 'react'
import { Input } from './ui/Input'
import { Select } from './ui/Select'
import { clsx } from 'clsx'

interface Country {
  id: string
  code: string
  name: string
  vat_rate: string
  currency_code: string
  is_active: boolean
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
  countries: Country[]
  citySuggestions: string[]
  isMobile: boolean
  isReadOnly: boolean
  onChange: (field: string, value: string) => void
}

export function TravelFields({ 
  dateStr, 
  office, 
  city, 
  country, 
  countries, 
  citySuggestions, 
  isMobile, 
  isReadOnly, 
  onChange 
}: TravelFieldsProps) {
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
          "grid-cols-3": !isMobile
        }
      )}>
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
        Specify travel destination for allowance calculations
      </p>
    </div>
  )
}
