const _values = new Map<string, number>()

export function setSignalValue(nodeId: string, channel: string, value: number): void {
  _values.set(`${nodeId}:${channel}`, value)
}

export function getSignalValue(nodeId: string, channel: string, fallback = 0): number {
  return _values.get(`${nodeId}:${channel}`) ?? fallback
}

// All currently-known channels emitted by a node, e.g. a sketch's output() calls.
export function getNodeSignals(nodeId: string): Record<string, number> {
  const out: Record<string, number> = {}
  const prefix = `${nodeId}:`
  for (const [key, value] of _values) {
    if (key.startsWith(prefix)) out[key.slice(prefix.length)] = value
  }
  return out
}

export function clearNodeSignals(nodeId: string): void {
  for (const key of _values.keys()) {
    if (key.startsWith(`${nodeId}:`)) _values.delete(key)
  }
}

export function clearAllSignals(): void {
  _values.clear()
}
