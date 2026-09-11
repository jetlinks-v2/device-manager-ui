/** Adds the exact session zone to the producer-owned range without changing range values. */
export const withDevicePropertyAggregateTimeZone = <T extends object>(
  range: T | undefined,
  timeZone: unknown,
) => {
  const zoneId = String(timeZone || '').trim()
  return range && zoneId ? { ...range, zoneId } : range
}
