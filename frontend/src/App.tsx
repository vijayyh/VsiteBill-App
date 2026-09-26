import { Navigate, Route, BrowserRouter, Routes } from 'react-router-dom'
import { PhoneShell } from './components/PhoneShell'
import { RequireRole } from './components/RequireRole'
import { useAutoFlushOfflineQueue } from './lib/offlineQueue'
import { SessionProvider } from './lib/session'
import { Login } from './screens/Login'
import { ForgotPassword } from './screens/ForgotPassword'
import { SupervisorDashboard } from './screens/supervisor/Dashboard'
import { SupervisorProject } from './screens/supervisor/Project'
import { UploadOptions } from './screens/supervisor/UploadOptions'
import { DeliveryDetails } from './screens/supervisor/DeliveryDetails'
import { UploadSuccess } from './screens/supervisor/UploadSuccess'
import { AccountantDashboard } from './screens/accountant/Dashboard'
import { ProjectGallery } from './screens/accountant/ProjectGallery'
import { ReviewDelivery } from './screens/accountant/ReviewDelivery'
import { AdminDashboard } from './screens/admin/Dashboard'
import { AdminUsers } from './screens/admin/Users'
import { AdminProjects } from './screens/admin/Projects'
import { AdminDeliveries } from './screens/admin/Deliveries'

export default function App() {
  useAutoFlushOfflineQueue()

  return (
    <SessionProvider>
      <BrowserRouter>
        <PhoneShell>
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />

            <Route
              path="/supervisor"
              element={
                <RequireRole role="supervisor">
                  <SupervisorDashboard />
                </RequireRole>
              }
            />
            <Route
              path="/supervisor/projects/:projectId"
              element={
                <RequireRole role="supervisor">
                  <SupervisorProject />
                </RequireRole>
              }
            />
            <Route
              path="/supervisor/projects/:projectId/upload"
              element={
                <RequireRole role="supervisor">
                  <UploadOptions />
                </RequireRole>
              }
            />
            <Route
              path="/supervisor/projects/:projectId/details"
              element={
                <RequireRole role="supervisor">
                  <DeliveryDetails />
                </RequireRole>
              }
            />
            <Route
              path="/supervisor/projects/:projectId/success"
              element={
                <RequireRole role="supervisor">
                  <UploadSuccess />
                </RequireRole>
              }
            />

            <Route
              path="/accountant"
              element={
                <RequireRole role="accountant">
                  <AccountantDashboard />
                </RequireRole>
              }
            />
            <Route
              path="/accountant/projects/:projectId/gallery"
              element={
                <RequireRole role="accountant">
                  <ProjectGallery />
                </RequireRole>
              }
            />
            <Route
              path="/accountant/projects/:projectId/review/:deliveryId"
              element={
                <RequireRole role="accountant">
                  <ReviewDelivery />
                </RequireRole>
              }
            />

            <Route
              path="/admin"
              element={
                <RequireRole role="admin">
                  <AdminDashboard />
                </RequireRole>
              }
            />
            <Route
              path="/admin/users"
              element={
                <RequireRole role="admin">
                  <AdminUsers />
                </RequireRole>
              }
            />
            <Route
              path="/admin/projects"
              element={
                <RequireRole role="admin">
                  <AdminProjects />
                </RequireRole>
              }
            />
            <Route
              path="/admin/deliveries"
              element={
                <RequireRole role="admin">
                  <AdminDeliveries />
                </RequireRole>
              }
            />

            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </PhoneShell>
      </BrowserRouter>
    </SessionProvider>
  )
}
