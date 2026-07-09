import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '../../components/common/Card'
import { DeepFilters } from '../../components/common/DeepFilters'
import { Loader } from '../../components/common/Loader'
import { StatusBadge } from '../../components/common/StatusBadge'
import { PageHeader } from '../../components/layout/PageHeader'
import { getPonds } from '../../services/ponds'
import type { Pond } from '../../types/pond'
import { downloadCsv } from '../../utils/helpers'

export function Ponds() {
  const [ponds, setPonds] = useState<Pond[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      setPonds(await getPonds())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const onExport = () => {
    downloadCsv('ponds.csv', [
      ['Name', 'Farmer', 'Phone', 'Region', 'Status', 'Density', 'Area', 'Depth'],
      ...ponds.map((p) => [
        p.name,
        p.farmerName,
        p.phone,
        `${p.district}, ${p.state}`,
        p.status,
        p.density,
        p.area,
        p.depth,
      ]),
    ])
  }

  return (
    <div className="stack-gap">
      <PageHeader title="Pond Overview" onRefresh={refresh} onExport={onExport} />
      <DeepFilters />

      {loading ? (
        <Loader />
      ) : (
        <Card kicker="All Ponds" title={`${ponds.length} ponds in the system`}>
          <div className="pond-grid">
            {ponds.map((pond) => (
              <Link key={pond.id} to={`/ponds/${pond.id}`} className="pond-card">
                <div className="pond-card-top">
                  <div className="pond-card-title-block">
                    <span className="pond-card-label">Pond</span>
                    <h3>{pond.name}</h3>
                  </div>
                  <StatusBadge status={pond.status} />
                </div>

                <div className="pond-info-rows">
                  <div className="pond-info-row">
                    <span className="pond-info-label">Farmer</span>
                    <span className="pond-info-value">
                      {pond.farmerName}
                      <span className="pond-info-sub">{pond.phone}</span>
                    </span>
                  </div>
                  <div className="pond-info-row">
                    <span className="pond-info-label">Location</span>
                    <span className="pond-info-value">
                      {pond.district}, {pond.state}
                      {pond.coordinates ? (
                        <span className="pond-info-sub">{pond.coordinates}</span>
                      ) : null}
                    </span>
                  </div>
                </div>

                <div className="pond-metrics">
                  <div className="pond-metric">
                    <span>Density</span>
                    <strong>{pond.density}</strong>
                  </div>
                  <div className="pond-metric">
                    <span>Area</span>
                    <strong>{pond.area}</strong>
                  </div>
                  <div className="pond-metric">
                    <span>Depth</span>
                    <strong>{pond.depth}</strong>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
