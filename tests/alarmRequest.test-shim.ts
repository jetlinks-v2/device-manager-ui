type Handler = (url: string, body: Record<string, unknown>) => Promise<unknown>
let handler: Handler = async () => { throw new Error('Unexpected request') }
export const setAlarmRequestHandler = (next: Handler) => { handler = next }
export const request = {
  get: (url: string) => handler(url, { method: 'GET' }),
  post: (url: string, body: Record<string, unknown>) => handler(url, body),
  put: (url: string, body: Record<string, unknown>) => handler(url, { method: 'PUT', ...body }),
  remove: (url: string) => handler(url, { method: 'DELETE' }),
}
export default { global: { t: (key: string) => key, locale: { value: 'zh' } } }

export const randomString = () => 'test-id'
export const restoreDeviceLibraryAlarms_api = async () => { throw new Error('Unexpected library restore') }
