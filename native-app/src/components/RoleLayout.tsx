import { Redirect, Stack, Tabs } from 'expo-router'
import { useSession, type Role } from '../lib/session'
import { BottomNav } from './BottomNav'
import { TabBackdrop } from './Frost'

/**
 * A role's section (/supervisor, /accountant, /admin): only that role may enter (the web's
 * RequireRole), and its screens slide in over the tab screens.
 */
export function RoleStack({ role }: { role: Role }) {
  const { user } = useSession()
  if (!user) return <Redirect href="/login" />
  if (user.role !== role) return <Redirect href={`/${user.role}`} />
  return <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />
}

/**
 * The role's tab screens with the custom bottom bar. "history" makes the Android back button step
 * back through the tabs you visited, like the browser's back button did.
 */
export function RoleTabs({ role, routes }: { role: Role; routes: string[] }) {
  return (
    <Tabs
      backBehavior="history"
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: 'transparent' }, animation: 'none' }}
      tabBar={(props) => <BottomNav {...props} role={role} />}
      // Each tab screen is the backdrop the frosted bottom bar blurs.
      screenLayout={({ children }) => <TabBackdrop>{children}</TabBackdrop>}
    >
      {routes.map((name) => (
        <Tabs.Screen key={name} name={name} />
      ))}
    </Tabs>
  )
}
