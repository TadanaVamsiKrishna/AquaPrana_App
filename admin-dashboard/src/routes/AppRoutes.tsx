import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { DashboardLayout } from '../components/layout/DashboardLayout'
import { useAuth } from '../hooks/useAuth'
import { Login } from '../pages/auth/Login'
import { Overview } from '../pages/overview/Overview'
import { Farmers } from '../pages/farmers/Farmers'
import { FarmerDetails } from '../pages/farmers/FarmerDetails'
import { Ponds } from '../pages/ponds/Ponds'
import { PondDetails } from '../pages/ponds/PondDetails'
import { CropCycles } from '../pages/cropcycles/CropCycles'
import { FeedingSchedules } from '../pages/feeding/FeedingSchedules'
import { PondLogs } from '../pages/logs/PondLogs'
import { Expenses } from '../pages/expenses/Expenses'
import { Inventory } from '../pages/inventory/Inventory'
import { Orders } from '../pages/inventory/Orders'
import { Sessions } from '../pages/aquagpt/Sessions'
import { Messages } from '../pages/aquagpt/Messages'
import { Usage } from '../pages/aquagpt/Usage'
import { AdminProfile } from '../pages/settings/AdminProfile'
import { ProtectedRoute } from './ProtectedRoute'
import { AquaGptMonitor } from '../pages/aquagpt/AquaGptMonitor'

function GuestOnly({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <GuestOnly>
            <Login />
          </GuestOnly>
        }
      />

      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>
          <Route index element={<Overview />} />
          <Route path="farmers" element={<Farmers />} />
          <Route path="farmers/:id" element={<FarmerDetails />} />
          <Route path="ponds" element={<Ponds />} />
          <Route path="ponds/:id" element={<PondDetails />} />
          <Route path="crop-cycles" element={<CropCycles />} />
          <Route path="feeding" element={<FeedingSchedules />} />
          <Route path="logs" element={<PondLogs />} />
          <Route path="expenses" element={<Expenses />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="inventory/orders" element={<Orders />} />
          <Route path="aquagpt" element={<AquaGptMonitor />} />
          <Route path="aquagpt/sessions" element={<Sessions />} />
          <Route path="aquagpt/messages" element={<Messages />} />
          <Route path="aquagpt/usage" element={<Usage />} />
          <Route path="settings" element={<AdminProfile />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
