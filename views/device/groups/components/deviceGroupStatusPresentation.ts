type CssColorResolver = (color: string) => string

const STATUS_PRESENTATION: Record<string, { icon: string, colors: [string, string] }> = {
  online: { icon: 'WifiOutlined', colors: ['var(--accent-soft)', 'var(--accent)'] },
  offline: { icon: 'DisconnectOutlined', colors: ['var(--bg-sunken)', 'var(--ink-5)'] },
  notActive: { icon: 'MinusCircleOutlined', colors: ['var(--warn-bg)', 'var(--warn)'] },
  'no-data': { icon: 'MinusCircleOutlined', colors: ['var(--warn-bg)', 'var(--warn)'] },
}
const FALLBACK_STATUS_PRESENTATION = { icon: 'AlertOutlined', colors: ['var(--err-bg)', 'var(--err)'] } as const

function statusPresentation(key: string) {
  return STATUS_PRESENTATION[key] || FALLBACK_STATUS_PRESENTATION
}

export function deviceGroupStatusIcon(key: string) {
  return statusPresentation(key).icon
}

export function deviceGroupStatusGradient(key: string, resolveColor: CssColorResolver) {
  const [soft, strong] = statusPresentation(key).colors.map(resolveColor)
  return {
    type: 'linear', x: 0, y: 1, x2: 1, y2: 0,
    colorStops: [{ offset: 0, color: soft }, { offset: 1, color: strong }],
  }
}
