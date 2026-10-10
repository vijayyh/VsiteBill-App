import { StyleSheet, View } from 'react-native'
import { changeLabel, changeValue } from '../lib/bill'
import { formatDateTime } from '../lib/format'
import type { Role } from '../lib/session'
import { colors, glass, ring } from '../lib/theme'
import type { BillChange, BillHistoryEntry } from '../lib/types'
import { SectionLabel } from './BillParts'
import { IconBill, IconCamera, IconPencil } from './icons'
import { T } from './T'

// Same as the web app's bill history (frontend/src/components/BillHistory.tsx).

const ROLE_LABEL: Record<Role, string> = { supervisor: 'Supervisor', accountant: 'Office', admin: 'Admin' }

function count(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`
}

function summary(entry: BillHistoryEntry) {
  const n = entry.changes.length
  if (entry.action === 'edited') return `Changed ${count(n, 'value', 'values')}`
  if (!entry.fromReading) return 'Sent · typed in by hand'
  if (n === 0) return 'Sent · kept everything as the photo read it'
  return `Sent · changed ${count(n, 'value', 'values')} from what the photo read`
}

function ChangeLine({ change }: { change: BillChange }) {
  const label = changeLabel(change.field)
  const from = changeValue(change.field, change.from)
  const to = changeValue(change.field, change.to)
  const wholeRow = /^items\.\d+$/.test(change.field)
  const added = change.from === null
  return (
    <View style={styles.change}>
      <T size={10.5} weight={600} color={colors.label}>
        {wholeRow ? `${label} ${added ? 'added' : 'removed'}` : label}
      </T>
      {wholeRow ? (
        <T size={12} lh={1.375} weight={added ? 600 : 400} color={added ? colors.ink : colors.inkMuted} style={!added && styles.struck}>
          {added ? to : from}
        </T>
      ) : (
        <T size={12} lh={1.375}>
          <T size={12} color={colors.inkMuted} style={styles.struck}>
            {from}
          </T>
          <T size={12} color={colors.inkFaint}>
            {'  →  '}
          </T>
          <T size={12} weight={600}>
            {to}
          </T>
        </T>
      )}
    </View>
  )
}

/**
 * Who sent the bill and every save since, newest first, with each value from → to: what the
 * supervisor changed from the photo reading, and what the office changed after. For the office
 * and admins (the API doesn't show it to supervisors).
 */
export function BillHistory({ history }: { history: BillHistoryEntry[] | undefined }) {
  return (
    <View>
      <SectionLabel
        title="History"
        right={
          <T size={12} color={colors.inkMuted}>
            Who changed what
          </T>
        }
      />
      <View style={[glass, styles.card]}>
        {history === undefined ? (
          <T size={12.5} color={colors.inkMuted}>
            Loading…
          </T>
        ) : null}
        {history?.length === 0 ? (
          <T size={12.5} lh={1.625} color={colors.inkMuted}>
            Nothing recorded: this bill was sent before changes were tracked.
          </T>
        ) : null}
        {history?.map((entry) => {
          const Icon = entry.action === 'edited' ? IconPencil : entry.fromReading ? IconCamera : IconBill
          return (
            <View key={entry.id} style={{ flexDirection: 'row', gap: 10 }}>
              <View style={styles.icon}>
                <Icon size={13} stroke={colors.accent} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={styles.entryTop}>
                  <T size={13} weight={700} numberOfLines={1} style={{ flexShrink: 1 }}>
                    {entry.by.name}
                    <T size={13} weight={600} color={colors.inkMuted}>
                      {` · ${ROLE_LABEL[entry.by.role]}`}
                    </T>
                  </T>
                  <T size={11} color={colors.inkFaint}>
                    {formatDateTime(entry.at)}
                  </T>
                </View>
                <T size={12} color={colors.inkMuted} style={{ marginTop: 1 }}>
                  {summary(entry)}
                </T>
                {entry.changes.length > 0 ? (
                  <View style={{ marginTop: 8, gap: 6 }}>
                    {entry.changes.map((change, i) => (
                      <ChangeLine key={i} change={change} />
                    ))}
                  </View>
                ) : null}
              </View>
            </View>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, padding: 12, gap: 14 },
  icon: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.infoBg, alignItems: 'center', justifyContent: 'center' },
  entryTop: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  change: {
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.6)',
    ...ring(1, colors.white),
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  struck: { textDecorationLine: 'line-through' },
})
