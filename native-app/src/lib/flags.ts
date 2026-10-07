import * as SecureStore from 'expo-secure-store'
import { useEffect, useState } from 'react'

// Small on-device flags (the web keeps these in localStorage).
export const WELCOME_SEEN_KEY = 'siteverify.welcomeSeen'

let welcomeSeen: boolean | null = null

export function markWelcomeSeen() {
  welcomeSeen = true
  void SecureStore.setItemAsync(WELCOME_SEEN_KEY, '1').catch(() => {})
}

/** null while loading, then whether the welcome screen has been seen on this phone. */
export function useWelcomeSeen() {
  const [seen, setSeen] = useState<boolean | null>(welcomeSeen)
  useEffect(() => {
    if (welcomeSeen !== null) return
    void SecureStore.getItemAsync(WELCOME_SEEN_KEY)
      .then((v) => {
        welcomeSeen = v === '1'
        setSeen(welcomeSeen)
      })
      .catch(() => setSeen(false))
  }, [])
  return seen
}
