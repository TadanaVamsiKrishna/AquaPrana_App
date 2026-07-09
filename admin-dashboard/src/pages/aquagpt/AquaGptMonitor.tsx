import { useCallback, useEffect, useState } from 'react'
import { Card } from '../../components/common/Card'
import { DeepFilters } from '../../components/common/DeepFilters'
import { Loader } from '../../components/common/Loader'
import { Table, type Column } from '../../components/common/Table'
import { PageHeader } from '../../components/layout/PageHeader'
import { getAquaGptSessions, getAquaGptUsage } from '../../services/aquagpt'
import type { AquaGptSession, AquaGptUsage } from '../../types/aquagpt'
import { formatDate, formatDateShort } from '../../utils/formatDate'
import { downloadCsv } from '../../utils/helpers'

export function AquaGptMonitor() {
  const [usage, setUsage] = useState<AquaGptUsage[]>([])
  const [sessions, setSessions] = useState<AquaGptSession[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [nextUsage, nextSessions] = await Promise.all([
        getAquaGptUsage(),
        getAquaGptSessions(),
      ])
      setUsage(nextUsage)
      setSessions(nextSessions)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const usageColumns: Column<AquaGptUsage>[] = [
    {
      key: 'date',
      header: 'Date',
      render: (row) => formatDateShort(row.date),
    },
    {
      key: 'farmer',
      header: 'Farmer',
      render: (row) => (
        <div>
          <div className="cell-primary">{row.farmerName}</div>
          <div className="cell-secondary">{row.phone}</div>
        </div>
      ),
    },
    { key: 'messages', header: 'Messages', render: (row) => row.messages },
    { key: 'tokens', header: 'Tokens', render: (row) => row.tokens },
    {
      key: 'updated',
      header: 'Updated',
      render: (row) => formatDate(row.updatedAt),
    },
  ]

  const sessionColumns: Column<AquaGptSession>[] = [
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

  const onExport = () => {
    downloadCsv('aquagpt-usage.csv', [
      ['Date', 'Farmer', 'Phone', 'Messages', 'Tokens', 'Updated'],
      ...usage.map((u) => [
        formatDateShort(u.date),
        u.farmerName,
        u.phone,
        String(u.messages),
        String(u.tokens),
        formatDate(u.updatedAt),
      ]),
    ])
  }

  return (
    <div className="stack-gap">
      <PageHeader title="AquaGPT Monitor" onRefresh={refresh} onExport={onExport} />
      <DeepFilters />

      {loading ? (
        <Loader />
      ) : (
        <div className="split-grid">
          <Card kicker="AI Usage" title="AquaGPT Daily Usage">
            <Table columns={usageColumns} data={usage} rowKey={(row) => row.id} />
          </Card>
          <Card kicker="Latest AI Chats" title="AquaGPT Sessions">
            <Table columns={sessionColumns} data={sessions} rowKey={(row) => row.id} />
          </Card>
        </div>
      )}
    </div>
  )
}
