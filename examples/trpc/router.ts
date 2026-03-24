import { withIntrospection } from '@api-introspect/trpc'
import { initTRPC, TRPCError } from '@trpc/server'
import { z } from 'zod'

import type { Context } from './context'

const t = initTRPC.context<Context>().meta<{ description?: string, auth?: boolean }>().create()

const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.token)
    throw new TRPCError({ code: 'UNAUTHORIZED' })
  return next()
})

// In-memory data store
const users: { id: number, name: string, email: string }[] = [
  { id: 1, name: 'Alice', email: 'alice@example.com' },
  { id: 2, name: 'Bob', email: 'bob@example.com' },
]
let nextId = 3

const appRouter = t.router({
  user: t.router({
    list: t.procedure
      .meta({ description: 'List all users' })
      .query(() => users),

    getById: t.procedure
      .meta({ description: 'Get a user by ID' })
      .input(z.object({ id: z.number() }))
      .query(({ input }) => {
        const user = users.find(u => u.id === input.id)
        if (!user)
          throw new Error('User not found')
        return user
      }),

    create: protectedProcedure
      .meta({ description: 'Create a new user (requires auth)', auth: true })
      .input(z.object({ name: z.string(), email: z.string().email() }))
      .mutation(({ input }) => {
        const user = { id: nextId++, ...input }
        users.push(user)
        return user
      }),

    update: protectedProcedure
      .meta({ description: 'Update a user (requires auth)', auth: true })
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        email: z.string().email().optional(),
      }))
      .mutation(({ input }) => {
        const user = users.find(u => u.id === input.id)
        if (!user)
          throw new Error('User not found')
        if (input.name)
          user.name = input.name
        if (input.email)
          user.email = input.email
        return user
      }),

    delete: protectedProcedure
      .meta({ description: 'Delete a user (requires auth)', auth: true })
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => {
        const idx = users.findIndex(u => u.id === input.id)
        if (idx === -1)
          throw new Error('User not found')
        return users.splice(idx, 1)[0]
      }),
  }),

  health: t.router({
    check: t.procedure
      .meta({ description: 'Health check' })
      .query(() => ({ status: 'ok', timestamp: Date.now() })),
  }),
})

export const exampleRouter = withIntrospection(t, appRouter, {
  meta: { name: 'Example API' },
})
