import { delay } from '../utils/helpers'
import type { AquaGptSession, AquaGptUsage } from '../types/aquagpt'

const usage: AquaGptUsage[] = [
  {
    id: 'u1',
    date: '2026-07-02',
    farmerName: 'Anirudh',
    phone: '+918523055561',
    messages: 14,
    tokens: 889,
    updatedAt: '2026-07-02T18:42:00',
  },
  {
    id: 'u2',
    date: '2026-07-01',
    farmerName: 'Ravi Kumar',
    phone: '+919876543210',
    messages: 6,
    tokens: 412,
    updatedAt: '2026-07-01T11:15:00',
  },
]

const sessions: AquaGptSession[] = [
  {
    id: 's1',
    scope: 'General',
    farmerName: 'Anirudh',
    phone: '+918523055561',
    model: 'nvidia:meta/llama-3.1-8b-instruct',
    messages: 8,
    tokens: 520,
  },
  {
    id: 's2',
    scope: 'PondScore Demo Alpha',
    farmerName: 'Anirudh',
    phone: '+918523055561',
    model: 'nvidia:meta/llama-3.1-8b-instruct',
    messages: 12,
    tokens: 741,
  },
]

export async function getAquaGptUsage(): Promise<AquaGptUsage[]> {
  await delay()
  return usage
}

export async function getAquaGptSessions(): Promise<AquaGptSession[]> {
  await delay()
  return sessions
}
