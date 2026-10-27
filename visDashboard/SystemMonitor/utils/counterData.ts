/** 相邻累计字节转换为B/s；首点、时间未推进或counter回退均保留缺口。 */
export const deriveBytesPerSecond = (
  currentTime: number | undefined,
  previousTime: number | undefined,
  currentBytes: number | undefined,
  previousBytes: number | undefined,
): number | undefined => {
  if ([currentTime, previousTime, currentBytes, previousBytes].some(value => value === undefined)) return undefined
  const elapsedSeconds = (currentTime! - previousTime!) / 1000
  const bytesDelta = currentBytes! - previousBytes!
  if (elapsedSeconds <= 0 || bytesDelta < 0) return undefined
  return bytesDelta / elapsedSeconds
}
