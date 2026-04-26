import { Buffer } from 'node:buffer'
import { createServer } from 'node:http'

import { spec } from './spec'

interface Pet {
  id: number
  name: string
  tag?: string
}

const pets: Pet[] = [
  { id: 1, name: 'Rex', tag: 'dog' },
  { id: 2, name: 'Whiskers', tag: 'cat' },
]
let nextId = 3

const PET_ID_PATH = /^\/pets\/(\d+)\/?$/

function send(res: import('node:http').ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

async function readJson(req: import('node:http').IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  for await (const chunk of req)
    chunks.push(chunk as Buffer)
  if (chunks.length === 0)
    return undefined
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://localhost')
    const method = req.method ?? 'GET'

    if (url.pathname === '/openapi.json' && method === 'GET') {
      send(res, 200, spec)
      return
    }

    if (url.pathname === '/pets' && method === 'GET') {
      const limit = Number(url.searchParams.get('limit') ?? pets.length)
      send(res, 200, pets.slice(0, limit))
      return
    }

    if (url.pathname === '/pets' && method === 'POST') {
      const body = await readJson(req) as { name?: string, tag?: string } | undefined
      if (!body?.name) {
        send(res, 400, { message: 'name is required' })
        return
      }
      const pet: Pet = { id: nextId++, name: body.name, ...(body.tag && { tag: body.tag }) }
      pets.push(pet)
      send(res, 201, pet)
      return
    }

    const idMatch = PET_ID_PATH.exec(url.pathname)
    if (idMatch) {
      const id = Number(idMatch[1])
      const idx = pets.findIndex(p => p.id === id)

      if (method === 'GET') {
        if (idx === -1) {
          send(res, 404, { message: 'Pet not found' })
          return
        }
        send(res, 200, pets[idx])
        return
      }

      if (method === 'DELETE') {
        if (idx === -1) {
          send(res, 404, { message: 'Pet not found' })
          return
        }
        const [removed] = pets.splice(idx, 1)
        send(res, 200, removed)
        return
      }
    }

    send(res, 404, { message: 'Not found' })
  }
  catch (error) {
    send(res, 500, { message: error instanceof Error ? error.message : String(error) })
  }
})

server.listen(3002, () => {
  console.log('Server running on http://localhost:3002')
  console.log('Spec:  http://localhost:3002/openapi.json')
  console.log('Try:   npx api-introspect list http://localhost:3002/openapi.json')
})
