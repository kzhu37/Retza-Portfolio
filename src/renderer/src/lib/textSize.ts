import type { TextSize } from '../../../shared/contracts'

export type { TextSize } from '../../../shared/contracts'

export const FONT_SCALE = {
  normal: { msg: 18, ts: 12, heading: 24, sub: 12, hint: 13, input: 18, kbd: 12, badge: 9 },
  large:  { msg: 21, ts: 14, heading: 28, sub: 14, hint: 15, input: 21, kbd: 14, badge: 11 },
  xlarge: { msg: 26, ts: 17, heading: 34, sub: 17, hint: 18, input: 26, kbd: 17, badge: 14 },
} as const

export type FontSizes = typeof FONT_SCALE[TextSize]
