import { Type } from '@sinclair/typebox'
import type { FastifyPluginAsync, FastifyRequest } from 'fastify'

const UserSchema = Type.Object({
  id: Type.Number(),
  name: Type.String(),
  email: Type.String(),
})

// In-memory data store
const users: { id: number, name: string, email: string }[] = [
  { id: 1, name: 'Alice', email: 'alice@example.com' },
  { id: 2, name: 'Bob', email: 'bob@example.com' },
]
let nextId = 3

async function requireAuth(request: FastifyRequest) {
  if (!request.headers.authorization?.startsWith('Bearer ')) {
    throw new Error('Unauthorized')
  }
}

export const userRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', {
    schema: {
      description: 'List all users',
      response: { 200: Type.Array(UserSchema) },
    },
  }, async () => users)

  fastify.get('/:id', {
    schema: {
      description: 'Get a user by ID',
      params: Type.Object({ id: Type.Number() }),
      response: { 200: UserSchema },
    },
  }, async (request) => {
    const { id } = request.params as { id: number }
    const user = users.find(u => u.id === id)
    if (!user)
      throw new Error('User not found')
    return user
  })

  fastify.post('/', {
    schema: {
      description: 'Create a new user (requires auth)',
      body: Type.Object({
        name: Type.String(),
        email: Type.String({ format: 'email' }),
      }),
      response: { 201: UserSchema },
    },
    config: { meta: { auth: true } },
    preHandler: requireAuth,
  }, async (request, reply) => {
    const { name, email } = request.body as { name: string, email: string }
    const user = { id: nextId++, name, email }
    users.push(user)
    return reply.status(201).send(user)
  })

  fastify.patch('/:id', {
    schema: {
      description: 'Update a user (requires auth)',
      params: Type.Object({ id: Type.Number() }),
      body: Type.Object({
        name: Type.Optional(Type.String()),
        email: Type.Optional(Type.String({ format: 'email' })),
      }),
      response: { 200: UserSchema },
    },
    config: { meta: { auth: true } },
    preHandler: requireAuth,
  }, async (request) => {
    const { id } = request.params as { id: number }
    const { name, email } = request.body as { name?: string, email?: string }
    const user = users.find(u => u.id === id)
    if (!user)
      throw new Error('User not found')
    if (name)
      user.name = name
    if (email)
      user.email = email
    return user
  })

  fastify.delete('/:id', {
    schema: {
      description: 'Delete a user (requires auth)',
      params: Type.Object({ id: Type.Number() }),
      response: { 200: UserSchema },
    },
    config: { meta: { auth: true } },
    preHandler: requireAuth,
  }, async (request) => {
    const { id } = request.params as { id: number }
    const idx = users.findIndex(u => u.id === id)
    if (idx === -1)
      throw new Error('User not found')
    return users.splice(idx, 1)[0]
  })
}

export const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', {
    schema: {
      description: 'Health check',
      response: {
        200: Type.Object({
          status: Type.String(),
          timestamp: Type.Number(),
        }),
      },
    },
  }, async () => ({ status: 'ok', timestamp: Date.now() }))
}
