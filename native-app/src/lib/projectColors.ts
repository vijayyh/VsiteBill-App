import type { ProjectAccent } from './types'

/** Gradient for each project colour (cards and the project hero), as on the web (`bg-gradient-to-br`). */
export const GRADIENT: Record<ProjectAccent, string> = {
  accent: 'linear-gradient(to bottom right, #1a3c5e, #2f5f8a)',
  forest: 'linear-gradient(to bottom right, #2b5d3e, #3f7d57)',
  clay: 'linear-gradient(to bottom right, #8a5300, #b06d12)',
}

/** Solid project colour (admin project list swatches). */
export const ACCENT_COLOR: Record<ProjectAccent, string> = {
  accent: '#1a3c5e',
  forest: '#2b5d3e',
  clay: '#8a5300',
}
