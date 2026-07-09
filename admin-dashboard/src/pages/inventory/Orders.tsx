import { Link } from 'react-router-dom'
import { Card } from '../../components/common/Card'
import { Loader } from '../../components/common/Loader'
import { PageHeader } from '../../components/layout/PageHeader'
import { useInventory } from '../../hooks/useInventory'

export function Orders() {
  const { orders, loading, refresh } = useInventory()

  return (
    <div className="stack-gap">
      <PageHeader title="Inventory Orders" onRefresh={refresh} live={false} />
      <Card kicker="Restock Flow" title="Orders">
        {loading ? (
          <Loader />
        ) : orders.length === 0 ? (
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
        <p style={{ marginTop: 16 }}>
          <Link to="/inventory">← Back to inventory</Link>
        </p>
      </Card>
    </div>
  )
}
