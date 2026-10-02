import type { DeliveryStatus } from './types'

// The API's REVIEW status is what the accountant's "Flag for follow-up" action
// sets, so it's shown to people as "Flagged".
export const STATUS_META: Record<
  DeliveryStatus,
  { label: string; text: string; bg: string; border: string; dot: string }
> = {
  PENDING: {
    label: 'Pending',
    text: 'text-info-text',
    bg: 'bg-info-bg',
    border: 'border-info-border',
    dot: 'bg-info-text',
  },
  REVIEW: {
    label: 'Flagged',
    text: 'text-warning-text',
    bg: 'bg-warning-bg',
    border: 'border-warning-border',
    dot: 'bg-warning-text',
  },
  MATCHED: {
    label: 'Matched',
    text: 'text-success-text',
    bg: 'bg-success-bg',
    border: 'border-success-border',
    dot: 'bg-success-text',
  },
}
