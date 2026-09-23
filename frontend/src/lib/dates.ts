const pad = (n: number) => String(n).padStart(2, '0')

/** Local calendar date as YYYY-MM-DD. Never use toISOString() for this: it is UTC. */
export function toDateString(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function todayString(now: Date = new Date()): string {
  return toDateString(now)
}

/** Pure calendar arithmetic on YYYY-MM-DD strings. Timezone independent. */
export function addDays(dateStr: string, delta: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const shifted = new Date(Date.UTC(y, m - 1, d + delta))
  return shifted.toISOString().slice(0, 10)
}
