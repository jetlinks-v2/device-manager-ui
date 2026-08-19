type SpaceAreaError = {
  message?: unknown
  data?: { message?: unknown }
  response?: { data?: { message?: unknown } }
}

export function resolveSpaceAreaError(error: unknown): string | undefined {
  const source = error && typeof error === 'object' ? error as SpaceAreaError : {}
  const candidates = [source.response?.data?.message, source.data?.message, source.message]
  const message = candidates.find((item): item is string => typeof item === 'string' && item.trim())?.trim()

  return message && !/^Request failed with status code \d+$/i.test(message) ? message : undefined
}
