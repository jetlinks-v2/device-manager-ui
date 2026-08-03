import dayjs from 'dayjs'

const MESSAGE_TREND_AXIS_FORMAT = 'HH:mm'
const MESSAGE_TREND_TOOLTIP_FORMAT = 'YYYY-MM-DD HH:mm:ss'

export function formatMessageTrendTimestamp(value?: number) {
  if (!value) return ''
  const date = dayjs(value)
  return date.isValid() ? date.format(MESSAGE_TREND_TOOLTIP_FORMAT) : ''
}

export function formatMessageTrendAxisLabel(value?: string) {
  const date = dayjs(value)
  return date.isValid() ? date.format(MESSAGE_TREND_AXIS_FORMAT) : ''
}
