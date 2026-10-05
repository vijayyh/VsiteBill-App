import type { ReactNode } from 'react'
import { Navigate, Route, BrowserRouter, Routes } from 'react-router-dom'
import { PhoneShell } from './components/PhoneShell'
import { RequireRole } from './components/RequireRole'
import { useAutoFlushOfflineQueue } from './lib/offlineQueue'
import { SessionProvider, type Role } from './lib/session'
import { Login } from './screens/Login'
import { Welcome } from './screens/Welcome'
import { ForgotPassword } from './screens/ForgotPassword'
import { Alerts } from './screens/common/Alerts'
import { Profile } from './screens/common/Profile'
import { SupervisorDashboard } from './screens/supervisor/Dashboard'
import { MyBills } from './screens/supervisor/MyBills'
import { AddBill } from './screens/supervisor/AddBill'
import { SupervisorProject } from './screens/supervisor/Project'
import { UploadOptions } from './screens/supervisor/UploadOptions'
import { DeliveryDetails } from './screens/supervisor/DeliveryDetails'
import { UploadSuccess } from './screens/supervisor/UploadSuccess'
import { AccountantDashboard } from './screens/accountant/Dashboard'
import { AccountantProjects } from './screens/accountant/Projects'
import { ReviewQueue } from './screens/accountant/Review'
import { ProjectGallery } from './screens/accountant/ProjectGallery'
import { ReviewDelivery } from './screens/accountant/ReviewDelivery'
import { AdminDashboard } from './screens/admin/Dashboard'
import { AdminUsers } from './screens/admin/Users'
import { AdminProjects } from './screens/admin/Projects'
import { AdminDeliveries } from './screens/admin/Deliveries'

const ROUTES: Record<Role, [string, ReactNode][]> = {
  supervisor: [
    ['', <SupervisorDashboard />],
    ['bills', <MyBills />],
    ['add', <AddBill />],
    ['projects/:projectId', <SupervisorProject />],
    ['projects/:projectId/upload', <UploadOptions />],
    ['projects/:projectId/details', <DeliveryDetails />],
    ['projects/:projectId/success', <UploadSuccess />],
  ],
  accountant: [
    ['', <AccountantDashboard />],
    ['projects', <AccountantProjects />],
    ['review', <ReviewQueue />],
    ['projects/:projectId/gallery', <ProjectGallery />],
    ['projects/:projectId/review/:deliveryId', <ReviewDelivery />],
  ],
  admin: [
    ['', <AdminDashboard />],
    ['users', <AdminUsers />],
    ['projects', <AdminProjects />],
    ['deliveries', <AdminDeliveries />],
  ],
}

export default function App() {
  useAutoFlushOfflineQueue()

  return (
    <SessionProvider>
      <BrowserRouter>
        <PhoneShell>
          <Routes>
            <Route path="/" element={<Welcome />} />
            <Route path="/login" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />

            {(Object.keys(ROUTES) as Role[]).flatMap((role) =>
              [...ROUTES[role], ['alerts', <Alerts />] as [string, ReactNode], ['profile', <Profile />] as [string, ReactNode]].map(
                ([path, element]) => (
                  <Route
                    key={`${role}/${path}`}
                    path={`/${role}${path ? `/${path}` : ''}`}
                    element={<RequireRole role={role}>{element}</RequireRole>}
                  />
                ),
              ),
            )}

            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </PhoneShell>
      </BrowserRouter>
    </SessionProvider>
  )
}
