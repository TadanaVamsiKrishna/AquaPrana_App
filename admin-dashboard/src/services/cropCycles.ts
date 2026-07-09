import { delay } from '../utils/helpers'

export interface CropCycle {
  id: string
  pondName: string
  farmerName: string
  species: string
  startDate: string
  status: string
}

const cycles: CropCycle[] = [
  {
    id: 'c1',
    pondName: 'PondScore Demo Alpha',
    farmerName: 'Anirudh',
    species: 'Vannamei',
    startDate: '2026-04-01',
    status: 'Active',
  },
]

export async function getCropCycles(): Promise<CropCycle[]> {
  await delay()
  return cycles
}
