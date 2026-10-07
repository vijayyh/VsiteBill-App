import { router, type Href } from 'expo-router'
import type { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import { formatDateTime, formatQty } from '../lib/format'
import { STATUS_META } from '../lib/status'
import { colors, fonts, glass, radii, ring } from '../lib/theme'
import type { AdminDelivery, DeliveryStatus } from '../lib/types'
import { AuthImage } from './AuthImage'
import { IconCloud } from './icons'
import { T } from './T'
import { Tap } from './ui'

// Native versions of StatusBadge, BillSummary and BillRow from the web app.

export function StatusBadge({ status }: { status: DeliveryStatus }) {
  const meta = STATUS_META[status]
  return (
    <View style={[styles.badge, { backgroundColor: meta.bg }]}>
      <View style={[styles.badgeDot, { backgroundColor: meta.dot }]} />
      <T size={11} weight={700} color={meta.text} numberOfLines={1}>
        {meta.label}
      </T>
    </View>
  )
}

function Stat({ label, value, warn = false, grow = false }: { label: string; value: string; warn?: boolean; grow?: boolean }) {
  return (
    <View style={{ flex: 1, minWidth: 0, flexGrow: grow ? 1 : 1 }}>
      <T size={10} weight={600} color={colors.inkFaint} style={styles.statLabel}>
        {label}
      </T>
      <T size={13} weight={700} color={warn ? colors.warningText : colors.ink} numberOfLines={1}>
        {value}
      </T>
    </View>
  )
}

/** The text body of a bill card: vendor/item, a badge, quantities, PO, note and a footer line. */
export function BillSummary({
  vendor,
  item,
  badge,
  delivered,
  ordered,
  poNumber,
  note,
  byline,
  timestamp,
  inDrive = false,
}: {
  vendor: string
  item: string
  badge: ReactNode
  delivered: number | null
  ordered?: number | null
  poNumber: string | null
  note?: string | null
  byline?: string | null
  timestamp: string
  inDrive?: boolean
}) {
  const mismatch = ordered != null && delivered != null && ordered !== delivered
  return (
    <View>
      <View style={styles.summaryTop}>
        <View style={{ flexShrink: 1, minWidth: 0 }}>
          <T size={14} weight={700} numberOfLines={1}>
            {vendor || 'Vendor not entered'}
          </T>
          <T size={12} color={colors.inkMuted} numberOfLines={1} style={{ marginTop: 1 }}>
            {item || 'No item description'}
          </T>
        </View>
        {badge}
      </View>

      <View style={styles.stats}>
        <Stat label="Delivered" value={formatQty(delivered)} warn={mismatch} />
        {ordered !== undefined ? <Stat label="Ordered" value={formatQty(ordered)} /> : null}
        <Stat label="PO no." value={poNumber || '—'} />
      </View>

      {note ? (
        <T size={11.5} color={colors.inkMuted} numberOfLines={2} style={styles.note}>
          “{note}”
        </T>
      ) : null}

      <View style={styles.footer}>
        <T size={11} color={colors.inkFaint} numberOfLines={1} style={{ flexShrink: 1 }}>
          {byline ? `${byline} · ` : ''}
          {formatDateTime(timestamp)}
        </T>
        {inDrive ? (
          <View style={styles.inDrive}>
            <IconCloud size={12} stroke={colors.successText} />
            <T size={11} weight={600} color={colors.successText}>
              In Drive
            </T>
          </View>
        ) : null}
      </View>
    </View>
  )
}

/** Compact glass row for a bill in cross-project lists. */
export function BillRow({
  bill,
  to,
  showThumb = false,
  showUploader = false,
}: {
  bill: AdminDelivery
  to: Href
  showThumb?: boolean
  showUploader?: boolean
}) {
  const mismatch = bill.ordered != null && bill.delivered != null && bill.ordered !== bill.delivered
  return (
    <Tap onPress={() => router.push(to)} style={[glass, styles.row]}>
      {showThumb ? (
        <View style={styles.rowThumb}>{bill.photoUrl ? <AuthImage src={bill.photoUrl} /> : null}</View>
      ) : null}
      <View style={{ flex: 1, minWidth: 0, paddingLeft: showThumb ? 0 : 4 }}>
        <T size={13.5} weight={700} numberOfLines={1}>
          {bill.vendor || 'Vendor not entered'}
        </T>
        <T size={11.5} color={colors.inkMuted} numberOfLines={1} style={{ marginTop: 1 }}>
          {bill.project.code} · {bill.item || 'No item description'}
        </T>
        <View style={styles.rowMeta}>
          <T size={11} color={colors.inkFaint} numberOfLines={1} style={{ flexShrink: 1 }}>
            {showUploader && bill.uploadedBy ? `${bill.uploadedBy} · ` : ''}
            {formatDateTime(bill.uploadedAt)}
          </T>
          {bill.driveFileId ? <IconCloud size={11} stroke={colors.successText} /> : null}
        </View>
      </View>
      <View style={styles.rowRight}>
        <StatusBadge status={bill.status} />
        <T size={11} weight={600} color={mismatch ? colors.warningText : colors.inkMuted}>
          Qty {formatQty(bill.delivered)}
          {bill.ordered != null ? ` / ${formatQty(bill.ordered)}` : ''}
        </T>
      </View>
    </Tap>
  )
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radii.full,
    paddingLeft: 8,
    paddingRight: 10,
    paddingVertical: 3,
    flexShrink: 0,
  },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  summaryTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  stats: { flexDirection: 'row', gap: 8, marginTop: 10 },
  statLabel: { textTransform: 'uppercase', letterSpacing: 0.25 },
  note: { fontFamily: fonts.italic, marginTop: 8 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.8)',
  },
  inDrive: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, paddingRight: 14, borderRadius: radii.card },
  rowThumb: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: colors.cameraBg,
    overflow: 'hidden',
    ...ring(1, 'rgba(255,255,255,0.7)'),
  },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  rowRight: { alignItems: 'flex-end', gap: 4, flexShrink: 0 },
})
