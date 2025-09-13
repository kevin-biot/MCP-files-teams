import { fetch } from 'undici'

export interface ChromaRestOptions {
  baseUrl: string
  tenant?: string
  database?: string
}

export class ChromaRest {
  private base: string
  private tenant: string
  private database: string

  constructor(opts: ChromaRestOptions) {
    this.base = opts.baseUrl.replace(/\/$/, '')
    this.tenant = opts.tenant ?? 'default'
    this.database = opts.database ?? 'default'
  }

  private td(path: string) {
    return `${this.base}/api/v2/tenants/${this.tenant}/databases/${this.database}${path}`
  }

  async heartbeat(): Promise<boolean> {
    const r = await fetch(`${this.base}/api/v2/heartbeat`)
    return r.status === 200
  }

  async ensureTenant(): Promise<void> {
    await fetch(`${this.base}/api/v2/tenants`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: this.tenant })
    })
  }

  async ensureDatabase(): Promise<void> {
    await fetch(`${this.base}/api/v2/tenants/${this.tenant}/databases`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: this.database })
    })
  }

  async ensureCollection(name: string): Promise<void> {
    const r = await fetch(this.td('/collections'), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    })
    if (![200, 201, 409].includes(r.status)) {
      const t = await r.text()
      throw new Error(`ensureCollection failed: ${r.status} ${t}`)
    }
  }

  async getCollection(name: string): Promise<any> {
    const r = await fetch(this.td(`/collections/${encodeURIComponent(name)}`))
    if (r.status !== 200) throw new Error(`getCollection(${name}) -> ${r.status}`)
    return r.json()
  }
}

