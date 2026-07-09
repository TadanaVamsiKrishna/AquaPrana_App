import { useCallback, useEffect, useState } from 'react'
import { AquaGPTChart } from '../../components/charts/AquaGPTChart'
import { ExpenseChart } from '../../components/charts/ExpenseChart'
import { FarmerChart } from '../../components/charts/FarmerChart'
import { InventoryChart } from '../../components/charts/InventoryChart'
import { Card } from '../../components/common/Card'
import { Loader } from '../../components/common/Loader'
import { PageHeader } from '../../components/layout/PageHeader'
import { getExpenses } from '../../services/expenses'
import { getInventoryItems } from '../../services/inventory'
import { getPonds } from '../../services/ponds'
import { getFarmers } from '../../services/users'
import { downloadCsv } from '../../utils/helpers'

export function Overview() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    farmers: 0,
    ponds: 0,
    expenses: 0,
    inventory: 0,
  })

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [farmers, ponds, expenses, inventory] = await Promise.all([
        getFarmers(),
        getPonds(),
        getExpenses(),
        getInventoryItems(),
      ])
      setStats({
        farmers: farmers.length,
        ponds: ponds.length,
        expenses: expenses.length,
        inventory: inventory.length,
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const onExport = () => {
    downloadCsv('overview.csv', [
      ['Metric', 'Value'],
      ['Farmers', String(stats.farmers)],
      ['Ponds', String(stats.ponds)],
      ['Expense rows', String(stats.expenses)],
      ['Inventory items', String(stats.inventory)],
    ])
  }

  if (loading) return <Loader label="Loading overview…" />

  return (
    <div className="stack-gap">
      <PageHeader title="Overview" onRefresh={refresh} onExport={onExport} />

      <div className="overview-grid">
        <Card className="stat-card">
          <span>Farmers</span>
          <strong>{stats.farmers}</strong>
        </Card>
        <Card className="stat-card">
          <span>Ponds</span>
          <strong>{stats.ponds}</strong>
        </Card>
        <Card className="stat-card">
          <span>Expense Cycles</span>
          <strong>{stats.expenses}</strong>
        </Card>
        <Card className="stat-card">
          <span>Inventory Items</span>
          <strong>{stats.inventory}</strong>
        </Card>
      </div>

      <div className="split-grid">
        <FarmerChart />
        <ExpenseChart />
        <InventoryChart />
        <AquaGPTChart />
      </div>
    </div>
  )
}
