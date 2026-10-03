import type { ReactNode } from 'react'
import { BellButton } from './AppHeader'
import { TabScreen } from './BottomNav'
import { PageTitle } from './ui'

/** Frame for the admin tabs: big title with the alerts bell, content, bottom nav. */
export function AdminShell({ title, subtitle = 'Admin', children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <TabScreen>
      <PageTitle title={title} subtitle={subtitle} right={<BellButton />} />
      <div className="px-5 flex flex-col">{children}</div>
    </TabScreen>
  )
}
