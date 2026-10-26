import type { LogFile } from '@jetlinks-web-core/components/RuntimeDiagnostics'
import { logChildren } from '../../../api/link/diagnostics'

export { logFileKey } from './logFilePresentation'
interface LatestLogSelection { file: LogFile; siblings: LogFile[]; parents: LogFile[] }

/** 目录优先；合法修改时间倒序；同名按自然名称稳定排序，不改变服务端文件身份。 */
export function sortLogCatalog(files: readonly LogFile[]) {
  const modified = (file: LogFile) => Number.isFinite(file.lastModified) && file.lastModified! > 0 ? file.lastModified! : -Infinity
  return files.slice().sort((left, right) => Number(!!right.directory) - Number(!!left.directory)
    || modified(right) - modified(left)
    || left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: 'base' }))
}

/** 只发现普通目录，不展开归档；current 优先，再以真实修改时间选最新文件。 */
export async function latestLogFile(node: string, roots: LogFile[], signal: AbortSignal): Promise<LatestLogSelection | undefined> {
  const candidates: LatestLogSelection[] = []
  const pending = [{ files: roots, parents: [] as LogFile[] }]
  let visited = 0
  while (pending.length && visited < 12 && !signal.aborted) {
    const branch = pending.shift()!
    for (const file of branch.files) {
      if (!file.directory && file.operations?.includes('readWindow') && !file.compressed && !/\.(zip|gz)$/i.test(file.name)) candidates.push({ file, siblings: branch.files, parents: branch.parents })
      else if (file.directory && branch.parents.length < 3 && visited++ < 12) {
        try {
          const children = await logChildren(node, file, signal)
          if (!signal.aborted) pending.push({ files: children, parents: [...branch.parents, file] })
        } catch (error) {
          // 根目录已单独完成授权读取。自动发现只跳过失败分支；手动进入该目录仍呈现原始错误。
          if (signal.aborted || (error as { name?: string })?.name === 'AbortError') throw error
        }
      }
    }
  }
  return candidates.sort((a, b) => Number(b.file.current === true) - Number(a.file.current === true) || (b.file.lastModified ?? 0) - (a.file.lastModified ?? 0))[0]
}
