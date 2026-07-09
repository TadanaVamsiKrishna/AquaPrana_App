import { delay } from '../utils/helpers'

export interface FeedingSchedule {
  id: string
  pondName: string
  feedType: string
  quantityKg: number
  time: string
}

const schedules: FeedingSchedule[] = [
  {
    id: 'fs1',
    pondName: 'My Pond',
    feedType: 'Starter',
    quantityKg: 25,
    time: '08:00',
  },
]

export async function getFeedingSchedules(): Promise<FeedingSchedule[]> {
  await delay()
  return schedules
}
