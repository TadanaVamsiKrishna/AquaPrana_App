import { useState } from 'react'
import { Button } from './Button'
import { Card } from './Card'
import { Input } from './Input'

export interface DeepFilterValues {
  from: string
  to: string
  state: string
  district: string
  farmer: string
  pond: string
  severity: string
}

const EMPTY: DeepFilterValues = {
  from: '',
  to: '',
  state: 'all',
  district: 'all',
  farmer: 'all',
  pond: 'all',
  severity: 'all',
}

interface DeepFiltersProps {
  onChange?: (values: DeepFilterValues) => void
}

export function DeepFilters({ onChange }: DeepFiltersProps) {
  const [values, setValues] = useState<DeepFilterValues>(EMPTY)

  const update = (patch: Partial<DeepFilterValues>) => {
    const next = { ...values, ...patch }
    setValues(next)
    onChange?.(next)
  }

  const clear = () => {
    setValues(EMPTY)
    onChange?.(EMPTY)
  }

  return (
    <Card
      className="deep-filters"
      kicker="Deep Filters"
      title="Region, farmer, pond, severity, and date range"
      actions={
        <Button type="button" variant="outline" onClick={clear}>
          Clear Filters
        </Button>
      }
    >
      <div className="deep-filters-grid">
        <Input
          label="From"
          type="date"
          value={values.from}
          onChange={(e) => update({ from: e.target.value })}
        />
        <Input
          label="To"
          type="date"
          value={values.to}
          onChange={(e) => update({ to: e.target.value })}
        />
        <Input
          as="select"
          label="State"
          value={values.state}
          onChange={(e) => update({ state: e.target.value })}
          options={[
            { label: 'All states', value: 'all' },
            { label: 'Andhra Pradesh', value: 'ap' },
            { label: 'Tamil Nadu', value: 'tn' },
          ]}
        />
        <Input
          as="select"
          label="District"
          value={values.district}
          onChange={(e) => update({ district: e.target.value })}
          options={[
            { label: 'All districts', value: 'all' },
            { label: 'West Godavari', value: 'wg' },
            { label: 'East Godavari', value: 'eg' },
            { label: 'Krishna', value: 'kr' },
          ]}
        />
        <Input
          as="select"
          label="Farmer"
          value={values.farmer}
          onChange={(e) => update({ farmer: e.target.value })}
          options={[
            { label: 'All farmers', value: 'all' },
            { label: 'Anirudh', value: 'anirudh' },
            { label: 'Ravi Kumar', value: 'ravi' },
          ]}
        />
        <Input
          as="select"
          label="Pond"
          value={values.pond}
          onChange={(e) => update({ pond: e.target.value })}
          options={[
            { label: 'All ponds', value: 'all' },
            { label: 'My Pond', value: 'my-pond' },
            { label: 'PondScore Demo Alpha', value: 'alpha' },
          ]}
        />
        <Input
          as="select"
          label="Alert Severity"
          value={values.severity}
          onChange={(e) => update({ severity: e.target.value })}
          options={[
            { label: 'All statuses', value: 'all' },
            { label: 'Stable', value: 'stable' },
            { label: 'Warning', value: 'warning' },
          ]}
        />
      </div>
      <div className="deep-filters-footer">Showing all data</div>
    </Card>
  )
}
