import { createServer } from 'http'
import { ChromaRest } from './lib/chroma-rest.js'

const PORT = Number(process.env.PORT || process.env.MCP_PORT || 8080)
const CHROMA_URL = process.env.CHROMA_URL || 'http://chroma-svc:8000'
const TENANT = process.env.CHROMA_TENANT || 'default'
const DATABASE = process.env.CHROMA_DATABASE || 'default'
const COLLECTION = process.env.CHROMA_COLLECTION || 'llm_conversation_memory'

async function initialize() {
  const chroma = new ChromaRest({ baseUrl: CHROMA_URL, tenant: TENANT, database: DATABASE })
  // Wait for heartbeat
  const start = Date.now()
  while (Date.now() - start < 60_000) {
    try {
      if (await chroma.heartbeat()) break
    } catch {}
    await new Promise(r => setTimeout(r, 1000))
  }
  console.log(`✓ ChromaDB client initialized (url=${CHROMA_URL})`)

  try {
    await chroma.ensureTenant()
    await chroma.ensureDatabase()
    await chroma.ensureCollection(COLLECTION)
    const info = await chroma.getCollection(COLLECTION)
    console.log(`✓ Connected to ChromaDB collection '${COLLECTION}' (id=${info.id})`)
  } catch (e: any) {
    console.error('✗ Chroma ensure failed:', e?.message || e)
  }
}

function startHttp() {
  const srv = createServer((req, res) => {
    if (req.url === '/health') {
      res.statusCode = 200; res.end('ok')
    } else {
      res.statusCode = 200; res.end('MCP Files Teams')
    }
  })
  srv.listen(PORT, '0.0.0.0', () => {
    console.log(`MCP Files (REST) server listening on :${PORT}`)
  })
}

initialize().finally(startHttp)

