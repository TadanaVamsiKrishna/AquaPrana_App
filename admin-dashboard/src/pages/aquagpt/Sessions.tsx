import { useEffect, useState } from 'react'
import { Card } from '../../components/common/Card'
import { Loader } from '../../components/common/Loader'
import { Table, type Column } from '../../components/common/Table'
import { PageHeader } from '../../components/layout/PageHeader'
import { getAquaGptSessions } from '../../services/aquagpt'
import type { AquaGptSession } from '../../types/aquagpt'

export function Sessions() {
  const [sessions, setSessions] = useState<AquaGptSession[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      setLoading(true)
      setSessions(await getAquaGptSessions())
      setLoading(false)
    })()
  }, [])

  const columns: Column<AquaGptSession>[] = [
    {
      key: 'scope',
      header: 'Scope / Farmer',
      render: (row) => (
        <div>
          <div className="cell-primary">{row.scope}</div>
          <div className="cell-secondary">
            {row.farmerName} {row.phone}
          </div>
        </div>
      ),
    },
    { key: 'model', header: 'Model', render: (row) => row.model },
    { key: 'messages', header: 'Messages', render: (row) => row.messages },
    { key: 'tokens', header: 'Tokens', render: (row) => row.tokens },
  ]

  return (
    <div className="stack-gap">
      <PageHeader title="AquaGPT Sessions" live={false} />
      <Card title="Sessions">
        {loading ? (
          <Loader />
        ) : (
          <Table columns={columns} data={sessions} rowKey={(row) => row.id} />
        )}
      </Card>
    </div>
  )
}
