export type PondStatus = 'Stable' | 'Watch closely' | 'Warning'

export interface Pond {
  id: string
  name: string
  farmerName: string
  phone: string
  district: string
  state: string
  coordinates?: string
  status: PondStatus
  density: string
  area: string
  depth: string
}

export interface PondLog {
  id: string
  time: string
  pondName: string
  pondScore: string
  farmerName: string
  phone: string
  doLevel: number
  ph: number
  temp: number
  ammonia: number
  feedKg: number
  mortality: number
  status: 'Stable' | 'Warning'
}

export interface ExpenseRow {
  id: string
  pondName: string
  farmerName: string
  location: string
  species: string
  totalCost: number
  feedCost: number
  seedCost: number
  labourCost: number
  treatmentCost: number
  updatedAt: string
}
