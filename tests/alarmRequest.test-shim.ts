type Handler = (url: string, body: Record<string, unknown>) => Promise<unknown>
let handler: Handler = async () => { throw new Error('Unexpected request') }
export const setAlarmRequestHandler = (next: Handler) => { handler = next }
export const request = {
  post: (url: string, body: Record<string, unknown>) => handler(url, body),
}
export default { global: { t: (key: string) => key } }

export const randomString = () => 'test-id'
