import { useEffect, useState } from 'react'
import { Card } from '../../components/common/Card'
import { Loader } from '../../components/common/Loader'
import { Table, type Column } from '../../components/common/Table'
import { PageHeader } from '../../components/layout/PageHeader'
import { getCropCycles, type CropCycle } from '../../services/cropCycles'
import { formatDateShort } from '../../utils/formatDate'

export function CropCycles() {
  const [rows, setRows] = useState<CropCycle[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      setLoading(true)
      setRows(await getCropCycles())
      setLoading(false)
    })()
  }, [])

  const columns: Column<CropCycle>[] = [
    { key: 'pond', header: 'Pond', render: (row) => row.pondName },
    { key: 'farmer', header: 'Farmer', render: (row) => row.farmerName },
    { key: 'species', header: 'Species', render: (row) => row.species },
    {
      key: 'start',
      header: 'Start Date',
      render: (row) => formatDateShort(row.startDate),
    },
    { key: 'status', header: 'Status', render: (row) => row.status },
  ]

  return (
    <div className="stack-gap">
      <PageHeader title="Crop Cycles" live={false} />
      <Card title="Active Cycles">
        {loading ? (
          <Loader />
        ) : (
          <Table columns={columns} data={rows} rowKey={(row) => row.id} />
        )}
      </Card>
    </div>
  )
}
