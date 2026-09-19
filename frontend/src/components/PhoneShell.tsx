import type { ReactNode } from 'react'

/**
 * Centers the app in a phone-width column on wide viewports (desktop dev/testing)
 * and goes edge-to-edge below that width, matching how it will actually run on a phone.
 */
export function PhoneShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen w-full bg-ink flex justify-center">
      <div className="w-full max-w-[430px] min-h-screen bg-bg sm:shadow-[0_0_0_1px_var(--color-border),0_24px_48px_-24px_rgba(20,24,26,0.4)] sm:my-6 sm:min-h-[calc(100vh-48px)] sm:rounded-[28px] overflow-hidden flex flex-col">
        {children}
      </div>
    </div>
  )
}
