import type { ComponentType, InputHTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { IconSearch } from './icons'

type Icon = ComponentType<{ size?: number; stroke?: string; strokeWidth?: number }>

export const btnPrimary =
  'inline-flex items-center justify-center gap-2 rounded-full bg-accent text-white font-bold shadow-[0_10px_24px_-12px_rgba(26,60,94,0.7)] disabled:opacity-60'
export const btnSecondary =
  'inline-flex items-center justify-center gap-2 rounded-full glass text-ink font-semibold disabled:opacity-60'

/** Frosted-glass card. */
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`glass rounded-card ${className}`}>{children}</div>
}

/** Big title row for a tab screen that doesn't use the greeting header. */
export function PageTitle({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-3 px-5 pt-7 pb-3">
      <div className="min-w-0">
        <div className="text-[24px] font-bold leading-tight">{title}</div>
        {subtitle && <div className="text-[12.5px] text-ink-muted mt-1">{subtitle}</div>}
      </div>
      {right}
    </div>
  )
}

export function SectionTitle({ title, to, linkLabel = 'See all' }: { title: string; to?: string; linkLabel?: string }) {
  return (
    <div className="flex items-center justify-between mb-2.5">
      <div className="text-[15px] font-bold">{title}</div>
      {to && (
        <Link to={to} className="text-[12px] font-semibold text-accent">
          {linkLabel}
        </Link>
      )}
    </div>
  )
}

export function StatTile({ value, label, icon: Icon, tint }: { value: ReactNode; label: string; icon: Icon; tint: string }) {
  return (
    <Card className="p-3">
      <div className="flex justify-end">
        <span className={`w-7 h-7 rounded-full flex items-center justify-center ring-1 ring-white/80 ${tint}`}>
          <Icon size={14} stroke="currentColor" strokeWidth={2.4} />
        </span>
      </div>
      <div className="text-[24px] font-bold leading-none mt-1">{value}</div>
      <div className="text-[11px] text-ink-muted mt-1.5 leading-tight">{label}</div>
    </Card>
  )
}

export interface TabOption<T extends string> {
  key: T
  label: string
  count?: number
  /** Tailwind classes for the dot shown before the label (status tabs). */
  dot?: string
}

/** Pill filter tabs: the active one is solid navy, the rest are frosted pills with a fine edge. */
export function FilterTabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: TabOption<T>[]
  value: T
  onChange: (key: T) => void
}) {
  return (
    <div className="flex gap-2 overflow-x-auto px-5 scroll-px-5 py-1 [scrollbar-width:none]">
      {tabs.map((tab) => {
        const active = tab.key === value
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            className={`flex-shrink-0 inline-flex items-center gap-1.5 rounded-full px-3.5 py-[7px] text-[12.5px] font-semibold transition-colors ${
              active
                ? 'bg-accent text-white shadow-[0_8px_18px_-10px_rgba(26,60,94,0.8)] ring-1 ring-accent'
                : 'glass text-ink-muted ring-1 ring-black/[0.04]'
            }`}
          >
            {tab.dot && <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-white' : tab.dot}`} />}
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={`min-w-[20px] rounded-full px-1.5 text-[11px] font-bold leading-[18px] text-center ${
                  active ? 'bg-white/20 text-white' : 'bg-white/80 text-ink'
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export function SearchField({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
}) {
  return (
    <label className="glass-strong rounded-full flex items-center gap-2.5 px-4 h-12">
      <IconSearch size={17} stroke="var(--color-ink-muted)" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-grow bg-transparent outline-none text-[14px] placeholder:text-ink-faint"
      />
      {value && (
        <button type="button" onClick={() => onChange('')} className="text-[12px] font-semibold text-ink-muted">
          Clear
        </button>
      )}
    </label>
  )
}

/** Labelled text input in the frosted pill style. */
export function Field({
  label,
  invalid = false,
  hint,
  ...input
}: { label: ReactNode; invalid?: boolean; hint?: ReactNode } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="text-[12px] font-semibold text-label mb-1.5 ml-3 flex items-center gap-1.5" htmlFor={input.id}>
        {label}
      </label>
      <input
        {...input}
        /* outline, not ring: the glass utility's box-shadow would cancel a ring */
        className={`w-full rounded-[16px] glass-strong px-4 py-3 text-[14.5px] text-ink placeholder:text-ink-faint outline-solid outline-0 outline-transparent focus:outline-2 focus:outline-accent/40 ${
          invalid ? 'outline-2 outline-warning-text/70' : ''
        }`}
      />
      {hint && <div className="text-[11.5px] text-ink-muted mt-1 ml-3">{hint}</div>}
    </div>
  )
}

export function EmptyState({ icon: Icon, title, body }: { icon: Icon; title: string; body?: ReactNode }) {
  return (
    <Card className="px-5 py-7 flex flex-col items-center text-center">
      <span className="w-12 h-12 rounded-full bg-white/70 ring-1 ring-white flex items-center justify-center">
        <Icon size={22} stroke="var(--color-ink-muted)" />
      </span>
      <div className="text-[14px] font-bold mt-3">{title}</div>
      {body && <div className="text-[12.5px] text-ink-muted mt-1 leading-relaxed max-w-[260px]">{body}</div>}
    </Card>
  )
}
