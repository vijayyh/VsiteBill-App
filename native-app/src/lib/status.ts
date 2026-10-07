import { colors } from './theme'
import type { DeliveryStatus } from './types'

// The API's REVIEW status is what the accountant's "Flag for follow-up" action
// sets, so it's shown to people as "Flagged". (Same as frontend/src/lib/status.ts.)
export const STATUS_META: Record<DeliveryStatus, { label: string; text: string; bg: string; border: string; dot: string }> = {
  PENDING: {
    label: 'Pending',
    text: colors.infoText,
    bg: colors.infoBg,
    border: colors.infoBorder,
    dot: colors.infoText,
  },
  REVIEW: {
    label: 'Flagged',
    text: colors.warningText,
    bg: colors.warningBg,
    border: colors.warningBorder,
    dot: colors.warningText,
  },
  MATCHED: {
    label: 'Matched',
    text: colors.successText,
    bg: colors.successBg,
    border: colors.successBorder,
    dot: colors.successText,
  },
}
