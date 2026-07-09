export interface AquaGptUsage {
  id: string
  date: string
  farmerName: string
  phone: string
  messages: number
  tokens: number
  updatedAt: string
}

export interface AquaGptSession {
  id: string
  scope: string
  farmerName: string
  phone: string
  model: string
  messages: number
  tokens: number
}
