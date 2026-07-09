export interface Farmer {
  id: string
  name: string
  phone: string
  district: string
  state: string
  ponds: number
  activeCycles: number
  logs: number
  expense: number
  aquagpt: number
  joinedAt: string
}

export interface AdminUser {
  id: string
  name: string
  email: string
}
