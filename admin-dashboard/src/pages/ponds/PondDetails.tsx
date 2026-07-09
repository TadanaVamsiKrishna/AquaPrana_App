import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Card } from '../../components/common/Card'
import { Loader } from '../../components/common/Loader'
import { StatusBadge } from '../../components/common/StatusBadge'
import { PageHeader } from '../../components/layout/PageHeader'
import { getPondById } from '../../services/ponds'
import type { Pond } from '../../types/pond'

export function PondDetails() {
  const { id } = useParams()
  const [pond, setPond] = useState<Pond | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    void (async () => {
      setLoading(true)
      const data = id ? await getPondById(id) : undefined
      if (active) {
        setPond(data ?? null)
        setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [id])

  if (loading) return <Loader />
  if (!pond) {
    return (
      <Card title="Pond not found">
        <Link to="/ponds">Back to ponds</Link>
      </Card>
    )
  }

  return (
    <div className="stack-gap">
      <PageHeader title={pond.name} live={false} />
      <Card
        kicker="Pond Details"
        title={pond.name}
        actions={<StatusBadge status={pond.status} />}
      >
        <p>
          <strong>Farmer:</strong> {pond.farmerName} · {pond.phone}
        </p>
        <p>
          <strong>Region:</strong> {pond.district}, {pond.state}
        </p>
        <p>
          <strong>Density:</strong> {pond.density}
        </p>
        <p>
          <strong>Area:</strong> {pond.area}
        </p>
        <p>
          <strong>Depth:</strong> {pond.depth}
        </p>
        <p style={{ marginTop: 16 }}>
          <Link to="/ponds">← Back to ponds</Link>
        </p>
      </Card>
    </div>
  )
}
