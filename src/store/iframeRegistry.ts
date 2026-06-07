// Maps a node id to its live preview iframe window, so the feedback bridge can
// route captured frames to a specific consumer iframe without React plumbing.
const wins = new Map<string, Window>()

export function registerIframe(nodeId: string, win: Window): void {
  wins.set(nodeId, win)
}

export function unregisterIframe(nodeId: string): void {
  wins.delete(nodeId)
}

export function getIframeWindow(nodeId: string): Window | undefined {
  return wins.get(nodeId)
}
