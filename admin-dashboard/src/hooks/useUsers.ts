import { useCallback, useEffect, useState } from 'react'
import { getFarmers } from '../services/users'
import type { Farmer } from '../types/user'

export function useUsers() {
  const [farmers, setFarmers] = useState<Farmer[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getFarmers()
      setFarmers(data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { farmers, loading, refresh }
}
