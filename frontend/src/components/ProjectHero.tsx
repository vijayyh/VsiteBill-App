import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Skyline } from './ProjectCard'
import { IconBack } from './icons'
import { GRADIENT } from '../lib/projectColors'
import type { ProjectAccent } from '../lib/types'

/** Count shown in the hero's frosted strip, e.g. "3 / Pending". */
export interface HeroStat {
  value: ReactNode
  label: string
}

/**
 * Colour header for a project's own screen: the project's colour and skyline, a back button,
 * the code and name, an optional action (e.g. a Drive link) and a strip of counts.
 */
export function ProjectHero({
  backTo,
  code,
  name,
  accent,
  action,
  stats,
}: {
  backTo: string
  code?: string
  name?: string
  accent?: ProjectAccent
  action?: ReactNode
  stats?: HeroStat[]
}) {
  return (
    <div className="flex-shrink-0 px-3 pt-3">
      <div
        className={`relative rounded-[24px] overflow-hidden bg-gradient-to-br ${GRADIENT[accent ?? 'accent']} text-white px-4 pt-3 pb-4 shadow-[0_18px_36px_-20px_rgba(26,60,94,0.9)]`}
      >
        <Skyline />
        <div className="relative flex items-center justify-between gap-2">
          <Link
            to={backTo}
            aria-label="Go back"
            className="w-10 h-10 rounded-full bg-white/20 ring-1 ring-white/40 backdrop-blur flex items-center justify-center"
          >
            <IconBack size={20} stroke="#FFFFFF" />
          </Link>
          {action}
        </div>

        <div className="relative mt-5 min-h-[52px]">
          <div className="text-[11.5px] font-semibold opacity-80 tracking-wide">{code}</div>
          <div className="text-[21px] font-bold leading-snug mt-0.5 pr-10 line-clamp-2">{name}</div>
        </div>

        {stats && stats.length > 0 && (
          <div className="relative mt-4 grid grid-flow-col auto-cols-fr rounded-[16px] bg-white/15 ring-1 ring-white/30 backdrop-blur divide-x divide-white/25">
            {stats.map((stat) => (
              <div key={stat.label} className="px-2 py-2 text-center">
                <div className="text-[17px] font-bold leading-none">{stat.value}</div>
                <div className="text-[10.5px] font-medium opacity-85 mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/** Small frosted pill for the hero's top-right corner. */
export const heroPill =
  'flex items-center gap-1 rounded-full bg-white/20 ring-1 ring-white/40 backdrop-blur text-white text-[12px] font-bold px-3 py-1.5'
