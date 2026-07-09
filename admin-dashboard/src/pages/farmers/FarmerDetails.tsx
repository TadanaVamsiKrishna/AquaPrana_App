import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Card } from '../../components/common/Card'
import { Loader } from '../../components/common/Loader'
import { PageHeader } from '../../components/layout/PageHeader'
import { getFarmerById } from '../../services/users'
import type { Farmer } from '../../types/user'
import { formatCurrencyINR, formatDate } from '../../utils/formatDate'

export function FarmerDetails() {
  const { id } = useParams()
  const [farmer, setFarmer] = useState<Farmer | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    void (async () => {
      setLoading(true)
      const data = id ? await getFarmerById(id) : undefined
      if (active) {
        setFarmer(data ?? null)
        setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [id])

  if (loading) return <Loader />
  if (!farmer) {
    return (
      <Card title="Farmer not found">
        <Link to="/farmers">Back to farmers</Link>
      </Card>
    )
  }

  return (
    <div className="stack-gap">
      <PageHeader title={farmer.name} live={false} />
      <Card kicker="Farmer Profile" title="Details">
        <p>
          <strong>Phone:</strong> {farmer.phone}
        </p>
        <p>
          <strong>Region:</strong> {farmer.district}, {farmer.state}
        </p>
        <p>
          <strong>Ponds:</strong> {farmer.ponds}
        </p>
        <p>
          <strong>Active cycles:</strong> {farmer.activeCycles}
        </p>
        <p>
          <strong>Expense:</strong> {formatCurrencyINR(farmer.expense)}
        </p>
        <p>
          <strong>Joined:</strong> {formatDate(farmer.joinedAt)}
        </p>
        <p style={{ marginTop: 16 }}>
          <Link to="/farmers">← Back to directory</Link>
        </p>
      </Card>
    </div>
  )
}
