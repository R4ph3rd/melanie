const _values = new Map<string, number>()

export function setSignalValue(nodeId: string, channel: string, value: number): void {
  _values.set(`${nodeId}:${channel}`, value)
}

export function getSignalValue(nodeId: string, channel: string, fallback = 0): number {
  return _values.get(`${nodeId}:${channel}`) ?? fallback
}

export function clearNodeSignals(nodeId: string): void {
  for (const key of _values.keys()) {
    if (key.startsWith(`${nodeId}:`)) _values.delete(key)
  }
}

export function clearAllSignals(): void {
  _values.clear()
}
