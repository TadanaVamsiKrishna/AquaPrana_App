import { Link } from 'react-router-dom'
import { Card } from '../../components/common/Card'
import { DeepFilters } from '../../components/common/DeepFilters'
import { Loader } from '../../components/common/Loader'
import { StatusBadge } from '../../components/common/StatusBadge'
import { Table, type Column } from '../../components/common/Table'
import { PageHeader } from '../../components/layout/PageHeader'
import { useInventory } from '../../hooks/useInventory'
import type { InventoryItem } from '../../types/inventory'
import { downloadCsv } from '../../utils/helpers'

export function Inventory() {
  const { items, orders, loading, refresh } = useInventory()

  const columns: Column<InventoryItem>[] = [
    {
      key: 'product',
      header: 'Product',
      render: (row) => (
        <div>
          <div className="cell-primary">{row.product}</div>
          <div className="cell-secondary">{row.contact}</div>
        </div>
      ),
    },
    { key: 'qty', header: 'Current Qty', render: (row) => row.currentQty },
    { key: 'threshold', header: 'Threshold', render: (row) => row.threshold },
    { key: 'restock', header: 'Restock Qty', render: (row) => row.restockQty },
    {
      key: 'status',
      header: 'Location Status',
      render: (row) => <StatusBadge status={row.locationStatus} />,
    },
    {
      key: 'update',
      header: 'Update',
      render: () => (
        <Link className="linkish" to="/inventory/orders">
          View
        </Link>
      ),
    },
  ]

  const onExport = () => {
    downloadCsv('inventory.csv', [
      ['Product', 'Contact', 'Current Qty', 'Threshold', 'Restock Qty', 'Status'],
      ...items.map((i) => [
        i.product,
        i.contact,
        i.currentQty,
        i.threshold,
        i.restockQty,
        i.locationStatus,
      ]),
    ])
  }

  return (
    <div className="stack-gap">
      <PageHeader title="Inventory Monitor" onRefresh={refresh} onExport={onExport} />
      <DeepFilters />

      {loading ? (
        <Loader />
      ) : (
        <div className="split-grid">
          <Card kicker="Stock Levels" title="Inventory Items">
            <Table columns={columns} data={items} rowKey={(row) => row.id} />
          </Card>
          <Card kicker="Restock Flow" title="Inventory Orders">
            {orders.length === 0 ? (
              <div className="empty-state">No data available yet.</div>
            ) : (
              <ul>
                {orders.map((o) => (
                  <li key={o.id}>
                    {o.product} · {o.quantity} · {o.status}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </div>
  )
}
