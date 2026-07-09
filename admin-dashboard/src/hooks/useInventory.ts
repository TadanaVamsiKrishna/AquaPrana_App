import { useCallback, useEffect, useState } from 'react'
import { getInventoryItems, getInventoryOrders } from '../services/inventory'
import type { InventoryItem, InventoryOrder } from '../types/inventory'

export function useInventory() {
  const [items, setItems] = useState<InventoryItem[]>([])
  const [orders, setOrders] = useState<InventoryOrder[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [nextItems, nextOrders] = await Promise.all([
        getInventoryItems(),
        getInventoryOrders(),
      ])
      setItems(nextItems)
      setOrders(nextOrders)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { items, orders, loading, refresh }
}
