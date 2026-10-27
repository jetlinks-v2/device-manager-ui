import type { LogFile } from '@jetlinks-web-core/components/RuntimeDiagnostics'

export const logFileKey = (file: LogFile) => JSON.stringify([file.providerId, file.id, file.entry ?? ''])

/** 目录元数据缺失时省略，不用零或破折号伪装为真实文件属性。 */
export function logFileMetadata(file: LogFile) {
  let size = ''
  if (!file.directory && typeof file.size === 'number' && Number.isFinite(file.size) && file.size >= 0) {
    const unit = file.size > 0 ? Math.max(0, Math.min(4, Math.floor(Math.log(file.size) / Math.log(1024)))) : 0
    size = `${unit ? (file.size / 1024 ** unit).toFixed(1) : file.size} ${['B', 'KB', 'MB', 'GB', 'TB'][unit]}`
  }
  const date = typeof file.lastModified === 'number' ? new Date(file.lastModified) : undefined
  const validDate = date && Number.isFinite(date.getTime())
  const modified = validDate ? `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}` : ''
  return { summary: [size, modified].filter(Boolean).join(' · '), modified: validDate ? date.toLocaleString() : '' }
}
