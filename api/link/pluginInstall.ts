import type { UploadProps } from 'ant-design-vue'
import type { Subscription } from 'rxjs'
import { createUploadCustomRequest } from '@jetlinks-web-core/components/Upload/utils'
import { postRuntimeNdJson } from '@jetlinks-web-core/utils/ndjson-precision'

type UploadOptions = Parameters<NonNullable<UploadProps['customRequest']>>[0]

export interface PluginPackageDescription {
  id: string
  name: string
  description?: string
  version: string
  type: string
  typeName: string
  others?: Record<string, unknown>
}

export interface PluginInstallProgress {
  name: string
  type?: 'STEP' | 'MEASURABLE'
  status: 'STARTED' | 'PROGRESS' | 'COMPLETED' | 'FAILED' | 'CANCELLED'
  message?: string
  errorMessage?: string
  measurable?: { current?: number | string; total?: number | string; unitValue?: string; unitText?: string }
  attributes?: { serverId?: string; serviceId?: string; applicable?: boolean; progressAvailable?: boolean;
    errorCode?: string; result?: PluginPackageDescription }
}

export interface PluginDriverUploadResult {
  id: string
  name: string
  description?: string
  version: string
  type: { id: string; name: string; value: string; text: string }
  accessUrl: string
  filename: string
  extension: string
  length: number | string
  md5: string
  sha256: string
  others?: Record<string, unknown>
}

interface StoredFile {
  id: string
  name: string
  accessUrl: string
  extension: string
  length: number | string
  md5: string
  sha256: string
}

const failure = (code: string, message = code) => Object.assign(new Error(message), { code })

/** Upload bytes first, then consume host check progress; cancellation owns both request stages. */
export function createPluginDriverUpload(onProgress: (event: PluginInstallProgress) => void = () => {}) {
  return (options: UploadOptions) => {
    let active = true
    let checking: Subscription | undefined
    const upload = createUploadCustomRequest({ idleTimeout: 60_000 })({
      ...options,
      onSuccess(response: { success?: boolean; result?: StoredFile; message?: string }) {
        if (!active) return
        const file = response?.result
        if (response?.success === false || !file?.accessUrl) {
          options.onError?.(failure('UPLOAD_RESPONSE', response?.message || 'UPLOAD_RESPONSE'))
          return
        }
        let result: PluginPackageDescription | undefined
        let lastError: Error | undefined
        onProgress({ name: 'plugin.check', status: 'STARTED' })
        checking = postRuntimeNdJson<PluginInstallProgress>('/plugin/driver/convert/_progress', {
          provider: 'jar', configuration: { location: file.accessUrl },
        }).subscribe({
          next(event) {
            if (!active) return
            onProgress(event)
            if (event.name === 'plugin.check' && event.status === 'COMPLETED' && event.attributes?.result)
              result = event.attributes.result
            if (event.status === 'FAILED') {
              const code = event.attributes?.errorCode
              if (!lastError || event.attributes?.serverId || (code && code !== 'error.unable_to_load_plugin_driver'))
                lastError = failure(code || 'CHECK_FAILED', event.errorMessage || event.message)
              if (!event.attributes?.serverId) result = undefined
            }
          },
          error(error: Error & { status?: number }) {
            if (active) options.onError?.(error.status === 401 || error.status === 403 ? error : lastError || error)
          },
          complete() {
            if (!active) return
            if (!result?.version || !result.type) {
              options.onError?.(lastError || failure('CHECK_STREAM_ENDED'))
              return
            }
            const value: PluginDriverUploadResult = { ...file, ...result, filename: file.name,
              type: { id: result.type, name: result.typeName, value: result.type, text: result.typeName } }
            options.onSuccess?.({ ...response, result: value })
          },
        })
      },
    })
    return { abort() { active = false; upload.abort(); checking?.unsubscribe() } }
  }
}
