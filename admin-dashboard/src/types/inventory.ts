export type InventoryHealth = 'Healthy' | 'Low' | 'Critical'

export interface InventoryItem {
  id: string
  product: string
  contact: string
  currentQty: string
  threshold: string
  restockQty: string
  locationStatus: InventoryHealth
  updatedAt: string
}

export interface InventoryOrder {
  id: string
  product: string
  quantity: string
  status: string
  requestedAt: string
  fulfilledAt?: string
}
