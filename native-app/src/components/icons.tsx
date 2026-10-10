import Svg, { Circle, Line, Path, Polyline, Rect } from 'react-native-svg'

// Same line icons as the web app (frontend/src/components/icons.tsx), drawn with react-native-svg.
// Unlike the web, colours must be real values: pass theme colours (e.g. colors.ink), not CSS variables.
export interface IconProps {
  size?: number
  stroke?: string
  strokeWidth?: number
}

function base({ size = 20, stroke = 'currentColor', strokeWidth = 2 }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke,
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }
}

export type Icon = (props: IconProps) => React.JSX.Element

export function IconShield(props: IconProps) {
  return (
    <Svg {...base(props)}>
      <Path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <Polyline points="22 4 12 14.01 9 11.01" />
    </Svg>
  )
}

export function IconTruck(props: IconProps) {
  return (
    <Svg {...base(props)}>
      <Path d="M3 21h18" />
      <Path d="M5 21V7l8-4v18" />
      <Path d="M19 21V11l-6-4" />
    </Svg>
  )
}

export function IconCamera(props: IconProps) {
  return (
    <Svg {...base(props)}>
      <Path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <Circle cx="12" cy="13" r="4" />
    </Svg>
  )
}

export function IconGallery(props: IconProps) {
  return (
    <Svg {...base(props)}>
      <Rect x="3" y="3" width="18" height="18" rx="2" />
      <Circle cx="8.5" cy="8.5" r="1.5" />
      <Polyline points="21 15 16 10 5 21" />
    </Svg>
  )
}

export function IconBack(props: IconProps) {
  return (
    <Svg {...base(props)}>
      <Line x1="19" y1="12" x2="5" y2="12" />
      <Polyline points="12 19 5 12 12 5" />
    </Svg>
  )
}

export function IconChevronRight(props: IconProps) {
  return (
    <Svg {...base(props)}>
      <Polyline points="9 18 15 12 9 6" />
    </Svg>
  )
}

export function IconClose(props: IconProps) {
  return (
    <Svg {...base(props)}>
      <Line x1="18" y1="6" x2="6" y2="18" />
      <Line x1="6" y1="6" x2="18" y2="18" />
    </Svg>
  )
}

export function IconCalendar(props: IconProps) {
  return (
    <Svg {...base(props)}>
      <Rect x="3" y="4" width="18" height="18" rx="2" />
      <Line x1="16" y1="2" x2="16" y2="6" />
      <Line x1="8" y1="2" x2="8" y2="6" />
      <Line x1="3" y1="10" x2="21" y2="10" />
    </Svg>
  )
}

export function IconPencil(props: IconProps) {
  return (
    <Svg {...base(props)}>
      <Path d="M12 20h9" />
      <Path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </Svg>
  )
}

export function IconPlus(props: IconProps) {
  return (
    <Svg {...base(props)}>
      <Line x1="12" y1="5" x2="12" y2="19" />
      <Line x1="5" y1="12" x2="19" y2="12" />
    </Svg>
  )
}

export function IconCheck(props: IconProps) {
  return (
    <Svg {...base(props)}>
      <Polyline points="20 6 9 17 4 12" />
    </Svg>
  )
}

export function IconAlertTriangle(props: IconProps) {
  return (
    <Svg {...base(props)}>
      <Path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <Line x1="12" y1="9" x2="12" y2="13" />
      <Line x1="12" y1="17" x2="12.01" y2="17" />
    </Svg>
  )
}

export function IconClock(props: IconProps) {
  return (
    <Svg {...base(props)}>
      <Circle cx="12" cy="12" r="10" />
      <Polyline points="12 6 12 12 16 14" />
    </Svg>
  )
}

export function IconHome(props: IconProps) {
  return (
    <Svg {...base(props)}>
      <Path d="M3 10.5 12 3l9 7.5" />
      <Path d="M5 9v12h14V9" />
      <Path d="M10 21v-6h4v6" />
    </Svg>
  )
}

export function IconBill(props: IconProps) {
  return (
    <Svg {...base(props)}>
      <Path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <Polyline points="14 2 14 8 20 8" />
      <Line x1="8" y1="13" x2="16" y2="13" />
      <Line x1="8" y1="17" x2="13" y2="17" />
    </Svg>
  )
}

export function IconBell(props: IconProps) {
  return (
    <Svg {...base(props)}>
      <Path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <Path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </Svg>
  )
}

export function IconUser(props: IconProps) {
  return (
    <Svg {...base(props)}>
      <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <Circle cx="12" cy="7" r="4" />
    </Svg>
  )
}

export function IconUsers(props: IconProps) {
  return (
    <Svg {...base(props)}>
      <Path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <Circle cx="9" cy="7" r="4" />
      <Path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <Path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </Svg>
  )
}

export function IconSearch(props: IconProps) {
  return (
    <Svg {...base(props)}>
      <Circle cx="11" cy="11" r="7" />
      <Line x1="20" y1="20" x2="16.2" y2="16.2" />
    </Svg>
  )
}

export function IconGrid(props: IconProps) {
  return (
    <Svg {...base(props)}>
      <Rect x="3" y="3" width="7" height="7" rx="1.5" />
      <Rect x="14" y="3" width="7" height="7" rx="1.5" />
      <Rect x="3" y="14" width="7" height="7" rx="1.5" />
      <Rect x="14" y="14" width="7" height="7" rx="1.5" />
    </Svg>
  )
}

export function IconFolder(props: IconProps) {
  return (
    <Svg {...base(props)}>
      <Path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </Svg>
  )
}

export function IconClipboardCheck(props: IconProps) {
  return (
    <Svg {...base(props)}>
      <Rect x="5" y="4" width="14" height="18" rx="2" />
      <Path d="M9 2h6v4H9z" />
      <Polyline points="9 14 11 16 15 12" />
    </Svg>
  )
}

export function IconLock(props: IconProps) {
  return (
    <Svg {...base(props)}>
      <Rect x="4" y="11" width="16" height="10" rx="2" />
      <Path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </Svg>
  )
}

export function IconLogOut(props: IconProps) {
  return (
    <Svg {...base(props)}>
      <Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <Polyline points="16 17 21 12 16 7" />
      <Line x1="21" y1="12" x2="9" y2="12" />
    </Svg>
  )
}

export function IconInfo(props: IconProps) {
  return (
    <Svg {...base(props)}>
      <Circle cx="12" cy="12" r="10" />
      <Line x1="12" y1="16" x2="12" y2="11" />
      <Line x1="12" y1="8" x2="12.01" y2="8" />
    </Svg>
  )
}

export function IconPhone(props: IconProps) {
  return (
    <Svg {...base(props)}>
      <Rect x="6" y="2" width="12" height="20" rx="2.5" />
      <Line x1="11" y1="18" x2="13" y2="18" />
    </Svg>
  )
}

export function IconCloud(props: IconProps) {
  return (
    <Svg {...base(props)}>
      <Path d="M17.5 19a4.5 4.5 0 0 0 0-9 6 6 0 0 0-11.4-2A5 5 0 0 0 6.5 19h11z" />
    </Svg>
  )
}
