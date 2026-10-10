import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker'
import { useState, type ReactNode } from 'react'
import { Platform, StyleSheet, TextInput, View, type StyleProp, type TextInputProps, type TextStyle, type ViewStyle } from 'react-native'
import {
  AMOUNT_FIELDS,
  amountsCheck,
  changedKeys,
  emptyRow,
  formatMoney,
  isEmptyRow,
  numberOnly,
  rowWasEdited,
  sharedUnit,
  totalQuantity,
  type AmountKey,
  type Amounts,
  type ItemRow,
  type Mark,
  type RowKey,
} from '../lib/bill'
import { formatQty } from '../lib/format'
import { colors, fonts, glass, glassStrong, radii, ring } from '../lib/theme'
import { IconAlertTriangle, IconCalendar, IconCamera, IconCheck, IconClose, IconPencil, IconPlus } from './icons'
import { T } from './T'
import { Tap } from './ui'

// Native versions of the web app's bill parts (frontend/src/components/BillParts.tsx).

/** The mark beside a value's label (it doesn't change the label's height). */
export function ReadMark({ mark }: { mark?: Mark }) {
  if (mark === 'edited') {
    return (
      <View style={[st.chip, { backgroundColor: colors.infoBg }]} accessibilityLabel="Edited">
        <IconPencil size={9} stroke={colors.accent} strokeWidth={2.6} />
        <T size={9.5} weight={700} lh={1.2} color={colors.accent}>
          EDITED
        </T>
      </View>
    )
  }
  if (mark === 'check') {
    return (
      <View style={[st.chip, { backgroundColor: colors.warningBg }]} accessibilityLabel="Unclear on the photo">
        <T size={9.5} weight={700} lh={1.2} color={colors.warningText}>
          CHECK
        </T>
      </View>
    )
  }
  if (mark === 'read') {
    return (
      <View style={st.readMark} accessibilityLabel="Filled in from the photo">
        <IconCamera size={11} stroke={colors.accent} />
      </View>
    )
  }
  return null
}

/** A field's label with its mark after it. */
export function MarkedLabel({ label, mark }: { label: string; mark?: Mark }) {
  return (
    <>
      <T size={12} weight={600} color={colors.label}>
        {label}
      </T>
      <ReadMark mark={mark} />
    </>
  )
}

/** Small caps heading over a group of fields, with an optional note at its right. */
export function SectionLabel({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <View style={st.sectionLabel}>
      <T size={12} weight={700} color={colors.inkMuted} style={st.sectionTitle}>
        {title}
      </T>
      {right}
    </View>
  )
}

/** Shown under a number box when something other than a number was typed (and dropped). */
export function NumbersOnly({ style }: { style?: StyleProp<TextStyle> }) {
  return (
    <T size={11} weight={600} color={colors.warningText} style={[{ marginTop: 4 }, style]} accessibilityRole="alert">
      Numbers only
    </T>
  )
}

/**
 * A frosted box with a text input, outlined while focused or when something is wrong. With
 * `numeric`, anything that isn't a digit or the one decimal point is dropped as it's typed or
 * pasted, with "Numbers only" under the box when that happens.
 */
function BoxInput({
  value,
  onChangeText,
  numeric = false,
  invalid = false,
  frameStyle,
  inputStyle,
  hintStyle,
  ...input
}: Omit<TextInputProps, 'value' | 'onChangeText' | 'style'> & {
  value: string
  onChangeText: (value: string) => void
  numeric?: boolean
  invalid?: boolean
  frameStyle?: StyleProp<ViewStyle>
  inputStyle?: StyleProp<TextStyle>
  hintStyle?: StyleProp<TextStyle>
}) {
  const [focused, setFocused] = useState(false)
  const [rejected, setRejected] = useState(false)
  return (
    <>
      {/* The outline is drawn by a wrapper: changing it on the TextInput itself makes Android drop its padding. */}
      <View style={[glassStrong, st.boxFrame, rejected || (!focused && invalid) ? st.invalid : focused ? st.focused : null, frameStyle]}>
        <TextInput
          {...input}
          value={value}
          keyboardType={numeric ? 'decimal-pad' : input.keyboardType}
          onChangeText={(text) => {
            if (!numeric) return onChangeText(text)
            const typed = numberOnly(text)
            setRejected(typed.rejected)
            onChangeText(typed.value)
          }}
          onFocus={(e) => {
            setFocused(true)
            input.onFocus?.(e)
          }}
          onBlur={(e) => {
            setFocused(false)
            setRejected(false)
            input.onBlur?.(e)
          }}
          placeholderTextColor={colors.inkFaint}
          underlineColorAndroid="transparent"
          style={[st.boxInput, inputStyle]}
        />
      </View>
      {rejected ? <NumbersOnly style={hintStyle} /> : null}
    </>
  )
}

/** The web's Field for a number: label above, numbers-only box below. */
export function NumberField({
  label,
  value,
  onChange,
  invalid,
  style,
  placeholder,
}: {
  label: ReactNode
  value: string
  onChange: (value: string) => void
  invalid?: boolean
  style?: StyleProp<ViewStyle>
  placeholder?: string
}) {
  return (
    <View style={style}>
      <View style={st.fieldLabel}>{label}</View>
      <BoxInput
        numeric
        value={value}
        onChangeText={onChange}
        invalid={invalid}
        placeholder={placeholder}
        frameStyle={{ borderRadius: 16 }}
        inputStyle={st.fieldInput}
        hintStyle={{ marginLeft: 12 }}
      />
    </View>
  )
}

function isoDate(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/**
 * The web's date field (`<input type="date">`): shows the date as dd-mm-yyyy and opens the phone's
 * own date picker. The value is YYYY-MM-DD, as the API takes it.
 */
export function DateField({
  label,
  value,
  onChange,
  invalid = false,
  style,
}: {
  label: ReactNode
  value: string
  onChange: (value: string) => void
  invalid?: boolean
  style?: StyleProp<ViewStyle>
}) {
  const [iosOpen, setIosOpen] = useState(false)
  const date = value ? new Date(`${value}T00:00:00`) : new Date()
  const shown = value ? value.split('-').reverse().join('-') : ''

  function pick() {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({ value: date, mode: 'date', onValueChange: (_, picked) => onChange(isoDate(picked)) })
    } else {
      setIosOpen((open) => !open)
    }
  }

  return (
    <View style={style}>
      <View style={st.fieldLabel}>{typeof label === 'string' ? <T size={12} weight={600} color={colors.label}>{label}</T> : label}</View>
      <Tap onPress={pick} accessibilityRole="button" accessibilityLabel={`Bill date${shown ? `, ${shown}` : ''}`} style={[glassStrong, st.boxFrame, st.dateBox, invalid && st.invalid, { borderRadius: 16 }]}>
        <T size={14.5} lh={1.5} color={shown ? colors.ink : colors.inkFaint} style={{ flex: 1 }}>
          {shown || 'dd-mm-yyyy'}
        </T>
        <IconCalendar size={16} stroke={colors.ink} />
      </Tap>
      {iosOpen ? (
        <DateTimePicker value={date} mode="date" display="inline" onValueChange={(_, picked) => onChange(isoDate(picked))} />
      ) : null}
    </View>
  )
}

function SmallField({
  label,
  value,
  onChange,
  numeric = false,
  mark,
  invalid = false,
  placeholder,
  accessibilityLabel,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  numeric?: boolean
  mark?: Mark
  invalid?: boolean
  placeholder: string
  accessibilityLabel: string
}) {
  return (
    <View style={{ flex: 1, minWidth: 0 }}>
      <View style={st.smallLabel}>
        <T size={11} weight={600} color={colors.label}>
          {label}
        </T>
        <ReadMark mark={mark} />
      </View>
      <BoxInput
        numeric={numeric}
        value={value}
        onChangeText={onChange}
        invalid={invalid}
        placeholder={placeholder}
        accessibilityLabel={accessibilityLabel}
        hintStyle={{ marginLeft: 8 }}
      />
    </View>
  )
}

const ITEM_FIELDS: { key: Exclude<RowKey, 'description'>; label: string; placeholder: string; numeric: boolean }[] = [
  { key: 'quantity', label: 'Quantity', placeholder: 'e.g. 480', numeric: true },
  { key: 'unit', label: 'Unit', placeholder: 'e.g. Bags', numeric: false },
  { key: 'rate', label: 'Rate (₹)', placeholder: 'If printed', numeric: true },
  { key: 'amount', label: 'Amount (₹)', placeholder: 'If printed', numeric: true },
]

/**
 * The goods on a bill, one card per item: a single-item bill has one, a multi-item bill one per
 * line of its table. Rows can be added and removed; the quantities add up to "delivered". A value
 * changed from where its row started (the photo reading, or what was saved), or by an earlier
 * save (`editedFields`, from the bill's history), is marked EDITED.
 */
export function ItemsEditor({
  rows,
  onChange,
  showErrors = false,
  flagged = false,
  editedFields,
}: {
  rows: ItemRow[]
  onChange: (rows: ItemRow[]) => void
  showErrors?: boolean
  /** The office was asked to double-check the quantities. */
  flagged?: boolean
  editedFields?: Set<string>
}) {
  const total = totalQuantity(rows)
  const unit = sharedUnit(rows)
  const nothingYet = rows.every(isEmptyRow)

  function edit(index: number, key: RowKey, value: string) {
    onChange(rows.map((row, i) => (i === index ? { ...row, [key]: value } : row)))
  }

  return (
    <View>
      <SectionLabel
        title={rows.length > 1 ? `Items · ${rows.length}` : 'Item'}
        right={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {flagged ? (
              <View style={st.doubleCheck}>
                <T size={9} weight={700} color={colors.warningText}>
                  DOUBLE-CHECK
                </T>
              </View>
            ) : null}
            {total !== null ? (
              <T size={12} color={colors.inkMuted}>
                Total qty{' '}
                <T size={12} weight={700}>
                  {formatQty(total)}
                </T>
                {unit ? ` ${unit}` : ''}
              </T>
            ) : null}
          </View>
        }
      />
      <View style={{ gap: 10 }}>
        {rows.map((row, index) => {
          const filled = !isEmptyRow(row) || (nothingYet && index === 0)
          const n = index + 1
          const changed = changedKeys(row)
          const fieldMark = (key: RowKey): Mark | undefined =>
            changed.has(key) || editedFields?.has(`items.${n}.${key}`) ? 'edited' : undefined
          const rowMark: Mark | undefined =
            changed.size > 0 || (editedFields && rowWasEdited(editedFields, n)) ? 'edited' : row.mark
          return (
            <View key={index} style={[glass, st.itemCard, rowMark === 'check' && ring(1, colors.warningBorder)]}>
              <View style={st.itemHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 4 }}>
                  <T size={12} weight={700} color={colors.label}>
                    {rows.length > 1 ? `Item ${n}` : 'Description'}
                  </T>
                  <ReadMark mark={rowMark} />
                </View>
                {rows.length > 1 ? (
                  <Tap onPress={() => onChange(rows.filter((_, i) => i !== index))} accessibilityLabel={`Remove item ${n}`} hitSlop={6} style={st.remove}>
                    <IconClose size={13} stroke={colors.inkMuted} strokeWidth={2.4} />
                  </Tap>
                ) : null}
              </View>
              <BoxInput
                multiline
                accessibilityLabel={`Item ${n} description`}
                placeholder="e.g. OPC 53 Grade Cement, 50kg bags"
                value={row.description}
                onChangeText={(value) => edit(index, 'description', value)}
                invalid={showErrors && filled && !row.description.trim()}
                inputStyle={st.description}
              />
              <View style={st.grid}>
                {[ITEM_FIELDS.slice(0, 2), ITEM_FIELDS.slice(2)].map((pair, line) => (
                  <View key={line} style={{ flexDirection: 'row', gap: 8 }}>
                    {pair.map(({ key, label, placeholder, numeric }) => (
                      <SmallField
                        key={key}
                        label={label}
                        placeholder={placeholder}
                        numeric={numeric}
                        mark={fieldMark(key)}
                        invalid={key === 'quantity' && showErrors && filled && !row.quantity.trim()}
                        accessibilityLabel={`Item ${n} ${key}`}
                        value={row[key]}
                        onChange={(value) => edit(index, key, value)}
                      />
                    ))}
                  </View>
                ))}
              </View>
            </View>
          )
        })}
        <Tap onPress={() => onChange([...rows, emptyRow()])} style={st.addItem}>
          <IconPlus size={15} stroke={colors.accent} strokeWidth={2.6} />
          <T size={13} weight={700} color={colors.accent}>
            Add another item
          </T>
        </Tap>
      </View>
    </View>
  )
}

/**
 * The money a bill states, laid out like the foot of the bill: taxable amount, GST, total. All
 * optional (a challan has none), numbers only, with a check that they add up once filled in.
 */
export function AmountsCard({
  amounts,
  onChange,
  marks = {},
}: {
  amounts: Amounts
  onChange: (key: AmountKey, value: string) => void
  marks?: Partial<Record<AmountKey, Mark>>
}) {
  const check = amountsCheck(amounts)
  return (
    <View>
      <SectionLabel
        title="Amounts"
        right={
          <T size={12} color={colors.inkMuted}>
            If printed on the bill
          </T>
        }
      />
      <View style={[glass, st.amounts]}>
        {AMOUNT_FIELDS.map(({ key, label }) => {
          const total = key === 'totalAmount'
          return (
            <View key={key} style={[st.amountRow, total && st.totalRow]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 }}>
                <T size={13} weight={total ? 700 : 600} color={total ? colors.ink : colors.label} numberOfLines={1}>
                  {label}
                </T>
                <ReadMark mark={marks[key]} />
              </View>
              <View style={{ width: 124, flexShrink: 0 }}>
                <BoxInput
                  numeric
                  accessibilityLabel={label}
                  placeholder="—"
                  value={amounts[key]}
                  onChangeText={(value) => onChange(key, value)}
                  invalid={marks[key] === 'check'}
                  inputStyle={[st.amountInput, total && { fontFamily: fonts[700] }]}
                  hintStyle={{ textAlign: 'right', marginRight: 4 }}
                />
              </View>
            </View>
          )
        })}
        {check ? (
          <View style={[st.addsUp, { backgroundColor: check.addsUp ? colors.successBg : colors.warningBg }]}>
            {check.addsUp ? (
              <IconCheck size={13} stroke={colors.successText} strokeWidth={2.6} />
            ) : (
              <IconAlertTriangle size={13} stroke={colors.warningText} strokeWidth={2.4} />
            )}
            <T size={12} weight={600} color={check.addsUp ? colors.successText : colors.warningText} style={{ flexShrink: 1 }}>
              {check.addsUp
                ? 'Taxable amount + GST = total'
                : `Taxable amount + GST is ${formatMoney(Math.abs(check.difference))} ${check.difference > 0 ? 'less than' : 'more than'} the total`}
            </T>
          </View>
        ) : null}
      </View>
    </View>
  )
}

const st = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: radii.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginVertical: -3,
  },
  readMark: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.infoBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: -3,
  },
  sectionLabel: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8, marginBottom: 10, marginHorizontal: 4 },
  sectionTitle: { textTransform: 'uppercase', letterSpacing: 0.3 },
  fieldLabel: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6, marginLeft: 12 },
  fieldInput: { paddingHorizontal: 16, paddingVertical: 12, fontSize: 14.5 },
  smallLabel: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4, marginLeft: 8, minHeight: 16 },
  boxFrame: { borderRadius: 12 },
  boxInput: {
    backgroundColor: 'transparent',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: fonts[400],
    fontSize: 14,
    color: colors.ink,
  },
  focused: { outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'rgba(26, 60, 94, 0.4)' },
  invalid: { outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'rgba(138, 83, 0, 0.7)' },
  dateBox: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
  description: { lineHeight: 19, maxHeight: 180, textAlignVertical: 'top' },
  itemCard: { borderRadius: 18, padding: 12, gap: 10 },
  itemHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 24 },
  remove: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.7)',
    ...ring(1, 'rgba(0,0,0,0.05)'),
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: { gap: 8 },
  addItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 18,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(0,0,0,0.09)',
    paddingVertical: 12,
  },
  doubleCheck: { backgroundColor: colors.warningBg, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  amounts: { borderRadius: 18, paddingHorizontal: 12, paddingVertical: 6 },
  amountRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingVertical: 6 },
  totalRow: { borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.07)', marginTop: 4, paddingTop: 10 },
  amountInput: { textAlign: 'right' },
  addsUp: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: radii.full,
    marginTop: 6,
    marginBottom: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
})
