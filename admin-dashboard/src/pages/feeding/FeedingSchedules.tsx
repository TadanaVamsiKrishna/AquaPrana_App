import { useEffect, useState } from 'react'
import { Card } from '../../components/common/Card'
import { Loader } from '../../components/common/Loader'
import { Table, type Column } from '../../components/common/Table'
import { PageHeader } from '../../components/layout/PageHeader'
import { getFeedingSchedules, type FeedingSchedule } from '../../services/feeding'

export function FeedingSchedules() {
  const [rows, setRows] = useState<FeedingSchedule[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      setLoading(true)
      setRows(await getFeedingSchedules())
      setLoading(false)
    })()
  }, [])

  const columns: Column<FeedingSchedule>[] = [
    { key: 'pond', header: 'Pond', render: (row) => row.pondName },
    { key: 'feed', header: 'Feed Type', render: (row) => row.feedType },
    {
      key: 'qty',
      header: 'Quantity',
      render: (row) => `${row.quantityKg} kg`,
    },
    { key: 'time', header: 'Time', render: (row) => row.time },
  ]

  return (
    <div className="stack-gap">
      <PageHeader title="Feeding Schedules" live={false} />
      <Card title="Schedules">
        {loading ? (
          <Loader />
        ) : (
          <Table columns={columns} data={rows} rowKey={(row) => row.id} />
        )}
      </Card>
    </div>
  )
}
