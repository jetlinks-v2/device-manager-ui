import { getToken } from '@jetlinks-web/utils'

export type ProgressStatePayload = {
  type?: 'progress' | 'log' | 'success' | 'error'
  message?: string
  data?: unknown
  extra?: unknown
}

type StreamOp = '_install' | '_upgrade'

function extractErrorMessage(payload: unknown): string | undefined {
  if (!payload) {
    return undefined
  }
  if (typeof payload === 'string') {
    const text = payload.trim()
    if (!text) {
      return undefined
    }
    try {
      return extractErrorMessage(JSON.parse(text)) || text
    } catch {
      return text
    }
  }
  if (typeof payload === 'object') {
    const data = payload as Record<string, any>
    return (
      data.message ||
      data.msg ||
      data.error_description ||
      data.error?.message ||
      data.result?.message ||
      data.data?.message
    )
  }
  return String(payload)
}

async function streamCapabilityProgress(
  capabilityId: string,
  version: string,
  configuration: Record<string, unknown>,
  onLine: (state: ProgressStatePayload) => void,
  op: StreamOp,
): Promise<void> {
  const base = (import.meta as any).env?.VITE_APP_BASE_API || '/api'
  const path = `${base.replace(/\/$/, '')}/marketplace/capabilities/${encodeURIComponent(capabilityId)}/${encodeURIComponent(version)}/${op}`
  let token = ''
  try {
    token = typeof getToken === 'function' ? getToken() : ''
  } catch {
    token = ''
  }
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/x-ndjson, application/json',
  }
  if (token) {
    headers['X-Access-Token'] = token
  }

  const res = await fetch(path, {
    method: 'POST',
    headers,
    body: JSON.stringify(configuration ?? {}),
    credentials: 'include',
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(extractErrorMessage(text) || `HTTP ${res.status}`)
  }

  const reader = res.body?.getReader()
  if (!reader) {
    const text = await res.text()
    if (text?.trim()) {
      for (const line of text.split('\n')) {
        if (!line.trim()) continue
        try {
          onLine(JSON.parse(line))
        } catch {
          /* ignore */
        }
      }
    }
    return
  }

  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.trim()) continue
      try {
        onLine(JSON.parse(line))
      } catch {
        /* ignore bad line */
      }
    }
  }
  if (buffer.trim()) {
    try {
      onLine(JSON.parse(buffer))
    } catch {
      /* ignore */
    }
  }
}

/**
 * POST /marketplace/capabilities/{id}/{version}/_install
 * 响应为 NDJSON（每行一个 ProgressState JSON）。
 */
export async function streamCapabilityInstall(
  capabilityId: string,
  version: string,
  configuration: Record<string, unknown>,
  onLine: (state: ProgressStatePayload) => void,
): Promise<void> {
  return streamCapabilityProgress(capabilityId, version, configuration, onLine, '_install')
}

/**
 * POST /marketplace/capabilities/{id}/{version}/_upgrade
 * 响应为 NDJSON（每行一个 ProgressState JSON）。
 */
export async function streamCapabilityUpgrade(
  capabilityId: string,
  version: string,
  configuration: Record<string, unknown>,
  onLine: (state: ProgressStatePayload) => void,
): Promise<void> {
  return streamCapabilityProgress(capabilityId, version, configuration, onLine, '_upgrade')
}
