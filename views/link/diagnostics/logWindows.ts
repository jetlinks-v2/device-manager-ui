import type { LogWindow } from '../../../api/link/diagnostics'
import { normalizeLogs } from './normalize'

const MAX_LINES = 2500, MAX_TEXT = 4 * 1024 * 1024
export interface LogChunks { chunks: LogWindow[]; clipped: boolean }

/** 只合并服务端游标完全相邻的片段；相同日志文本可重复，绝不按内容去重或推算字节位置。 */
export function mergeLogWindows(previous: LogWindow[], next: LogWindow, direction?: 'backward' | 'forward'): LogChunks {
  let chunks = !previous.length || !direction ? [next] : direction === 'backward'
    ? next.endPosition === previous[0].startPosition ? [next, ...previous] : [next]
    : next.startPosition === previous.at(-1)!.endPosition ? [...previous, next] : [next]
  // EOF 的空回应仅更新继续位置，不能丢掉已有正文。
  if (previous.length && direction === 'forward' && !next.lines.length && next.startPosition === previous.at(-1)!.endPosition) {
    chunks = [...previous.slice(0, -1), { ...previous.at(-1)!, nextPosition: next.nextPosition }]
  }
  let lines = chunks.reduce((sum, chunk) => sum + chunk.lines.length, 0)
  let text = chunks.reduce((sum, chunk) => sum + chunk.lines.reduce((size, line) => size + line.length, 0), 0)
  let clipped = false
  while (chunks.length > 1 && (lines > MAX_LINES || text > MAX_TEXT)) {
    const removed = direction === 'backward' ? chunks.pop()! : chunks.shift()!
    lines -= removed.lines.length; text -= removed.lines.reduce((size, line) => size + line.length, 0); clipped = true
  }
  return { chunks, clipped }
}

export function joinedLogWindow(chunks: LogWindow[]): LogWindow | undefined {
  if (!chunks.length) return undefined
  const first = chunks[0], last = chunks.at(-1)!
  return { ...first, lines: chunks.flatMap(chunk => chunk.lines), endPosition: last.endPosition, nextPosition: last.nextPosition, truncated: chunks.some(chunk => chunk.truncated) }
}

/** 合并后再识别跨窗口异常栈；每条记录仍使用原片段的物理行身份，前插历史不会改变旧行 key。 */
export function entriesForLogWindows(chunks: LogWindow[]) {
  const keys = chunks.flatMap(chunk => chunk.lines.map((_, index) => `${chunk.startPosition}:${index}`))
  return normalizeLogs(chunks.flatMap(chunk => chunk.lines)).map(entry => ({ ...entry, id: keys[Number(entry.id.split(':')[1])] ?? entry.id }))
}
