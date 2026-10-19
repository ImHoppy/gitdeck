type Pending = { resolve: (v: unknown) => void; reject: (e: Error) => void }

type Reply = { id: number; result?: unknown; error?: string }

type PushedEvent = { event: string; data: unknown }

type Listener = (data: unknown) => void

const RECONNECT_MS = 1000

export class GitdClient {
  private socket: WebSocket | null = null
  private nextId = 1
  private pending = new Map<number, Pending>()
  private ready: Promise<void> | null = null
  private listeners = new Map<string, Set<Listener>>()

  private connect(): Promise<void> {
    if (this.ready) return this.ready
    this.ready = new Promise((resolve, reject) => {
      const url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`
      const socket = new WebSocket(url)
      socket.onopen = () => resolve()
      socket.onerror = () => reject(new Error('gitd unreachable'))
      socket.onmessage = (m) => this.onMessage(JSON.parse(m.data))
      socket.onclose = () => this.onClose()
      this.socket = socket
    })
    return this.ready
  }

  private onMessage(msg: Reply | PushedEvent) {
    if ('event' in msg) this.listeners.get(msg.event)?.forEach((l) => l(msg.data))
    else this.onReply(msg)
  }

  on<T>(event: string, listener: (data: T) => void): () => void {
    const set = this.listeners.get(event) ?? new Set()
    set.add(listener as Listener)
    this.listeners.set(event, set)
    this.connect().catch(() => {})
    return () => set.delete(listener as Listener)
  }

  private onReply(reply: Reply) {
    const p = this.pending.get(reply.id)
    if (!p) return
    this.pending.delete(reply.id)
    if (reply.error !== undefined) p.reject(new Error(reply.error))
    else p.resolve(reply.result)
  }

  private onClose() {
    for (const p of this.pending.values()) p.reject(new Error('connection lost'))
    this.pending.clear()
    this.socket = null
    this.ready = null
    setTimeout(() => this.connect().catch(() => {}), RECONNECT_MS)
  }

  async call<T>(method: string, params: unknown = null): Promise<T> {
    await this.connect()
    const id = this.nextId++
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject })
      this.socket!.send(JSON.stringify({ id, method, params }))
    })
  }
}

export const gitd = new GitdClient()
