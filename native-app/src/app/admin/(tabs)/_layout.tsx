import { RoleTabs } from '../../../components/RoleLayout'

// Alerts is a tab screen reached from the bell; it has no button in the admin's bar (as on the web).
export default function Layout() {
  return <RoleTabs role="admin" routes={['index', 'users', 'projects', 'deliveries', 'profile', 'alerts']} />
}
