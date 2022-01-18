/* eslint-disable  @typescript-eslint/no-unsafe-return */
declare const Zotero: any

function to_s(obj: any): string {
  if (typeof obj === 'string') return obj
  if (Array.isArray(obj)) return JSON.stringify(obj)
  if (obj instanceof Set) return JSON.stringify(Array.from(obj)) // eslint-disable-line @typescript-eslint/no-unsafe-argument
  const s = `${obj}`
  if (s ==='[object Object]') return JSON.stringify(obj)
  return s
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function debug(...msg): void {
  const str = `Erdos: ${msg.map(to_s).join(' ')}`
  // console.error(str) // tslint:disable-line:no-console
  Zotero.debug(str)
}
