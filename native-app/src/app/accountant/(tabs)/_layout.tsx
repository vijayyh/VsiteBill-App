import { RoleTabs } from '../../../components/RoleLayout'

export default function Layout() {
  return <RoleTabs role="accountant" routes={['index', 'projects', 'review', 'alerts', 'profile']} />
}
