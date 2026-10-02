function sameDay(a: Date, b: Date) {
  return a.toDateString() === b.toDateString()
}

export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

/** "Today, 4:05 PM" / "Yesterday, 4:05 PM" / "2 Oct, 4:05 PM" / "2 Oct 2025, 4:05 PM" */
export function formatDateTime(iso: string) {
  const date = new Date(iso)
  const now = new Date()
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  const time = formatTime(iso)

  if (sameDay(date, now)) return `Today, ${time}`
  if (sameDay(date, yesterday)) return `Yesterday, ${time}`
  const day = date.toLocaleDateString([], {
    day: 'numeric',
    month: 'short',
    ...(date.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
  })
  return `${day}, ${time}`
}

export function formatQty(value: number | null) {
  return value == null ? '—' : value.toLocaleString()
}

export function greeting(date = new Date()) {
  const hour = date.getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}
