import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '../../components/common/Card'
import { DeepFilters } from '../../components/common/DeepFilters'
import { Loader } from '../../components/common/Loader'
import { SearchBar } from '../../components/common/SearchBar'
import { Table, type Column } from '../../components/common/Table'
import { PageHeader } from '../../components/layout/PageHeader'
import { useUsers } from '../../hooks/useUsers'
import type { Farmer } from '../../types/user'
import { formatCurrencyINR, formatDate } from '../../utils/formatDate'
import { downloadCsv } from '../../utils/helpers'

export function Farmers() {
  const { farmers, loading, refresh } = useUsers()
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return farmers
    return farmers.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        f.phone.toLowerCase().includes(q) ||
        f.district.toLowerCase().includes(q),
    )
  }, [farmers, query])

  const columns: Column<Farmer>[] = [
    {
      key: 'farmer',
      header: 'Farmer',
      render: (row) => (
        <div>
          <Link className="cell-primary linkish" to={`/farmers/${row.id}`}>
            {row.name}
          </Link>
          <div className="cell-secondary">{row.phone}</div>
        </div>
      ),
    },
    {
      key: 'region',
      header: 'Region',
      render: (row) => `${row.district}, ${row.state}`,
    },
    { key: 'ponds', header: 'Ponds', render: (row) => row.ponds },
    { key: 'cycles', header: 'Active Cycles', render: (row) => row.activeCycles },
    { key: 'logs', header: 'Logs', render: (row) => row.logs },
    {
      key: 'expense',
      header: 'Expense',
      render: (row) => formatCurrencyINR(row.expense),
    },
    { key: 'aquagpt', header: 'AquaGPT', render: (row) => row.aquagpt },
    {
      key: 'joined',
      header: 'Joined',
      render: (row) => formatDate(row.joinedAt),
    },
  ]

  const onExport = () => {
    downloadCsv('farmers.csv', [
      ['Farmer', 'Phone', 'Region', 'Ponds', 'Active Cycles', 'Logs', 'Expense', 'AquaGPT', 'Joined'],
      ...filtered.map((f) => [
        f.name,
        f.phone,
        `${f.district}, ${f.state}`,
        String(f.ponds),
        String(f.activeCycles),
        String(f.logs),
        String(f.expense),
        String(f.aquagpt),
        formatDate(f.joinedAt),
      ]),
    ])
  }

  return (
    <div className="stack-gap">
      <PageHeader title="Farmer Directory" onRefresh={refresh} onExport={onExport} />
      <DeepFilters />
      <Card kicker="Users in the App" title="Farmer Directory">
        <SearchBar
          placeholder="Search by name, phone, district"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {loading ? (
          <Loader />
        ) : (
          <Table columns={columns} data={filtered} rowKey={(row) => row.id} />
        )}
      </Card>
    </div>
  )
}
