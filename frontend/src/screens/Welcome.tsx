import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useSession } from '../lib/session'

export const WELCOME_SEEN_KEY = 'siteverify.welcomeSeen'

function markSeen() {
  try {
    localStorage.setItem(WELCOME_SEEN_KEY, '1')
  } catch {
    // private mode etc. — the welcome screen just shows again next time
  }
}

function hasSeen() {
  try {
    return localStorage.getItem(WELCOME_SEEN_KEY) === '1'
  } catch {
    return false
  }
}

/** Site skyline, tower crane and a checked bill — drawn here rather than using a stock photo. */
function SiteIllustration() {
  return (
    <svg viewBox="0 0 320 300" preserveAspectRatio="xMidYMax slice" className="w-full h-full" aria-hidden>
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2f5f8a" />
          <stop offset="1" stopColor="#1a3c5e" />
        </linearGradient>
      </defs>
      <rect width="320" height="300" fill="url(#sky)" />
      <circle cx="252" cy="62" r="26" fill="#ffffff" opacity="0.12" />
      {/* skyline */}
      <g fill="#ffffff" opacity="0.14">
        <rect x="18" y="150" width="40" height="150" />
        <rect x="64" y="118" width="46" height="182" />
        <rect x="116" y="170" width="34" height="130" />
        <rect x="226" y="134" width="44" height="166" />
        <rect x="274" y="176" width="34" height="124" />
      </g>
      {/* tower crane */}
      <g stroke="#ffffff" strokeWidth="3" opacity="0.55" fill="none" strokeLinecap="round">
        <path d="M196 300 V70" />
        <path d="M206 300 V70" />
        <path d="M196 90 L206 110 M206 110 L196 130 M196 130 L206 150 M206 150 L196 170 M196 170 L206 190" />
        <path d="M120 70 H300" />
        <path d="M201 70 L201 46 L120 70 M201 46 L300 70" />
        <path d="M268 70 V108" />
      </g>
      <rect x="258" y="108" width="20" height="14" rx="2" fill="#e0ab52" opacity="0.9" />
      {/* bill card */}
      <g transform="translate(58 150) rotate(-6)">
        <rect width="128" height="112" rx="14" fill="#ffffff" />
        <rect x="16" y="18" width="62" height="8" rx="4" fill="#1a3c5e" />
        <rect x="16" y="36" width="96" height="6" rx="3" fill="#d8dce3" />
        <rect x="16" y="50" width="80" height="6" rx="3" fill="#d8dce3" />
        <rect x="16" y="64" width="88" height="6" rx="3" fill="#d8dce3" />
        <rect x="16" y="84" width="44" height="10" rx="5" fill="#e8f2ec" />
      </g>
      <circle cx="184" cy="246" r="24" fill="#1f6b3a" stroke="#ffffff" strokeWidth="4" />
      <path d="M173 246 l8 8 l15 -16" stroke="#ffffff" strokeWidth="4.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** First-open screen. Returning visitors (or logged-in users) skip straight past it. */
export function Welcome() {
  const { user } = useSession()
  const navigate = useNavigate()

  if (user) return <Navigate to={`/${user.role}`} replace />
  if (hasSeen()) return <Navigate to="/login" replace />

  return (
    <div className="flex-grow flex flex-col px-4 pt-4 pb-6 text-ink">
      <div className="flex-grow flex flex-col rounded-[28px] overflow-hidden shadow-soft bg-[#1a3c5e]">
        <div className="flex-grow min-h-[260px]">
          <SiteIllustration />
        </div>
        <div className="px-6 pb-7 pt-5 text-white">
          <div className="text-[30px] font-bold leading-[1.1]">Every bill,<br />checked on site.</div>
          <div className="text-[14px] text-white/80 mt-3 leading-relaxed">
            Photograph delivery bills even without signal. The office matches them against purchase
            orders, and every bill is archived by project.
          </div>
        </div>
      </div>

      <button
        onClick={() => {
          markSeen()
          navigate('/login')
        }}
        className="mt-5 w-full py-4 rounded-full bg-ink text-white text-[15px] font-bold"
      >
        Get started
      </button>
      <div className="text-center text-[13px] text-ink-muted mt-3.5">
        Already have an account?{' '}
        <Link to="/login" onClick={markSeen} className="font-bold text-ink">
          Log in
        </Link>
      </div>
    </div>
  )
}
