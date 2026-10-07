import { RoleTabs } from '../../../components/RoleLayout'

export default function Layout() {
  return <RoleTabs role="supervisor" routes={['index', 'bills', 'add', 'alerts', 'profile']} />
}
