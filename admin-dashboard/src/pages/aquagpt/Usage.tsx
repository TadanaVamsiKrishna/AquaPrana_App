import { useEffect, useState } from 'react'
import { Card } from '../../components/common/Card'
import { Loader } from '../../components/common/Loader'
import { Table, type Column } from '../../components/common/Table'
import { PageHeader } from '../../components/layout/PageHeader'
import { getAquaGptUsage } from '../../services/aquagpt'
import type { AquaGptUsage } from '../../types/aquagpt'
import { formatDate, formatDateShort } from '../../utils/formatDate'

export function Usage() {
  const [usage, setUsage] = useState<AquaGptUsage[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      setLoading(true)
      setUsage(await getAquaGptUsage())
      setLoading(false)
    })()
  }, [])

  const columns: Column<AquaGptUsage>[] = [
    {
      key: 'date',
      header: 'Date',
      render: (row) => formatDateShort(row.date),
    },
    {
      key: 'farmer',
      header: 'Farmer',
      render: (row) => `${row.farmerName} ${row.phone}`,
    },
    { key: 'messages', header: 'Messages', render: (row) => row.messages },
    { key: 'tokens', header: 'Tokens', render: (row) => row.tokens },
    {
      key: 'updated',
      header: 'Updated',
      render: (row) => formatDate(row.updatedAt),
    },
  ]

  return (
    <div className="stack-gap">
      <PageHeader title="AquaGPT Usage" live={false} />
      <Card title="Daily Usage">
        {loading ? (
          <Loader />
        ) : (
          <Table columns={columns} data={usage} rowKey={(row) => row.id} />
        )}
      </Card>
    </div>
  )
}
