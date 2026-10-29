import { useLocation, useNavigate } from 'react-router-dom'

/**
 * Goes back to the previous screen the way the phone's back button does (one step back in the
 * history), so the in-app back arrow and Android's back never disagree. Pushing `fallback`
 * instead (as the back links used to) added a new screen on top, so Android's back then returned
 * to the screen just left. With no earlier screen in the app (opened from a link, or the first
 * screen after a reload), it replaces this screen with `fallback`.
 */
export function useGoBack(fallback: string) {
  const navigate = useNavigate()
  const location = useLocation()
  return () => (location.key !== 'default' ? navigate(-1) : navigate(fallback, { replace: true }))
}
