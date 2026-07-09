import { useCallback, useEffect, useState } from 'react'
import { Card } from '../../components/common/Card'
import { DeepFilters } from '../../components/common/DeepFilters'
import { Loader } from '../../components/common/Loader'
import { Table, type Column } from '../../components/common/Table'
import { PageHeader } from '../../components/layout/PageHeader'
import { getExpenses } from '../../services/expenses'
import type { ExpenseRow } from '../../types/pond'
import { formatCurrencyINR, formatDate } from '../../utils/formatDate'
import { downloadCsv } from '../../utils/helpers'

export function Expenses() {
  const [rows, setRows] = useState<ExpenseRow[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      setRows(await getExpenses())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const columns: Column<ExpenseRow>[] = [
    {
      key: 'pond',
      header: 'Pond / Farmer',
      render: (row) => (
        <div>
          <div className="cell-primary">{row.pondName}</div>
          <div className="cell-secondary">
            {row.farmerName} | {row.location}
          </div>
        </div>
      ),
    },
    { key: 'species', header: 'Species', render: (row) => row.species },
    {
      key: 'total',
      header: 'Total Cost',
      render: (row) => formatCurrencyINR(row.totalCost),
    },
    {
      key: 'feed',
      header: 'Feed',
      render: (row) => formatCurrencyINR(row.feedCost),
    },
    {
      key: 'seed',
      header: 'Seed',
      render: (row) => formatCurrencyINR(row.seedCost),
    },
    {
      key: 'labour',
      header: 'Labour',
      render: (row) => formatCurrencyINR(row.labourCost),
    },
    {
      key: 'treatment',
      header: 'Treatment',
      render: (row) => formatCurrencyINR(row.treatmentCost),
    },
    {
      key: 'updated',
      header: 'Updated',
      render: (row) => formatDate(row.updatedAt),
    },
  ]

  const onExport = () => {
    downloadCsv('expenses.csv', [
      ['Pond', 'Farmer', 'Location', 'Species', 'Total', 'Feed', 'Seed', 'Labour', 'Treatment', 'Updated'],
      ...rows.map((r) => [
        r.pondName,
        r.farmerName,
        r.location,
        r.species,
        String(r.totalCost),
        String(r.feedCost),
        String(r.seedCost),
        String(r.labourCost),
        String(r.treatmentCost),
        formatDate(r.updatedAt),
      ]),
    ])
  }

  return (
    <div className="stack-gap">
      <PageHeader title="Cycle Expenses" onRefresh={refresh} onExport={onExport} />
      <DeepFilters />
      <Card kicker="Cycle Cost Tracking" title="Expense Tracker">
        {loading ? (
          <Loader />
        ) : (
          <Table columns={columns} data={rows} rowKey={(row) => row.id} />
        )}
      </Card>
    </div>
  )
}
